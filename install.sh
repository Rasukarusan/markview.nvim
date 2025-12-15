#!/bin/bash
# Markdown Preview インストールスクリプト

cd "$(dirname "$0")"

echo "依存パッケージをインストール中..."
npm install

echo "markコマンドをリンク中..."
npm link

echo "インストール完了!"
