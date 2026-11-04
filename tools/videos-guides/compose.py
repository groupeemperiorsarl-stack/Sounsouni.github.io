# Monte la vidéo complète : calques + écrans + caméra + main + karaoké, son nettoyé.
import json, os, sys, re, unicodedata, subprocess, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from story import VIDEOS, chunks
from PIL import Image, ImageDraw, ImageFilter
D = os.path.dirname(os.path.abspath(__file__)); LY = D + "/layers"; SH = D + "/shots"
v = sys.argv[1]; V = VIDEOS[v]; PREVIEW = sys.argv[2:]  # liste de temps (s) pour aperçus
FPS = 30; INTRO = 2.6; OUTRO = 2.2
steps = json.load(open(D + "/" + V["audio"] + ".steps.json"))
boxes = json.load(open(SH + "/boxes.json"))
AUDIO = D + "/audio/%s_net.wav" % V["audio"]
adur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", AUDIO], capture_output=True, text=True).stdout)
TOTAL = INTRO + adur + OUTRO
CH = [chunks([w['w'] for w in s['words']]) for s in steps]
def norm(w):
    w = unicodedata.normalize("NFD", w.lower()); w = "".join(c for c in w if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]", "", w)
def ease(x): x = max(0.0, min(1.0, x)); return x * x * (3 - 2 * x)
def crop_alpha(im):
    return im.crop(im.getchannel("A").getbbox())
# ---------- Plans (beats) avec horaires ----------
beats = []
for si, st in enumerate(steps):
    toks = [(norm(w["w"]), w["s"]) for w in st["words"]]; toks = [t for t in toks if t[0]]
    pos = 0
    for cue, bt in V["plan"][si]:
        if cue is None: t = st["start"] - (0.3 if si else 0.5)
        else:
            q = [norm(x) for x in cue.split()]; q = [x for x in q if x]; found = None
            for i in range(pos, len(toks) - len(q) + 1):
                if [toks[i + j][0] for j in range(len(q))] == q: found = i; break
            if found is None: raise SystemExit("repère introuvable : étape %d « %s »" % (si + 1, cue))
            pos = found + 1; t = toks[found][1] - (0.45 if "tap" in bt else 0.12)
        b = dict(bt); b["t"] = max(0.0, t) + INTRO; b["step"] = si; beats.append(b)
beats.sort(key=lambda b: b["t"]); beats[0]["t"] = 0.0
# ---------- Images ----------
BG = Image.open(LY + "/%s/bg.png" % v).convert("RGB")
TITLE = Image.open(LY + "/%s/title.png" % v).convert("RGB")
PHONE = Image.open(LY + "/phone.png").convert("RGBA")
HAND = crop_alpha(Image.open(LY + "/hand.png").convert("RGBA")); HANDP = crop_alpha(Image.open(LY + "/hand_press.png").convert("RGBA"))
def tip(im):
    a = im.getchannel("A"); w, h = im.size
    for y in range(h):
        xs = [x for x in range(w) if a.getpixel((x, y)) > 150]
        if xs: return (sum(xs) / len(xs), y + 4)
TIP = tip(HAND); TIPP = tip(HANDP)
PX, PY = 152, 166; SX, SY, SW, SHH = 166, 180, 388, 840
MASK = Image.new("L", (SW, SHH), 0); ImageDraw.Draw(MASK).rounded_rectangle([0, 0, SW - 1, SHH - 1], 52, fill=255)
_cache = {}
def img(path, mode="RGBA"):
    if path not in _cache: _cache[path] = Image.open(path).convert(mode)
    return _cache[path]
def shot(name): return img(SH + "/%s.png" % name, "RGB")
def ill(name, k): return img(LY + "/%s/ill_%s_%d.png" % (v, name, k))
def cam(b):
    z = b.get("z", 1.0); cx, cy = 195, 422
    if b.get("f") and boxes[b["sh"]].get(b["f"]):
        x, y, bw, bh = boxes[b["sh"]][b["f"]]; cx, cy = x + bw / 2, y + bh / 2
        for key in ("f", "hl", "tap"):  # la cible entière doit rester visible en largeur
            bx = boxes[b["sh"]].get(b.get(key) or "")
            if bx: z = min(z, 390 / (bx[2] + 30))
    z = max(1.0, min(z, 1.4)); w, h = 390 / z, 844 / z
    x0 = min(max(cx - w / 2, 0), 390 - w); y0 = min(max(cy - h / 2, 0), 844 - h)
    return (x0, y0, w)
