#!/usr/bin/env python3
"""Fabrique le site vitrine : portail d'accueil (dans index.html) + logistique.html, services.html, a-propos.html.
Usage : python3 tools/site/build.py <version>"""
import re, sys, os, json
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
V = sys.argv[1] if len(sys.argv) > 1 else "dev"
WA = "22393010123"
FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700;800;900&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">'
LOGO = "img/e/210deb8220be.webp"
DESC_ORG = "Sounsouni, entreprise ouest-africaine née à Bamako : marché en ligne, logistique de la Chine et de l'Inde jusqu'au Mali (livraison, Points de Retrait, transit) et services aux entreprises (BTP, industrie, immobilier, digital, intelligence artificielle, énergie)."
SERVICES = [
 ("btp", "fa-helmet-safety", "BTP & Construction", "Bâtiments, routes, rénovation", "Études, construction de bâtiments et d'ouvrages, rénovation, suivi de chantier et fourniture de matériaux."),
 ("industrie", "fa-industry", "Solutions industrielles", "Machines, installation, maintenance", "Achat et importation d'équipements, installation de lignes de production, maintenance et pièces détachées."),
 ("immobilier", "fa-building", "Immobilier", "Vente, location, gestion", "Recherche, vente et location de terrains, maisons et bureaux, gestion locative pour les propriétaires."),
 ("digital", "fa-code", "Digital", "Sites web & applications", "Sites internet, boutiques en ligne et applications mobiles sur mesure, comme l'application Sounsouni."),
 ("ia", "fa-brain", "Intelligence artificielle", "Assistants, automatisation", "Assistants intelligents, automatisation des tâches, analyse de données et formation des équipes à l'IA."),
 ("energie", "fa-solar-panel", "Énergie", "Solaire, électricité", "Installations solaires, groupes électrogènes, réseaux électriques pour maisons, boutiques et usines."),
 ("sourcing", "fa-globe", "Import & Sourcing", "Chine, Inde, Émirats…", "Nos Pôles Sounsouni achètent et vérifient vos marchandises sur place, puis les acheminent jusqu'à Bamako."),
 ("conseil", "fa-briefcase", "Conseil & Services", "Projets d'entreprise", "Études de marché, montage de projets, accompagnement administratif et services généraux aux entreprises."),
]
M = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'vitrine.json')))
def mcard(x):
    return '<a class="mc" href="p/%s.html"><span class="mci"><img src="img/site/m-%s.webp" alt="%s" loading="lazy" width="480" height="600"></span><span class="mcc">%s</span><span class="mcn">%s</span><span class="mcp">%s</span></a>' % (x[0], x[0], x[2], x[1], x[2], x[3])
def carousel():
    r1 = ''.join(mcard(x) for x in M[0::2]); r2 = ''.join(mcard(x) for x in M[1::2])
    return ('<section class="sec mkt"><div class="wrap"><div class="k rv">Dans le marché en ce moment</div><h2 class="rv d1">Mode, montres, high-tech… <span class="serif" style="color:var(--g)">tout est là.</span></h2>'
            '<p class="lead rv d2">Faites glisser pour découvrir les articles de nos vendeurs, puis entrez dans le marché.</p></div>'
            '<div class="mrow-wrap"><button class="mnav prev" type="button" aria-label="Précédent"><i class="fa-solid fa-arrow-left"></i></button><button class="mnav next" type="button" aria-label="Suivant"><i class="fa-solid fa-arrow-right"></i></button>'
            '<div class="mrows" tabindex="0"><div class="mrow">' + r1 + '</div><div class="mrow">' + r2 + '</div></div></div>'
            '<div class="wrap"><a href="./" class="gobtn" data-portail-fermer style="max-width:520px;margin:22px auto 0"><i class="fa-solid fa-cart-shopping"></i> Cliquez ici pour accéder au marché <i class="fa-solid fa-arrow-right"></i></a></div></section>')
