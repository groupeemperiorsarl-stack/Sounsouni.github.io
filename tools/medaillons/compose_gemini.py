# Place chaque objet (découpé de l'image Gemini) dans le cadre doré vide rendu par Blender
from PIL import Image, ImageFilter, ImageEnhance
import glob, os
D = os.path.dirname(os.path.abspath(__file__))
ring = Image.open(os.path.join(D, '..', 'blender', 'ring_empty.png')).convert('RGBA')
b = ring.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox(); m = 8
ring = ring.crop((b[0] - m, b[1] - m, b[2] + m, b[3] + m)); S = max(ring.size)
base = Image.new('RGBA', (S, S), (0, 0, 0, 0)); base.paste(ring, ((S - ring.width) // 2, (S - ring.height) // 2))
SCALE = {'ball': 0.70, 'phone': 0.74, 'apps': 0.76, 'gift': 0.74, 'djembe': 0.78}
for f in sorted(glob.glob(os.path.join(D, 'cut_*.png'))):
    k = os.path.basename(f)[4:-4]
    ob = Image.open(f).convert('RGBA')
    ob = ImageEnhance.Contrast(ob).enhance(1.04); ob = ImageEnhance.Color(ob).enhance(1.06)
    t = SCALE.get(k, 0.80) * S; r = t / max(ob.size)
    ob = ob.resize((max(1, int(ob.width * r)), max(1, int(ob.height * r))), Image.LANCZOS)
    x = (S - ob.width) // 2; y = int(S * 0.52 - ob.height / 2)
    out = base.copy()
    # ombre douce posée sur le velours
    sh = Image.new('RGBA', ob.size, (8, 30, 12, 0)); sh.putalpha(ob.getchannel('A').point(lambda v: int(v * 0.55)))
    pad = 40; shc = Image.new('RGBA', (ob.width + 2 * pad, ob.height + 2 * pad), (0, 0, 0, 0)); shc.paste(sh, (pad, pad))
    shc = shc.filter(ImageFilter.GaussianBlur(S * 0.018))
    out.alpha_composite(shc, (x - pad + int(S * 0.012), y - pad + int(S * 0.028)))
    out.alpha_composite(ob, (x, y))
    out.save(os.path.join(D, 'med', k + '.png'))
    out.resize((240, 240), Image.LANCZOS).save('/home/claude/sounsouni.github.io/img/cat/' + k + '.webp', 'WEBP', quality=86, method=6)
print('ok', len(glob.glob(os.path.join(D, 'med', '*.png'))))
