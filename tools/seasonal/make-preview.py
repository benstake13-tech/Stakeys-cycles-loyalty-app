import base64,json,html
from pathlib import Path
assets=Path('public/theme-assets')
files=[*sorted(assets.glob('*.glb')),*sorted(assets.glob('*.jpg'))]
encoded={p.name:'data:'+('model/gltf-binary' if p.suffix=='.glb' else 'image/jpeg')+';base64,'+base64.b64encode(p.read_bytes()).decode() for p in files}
s=Path('tools/seasonal/viewer-template.html').read_text().replace('__NOTICES__',html.escape((assets/'ASSET-NOTICES.txt').read_text())).replace('__ENGINE__',Path('preview/seasonal/preview-engine.js').read_text()).replace('__ASSETS__',json.dumps(encoded))
Path('preview/seasonal/Stakeys-Seasonal-Worlds.html').write_text(s)
print(len(s),'bytes')