VIT = [  # image, nom, catégorie, prix, id de l'article
 ("ecouteurs", "Casque Bluetooth sans fil", "Électronique", "10 000 FCFA", "id-mtmt5uapmckhk"),
 ("chaussure", "Chaussure fermée homme", "Mode", "15 000 FCFA", "id-mtngoaype4xk7"),
 ("sac", "Sac à dos", "Accessoires", "8 500 FCFA", "id-mu5poikjiqmln"),
 ("lampe", "Lampe solaire", "Maison & énergie", "15 000 FCFA", "id-mtk0fal82tx0z"),
 ("hoverboard", "Hoverboard Giro Drive", "Loisirs", "75 000 FCFA", "id-mtk9h8m0jjnyy"),
]
def nav(on, portail=False):
    m = '<a href="./" data-portail-fermer>Marché</a>' if portail else '<a href="./#marche">Marché</a>'
    links = [("logistique.html", "Logistique"), ("services.html", "Services"), ("a-propos.html", "À propos")]
    l = m + "".join('<a href="%s"%s>%s</a>' % (h, ' class="on"' if on == h else "", t) for h, t in links)
    log = '<a href="%s" class="pill p-w"%s>Se connecter</a>' % ("./" if portail else "./#marche", " data-portail-fermer" if portail else "")
    return ('<div class="nav"><a class="b" href="%s"><img src="%s" alt="Sounsouni" width="34" height="34">Sounsouni</a><nav class="links">%s</nav>'
            '<div class="r"><a class="lnk" href="a-propos.html">À propos</a>%s</div></div>') % ("./#accueil" if not portail else "#accueil", LOGO, l, log)
def footer():
    return ('<footer class="foot"><div class="wrap cols"><div><div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><img src="%s" alt="" width="46" height="46"><b>SOUNSOUNI</b></div>'
            'Entreprise ouest-africaine née à Bamako : marché en ligne, logistique du dernier kilomètre et services aux entreprises.'
            '<div class="legal">RCCM : ML-BKO-01-2026-A-05755<br>D-U-N-S : 85-042-6646</div></div>'
            '<div><div class="h">CONTACT</div>Sotelco, face à Bougouba<br>Bamako, Mali<br><a href="tel:+22393010123">+223 93 01 01 23</a><a href="mailto:direction@sounsouni.pro">direction@sounsouni.pro</a></div>'
            '<div><div class="h">LIENS</div><a href="a-propos.html">À propos</a><a href="logistique.html">Logistique</a><a href="services.html">Services</a><a href="partenaires.html">Partenaires</a><a href="privacy.html">Confidentialité</a></div>'
            '</div><div class="wrap" style="margin-top:22px;opacity:.55;font-size:11px">© 2026 SOUNSOUNI — Bamako, Mali</div></footer>') % LOGO
def svc_cards(link=True):
    return "".join(('<a href="services.html#%s" class="rv">' if link else '<a href="#demande" data-svc="%s" class="rv">') % k
                   + '<i class="fa-solid %s"></i>Sounsouni<br>%s<small>%s</small></a>' % (ic, n, s) for k, ic, n, s, _ in SERVICES)
def network(title=True):
    return ('<section class="sec" id="reseau"><div class="k rv">Notre réseau</div><h2 class="rv d1">Bamako <span class="serif" style="color:var(--g)">s\'illumine.</span></h2>'
            '<p class="lead rv d2">De la Chine, de l\'Inde et des Émirats jusqu\'à Bamako, puis de quartier en quartier : chaque point lumineux est un quartier où Sounsouni livre.</p>'
            '<div class="maps"><div class="map rv" data-sns-map="monde"></div><div class="map rv d1" data-sns-map="bamako"></div></div>'
            '<div class="legend"><span><i style="background:#ffd54a"></i>Point de Retrait Sounsouni</span><span><i style="background:#c8ff8a"></i>Livraison express</span><span><i style="background:#9aa79c"></i>Quartier desservi</span></div>'
            '<div class="stats"><div><b class="counter" data-to="65">65</b><span>quartiers desservis</span></div><div><b class="counter" data-to="29">29</b><span>zones express</span></div><div><b class="counter" data-to="5">5</b><span>pays reliés</span></div><div><b class="counter" data-to="24" data-suf=" h">24 h</b><span>livraison à Bamako</span></div></div></section>')
JOURNEY = [("chine", "Achat en Chine", "Votre Pôle Sounsouni va chez le vendeur, vérifie l'article, la couleur, la quantité et la qualité."),
           ("avion", "Le grand voyage", "Par avion ou par bateau, votre colis traverse le monde. Vous suivez chaque étape dans l'application."),
           ("aeroport", "Scanné à Bamako", "Notre équipe récupère le lot et scanne chaque colis : « Arrivé » s'affiche aussitôt, chez vous et chez l'expéditeur."),
           ("moto", "En route", "Un livreur Sounsouni traverse la ville jusqu'à votre quartier — ou dépose le colis au Point de Retrait le plus proche."),
           ("remise", "Remis en main propre", "Vous donnez votre code secret, le colis est à vous. Simple, sûr, transparent.")]
