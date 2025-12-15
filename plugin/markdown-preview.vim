" Markdown Preview Plugin
" プレビューサーバーを起動してブラウザでMarkdownをライブプレビュー

if exists('g:loaded_markdown_preview')
  finish
endif
let g:loaded_markdown_preview = 1

" markコマンドのパス（カスタマイズ可能）
if !exists('g:markdown_preview_mark_cmd')
  let g:markdown_preview_mark_cmd = 'mark'
endif

" ポート番号（カスタマイズ可能）
if !exists('g:markdown_preview_port')
  let g:markdown_preview_port = 3333
endif

" カスタムCSSファイルのパス（カスタマイズ可能）
if !exists('g:markdown_preview_css')
  let g:markdown_preview_css = ''
endif

" プラグインのディレクトリパスを取得
let s:plugin_root = expand('<sfile>:p:h:h')

let s:preview_job = 0

" スタイル名からCSS・テンプレートパスを解決する関数
" 戻り値: {'css': path, 'template': path} または {} (エラー時)
function! s:ResolveStylePaths(style) abort
  if a:style ==# ''
    return {'css': '', 'template': ''}
  endif

  " スタイル名を小文字に正規化
  let l:style_lower = tolower(a:style)

  " プラグイン内のstylesディレクトリからCSSを探す
  let l:css_path = s:plugin_root . '/styles/' . l:style_lower . '.css'

  if !filereadable(l:css_path)
    echohl WarningMsg | echo 'スタイル "' . a:style . '" が見つかりません: ' . l:css_path | echohl None
    return {}
  endif

  " 対応するテンプレートを探す（存在しなければ空）
  let l:template_path = s:plugin_root . '/templates/' . l:style_lower . '.html'
  if !filereadable(l:template_path)
    let l:template_path = ''
  endif

  return {'css': l:css_path, 'template': l:template_path}
endfunction

function! s:KillExistingProcess() abort
  " 既存のジョブを停止
  if s:preview_job > 0
    call jobstop(s:preview_job)
    let s:preview_job = 0
  endif

  " ポートを使用しているプロセスを強制終了
  let l:port = g:markdown_preview_port
  silent! call system('lsof -ti :' . l:port . ' | xargs kill -9 2>/dev/null')

  " 少し待機してポートが解放されるのを待つ
  sleep 100m
endfunction

function! s:StartMarkdownPreview(...) abort
  let l:file = expand('%:p')

  if l:file !~# '\.md$'
    echohl WarningMsg | echo 'Markdownファイルではありません' | echohl None
    return
  endif

  " 既存のプロセスを確実に停止
  call s:KillExistingProcess()

  let l:cmd = [g:markdown_preview_mark_cmd, l:file, '-p', string(g:markdown_preview_port)]

  " CSSパスとテンプレートパスを決定：引数 > グローバル設定
  let l:css_path = ''
  let l:template_path = ''

  " 引数でスタイル名が指定された場合
  if a:0 > 0 && a:1 !=# ''
    let l:paths = s:ResolveStylePaths(a:1)
    if empty(l:paths)
      return
    endif
    let l:css_path = l:paths.css
    let l:template_path = l:paths.template
  elseif g:markdown_preview_css !=# ''
    " グローバル設定のカスタムCSSを使用
    let l:css_path = expand(g:markdown_preview_css)
  endif

  if l:css_path !=# ''
    let l:cmd = l:cmd + ['-c', l:css_path]
  endif

  if l:template_path !=# ''
    let l:cmd = l:cmd + ['-t', l:template_path]
  endif

  let s:preview_job = jobstart(l:cmd, {
        \ 'on_stdout': function('s:OnOutput'),
        \ 'on_stderr': function('s:OnOutput'),
        \ 'on_exit': function('s:OnExit'),
        \ })

  if s:preview_job <= 0
    echohl ErrorMsg | echo 'プレビューの開始に失敗しました' | echohl None
    let s:preview_job = 0
  endif
endfunction

function! s:StopMarkdownPreview() abort
  call s:KillExistingProcess()
  echo 'プレビューを停止しました'
endfunction

function! s:OnOutput(job_id, data, event) abort
  for l:line in a:data
    if l:line !=# ''
      echom l:line
    endif
  endfor
endfunction

function! s:OnExit(job_id, code, event) abort
  let s:preview_job = 0
endfunction

command! -nargs=? -complete=customlist,s:CompleteStyles MarkdownPreview call s:StartMarkdownPreview(<q-args>)
command! MarkdownPreviewStop call s:StopMarkdownPreview()

" スタイル名の補完関数
function! s:CompleteStyles(ArgLead, CmdLine, CursorPos) abort
  let l:styles_dir = s:plugin_root . '/styles'
  let l:files = glob(l:styles_dir . '/*.css', 0, 1)
  let l:styles = []

  for l:file in l:files
    let l:name = fnamemodify(l:file, ':t:r')
    " default以外のスタイルを補完候補に追加
    if l:name !=# 'default'
      call add(l:styles, l:name)
    endif
  endfor

  " 入力中の文字でフィルタリング
  return filter(l:styles, 'v:val =~? "^" . a:ArgLead')
endfunction
