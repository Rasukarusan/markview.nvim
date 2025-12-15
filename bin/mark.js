#!/usr/bin/env node

import { program } from 'commander';
import { marked } from 'marked';
import open from 'open';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';

// mermaid用のカスタムレンダラー
const renderer = new marked.Renderer();
const originalCodeRenderer = renderer.code.bind(renderer);
renderer.code = function(code) {
  // codeオブジェクトから言語とテキストを取得
  const lang = code.lang || '';
  const text = code.text || '';
  if (lang === 'mermaid') {
    return `<pre class="mermaid">${text}</pre>`;
  }
  return originalCodeRenderer(code);
};
marked.setOptions({ renderer });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultCssPath = path.join(__dirname, '..', 'styles', 'default.css');
const templatesDir = path.join(__dirname, '..', 'templates');

let currentMdPath = null;
let customCssPath = null;
let templatePath = null;
let useDefaultCss = true;

/**
 * はてな記法の画像を変換
 * [f:id:username:20251211182309p:plain] → <figure>...</figure>
 * [f:id:username:20251211182309p:plain:w400] → 幅400px指定
 */
function convertHatenaFotolife(content) {
  // パターン: [f:id:ユーザー名:日時+形式:表示形式(:幅or高さ)?]
  // 形式: p=png, j=jpg, g=gif
  // 例: [f:id:rasukarusan:20251211182309p:plain]
  // 例: [f:id:rasukarusan:20251210140049j:plain:w200]
  const pattern = /\[f:id:([a-zA-Z0-9_-]+):(\d{14})([pjg]):([a-z]+)(?::([wh])(\d+))?\]/g;

  // 形式から拡張子へのマッピング
  const extMap = { p: 'png', j: 'jpg', g: 'gif' };

  return content.replace(pattern, (match, username, datetime, imgType, format, sizeType, sizeValue) => {
    // 日時から年月日を抽出（最初の8文字）
    const date = datetime.substring(0, 8);
    // ユーザー名の最初の文字
    const firstChar = username.charAt(0);
    // 拡張子
    const ext = extMap[imgType] || 'png';

    // 画像URL生成
    const imageUrl = `https://cdn-ak.f.st-hatena.com/images/fotolife/${firstChar}/${username}/${date}/${datetime}.${ext}`;

    // サイズ指定がある場合はstyle属性を追加
    let styleAttr = '';
    if (sizeType && sizeValue) {
      const cssProp = sizeType === 'w' ? 'width' : 'height';
      styleAttr = ` style="${cssProp}:${sizeValue}px"`;
    }

    // はてなブログ風のfigure要素を生成
    return `<figure class="figure-image figure-image-fotolife" title="">` +
      `<span itemscope="" itemtype="http://schema.org/Photograph">` +
      `<img src="${imageUrl}" loading="lazy" title="" class="hatena-fotolife"${styleAttr} itemprop="image">` +
      `</span>` +
      `<figcaption></figcaption>` +
      `</figure>`;
  });
}

function loadCss() {
  let css = '';
  if (useDefaultCss && fs.existsSync(defaultCssPath)) {
    css += fs.readFileSync(defaultCssPath, 'utf-8');
  }
  if (customCssPath && fs.existsSync(customCssPath)) {
    css += '\n' + fs.readFileSync(customCssPath, 'utf-8');
  }
  return css;
}

function generateHtml(mdPath) {
  let mdContent = fs.readFileSync(mdPath, 'utf-8');
  // はてな記法を変換
  mdContent = convertHatenaFotolife(mdContent);
  const htmlContent = marked(mdContent);
  const css = loadCss();
  const fileName = path.basename(mdPath, path.extname(mdPath));
  const now = new Date();
  const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;

  // テンプレートが指定されている場合はそれを使用
  if (templatePath && fs.existsSync(templatePath)) {
    let template = fs.readFileSync(templatePath, 'utf-8');
    return template
      .replace(/\{\{title\}\}/g, fileName)
      .replace(/\{\{content\}\}/g, htmlContent)
      .replace(/\{\{css\}\}/g, css)
      .replace(/\{\{date\}\}/g, dateStr);
  }

  // デフォルトのシンプルなテンプレート
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fileName}</title>
  <style>
${css}
  </style>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
</head>
<body>
  <article class="markdown-body">
${htmlContent}
  </article>
  <script>
    mermaid.initialize({ startOnLoad: true });
    const ws = new WebSocket('ws://' + location.host);
    ws.onmessage = (e) => {
      if (e.data === 'reload') {
        location.reload();
      }
    };
    ws.onclose = () => {
      console.log('サーバーが停止しました');
    };
  </script>
</body>
</html>`;
}

program
  .name('mark')
  .description('MarkdownファイルをブラウザでライブプレビューするCLI')
  .version('1.0.0');

program
  .argument('<file>', 'プレビューするMarkdownファイル')
  .option('-c, --css <path>', 'カスタムCSSファイルのパス')
  .option('-t, --template <path>', 'HTMLテンプレートファイルのパス')
  .option('--no-default-css', 'デフォルトCSSを適用しない')
  .option('-p, --port <number>', 'ポート番号', '3333')
  .option('--no-open', 'ブラウザを自動で開かない')
  .action(async (file, options) => {
    try {
      currentMdPath = path.resolve(file);
      customCssPath = options.css ? path.resolve(options.css) : null;
      templatePath = options.template ? path.resolve(options.template) : null;
      useDefaultCss = options.defaultCss;

      if (!fs.existsSync(currentMdPath)) {
        console.error(`エラー: ファイルが見つかりません: ${currentMdPath}`);
        process.exit(1);
      }

      if (customCssPath && !fs.existsSync(customCssPath)) {
        console.error(`エラー: CSSファイルが見つかりません: ${customCssPath}`);
        process.exit(1);
      }

      if (templatePath && !fs.existsSync(templatePath)) {
        console.error(`エラー: テンプレートファイルが見つかりません: ${templatePath}`);
        process.exit(1);
      }

      const port = parseInt(options.port, 10);

      const server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(generateHtml(currentMdPath));
      });

      const wss = new WebSocketServer({ server });

      const clients = new Set();
      wss.on('connection', (ws) => {
        clients.add(ws);
        ws.on('close', () => clients.delete(ws));
      });

      const notifyReload = () => {
        clients.forEach((ws) => {
          if (ws.readyState === 1) {
            ws.send('reload');
          }
        });
      };

      // fs.watchFileを使用（ポーリング方式、macOSで安定）
      fs.watchFile(currentMdPath, { interval: 300 }, (curr, prev) => {
        if (curr.mtime !== prev.mtime) {
          console.log(`ファイル更新を検知: ${path.basename(currentMdPath)}`);
          notifyReload();
        }
      });

      if (customCssPath) {
        fs.watchFile(customCssPath, { interval: 300 }, (curr, prev) => {
          if (curr.mtime !== prev.mtime) {
            console.log(`CSS更新を検知: ${path.basename(customCssPath)}`);
            notifyReload();
          }
        });
      }

      server.listen(port, () => {
        const url = `http://localhost:${port}`;
        console.log(`プレビューサーバー起動: ${url}`);
        console.log(`監視中: ${currentMdPath}`);
        console.log('Ctrl+C で停止');

        if (options.open) {
          open(url);
        }
      });

      process.on('SIGINT', () => {
        console.log('\nサーバーを停止します...');
        wss.close();
        server.close();
        process.exit(0);
      });

    } catch (error) {
      console.error('エラー:', error.message);
      process.exit(1);
    }
  });

program.parse();
