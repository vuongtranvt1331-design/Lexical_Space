from PIL import Image
from collections import deque
from pathlib import Path
source=Path(r'C:/Users/ADMIN/.gemini/antigravity/brain/d8d70d79-fa03-4fea-8ae4-76caacb038a6/.user_uploaded/media_1794993611090_701d3332.png')
im=Image.open(source).convert('RGBA').crop((20,20,543,482))
pix=im.load(); w,h=im.size
# The outside is near-ivory; flood only the background connected to the crop edge.
seen=set(); todo=deque()
for x in range(w): todo.extend(((x,0),(x,h-1)))
for y in range(h): todo.extend(((0,y),(w-1,y)))
while todo:
 x,y=todo.popleft()
 if (x,y) in seen or x<0 or y<0 or x>=w or y>=h: continue
 seen.add((x,y)); r,g,b,a=pix[x,y]
 if r>=240 and g>=230 and b>=210 and max(r,g,b)-min(r,g,b)<45:
  pix[x,y]=(r,g,b,0)
  todo.extend(((x+1,y),(x-1,y),(x,y+1),(x,y-1)))
bbox=im.getbbox(); im=im.crop(bbox)
im=im.resize((im.width * 2, im.height * 2),Image.Resampling.NEAREST)
canvas=Image.new('RGBA',(1254,1254)); canvas.alpha_composite(im,((1254-im.width)//2,(1254-im.height)//2))
for p in ['apps/arcade/assets/logo/vocabulary_test.png','apps/vocabulary-test/assets/logo.png']:
 canvas.save(p)
print('subject bounds',bbox,'canvas',canvas.getbbox())

