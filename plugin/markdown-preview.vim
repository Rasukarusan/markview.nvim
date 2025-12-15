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

let s:preview_job = 0

function! s:StartMarkdownPreview() abort
  let l:file = expand('%:p')

  if l:file !~# '\.md$'
    echohl WarningMsg | echo 'Markdownファイルではありません' | echohl None
    return
  endif

  if s:preview_job > 0
    echohl WarningMsg | echo '既に実行中です。:MarkdownPreviewStop で停止してください' | echohl None
    return
  endif

  let l:cmd = [g:markdown_preview_mark_cmd, l:file, '-p', string(g:markdown_preview_port)]

  " カスタムCSSが指定されている場合は追加
  if g:markdown_preview_css !=# ''
    let l:css_path = expand(g:markdown_preview_css)
    let l:cmd = l:cmd + ['-c', l:css_path]
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
  if s:preview_job > 0
    call jobstop(s:preview_job)
    let s:preview_job = 0
    echo 'プレビューを停止しました'
  else
    echohl WarningMsg | echo '実行中のプレビューはありません' | echohl None
  endif
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

command! MarkdownPreview call s:StartMarkdownPreview()
command! MarkdownPreviewStop call s:StopMarkdownPreview()
