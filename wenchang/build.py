#!/usr/bin/env python3
"""產生帶版本雜湊的 sw.js（內容有變，手機上的離線快取就會換新），以及更新紀錄。用法：python3 build.py
更新紀錄寫在 data/changes.json 最前面：{v, n, d, items:[[標題, 白話說明]]}；App 偵測到新版會先列出內容。"""
import pathlib, hashlib, json
ROOT = pathlib.Path(__file__).resolve().parent
changes = json.loads((ROOT / 'data/changes.json').read_text(encoding='utf-8'))
(ROOT / 'changes.json').write_text(json.dumps(changes, ensure_ascii=False), encoding='utf-8')
(ROOT / 'js/changes.js').write_text('// 由 build.py 從 data/changes.json 產生，請勿手改\nexport const CHANGES = ' + json.dumps(changes, ensure_ascii=False) + ';\n', encoding='utf-8')
h = hashlib.sha1()
for p in sorted(ROOT.rglob('*')):
    if p.is_file() and p.name != 'sw.js' and 'worker' not in p.parts:
        h.update(str(p.relative_to(ROOT)).encode()); h.update(p.read_bytes())
ver = h.hexdigest()[:10]
(ROOT / 'sw.js').write_text((ROOT / 'sw.src.js').read_text(encoding='utf-8').replace('__VERSION__', ver), encoding='utf-8')
print('sw ->', ver)
