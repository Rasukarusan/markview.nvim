# markview.nvim

MarkdownファイルをブラウザでライブプレビューするNeovim/Vimプラグイン

## 特徴

- ファイル保存時に自動でブラウザをリロード
- GitHub風のスタイルでプレビュー
- カスタムCSSに対応
- CLIツールとしても単体で使用可能

## 必要要件

- Node.js 18以上
- Neovim 0.5以上 または Vim 8以上

## インストール

### 1. プラグインのインストール

**lazy.nvim:**

```lua
{
  "Rasukarusan/markview.nvim",
  build = "./install.sh",
  ft = "markdown",
}
```

**packer.nvim:**

```lua
use {
  "Rasukarusan/markview.nvim",
  run = "./install.sh",
  ft = "markdown",
}
```

**vim-plug:**

```vim
Plug 'Rasukarusan/markview.nvim', { 'do': './install.sh' }
```

### 2. 手動インストール

```bash
git clone https://github.com/Rasukarusan/markview.nvim.git
cd markview.nvim
./install.sh
```

## 使い方

### Neovim/Vim

Markdownファイルを開いて以下のコマンドを実行：

```vim
:MarkdownPreview       " プレビュー開始
:MarkdownPreviewStop   " プレビュー停止
```

### CLIツール

```bash
mark <file.md>
```

**オプション:**

| オプション | 説明 |
|-----------|------|
| `-p, --port <number>` | ポート番号（デフォルト: 3333） |
| `-c, --css <path>` | カスタムCSSファイルのパス |
| `--no-default-css` | デフォルトCSSを適用しない |
| `--no-open` | ブラウザを自動で開かない |

**例:**

```bash
# 基本的な使い方
mark README.md

# カスタムCSSを適用
mark README.md -c ./my-style.css

# ポート変更 & ブラウザを開かない
mark README.md -p 8080 --no-open
```

## 設定

### Neovim/Vim設定

```vim
" markコマンドのパス（デフォルト: mark）
let g:markdown_preview_mark_cmd = 'mark'

" ポート番号（デフォルト: 3333）
let g:markdown_preview_port = 3333

" カスタムCSSファイルのパス（~展開に対応）
let g:markdown_preview_css = '~/my-style.css'
```

### キーマップ例

```vim
" Markdownファイルでのみ有効
autocmd FileType markdown nnoremap <buffer> <leader>p :MarkdownPreview<CR>
autocmd FileType markdown nnoremap <buffer> <leader>P :MarkdownPreviewStop<CR>
```

## ライセンス

MIT
