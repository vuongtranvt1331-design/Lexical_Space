"""Normalize AI raster exports to the approved integer sprite cells; retain originals."""
import json
from pathlib import Path
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[3]
folder=ROOT/'apps/space-dominators/assets/sprites'
entries=json.loads((folder/'manifest.json').read_text(encoding='utf-8'))['assets']
sources={e['id']:e['path'] for e in json.loads(Path(__file__).with_name('generated-sources.json').read_text(encoding='utf-8'))}
sheet=Image.new('RGB',(800,((len(entries)+4)//5)*190),'#111e30'); draw=ImageDraw.Draw(sheet)
for i,e in enumerate(entries):
    if e['id'] not in sources: continue
    im=Image.open(sources[e['id']]).convert('RGBA')
    # Remove near-invisible generation padding; nearest-neighbor preserves pixel steps.
    alpha=im.getchannel('A').point(lambda x: 255 if x>24 else 0)
    bounds=alpha.getbbox()
    if not bounds: raise ValueError(e['id']+' is empty')
    im=im.crop(bounds); w,h=e['size']
    if e['id']=='proj_twin_cross':
        # The generation contains two examples; use one bolt, rendered twice by code.
        im=im.crop((0,0,im.width//2,im.height))
        im=im.crop(im.getchannel('A').getbbox())
    if e.get('repeatAxis')=='y':
        # Use the stable central beam strip, never stretch decorative endpoints.
        im=im.crop((0,im.height//3,im.width,im.height*2//3))
        im=im.resize((max(2,w-8),h),Image.Resampling.NEAREST)
        out=Image.new('RGBA',(w,h)); out.alpha_composite(im,((w-im.width)//2,0))
        out.paste(out.crop((0,0,w,1)),(0,h-1))
    else:
        ratio=min((w-8)/im.width,(h-8)/im.height)
        im=im.resize((max(1,round(im.width*ratio)),max(1,round(im.height*ratio))),Image.Resampling.NEAREST)
        out=Image.new('RGBA',(w,h));out.alpha_composite(im,((w-im.width)//2,(h-im.height)//2))
    target=folder/e['path'];target.parent.mkdir(parents=True,exist_ok=True);out.save(target,optimize=True)
    thumb=out.copy();thumb.thumbnail((130,145),Image.Resampling.NEAREST)
    x=(i%5)*160;y=(i//5)*190;sheet.paste(thumb,(x+(160-thumb.width)//2,y),thumb)
    draw.text((x+4,y+149),e['id'],fill='white')
sheet.save(ROOT/'docs/boss-six-sprite-review.png')
