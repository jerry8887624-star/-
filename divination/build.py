#!/usr/bin/env python3
"""組合 src.html、css/ 與 data/ 下的資料，輸出可直接部署的 index.html。

用法：python3 divination/build.py [--fragment 輸出路徑]
  預設輸出 divination/index.html（完整 HTML，給 GitHub Pages）
  --fragment 另外輸出不含 <head> 骨架的片段（給 claude.ai Artifact）
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
src = (ROOT / 'src.html').read_text(encoding='utf-8')
for marker, path in [('/*APP_CSS*/', 'css/app.css'), ('/*KX_DATA*/', 'data/kangxi.js'), ('/*CONTENT*/', 'data/content.js'),
                     ('/*TAROT_DATA*/', 'data/tarot.js'), ('/*QIAN_DATA*/', 'data/qian.js'), ('/*DREAM_DATA*/', 'data/dream.js'), ('/*YIJING_DATA*/', 'data/yijing.js'), ('/*TONE_DATA*/', 'data/tones.js')]:
    assert marker in src, marker
    src = src.replace(marker, (ROOT / path).read_text(encoding='utf-8').strip())

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
<meta name="description" content="靈犀：每日運勢、塔羅占卜、求籤擲筊、紫微斗數、八字流年、姓名學改名與奇門遁甲。">
<meta name="theme-color" content="#F1EADB" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1C2849" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="靈犀">
<meta property="og:title" content="靈犀 LINGXI｜心有靈犀・一點通">
<meta property="og:description" content="心有靈犀・一點通｜每日運勢、塔羅、求籤擲筊、紫微流年、姓名改名、奇門方位">
<link rel="icon" type="image/svg+xml" href="icons/logo.svg?v=3">
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png?v=3">
<link rel="apple-touch-icon" href="icons/icon-180.png?v=3">
<link rel="manifest" href="manifest.webmanifest">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta property="og:type" content="website">
<meta property="og:url" content="https://jerry8887624-star.github.io/-/divination/">
<meta property="og:image" content="https://jerry8887624-star.github.io/-/divination/icons/og.png?v=3">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<style>:root{{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}body{{margin:0}}img{{max-width:100%}}[hidden]{{display:none!important}}</style>
{head}
</head>
<body>
{body}
</body>
</html>
'''
(ROOT / 'index.html').write_text(page, encoding='utf-8')
import hashlib
ver = hashlib.sha1(page.encode() + (ROOT / 'sw.src.js').read_bytes()).hexdigest()[:10]
(ROOT / 'sw.js').write_text((ROOT / 'sw.src.js').read_text(encoding='utf-8').replace('__VERSION__', ver), encoding='utf-8')
print('sw ->', ver)
print('page ->', ROOT / 'index.html', len(page.encode()) // 1024, 'KB')
