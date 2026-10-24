#!/usr/bin/env python3
"""從 starter 建立新 App：python3 new_app.py <目標資料夾> "<App 名稱>" [短名稱]"""
import shutil, sys, pathlib, datetime, subprocess
here = pathlib.Path(__file__).resolve().parent
dst = pathlib.Path(sys.argv[1]).resolve(); name = sys.argv[2]; short = sys.argv[3] if len(sys.argv) > 3 else name[:6]
assert not dst.exists() or not any(dst.iterdir()), f'{dst} 已存在且非空'
shutil.copytree(here.parent / 'assets' / 'starter', dst, dirs_exist_ok=True)
today = datetime.date.today(); d = f'{today.month} 月 {today.day} 日'
for f in ['src.html', 'manifest.webmanifest', 'data/changes.json']:
    p = dst / f; p.write_text(p.read_text(encoding='utf-8').replace('__APP_NAME__', name).replace('__APP_SHORT__', short).replace('__TODAY__', d), encoding='utf-8')
subprocess.run(['node', str(here / 'icons.cjs'), str(dst / 'icons')], check=True)
subprocess.run(['python3', str(dst / 'build.py')], check=True)
print('done ->', dst)
