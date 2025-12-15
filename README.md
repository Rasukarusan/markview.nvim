# markview.nvim

Markdownをブラウザでライブプレビューする Neovim/Vim プラグイン & CLI ツール

![GitHub](https://img.shields.io/badge/license-MIT-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)

## Features

- **ライブリロード** - ファイル保存時に自動でブラウザを更新
- **GitHub風スタイル** - 見慣れたGitHubのMarkdownスタイルでプレビュー
- **はてな/Qiita対応** - ブログ投稿前の見た目確認が可能
- **カスタムCSS** - 独自スタイルの適用に対応
- **CLI対応** - エディタなしでも単体で使用可能

## Requirements

- Node.js 18+
- Neovim 0.5+ / Vim 8+

## Installation

### lazy.nvim

```lua
{
  "Rasukarusan/markview.nvim",
  build = "./install.sh",
  ft = "markdown",
}
```

### packer.nvim

```lua
use {
  "Rasukarusan/markview.nvim",
  run = "./install.sh",
  ft = "markdown",
}
```

### vim-plug

```vim
Plug 'Rasukarusan/markview.nvim', { 'do': './install.sh' }
```

### Manual

```bash
git clone https://github.com/Rasukarusan/markview.nvim.git
cd markview.nvim
./install.sh
```

## Usage

### Neovim/Vim

```vim
:MarkdownPreview          " プレビュー開始（GitHub風）
:MarkdownPreview hatena   " はてなブログ風でプレビュー
:MarkdownPreview qiita    " Qiita風でプレビュー
:MarkdownPreviewStop      " プレビュー停止
```

### CLI

```bash
mark <file.md> [options]
```

| オプション | 説明 |
|-----------|------|
| `-p, --port <number>` | ポート番号（デフォルト: 3333） |
| `-c, --css <path>` | カスタムCSSファイル |
| `-t, --template <path>` | HTMLテンプレートファイル |
| `--no-default-css` | デフォルトCSSを無効化 |
| `--no-open` | ブラウザを自動で開かない |

```bash
# 基本
mark README.md

# はてなブログ風テンプレート
mark README.md -t ./templates/hatena.html -c ./styles/hatena.css

# カスタムCSS + ポート指定
mark README.md -c ./my-style.css -p 8080
```

## Configuration

```vim
" markコマンドのパス
let g:markdown_preview_mark_cmd = 'mark'

" ポート番号
let g:markdown_preview_port = 3333

" デフォルトで使用するカスタムCSS
let g:markdown_preview_css = '~/my-style.css'
```

### Keymap

```vim
autocmd FileType markdown nnoremap <buffer> <leader>p :MarkdownPreview<CR>
autocmd FileType markdown nnoremap <buffer> <leader>P :MarkdownPreviewStop<CR>
```

## Available Styles

| スタイル | コマンド | 用途 |
|---------|---------|------|
| Default | `:MarkdownPreview` | GitHub風の汎用スタイル |
| Hatena | `:MarkdownPreview hatena` | はてなブログ投稿前の確認 |
| Qiita | `:MarkdownPreview qiita` | Qiita投稿前の確認 |

## Custom Templates

テンプレートでは以下のプレースホルダーが使用できます：

| プレースホルダー | 内容 |
|-----------------|------|
| `{{title}}` | ファイル名（拡張子なし） |
| `{{content}}` | 変換後のHTML |
| `{{css}}` | 読み込んだCSS |
| `{{date}}` | 現在の日付（YYYY/MM/DD） |

## License

MIT