def journey():
    POS = {"chine": "58% 50%", "avion": "62% 50%", "aeroport": "72% 50%", "moto": "48% 50%", "remise": "52% 50%"}
    sl = "".join('<div class="slide%s"><img src="img/site/%s.webp" alt="" style="object-position:%s" %s></div>' % (" on" if i == 0 else "", im, POS.get(im, "50% 50%"), 'loading="lazy"' if i else "") for i, (im, t, d) in enumerate(JOURNEY))
    tx = "".join('<div class="tx%s"><div class="num">0%d</div><div class="ttl">%s</div><p class="dsc">%s</p></div>' % (" on" if i == 0 else "", i + 1, t, d) for i, (im, t, d) in enumerate(JOURNEY))
    return ('<section class="journey" id="voyage"><div class="stage">' + sl + '<div class="shade"></div>'
            '<div class="head wrap"><div class="k" style="color:var(--glow)">Le voyage de votre colis</div></div>'
            '<img class="colis" src="img/site/colis-seul.webp" alt="">'
            '<div class="txt wrap">' + tx + '</div><div class="bar">' + "<span><b></b></span>" * len(JOURNEY) + '</div></div></section>')
def cine_hero(portail_mode, kicker, h1_lines, p, cta, bg="img/site/bamako-nuit.webp", on=None):
    h1 = "<br>".join('<span class="split"><span style="animation-delay:%.2fs">%s</span></span>' % (0.15 + i * 0.12, l) for i, l in enumerate(h1_lines))
    return ('<header class="cine-hero"><div class="bg" style="background-image:url(%s)"></div><div class="veil"></div>'
            '<div class="navx"><div class="wrap">%s</div></div>'
            '<img class="hero-colis fadein" style="animation-delay:.9s" src="img/site/colis-seul.webp" alt="">'
            '<div class="inner wrap"><div class="k fadein" style="color:var(--glow);animation-delay:.1s">%s</div><h1 style="margin-top:14px">%s</h1>'
            '<p class="fadein" style="animation-delay:.6s">%s</p><div class="cta fadein" style="animation-delay:.8s">%s</div></div>'
            '<div class="scrollcue">Défiler<i></i></div></header>') % (bg, nav(on, portail_mode), kicker, h1, p, cta)
