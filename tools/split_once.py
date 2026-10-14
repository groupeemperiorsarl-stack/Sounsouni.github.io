#!/usr/bin/env python3
"""Découpe (une seule fois) l'ancien fichier unique index.html en :
   index.html (léger) + css/app.css + js/app.js + js/lang-fr.js / lang-en.js / lang-hi.js
   + img/e/<empreinte>.webp (images qui étaient collées dans le code).
Ensuite, ce sont ces fichiers qu'on modifie directement (tools/release.py met à jour
le numéro de version partout)."""
import re, os, hashlib, base64, sys

SRC = sys.argv[1] if len(sys.argv) > 1 else "index.html"
OUT = sys.argv[2] if len(sys.argv) > 2 else "."
s = open(SRC, encoding="utf-8").read()
ver = re.search(r'window\.SOUNSOUNI_VERSION = "([^"]+)"', s).group(1)
V = "?v=" + ver

# ---------- 1. images collées → fichiers ----------
os.makedirs(os.path.join(OUT, "img/e"), exist_ok=True)
seen = {}
def img_repl(m):
    kind, b64 = m.group(1), m.group(2)
    ext = {"webp": "webp", "png": "png", "jpeg": "jpg", "jpg": "jpg", "gif": "gif"}.get(kind, "bin")
    raw = base64.b64decode(b64)
    h = hashlib.sha1(raw).hexdigest()[:12]
    name = "img/e/%s.%s" % (h, ext)
    if name not in seen:
        open(os.path.join(OUT, name), "wb").write(raw)
        seen[name] = len(raw)
    return name
s = re.sub(r'data:image/(webp|png|jpe?g|gif);base64,([A-Za-z0-9+/=]+)', img_repl, s)

# ---------- 2. style principal → css/app.css ----------
m = re.search(r'\n    <style>\n(.*?)\n    </style>\n', s, re.S)
css = m.group(1)
assert len(css) > 50000, "style principal introuvable"
os.makedirs(os.path.join(OUT, "css"), exist_ok=True)
open(os.path.join(OUT, "css/app.css"), "w", encoding="utf-8").write(css + "\n")
s = s[:m.start()] + '\n    <link rel="stylesheet" href="css/app.css' + V + '">\n' + s[m.end():]

# ---------- 3. script principal → js/app.js ----------
scripts = [mm for mm in re.finditer(r'\n    <script>\n(.*?)\n    </script>', s, re.S)]
big = max(scripts, key=lambda mm: len(mm.group(1)))
js = big.group(1)
assert len(js) > 1000000

# ---------- 4. traductions → une langue par fichier ----------
a = js.index("\nconst TRANSLATIONS = {")
b = js.index("\n};", a) + 3
block = js[a:b]
pos = {l: block.index("\n  %s: {" % l) for l in ("fr", "en", "hi")}
order = sorted(pos, key=lambda l: pos[l])
os.makedirs(os.path.join(OUT, "js"), exist_ok=True)
for k, l in enumerate(order):
    start = pos[l] + len("\n  %s: " % l)
    end = pos[order[k + 1]] if k + 1 < len(order) else block.rindex("\n};")
    obj = block[start:end].rstrip().rstrip(",")
    assert obj.startswith("{") and obj.endswith("}"), l
    open(os.path.join(OUT, "js/lang-%s.js" % l), "w", encoding="utf-8").write(
        "// Sounsouni — textes en « %s » (chargé seulement si cette langue est utilisée)\n"
        "(window.SNS_LANG = window.SNS_LANG || {}).%s = %s;\n" % (l, l, obj))
js = js[:a] + "\n// Textes : un fichier par langue (js/lang-fr.js, lang-en.js, lang-hi.js) — voir snsEnsureLang().\nconst TRANSLATIONS = window.SNS_LANG || (window.SNS_LANG = {});\nif (!TRANSLATIONS.fr) TRANSLATIONS.fr = {};\n" + js[b:]
open(os.path.join(OUT, "js/app.js"), "w", encoding="utf-8").write(js + "\n")

loader = ('\n    <!-- Textes : le français toujours (langue de secours), et la langue choisie si c\'est une autre -->\n'
          '    <script src="js/lang-fr.js' + V + '"></script>\n'
          '    <script>(function () { var l = null; try { l = localStorage.getItem("sounsouni_language"); } catch (e) {}\n'
          '      if (!l) { var n = (navigator.language || navigator.userLanguage || "fr").toLowerCase(); l = n.indexOf("hi") === 0 ? "hi" : (n.indexOf("en") === 0 ? "en" : "fr"); }\n'
          '      if (l === "en" || l === "hi") document.write(\'<script src="js/lang-\' + l + \'.js' + V + '"><\\/script>\'); })();</script>\n'
          '    <script src="js/app.js' + V + '"></script>')
s = s[:big.start()] + loader + s[big.end():]
open(os.path.join(OUT, "index.html"), "w", encoding="utf-8").write(s)
print("version", ver, "| images", len(seen), sum(seen.values()) // 1024, "Ko | index", len(s.encode()) // 1024, "Ko | app.js", len(js.encode()) // 1024, "Ko | css", len(css.encode()) // 1024, "Ko")
for l in order: print("lang", l, os.path.getsize(os.path.join(OUT, "js/lang-%s.js" % l)) // 1024, "Ko")
