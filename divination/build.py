#!/usr/bin/env python3
"""組合 src.html 與 data/ 下的資料，輸出可直接部署的 index.html。

用法：python3 divination/build.py [--fragment 輸出路徑]
  預設輸出 divination/index.html（完整 HTML，給 GitHub Pages）
  --fragment 另外輸出不含 <head> 骨架的片段（給 claude.ai Artifact）
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
src = (ROOT / 'src.html').read_text(encoding='utf-8')
for marker, name in [('/*KX_DATA*/', 'kangxi.js'), ('/*YJ_DATA*/', 'yijing.js'), ('/*CONTENT*/', 'content.js')]:
    assert marker in src, marker
    src = src.replace(marker, (ROOT / 'data' / name).read_text(encoding='utf-8').strip())

if '--fragment' in sys.argv:
    out = pathlib.Path(sys.argv[sys.argv.index('--fragment') + 1])
    out.write_text(src, encoding='utf-8')
    print('fragment ->', out)

cut = src.index('</style>') + len('</style>')
head, body = src[:cut], src[cut:]
page = f'''<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="觀象閣：每日運勢、易經占卜、紫微斗數、八字流年、姓名學改名與奇門遁甲，一站看懂自己的時運。">
<meta name="theme-color" content="#e6ebe5" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0f1614" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="觀象閣">
<meta property="og:title" content="觀象閣">
<meta property="og:description" content="每日運勢 × 易經 × 紫微 × 流年 × 姓名 × 奇門">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='12' fill='%23b23a2b'/%3E%3Ctext x='32' y='45' font-size='38' text-anchor='middle' fill='%23fff7f2' font-family='serif'%3E%E8%A7%80%3C/text%3E%3C/svg%3E">
<style>:root{{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}body{{margin:0}}img{{max-width:100%}}[hidden]{{display:none!important}}</style>
{head}
</head>
<body>
{body}
</body>
</html>
'''
(ROOT / 'index.html').write_text(page, encoding='utf-8')
print('page ->', ROOT / 'index.html', len(page.encode()) // 1024, 'KB')
