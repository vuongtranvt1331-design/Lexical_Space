"""Resize generated finale assets, preserving alpha and registration to the source hull."""
from pathlib import Path
import json
from PIL import Image
ROOT=Path(__file__).resolve().parents[3]
sources=json.loads(Path(__file__).with_name('ending-image-sources.json').read_text(encoding='utf-8'))['assets']
out=ROOT/'apps/space-dominators/assets/boss-six-ending';out.mkdir(parents=True,exist_ok=True)
original=Image.open(ROOT/'apps/space-dominators/assets/star-destroyer.png').convert('RGBA')
for key,spec in sources.items():
 im=Image.open(spec['path']).convert('RGBA');im=im.crop(im.getchannel('A').getbbox())
 if key=='hull':
  box=original.getchannel('A').getbbox();im=im.resize((box[2]-box[0],box[3]-box[1]),Image.Resampling.NEAREST)
  final=Image.new('RGBA',original.size);final.alpha_composite(im,box[:2]);name='hull-bitten.png'
 else:
  im.thumbnail((88,88),Image.Resampling.NEAREST);final=Image.new('RGBA',(96,96));final.alpha_composite(im,((96-im.width)//2,(96-im.height)//2));name='reactor-closed.png' if key=='closed' else 'reactor.png'
 final.save(out/name,optimize=True)
 print(name,final.size,final.getchannel('A').getextrema())
