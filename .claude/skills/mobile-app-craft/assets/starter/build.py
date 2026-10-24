#!/usr/bin/env python3
"""把 css/、data/ 內嵌進 src.html，輸出 index.html；產生帶版本雜湊的 sw.js 與給舊版讀取的 changes.json。
用法：python3 build.py [--fragment 輸出路徑]（fragment 給 claude.ai Artifact 預覽）"""
import pathlib, sys, hashlib
ROOT = pathlib.Path(__file__).resolve().parent
src = (ROOT / 'src.html').read_text(encoding='utf-8')
for marker, path in [('/*APP_CSS*/', 'css/app.css'), ('/*CHANGES*/', 'data/changes.json')]:
    assert marker in src, marker
    src = src.replace(marker, (ROOT / path).read_text(encoding='utf-8').strip())
(ROOT / 'changes.json').write_text((ROOT / 'data/changes.json').read_text(encoding='utf-8'), encoding='utf-8')
if '--fragment' in sys.argv:
    out = pathlib.Path(sys.argv[sys.argv.index('--fragment') + 1]); out.write_text(src, encoding='utf-8'); print('fragment ->', out)
cut = src.index('</style>') + len('</style>')
head, body = src[:cut], src[cut:]
page = f'''<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#F4EFE3" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#11143A" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon.svg">
<link rel="apple-touch-icon" href="icons/icon-180.png">
{head}
</head>
<body>
{body}
</body>
</html>
'''
(ROOT / 'index.html').write_text(page, encoding='utf-8')
ver = hashlib.sha1(page.encode() + (ROOT / 'sw.src.js').read_bytes()).hexdigest()[:10]
(ROOT / 'sw.js').write_text((ROOT / 'sw.src.js').read_text(encoding='utf-8').replace('__VERSION__', ver), encoding='utf-8')
print('sw ->', ver); print('page ->', ROOT / 'index.html', len(page.encode()) // 1024, 'KB')
