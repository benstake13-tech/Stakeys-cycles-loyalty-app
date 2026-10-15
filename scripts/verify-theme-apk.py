#!/usr/bin/env python3
"""Fail a build if any packaged seasonal asset differs from the verified local bytes."""
from pathlib import Path
import hashlib,json,sys,zipfile,subprocess
root=Path(__file__).resolve().parent.parent
sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
for arg in sys.argv[1:]:
 with zipfile.ZipFile(arg) as apk:
  report=[]
  for asset in sorted((root/'public/theme-assets').iterdir()):
   if not asset.is_file():continue
   packed=apk.read('assets/public/theme-assets/'+asset.name)
   assert hashlib.sha256(packed).digest()==hashlib.sha256(asset.read_bytes()).digest(),f'APK has stale asset: {asset.name}'
   report.append(asset.name)
  scripts=[apk.read(n) for n in apk.namelist() if n.startswith('assets/public/assets/') and n.endswith('.js')]
  assert any(b'Seasonal scene cancelled' in b and b'weighted-cloth' in b for b in scripts),'APK does not contain the app renderer chunk'
  metadata=json.loads(apk.read('assets/public/theme-build.json'))
  assert metadata['sourceCommit']==sha,metadata
  assert metadata['surface'] in ['customer','staff'],metadata
  print(json.dumps({'apk':Path(arg).name,'sourceCommit':sha,'surface':metadata['surface'],'verifiedAssets':report}))
