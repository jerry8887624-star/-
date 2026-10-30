#!/usr/bin/env python3
"""產生帶版本雜湊的 sw.js（內容有變，手機上的離線快取就會換新）。用法：python3 build.py"""
import pathlib, hashlib
ROOT = pathlib.Path(__file__).resolve().parent
h = hashlib.sha1()
for p in sorted(ROOT.rglob('*')):
    if p.is_file() and p.name != 'sw.js' and 'worker' not in p.parts:
        h.update(str(p.relative_to(ROOT)).encode()); h.update(p.read_bytes())
ver = h.hexdigest()[:10]
(ROOT / 'sw.js').write_text((ROOT / 'sw.src.js').read_text(encoding='utf-8').replace('__VERSION__', ver), encoding='utf-8')
print('sw ->', ver)