def portail():
    vt = VIT[0]
    thumbs = "".join('<button type="button" data-vit data-nom="%s" data-cat="%s" data-prix="%s" data-href="p/%s.html"%s><img src="img/site/%s.webp" alt="%s" loading="lazy"></button>'
                     % (n, c, p, i, ' class="on"' if k == 0 else "", im, n) for k, (im, n, c, p, i) in enumerate(VIT))
    out = '<div id="portail" class="snsv" hidden>'
    out += cine_hero(True, "Sounsouni · Bamako", ["Tout", "Sounsouni,", '<span class="serif" style="color:var(--glow)">en un clic.</span>'],
                     "Le marché du Mali, la logistique du monde jusqu'à votre porte, et des services pour bâtir — une seule plateforme, née à Bamako.",
                     '<a href="./" class="pill p-w" data-portail-fermer>Entrer dans le marché</a><a href="#voyage" class="pill p-o">Voir le voyage d\'un colis</a>')
    out += ('<main class="wrap"><div class="doors" style="margin-top:56px">'
      '<div class="door market rv"><div class="k">01 — Marché</div><div class="t">Le marché<br><span class="serif">du Mali.</span></div>'
      '<p style="font-size:13.5px;color:#5e7462;margin-top:10px">Des milliers d\'articles de vendeurs vérifiés, livrés chez vous ou au Point de Retrait. Paiement Orange Money, Moov Money ou à la livraison.</p>'
      '<div class="mgrid">' + "".join('<a href="p/%s.html"><span class="mi ph"><img src="img/site/m-%s.webp" alt="%s" loading="lazy"></span><span class="mn">%s</span><span class="mp">%s</span></a>' % (x[0], x[0], x[2], x[2], x[3]) for x in (M[0], M[7], M[11], M[2])) + '</div>'
      '<a href="./" class="gobtn" data-portail-fermer><i class="fa-solid fa-cart-shopping"></i> Cliquez ici pour accéder au marché <i class="fa-solid fa-arrow-right"></i></a></div>'
      '<a href="logistique.html" class="door photo rv d1"><img class="ph" src="img/site/camionnette.webp" alt="" loading="lazy"><div class="k">02 — Logistique</div><div class="t">Du monde<br><span class="serif" style="color:var(--glow)">à votre porte.</span></div>'
      '<div style="font-size:13px;opacity:.85;margin-top:10px;padding-right:56px">Transit Chine · Inde → Bamako, livraison à domicile et Points de Retrait.</div><span class="go" style="background:var(--glow);color:var(--gd)"><i class="fa-solid fa-arrow-right"></i></span></a>'
      '</div></main>')
    out += carousel()
    out += journey()
    out += '<div class="darksec" style="margin-top:70px"><div class="wrap">' + network() + '</div></div>'
    out += ('<main class="wrap"><section class="sec"><div class="k rv">Sounsouni Services</div><h2 class="rv d1">Votre projet, <span class="serif">notre expertise.</span></h2>'
      '<p class="lead rv d2">Un besoin en construction, industrie, immobilier, digital ou intelligence artificielle ? Dites-le-nous : Sounsouni vous fait une offre.</p>'
      '<div class="svc-ph">'
      '<a href="services.html#btp" class="rv"><img src="img/site/btp.webp" alt="" loading="lazy"><b>Sounsouni BTP</b><small>Construction, routes, rénovation</small></a>'
      '<a href="services.html#digital" class="rv d1"><img src="img/site/digital.webp" alt="" loading="lazy"><b>Digital &amp; IA</b><small>Sites, applications, intelligence artificielle</small></a>'
      '<a href="services.html#energie" class="rv d2"><img src="img/site/solaire.webp" alt="" loading="lazy"><b>Énergie &amp; industrie</b><small>Solaire, machines, maintenance</small></a></div>'
      '<div class="svc">' + svc_cards() + '</div><a class="btnw" href="services.html#demande">Demander une offre</a></section>'
      '<section class="band rv"><img src="img/site/point-retrait.webp" alt="" loading="lazy"><div class="k" style="color:var(--glow)">Commerçants de Bamako</div>'
      '<h2 style="max-width:620px">Devenez <span class="serif" style="color:var(--glow)">Point de Retrait</span> Sounsouni.</h2>'
      '<p class="lead" style="color:#d9e6d6">Recevez les colis de votre quartier, gagnez une commission sur chaque retrait et attirez de nouveaux clients dans votre boutique.</p>'
      '<div class="cta"><a class="pill p-w" href="https://wa.me/' + WA + '?text=Bonjour%20Sounsouni%2C%20je%20veux%20devenir%20Point%20de%20Retrait.">Je veux devenir Point de Retrait</a></div></section></main>')
    out += footer() + '<a href="./" class="gomarket" data-portail-fermer><i class="fa-solid fa-cart-shopping"></i> Accéder au marché</a></div>'
    return out
def page(file, title, desc, on, body, dark=False):
    head = ('<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>%s</title><meta name="description" content="%s"><link rel="canonical" href="https://sounsouni.pro/%s">'
            '<meta property="og:type" content="website"><meta property="og:site_name" content="Sounsouni"><meta property="og:title" content="%s"><meta property="og:description" content="%s">'
            '<meta property="og:url" content="https://sounsouni.pro/%s"><meta property="og:image" content="https://sounsouni.pro/og-image.jpg"><meta name="twitter:card" content="summary_large_image">'
            '<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png"><link rel="apple-touch-icon" href="/apple-touch-icon.png">'
            '<meta name="theme-color" content="#2e7d32">%s<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">'
            '<link rel="stylesheet" href="css/site.css?v=%s"></head><body class="snsv">') % (title, desc, file, title, desc, file, FONTS, V)
    html = head + body + footer() + '<script src="js/site.js?v=%s"></script></body></html>' % V
    open(file, "w").write(html)
