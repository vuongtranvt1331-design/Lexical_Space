"""Draw the Vocabulary Test arcade logo (requires Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SIZE = 418  # Integer scaling preserves the intentionally chunky pixels.
image = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
d = ImageDraw.Draw(image)
ink = '#17102e'


def poly(points, fill, outline=ink, width=4):
    d.polygon(points, fill=fill)
    if outline:
        d.line(points + [points[0]], fill=outline, width=width, joint='curve')


def rect(box, fill, outline=ink, width=4):
    d.rectangle(box, fill=fill, outline=outline, width=width)


def star(x, y, radius, color):
    pts = [(x, y-radius), (x+radius//4, y-radius//4),
           (x+radius, y), (x+radius//4, y+radius//4),
           (x, y+radius), (x-radius//4, y+radius//4),
           (x-radius, y), (x-radius//4, y-radius//4)]
    poly(pts, color, ink, 3)
    d.rectangle((x-1, y-radius//2, x+1, y+1), fill='#fff6aa')


def title(text, center, y, size, fill):
    # Render to the low-resolution canvas: enlarged pixels are crisp, including type.
    font = ImageFont.truetype('C:/Windows/Fonts/impact.ttf', size)
    bounds = d.textbbox((0, 0), text, font=font, stroke_width=0)
    x = center - (bounds[2] - bounds[0]) / 2
    d.text((x, y), text, font=font, fill=fill, stroke_width=3,
           stroke_fill=ink)


# A radiating arcade crest gives the logo a silhouette without a solid background.
poly([(209,24),(227,43),(241,30),(256,54),(278,48),(287,73),
      (314,72),(316,96),(340,103),(332,126),(354,143),(340,161),
      (351,183),(329,195),(334,220),(309,228),(304,255),(277,254),
      (262,276),(241,264),(219,281),(200,267),(179,279),(162,260),
      (139,267),(128,244),(103,244),(100,219),(77,208),(84,184),
      (66,166),(80,147),(72,124),(96,113),(99,88),(124,89),
      (136,65),(159,71),(176,48),(191,56)], '#1048a1', ink, 6)
poly([(209,38),(225,58),(241,45),(252,68),(275,62),(280,85),
      (303,86),(303,106),(326,112),(317,132),(338,146),(325,162),
      (335,181),(316,190),(320,212),(298,217),(293,242),(272,240),
      (260,258),(240,248),(219,264),(200,251),(180,262),(164,245),
      (143,251),(133,230),(114,230),(113,210),(91,200),(100,182),
      (82,165),(96,148),(88,132),(108,122),(111,101),(131,102),
      (143,80),(162,86),(178,64),(192,71)], '#26b8e4', None)
# Inner highlights and arcade confetti.
for box, color in [((117,108,125,115),'#a4f8f6'), ((286,104,292,111),'#a4f8f6'),
                   ((92,177,98,184),'#ffe871'), ((320,171,326,178),'#ffe871'),
                   ((130,235,137,242),'#f36ab4'), ((284,224,291,231),'#f36ab4')]:
    d.rectangle(box, fill=color)
star(72, 105, 17, '#ffe04c')
star(350, 95, 19, '#ffe04c')
star(55, 230, 13, '#ff72bd')
star(359, 224, 14, '#ffe04c')

# Clipboard: stepped pixel corners, thick navy border and warm paper.
poly([(117,75),(139,75),(139,68),(279,68),(279,75),(301,75),
      (301,88),(309,88),(309,267),(301,267),(301,279),(117,279),
      (117,271),(109,271),(109,88),(117,88)], '#132f7b', ink, 6)
poly([(122,84),(144,84),(144,78),(274,78),(274,84),(296,84),
      (296,93),(300,93),(300,260),(294,260),(294,269),(122,269)], '#3579df', None)
d.rectangle((119,97,126,255), fill='#68c7ff')
rect((132,96,287,260), '#fff2cb', '#0d2256', 4)
d.rectangle((140,104,279,252), fill='#fff9e5')
d.rectangle((140,236,279,252), fill='#f2d8a9')
# Paper details: checkboxes, teal checks and short writing lines.
for y, line_len in [(122,93),(151,77),(180,89),(209,67)]:
    rect((146,y,161,y+15), '#fffdf4', '#274176', 2)
    d.line([(148,y+7),(153,y+12),(161,y+3)], fill='#16bd9a', width=4, joint='curve')
    d.rectangle((169,y+2,169+line_len,y+5), fill='#5474a5')
    d.rectangle((169,y+10,169+line_len-24,y+12), fill='#c5d5d5')
# Gold clip with inset opening.
poly([(173,64),(182,64),(182,54),(190,54),(190,48),(228,48),
      (228,54),(236,54),(236,64),(245,64),(245,72),(251,72),
      (251,88),(167,88),(167,72),(173,72)], '#f5a900', ink, 5)
d.rectangle((176,72,242,80), fill='#ffdc4b')
d.rectangle((194,55,224,65), fill='#ffe970')
rect((201,57,217,68), '#77511e', ink, 2)
d.rectangle((174,82,245,85), fill='#c77a00')

# A pencil crossing the lower-right edge, drawn as bold stepped polygons.
poly([(266,228),(271,209),(327,139),(337,129),(348,128),(361,139),
      (362,149),(355,160),(297,229),(279,239)], '#f5bd29', ink, 6)
poly([(278,214),(332,148),(341,154),(288,222)], '#ffe75b', None)
poly([(288,222),(341,154),(350,162),(295,229)], '#ef9419', None)
poly([(266,228),(277,214),(295,229),(279,239),(264,242)], '#f6d1a6', ink, 3)
poly([(264,242),(268,231),(277,237)], '#23233b', None)
poly([(327,139),(335,128),(344,123),(358,134),(363,143),(355,154)], '#a3b9db', ink, 4)
d.line([(333,133),(355,151)], fill='#e8f4ff', width=3)
poly([(341,124),(348,115),(356,112),(368,115),(377,124),(379,134),
      (369,145)], '#f15c89', ink, 5)
d.line([(350,119),(358,119),(368,128)], fill='#ffafc1', width=4)

# Gold A+ award badge, with a pixel-stepped rim and ribbons.
poly([(79,240),(100,246),(112,274),(102,288),(91,279),(78,284)], '#ef4f7c', ink, 4)
poly([(109,244),(128,247),(135,283),(123,278),(113,288),(103,270)], '#c93b83', ink, 4)
badge = [(102,185),(113,188),(119,184),(127,191),(137,193),(139,202),
         (146,209),(142,218),(145,227),(138,234),(135,244),(125,246),
         (118,252),(109,248),(100,251),(93,244),(83,242),(81,232),
         (75,224),(79,215),(76,206),(84,200),(87,191),(97,190)]
poly(badge, '#f39a13', ink, 5)
poly([(107,194),(119,197),(130,204),(135,216),(132,229),(124,237),
      (110,241),(97,237),(88,228),(86,216),(91,203),(98,197)], '#ffe060', '#b75a12', 3)
d.line([(93,213),(98,203),(109,200),(120,202)], fill='#fff7ae', width=3)
title('A+', 111, 201, 24, '#fff8d5')

# A solid two-tier nameplate anchors the composition and is not a banner.
poly([(45,284),(56,284),(56,277),(362,277),(362,284),(373,284),
      (373,343),(365,343),(365,354),(53,354),(53,346),(45,346)], '#0d2255', ink, 7)
poly([(53,291),(63,291),(63,285),(355,285),(355,291),(365,291),
      (365,336),(357,336),(357,346),(61,346),(61,338),(53,338)], '#2468bf', None)
d.rectangle((62,289,355,293), fill='#79e9ff')
d.rectangle((61,338,357,343), fill='#124295')
title('VOCABULARY', 209, 286, 39, '#fff1a2')
title('TEST', 209, 319, 32, '#ffffff')
star(75, 326, 8, '#ffe04c')
star(343, 326, 8, '#ffe04c')
# Small lower accent pixels finish the silhouette.
for x, y, color in [(147,365,'#ffdb4a'), (158,369,'#ff83b8'),
                     (257,365,'#ff83b8'), (268,369,'#ffdb4a')]:
    d.rectangle((x,y,x+5,y+5), fill=color)

output = image.resize((1254, 1254), Image.Resampling.NEAREST)
for path in (ROOT / 'apps/arcade/assets/logo/vocabulary_test.png',
             ROOT / 'apps/vocabulary-test/assets/logo.png'):
    path.parent.mkdir(parents=True, exist_ok=True)
    output.save(path, format='PNG', optimize=True)
    print(f'Saved {path} ({output.width}x{output.height} {output.mode})')
