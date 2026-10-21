#!/usr/bin/env python3
"""Nouvelle version : python3 tools/release.py 2026-10-14-i
Met le numéro de version dans index.html (window.SOUNSOUNI_VERSION) et sur
chaque fichier chargé (?v=...), pour que les téléphones prennent tout de suite
les nouveaux fichiers au lieu de leur copie gardée en mémoire."""
import re, sys
ver = sys.argv[1]
# Garde-fou anciens iPhone : un « regard en arrière » (?<= ou (?<! dans une
# expression régulière fait refuser TOUT le programme par Safari avant iOS
# 16.4 (écran noir, incident du 21/10/2026). On refuse de publier.
import glob
for f in glob.glob("js/*.js") + ["sw.js"]:
    txt = open(f, encoding="utf-8").read()
    for bad in ("(?<=", "(?<!"):
        if bad in txt:
            sys.exit("ARRÊT : %s contient %s (non compris par les anciens iPhone). Réécrire sans." % (f, bad))
p = "index.html"
s = open(p, encoding="utf-8").read()
s = re.sub(r'window\.SOUNSOUNI_VERSION = "[^"]+"', 'window.SOUNSOUNI_VERSION = "%s"' % ver, s, count=1)
s = re.sub(r'(\.(?:js|css))\?v=[A-Za-z0-9_\-.]+', r'\1?v=' + ver, s)
open(p, "w", encoding="utf-8").write(s)
print("version", ver, "— références :", len(re.findall(r'\?v=' + re.escape(ver), s)))
