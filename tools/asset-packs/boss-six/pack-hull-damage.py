"""Pack generated whole-hull damage states; registration/resize only, never cut damage masks."""
from pathlib import Path
from PIL import Image,ImageDraw
import json,hashlib
ROOT=Path(__file__).resolve().parents[3]
data=json.loads(Path(__file__).with_name('hull-damage-atlas-sources.json').read_text(encoding='utf-8'))
out=ROOT/'apps/space-dominators/assets/boss-six-ending';original=Image.open(ROOT/'apps/space-dominators/assets/star-destroyer.png').convert('RGBA')
w,h=original.size;box=original.getchannel('A').getbbox();entries=[]
review=Image.new('RGB',(w*3,h*2+60),'#111e30');d=ImageDraw.Draw(review)
for variant in range(2):
 atlas=Image.new('RGBA',(w*3,h))
 for job in [j for j in data['images'] if j['set']==variant]:
  im=Image.open(job['path']).convert('RGBA');im=im.crop(im.getchannel('A').getbbox())
  im=im.resize((box[2]-box[0],box[3]-box[1]),Image.Resampling.NEAREST)
  frame=Image.new('RGBA',(w,h));frame.alpha_composite(im,box[:2]);x=(job['stage']-1)*w
  atlas.alpha_composite(frame,(x,0));review.paste(frame,(x,variant*(h+30)),frame);d.text((x+8,variant*(h+30)+h+6),job['id'],fill='white')
 path=out/f'hull-damage-{variant+1}.png';atlas.save(path,optimize=True)
 entries.append({'file':path.name,'width':w*3,'height':h,'frames':[{'stage':s,'x':(s-1)*w,'y':0,'width':w,'height':h} for s in range(1,4)],'regions':data['plans'][variant],'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
(out/'hull-damage-atlas.json').write_text(json.dumps({'frameWidth':w,'frameHeight':h,'variants':entries},indent=2)+'\n',encoding='utf-8')
review.save(ROOT/'docs/boss-six-hull-damage-review.png')
