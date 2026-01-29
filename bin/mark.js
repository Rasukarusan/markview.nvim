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
 * はてな記法のリンク埋め込みを変換
 * [URL:title] → <a>リンク</a>
 * [URL:embed] or [URL:embed:cite] → はてなブログカード
 */
function convertHatenaEmbed(content) {
  // [URL:embed] または [URL:embed:cite] → はてなブログカード
  const embedPattern = /\[(https?:\/\/[^\]]+):embed(?::cite)?\]/g;
  content = content.replace(embedPattern, (match, url) => {
    const encodedUrl = encodeURIComponent(url);
    const domain = new URL(url).hostname;
    return `<p><iframe src="https://hatenablog-parts.com/embed?url=${encodedUrl}" ` +
      `title="" class="embed-card embed-webcard" scrolling="no" frameborder="0" ` +
      `style="display: block; width: 100%; height: 155px; max-width: 500px; margin: 10px 0px;" loading="lazy"></iframe>` +
      `<cite class="hatena-citation"><a href="${url}" target="_blank" rel="noopener noreferrer">${domain}</a></cite></p>`;
  });

  // [URL:title] → シンプルなリンク
  const titlePattern = /\[(https?:\/\/[^\]]+):title\]/g;
  content = content.replace(titlePattern, (match, url) => {
    return `<p><a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a></p>`;
  });

  return content;
}

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
  mdContent = convertHatenaEmbed(mdContent);
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
        return;
      }
      // スクロール同期メッセージを処理
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'scroll') {
          const { line, total } = data;
          // 行番号に基づいてスクロール位置を計算（比率ベース）
          const scrollRatio = (line - 1) / Math.max(total - 1, 1);
          const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
          const targetScroll = Math.round(maxScroll * scrollRatio);
          window.scrollTo({ top: targetScroll, behavior: 'smooth' });
        }
      } catch (err) {
        // JSON以外のメッセージは無視
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

      // 現在のMarkdownファイルの総行数を取得
      let totalLines = 0;
      const updateTotalLines = () => {
        const content = fs.readFileSync(currentMdPath, 'utf-8');
        totalLines = content.split('\n').length;
      };
      updateTotalLines();

      // WebSocketクライアントへのスクロール通知用関数（後で定義）
      let notifyScroll = null;

      const server = http.createServer((req, res) => {
        // スクロール同期API
        if (req.method === 'POST' && req.url === '/scroll') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              const { line, total } = data;
              if (notifyScroll) {
                notifyScroll(line, total || totalLines);
              }
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true }));
            } catch (e) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
          });
          return;
        }

        // 通常のHTMLプレビュー
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

      // スクロール位置をブラウザに通知
      notifyScroll = (line, total) => {
        const scrollData = JSON.stringify({ type: 'scroll', line, total });
        clients.forEach((ws) => {
          if (ws.readyState === 1) {
            ws.send(scrollData);
          }
        });
      };

      // fs.watchFileを使用（ポーリング方式、macOSで安定）
      fs.watchFile(currentMdPath, { interval: 300 }, (curr, prev) => {
        if (curr.mtime !== prev.mtime) {
          console.log(`ファイル更新を検知: ${path.basename(currentMdPath)}`);
          updateTotalLines();
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