def hero(on, kicker, h1, p, cta, dark=False):
    return ('<header class="top%s"><div class="glow-bg"></div><div class="wrap">%s<div class="hero"><div><div class="k" style="color:#d7f5c0">%s</div><h1>%s</h1><p>%s</p><div class="cta">%s</div></div>'
            '<div class="hero-art"><img src="img/3d/livraison-banner.webp" alt="" width="1000" height="465"></div></div></div></header>') % (" dark" if dark else "", nav(on), kicker, h1, p, cta)
# ---------- Logistique ----------
STEPS = [("fa-store", "Achat ou dépôt", "Votre fournisseur en Chine ou en Inde remet la marchandise à notre Pôle Sounsouni ou à votre transitaire.", "#1b5e20"),
         ("fa-magnifying-glass", "Vérification", "Le Pôle vérifie l'article, la couleur, la quantité et la qualité, puis colle le code Sounsouni sur le colis.", "#22662a"),
         ("fa-plane-departure", "Transit", "Le colis voyage par avion ou par bateau. Vous suivez chaque étape dans l'application.", "#1f4f6e"),
         ("fa-barcode", "Arrivé à Bamako", "Notre équipe récupère le lot à l'aéroport ou au port et scanne chaque colis : l'état « Arrivé » s'affiche aussitôt.", "#24452c"),
         ("fa-motorcycle", "Livraison", "Un livreur Sounsouni l'apporte à domicile, ou il attend dans le Point de Retrait le plus proche.", "#2e7d32"),
         ("fa-key", "Remise avec code", "Le client donne son code secret : le colis est remis, et tout le monde le voit en direct.", "#0f2e14")]
logi = cine_hero(False, "Sounsouni Logistique", ["Du monde", '<span class="serif" style="color:var(--glow)">à votre porte.</span>'],
            "Transit depuis la Chine et l'Inde, réception à Bamako, livraison express à domicile et réseau de Points de Retrait : Sounsouni s'occupe de tout, et vous suivez chaque étape.",
            '<a class="pill p-w" href="https://wa.me/%s?text=%s">Envoyer un colis</a><a class="pill p-o" href="#reseau">Voir le réseau</a>' % (WA, "Bonjour%20Sounsouni%2C%20je%20veux%20envoyer%20un%20colis."), "img/site/camionnette.webp", "logistique.html")
logi += journey() + '<main class="wrap"><section class="sec"><div class="k rv">Le voyage d\'un colis</div><h2 class="rv d1">Six étapes, <span class="serif">zéro souci.</span></h2><div class="steps">'
logi += "".join('<div class="step rv%s" style="background:%s"><span class="n">0%d</span><i class="fa-solid %s big"></i><h3>%s</h3><p>%s</p></div>' % ((" d1", " d2", "")[i % 3], c, i + 1, ic, t, d) for i, (ic, t, d, c) in enumerate(STEPS))
logi += '</div></section></main><div class="darksec" style="margin-top:70px"><div class="wrap">' + network() + '</div></div><main class="wrap">'
logi += ('<section class="sec"><div class="k rv">Tarifs de livraison à Bamako</div><h2 class="rv d1">Clairs, <span class="serif">sans surprise.</span></h2><div class="tarifs">'
         '<div class="tarif rv"><div class="k">Point de Retrait</div><b>dès 1 000 FCFA</b><small>Jusqu\'à 5 kg, puis 200 FCFA par kg. Le client retire avec son code.</small></div>'
         '<div class="tarif rv d1"><div class="k">À domicile</div><b>dès 2 000 FCFA</b><small>Jusqu\'à 5 kg, puis 300 FCFA par kg. Livré par un livreur Sounsouni.</small></div>'
         '<div class="tarif rv d2"><div class="k">Régions</div><b>dès 3 500 FCFA</b><small>Point de Retrait en région, jusqu\'à 5 kg, puis 400 FCFA par kg.</small></div></div></section>'
         '<section class="sec two"><div><div class="k rv">Professionnels</div><h2 class="rv d1">Transitaires, <span class="serif">travaillons ensemble.</span></h2>'
         '<p class="lead rv d2">Vous envoyez des colis vers le Mali ? Annoncez-les dans votre Espace Transitaire : nous les récupérons à Bamako, appelons vos clients et les livrons. Vous suivez tout en direct.</p>'
         '<div class="cta rv"><a class="pill p-g" href="https://wa.me/%s?text=%s">Devenir transitaire partenaire</a><a class="pill p-d" href="https://wa.me/%s?text=%s">Ouvrir un Point de Retrait</a></div></div>'
         '<div class="card rv d1" style="margin-top:20px"><div class="k">Pôles Sounsouni</div><h3 style="font-weight:900;font-size:26px;margin-top:8px;letter-spacing:-.5px">Nos yeux et nos mains à l\'étranger</h3>'
         '<p class="lead">En Chine et en Inde, nos Pôles Sounsouni vont chez le vendeur, vérifient la marchandise, la paient et la remettent au transitaire. Vous achetez à l\'étranger en toute confiance.</p></div></section></main>'
         ) % (WA, "Bonjour%20Sounsouni%2C%20je%20suis%20transitaire.", WA, "Bonjour%20Sounsouni%2C%20je%20veux%20ouvrir%20un%20Point%20de%20Retrait.")
