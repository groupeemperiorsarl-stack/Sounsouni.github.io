#!/usr/bin/env python3
"""Nouvelle version : python3 tools/release.py 2026-10-14-i
Met le numéro de version dans index.html (window.SOUNSOUNI_VERSION) et sur
chaque fichier chargé (?v=...), pour que les téléphones prennent tout de suite
les nouveaux fichiers au lieu de leur copie gardée en mémoire."""
import re, sys
ver = sys.argv[1]
p = "index.html"
s = open(p, encoding="utf-8").read()
s = re.sub(r'window\.SOUNSOUNI_VERSION = "[^"]+"', 'window.SOUNSOUNI_VERSION = "%s"' % ver, s, count=1)
s = re.sub(r'(\.(?:js|css))\?v=[A-Za-z0-9_\-.]+', r'\1?v=' + ver, s)
open(p, "w", encoding="utf-8").write(s)
print("version", ver, "— références :", len(re.findall(r'\?v=' + re.escape(ver), s)))
