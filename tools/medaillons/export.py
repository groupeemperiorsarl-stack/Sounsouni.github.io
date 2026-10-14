# Recadre chaque médaillon, carré 240 px, webp léger → img/cat/
from PIL import Image
import glob, os
src = '/tmp/claude-0/-home-claude/24c68de7-e3d6-5a53-a13a-e15c79004fc0/scratchpad/blender/hqB/'
dst = '/home/claude/sounsouni.github.io/img/cat/'; os.makedirs(dst, exist_ok=True)
tot = 0
for f in sorted(glob.glob(src + '*.png')):
    im = Image.open(f).convert('RGBA'); b = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    m = 6; im = im.crop((b[0] - m, b[1] - m, b[2] + m, b[3] + m)); s = max(im.size)
    c = Image.new('RGBA', (s, s), (0, 0, 0, 0)); c.paste(im, ((s - im.width) // 2, (s - im.height) // 2))
    c = c.resize((240, 240), Image.LANCZOS)
    out = dst + os.path.basename(f)[:-4] + '.webp'; c.save(out, 'WEBP', quality=84, method=6); tot += os.path.getsize(out)
print(len(glob.glob(dst + '*.webp')), 'images', tot // 1024, 'Ko')