def lerp(a, b, p): return tuple(a[i] + (b[i] - a[i]) * p for i in range(len(a)))
def screen_img(name, c):
    x0, y0, w = c; h = w * 844 / 390
    return shot(name).crop((int(x0 * 2), int(y0 * 2), int((x0 + w) * 2), int((y0 + h) * 2))).resize((SW, SHH), Image.BILINEAR)
def to_screen(boxc, c):
    x0, y0, w = c; s = SW / w; x, y, bw, bh = boxc
    return (SX + (x - x0) * s, SY + (y - y0) * s, bw * s, bh * s)
def phone_view(b, prev, tb):
    """Contenu de l'écran pour le plan b (prev = plan précédent sur téléphone)."""
    c1 = cam(b); p = ease(tb / 0.6)
    if prev is not None and prev.get("sh"):
        c0 = cam(prev); c = lerp(c0, c1, p)
        if prev["sh"] != b["sh"] and tb < 0.4:
            a = screen_img(prev["sh"], c); bimg = screen_img(b["sh"], c)
            return Image.blend(a, bimg, ease(tb / 0.4)), c
    else: c = c1
    return screen_img(b["sh"], c), c
def card_frame(content_rgba_or_screen, is_ill):
    pass
def draw_highlight(fr, r, t):
    x, y, w, h = r; m = 10; pad = 7
    lay = Image.new("RGBA", (int(w + 2 * (m + pad)) + 2, int(h + 2 * (m + pad)) + 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay); pulse = 0.65 + 0.35 * math.sin(t * 5.0)
    rr = [m, m, m + w + 2 * pad, m + h + 2 * pad]
    d.rounded_rectangle(rr, 16, outline=(123, 203, 58, int(110 * pulse)), width=12)
    lay = lay.filter(ImageFilter.GaussianBlur(5)); d = ImageDraw.Draw(lay)
    d.rounded_rectangle(rr, 16, outline=(76, 175, 40, 255), width=4)
    fr.paste(lay, (int(x - m - pad), int(y - m - pad)), lay)
def ripple(fr, cx, cy, p):
    rad = 18 + 46 * p; a = int(200 * (1 - p))
    lay = Image.new("RGBA", (140, 140), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    d.ellipse([70 - rad, 70 - rad, 70 + rad, 70 + rad], fill=(123, 203, 58, a // 3), outline=(255, 255, 255, a), width=4)
    fr.paste(lay, (int(cx - 70), int(cy - 70)), lay)
def caption(t):
    ta = t - INTRO; si = 0
    for i, st in enumerate(steps):
        if ta >= st["start"] - 0.25: si = i
    st = steps[si]; k = sum(1 for w in st["words"] if w["s"] <= ta + 0.05)
    ch = CH[si]; ci = 0
    for i, (a, b_) in enumerate(ch):
        if k > a or (i == 0): ci = i
    # passe à la phrase suivante dès qu'elle commence
    a, b_ = ch[ci]
    return si, ci, max(0, min(k - a, b_ - a))
def frame(t):
    if t < INTRO - 0.5:
        return TITLE.copy()
    fr = BG.copy()
    # beat courant
    bi = max(i for i, b in enumerate(beats) if b["t"] <= t); b = beats[bi]; tb = t - b["t"]
    prevb = beats[bi - 1] if bi else None
    # contenu central
    def render_beat(bb, pb, tbb):
        out = Image.new("RGBA", (720, 1100), (0, 0, 0, 0))
        if "il" in bb:
            out.paste(ill(*bb["il"]), (PX - 40 - 122, PY - 40), ill(*bb["il"])) if False else None
            im = ill(*bb["il"]); out.paste(im, (30 - 40, PY - 40), im); return out, None
        pph = pb if (pb is not None and "sh" in pb) else None
        scr, c = phone_view(bb, pph, tbb)
        out.paste(PHONE, (PX - 40, PY - 40), PHONE)
        out.paste(scr, (SX, SY), MASK)
        return out, c
    cur, c = render_beat(b, prevb, tb)
    # changement de type (illustration <-> téléphone) ou d'illustration : fondu
    if prevb is not None and tb < 0.45 and (("il" in b) != ("il" in prevb) or ("il" in b and b["il"] != prevb["il"])):
        pp = beats[bi - 2] if bi >= 2 else None
        old, _ = render_beat(prevb, pp, 10)
        p = ease(tb / 0.45)
        if ("il" in b) and ("il" in prevb) and b["il"][0] == prevb["il"][0]:
            cur = Image.blend(old, cur, p)  # même scène, révélation progressive
        else:
            sc = 0.94 + 0.06 * p
            cw = cur.resize((int(720 * sc), int(1100 * sc)), Image.BILINEAR)
            tmp = Image.new("RGBA", (720, 1100), (0, 0, 0, 0)); tmp.paste(cw, ((720 - cw.size[0]) // 2, int((1100 - cw.size[1]) * 0.35)))
            cur = Image.blend(old, tmp, p)
    elif prevb is None or (t < INTRO + 0.4):
        pass
    fr.paste(cur, (0, 0), cur)
    # surlignage
    if c is not None and b.get("hl") and boxes[b["sh"]].get(b["hl"]) and tb > 0.35:
        draw_highlight(fr, to_screen(boxes[b["sh"]][b["hl"]], c), t)
    # main
    hand_pos = None; pressed = False; alpha = 1.0
    if c is not None and b.get("tap") and boxes[b["sh"]].get(b["tap"]):
        r = to_screen(boxes[b["sh"]][b["tap"]], cam(b)); tx, ty = r[0] + r[2] * 0.5, r[1] + r[3] * 0.55
        # point de départ : main précédente ou bas de l'écran
        sx, sy = 560, 1150
        if prevb is not None and prevb.get("tap") and prevb.get("sh") and boxes[prevb["sh"]].get(prevb["tap"]):
            r0 = to_screen(boxes[prevb["sh"]][prevb["tap"]], cam(prevb)); sx, sy = r0[0] + r0[2] * 0.5, r0[1] + r0[3] * 0.55
        mp = ease(tb / 0.55); hand_pos = (sx + (tx - sx) * mp, sy + (ty - sy) * mp)
        pressed = 0.6 < tb < 0.85
        if 0.62 < tb < 1.3: ripple(fr, tx, ty, (tb - 0.62) / 0.68)
    elif prevb is not None and prevb.get("tap") and "sh" in prevb and tb < 0.3 and boxes[prevb["sh"]].get(prevb["tap"]):
        r0 = to_screen(boxes[prevb["sh"]][prevb["tap"]], cam(prevb)); hand_pos = (r0[0] + r0[2] * 0.5, r0[1] + r0[3] * 0.55); alpha = 1 - tb / 0.3
    if hand_pos:
        H = HANDP if pressed else HAND; tp = TIPP if pressed else TIP
        if alpha < 1: H = H.copy(); H.putalpha(H.getchannel("A").point(lambda a: int(a * alpha)))
        fr.paste(H, (int(hand_pos[0] - tp[0]), int(hand_pos[1] - tp[1])), H)
    # pastille d'étape + sous-titres
    si, ci, k = caption(t)
    sp = img(LY + "/%s/spill%02d.png" % (v, si + 1)); sp = _cache.setdefault("spc%d" % si, crop_alpha(sp))
    fr.paste(sp, ((720 - sp.size[0]) // 2, 106), sp)
    cp = img(LY + "/%s/cap%02d_%02d_%02d.png" % (v, si + 1, ci, k)); fr.paste(cp, (0, 1016), cp)
    # barre de progression
    d = ImageDraw.Draw(fr); p = max(0, min(1, (t - INTRO) / adur))
    d.rounded_rectangle([40, 1266, 680, 1272], 3, fill=(205, 226, 190)); d.rounded_rectangle([40, 1266, 40 + max(6, 640 * p), 1272], 3, fill=(46, 125, 50))
    if t < INTRO:  # fondu depuis la carte titre
        fr = Image.blend(TITLE, fr, ease((t - (INTRO - 0.5)) / 0.5))
    if t > INTRO + adur + 0.6:
        fin = TITLE; fr = Image.blend(fr, fin, ease((t - INTRO - adur - 0.6) / 0.8))
    return fr
if PREVIEW:
    for ts in PREVIEW:
        frame(float(ts)).save(D + "/prev_%s_%s.jpg" % (v, ts), quality=88)
    sys.exit()
os.makedirs(D + "/out", exist_ok=True)
OUT = D + "/out/%s_complet.mp4" % v
N = int(TOTAL * FPS)
ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "720x1280", "-r", str(FPS), "-i", "-",
                       "-itsoffset", str(INTRO), "-i", AUDIO, "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                       "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-af", "apad", "-t", "%.3f" % TOTAL, "-movflags", "+faststart", OUT], stdin=subprocess.PIPE)
for n in range(N):
    ff.stdin.write(frame(n / FPS).tobytes())
    if n % 600 == 0: print(v, "image", n, "/", N, flush=True)
ff.stdin.close(); ff.wait()
json.dump({"intro": INTRO, "steps": [[s["start"] + INTRO, s["end"] + INTRO] for s in steps], "total": TOTAL}, open(D + "/out/%s_timing.json" % v, "w"))
print("fini", OUT)
