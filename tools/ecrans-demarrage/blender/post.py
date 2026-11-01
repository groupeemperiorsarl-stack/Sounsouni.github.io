"""Finitions « cinéma » : halo lumineux (bloom), rayons du soleil, vignette, léger grain.
python3 post.py entree.png sortie.png"""
import sys, json, numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, map_coordinates
src, out = sys.argv[1], sys.argv[2]
im = np.asarray(Image.open(src).convert("RGB")).astype(np.float32) / 255
H, W, _ = im.shape
try: info = json.load(open(src + ".json"))
except Exception: info = {"sun": [.5, .45], "moment": "final"}
lum = im @ np.array([.2126, .7152, .0722], np.float32)
# halo : ce qui brille déborde doucement
br = np.clip((lum - .82) / .18, 0, 1)[..., None] * im
bloom = gaussian_filter(br, (W * .012, W * .012, 0)) * .55 + gaussian_filter(br, (W * .05, W * .05, 0)) * .45
res = im + bloom * {"aube": 1.1, "impact": .8}.get(info["moment"], .45)
# rayons : flou radial des zones lumineuses vers le soleil
sx, sy = info["sun"][0] * W, info["sun"][1] * H
if 0 < sy < H * 1.1 and info["moment"] != "aube":
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    acc = np.zeros_like(im); n = 48
    for k in range(n):
        s = 1 - k / n * .42
        cx = sx + (xx - sx) * s; cy = sy + (yy - sy) * s
        for c in range(3): acc[..., c] += map_coordinates(br[..., c], [cy, cx], order=1, mode="constant")
    hz = np.clip((sy + H * .1 - yy) / (H * .08), 0, 1)[..., None]
    res += acc / n * .4 * hz * np.array([1, .85, .6], np.float32)
# vignette douce + grain fin
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
v = 1 - .28 * (((xx / W - .5) ** 2 + (yy / H - .48) ** 2 * .6) / .32)
res *= np.clip(v, .55, 1)[..., None]
res += np.random.default_rng(1).normal(0, .008, res.shape).astype(np.float32)
Image.fromarray((np.clip(res, 0, 1) * 255).astype(np.uint8)).save(out)