page("logistique.html", "Sounsouni Logistique — Transit Chine, Inde → Bamako, livraison et Points de Retrait",
     "Sounsouni Logistique : transit de colis depuis la Chine et l'Inde vers Bamako, réception scannée à l'arrivée, livraison express à domicile et Points de Retrait dans plus de 60 quartiers de Bamako.", "logistique.html", logi)
# ---------- Services ----------
srv = cine_hero(False, "Sounsouni Services", ["Votre projet,", '<span class="serif" style="color:var(--glow)">notre expertise.</span>'],
           "Construction, industrie, immobilier, digital, intelligence artificielle, énergie : décrivez votre besoin, Sounsouni vous fait une offre.",
           '<a class="pill p-w" href="#demande">Demander une offre</a><a class="pill p-o" href="#domaines">Nos domaines</a>', "img/site/btp.webp", "services.html")
srv += '<main class="wrap"><section class="sec" id="domaines"><div class="k rv">Nos domaines</div><h2 class="rv d1">Tout Sounsouni <span class="serif">au service des entreprises.</span></h2><div class="steps">'
srv += "".join('<div class="step rv" id="%s" style="background:%s"><i class="fa-solid %s big"></i><h3>Sounsouni<br>%s</h3><p>%s</p><a class="pill p-w" style="margin-top:14px;align-self:flex-start" href="#demande" data-svc="%s">Demander une offre</a></div>'
               % (k, ("#1b5e20", "#24452c", "#1f4f6e", "#2e7d32", "#0f2e14", "#22662a", "#1d3b49", "#33502f")[i], ic, n, d, k) for i, (k, ic, n, s, d) in enumerate(SERVICES))
srv += '</div></section><section class="sec two" id="demande"><div><div class="k rv">Demande d\'offre</div><h2 class="rv d1">Parlez-nous <span class="serif">de votre projet.</span></h2><p class="lead rv d2">Votre demande arrive directement chez Sounsouni, sur WhatsApp. Nous vous répondons avec une offre adaptée.</p></div>'
srv += ('<form class="card form rv d1" id="sns-offre"><select name="domaine" required><option value="">Domaine</option>%s</select><input name="nom" placeholder="Votre nom ou votre entreprise" required>'
        '<input name="tel" type="tel" placeholder="Votre téléphone" required><input name="ville" placeholder="Ville (ex. Bamako)"><textarea name="besoin" placeholder="Décrivez votre besoin" required></textarea>'
        '<button class="btnw" type="submit" style="border:0;width:100%%"><i class="fa-brands fa-whatsapp"></i> Envoyer ma demande</button>'
        '<a href="mailto:direction@sounsouni.pro" style="text-align:center;font-size:12.5px;color:var(--dim)">ou par e-mail : direction@sounsouni.pro</a></form></section></main>') % "".join('<option value="%s">Sounsouni %s</option>' % (k, n) for k, ic, n, s, d in SERVICES)
srv += ('<script>(function(){var f=document.getElementById("sns-offre");if(!f)return;var sel=f.querySelector("select");'
        'document.querySelectorAll("[data-svc]").forEach(function(a){a.addEventListener("click",function(){sel.value=a.getAttribute("data-svc");});});'
        'if(location.hash.length>1){var h=location.hash.slice(1);for(var i=0;i<sel.options.length;i++)if(sel.options[i].value===h)sel.value=h;}'
        'f.addEventListener("submit",function(e){e.preventDefault();var d=new FormData(f),o=sel.options[sel.selectedIndex].text;'
        'var m="Bonjour Sounsouni, je souhaite une offre.\\nDomaine : "+o+"\\nNom : "+d.get("nom")+"\\nTéléphone : "+d.get("tel")+"\\nVille : "+(d.get("ville")||"-")+"\\nBesoin : "+d.get("besoin");'
        'window.open("https://wa.me/%s?text="+encodeURIComponent(m),"_blank");});})();</script>') % WA
