#!/usr/bin/env node

import { program } from 'commander';
import { marked } from 'marked';
import open from 'open';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultCssPath = path.join(__dirname, '..', 'styles', 'default.css');
const templatesDir = path.join(__dirname, '..', 'templates');

let currentMdPath = null;
let customCssPath = null;
let templatePath = null;
let useDefaultCss = true;

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
  const mdContent = fs.readFileSync(mdPath, 'utf-8');
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
</head>
<body>
  <article class="markdown-body">
${htmlContent}
  </article>
  <script>
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