page("services.html", "Sounsouni Services — BTP, industrie, immobilier, digital, IA, énergie au Mali",
     "Sounsouni Services : construction et BTP, solutions industrielles, immobilier, sites web et applications, intelligence artificielle, énergie solaire, import et sourcing, conseil aux entreprises au Mali.", "services.html", srv)
# ---------- À propos ----------
ap = cine_hero(False, "À propos de nous", ["Née à Bamako,", '<span class="serif" style="color:var(--glow)">ouverte au monde.</span>'],
          "Sounsouni est une entreprise ouest-africaine qui rapproche les Maliens de tout ce dont ils ont besoin : les produits, les colis du monde entier et les services pour bâtir.",
          '<a class="pill p-w" href="./#marche">Découvrir le marché</a><a class="pill p-o" href="#contact">Nous contacter</a>', "img/site/bamako-nuit-2.webp", "a-propos.html")
ap += ('<main class="wrap"><section class="sec two"><div><div style="display:flex;justify-content:center"><img class="rv" src="%s" alt="Logo Sounsouni" width="260" height="260" style="width:220px;height:220px;filter:drop-shadow(0 24px 30px rgba(40,90,20,.25))"></div></div>'
       '<div><div class="k rv">Qui sommes-nous</div><h2 class="rv d1">Sounsouni, <span class="serif">toute l\'Afrique en un clic.</span></h2>'
       '<p class="lead rv d2">Sounsouni est née à Bamako avec une idée simple : qu\'acheter, envoyer et entreprendre au Mali devienne aussi facile qu\'ailleurs. Aujourd\'hui, Sounsouni réunit trois métiers sur une seule plateforme.</p></div></section>'
       '<section class="sec"><div class="svc" style="grid-template-columns:1fr">'
       '<div class="rv"><i class="fa-solid fa-bag-shopping"></i>Le Marché<small style="font-size:13px">Un marché en ligne où des vendeurs vérifiés proposent leurs articles, avec paiement sécurisé (Orange Money, Moov Money ou à la livraison).</small></div>'
       '<div class="rv d1"><i class="fa-solid fa-truck-fast"></i>La Logistique<small style="font-size:13px">Transit depuis la Chine et l\'Inde, réception scannée à Bamako, livraison express et réseau de Points de Retrait dans les quartiers.</small></div>'
       '<div class="rv d2"><i class="fa-solid fa-helmet-safety"></i>Les Services<small style="font-size:13px">BTP, industrie, immobilier, digital, intelligence artificielle, énergie, sourcing et conseil pour les entreprises.</small></div></div></section>'
       '<section class="sec"><div class="card rv" style="background:var(--gd);color:#fff"><div class="k" style="color:var(--glow)">Notre mission</div><h2 style="font-size:clamp(26px,6vw,44px)">Rendre le commerce simple, sûr et transparent <span class="serif" style="color:var(--glow)">pour chaque Malien.</span></h2></div></section>'
       '<section class="sec two" id="contact"><div><div class="k rv">Fiche de l\'entreprise</div><h2 class="rv d1">SOUNSOUNI</h2></div>'
       '<div class="card rv d1" style="font-size:15px;line-height:2">'
       '<div><b>Registre du commerce (RCCM)</b> : ML-BKO-01-2026-A-05755</div><div><b>D-U-N-S (Dun &amp; Bradstreet)</b> : 85-042-6646</div>'
       '<div><b>Siège</b> : Sotelco, face à Bougouba, Bamako, Mali</div><div><b>Téléphone</b> : <a href="tel:+22393010123">+223 93 01 01 23</a></div><div><b>E-mail</b> : <a href="mailto:direction@sounsouni.pro">direction@sounsouni.pro</a></div></div></section></main>') % LOGO
page("a-propos.html", "À propos de Sounsouni — Entreprise ouest-africaine née à Bamako",
     "Sounsouni, entreprise ouest-africaine née à Bamako (RCCM ML-BKO-01-2026-A-05755, D-U-N-S 85-042-6646) : marché en ligne, logistique et services aux entreprises.", "a-propos.html", ap)
# ---------- Portail dans index.html ----------
ix = open("index.html").read()
GATE = ('<!--PORTAIL-->' + FONTS + '<link rel="stylesheet" href="css/site.css?v=%s">'
        '<script>(function(){var show=true;try{if(localStorage.getItem("sns_has_profile")==="1")show=false;if(sessionStorage.getItem("sns_portail_ferme")==="1")show=false;}catch(e){}'
        'if(window.Capacitor||/; wv\\)/.test(navigator.userAgent)||(window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches))show=false;'
        'var h=location.hash;if(h&&h!=="#accueil")show=false;if(location.search.indexOf("p=")>-1)show=false;if(h==="#accueil")show=true;'
        'window.__snsPortail=show;if(show)document.documentElement.classList.add("portail-on");})();</script><!--/PORTAIL-->') % V
ix = re.sub(r"<!--PORTAIL-->.*?<!--/PORTAIL-->", "", ix, flags=re.S)
ix = ix.replace("</head>", GATE + "\n</head>", 1)
ix = re.sub(r'<!--PORTAIL-BODY-->.*?<!--/PORTAIL-BODY-->\n?', "", ix, flags=re.S)
body = ('<!--PORTAIL-BODY-->' + portail() + '<script>if(window.__snsPortail)document.getElementById("portail").removeAttribute("hidden");</script>'
        '<script src="js/site.js?v=' + V + '" defer></script><!--/PORTAIL-BODY-->\n')
ix = ix.replace("<body>\n", "<body>\n" + body, 1)
TITLE = "Sounsouni — Marché en ligne, logistique et services au Mali | Bamako"
ix = re.sub(r"<title>.*?</title>", "<title>%s</title>" % TITLE, ix, count=1)
ix = re.sub(r'(<meta name="description" content=")[^"]*', lambda m: m.group(1) + DESC_ORG, ix, count=1)
ix = re.sub(r'(<meta property="og:title" content=")[^"]*', lambda m: m.group(1) + TITLE, ix, count=1)
ix = re.sub(r'(<meta property="og:description" content=")[^"]*', lambda m: m.group(1) + DESC_ORG, ix, count=1)
ld = [{"@context": "https://schema.org", "@type": "Organization", "@id": "https://sounsouni.pro/#org", "name": "Sounsouni", "legalName": "SOUNSOUNI", "alternateName": ["Sounsouni Mali", "Sounsouni.pro"],
       "url": "https://sounsouni.pro/", "logo": "https://sounsouni.pro/favicon-512.png", "image": "https://sounsouni.pro/og-image.jpg", "description": DESC_ORG, "duns": "850426646",
       "identifier": [{"@type": "PropertyValue", "propertyID": "RCCM", "value": "ML-BKO-01-2026-A-05755"}, {"@type": "PropertyValue", "propertyID": "DUNS", "value": "85-042-6646"}],
       "email": "direction@sounsouni.pro", "telephone": "+223 93 01 01 23", "address": {"@type": "PostalAddress", "streetAddress": "Sotelco, face à Bougouba", "addressLocality": "Bamako", "addressCountry": "ML"}, "areaServed": "ML",
       "makesOffer": [{"@type": "Offer", "itemOffered": {"@type": "Service", "name": "Sounsouni " + n}} for k, ic, n, s, d in SERVICES]},
      {"@context": "https://schema.org", "@type": "WebSite", "@id": "https://sounsouni.pro/#site", "name": "Sounsouni", "alternateName": "Sounsouni Mali", "url": "https://sounsouni.pro/", "inLanguage": "fr", "publisher": {"@id": "https://sounsouni.pro/#org"}}]
ix = re.sub(r'<script type="application/ld\+json">.*?</script>', lambda m: '<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False) + '</script>', ix, count=1, flags=re.S)
open("index.html", "w").write(ix)
# plan du site
sm = open("sitemap.xml").read()
for f, pr in (("logistique.html", "0.9"), ("services.html", "0.8"), ("a-propos.html", "0.7")):
    if f not in sm: sm = sm.replace("</urlset>", "  <url><loc>https://sounsouni.pro/%s</loc><lastmod>2026-11-24</lastmod><changefreq>monthly</changefreq><priority>%s</priority></url>\n</urlset>" % (f, pr))
open("sitemap.xml", "w").write(sm)
print("site fabriqué", V)
