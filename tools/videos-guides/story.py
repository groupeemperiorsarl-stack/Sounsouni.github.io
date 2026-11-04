# Storyboard des deux vidéos : titres d'étapes, illustrations et « plans » calés sur les mots.
LOGO = '<img src="assets/210deb8220be.webp" style="width:170px;height:170px">'
def rows(items, k, hot=None):
    h = ''
    for i, (ic, b, s) in enumerate(items):
        cls = 'row' + (' off' if i >= k else '') + (' hot' if hot == i else '')
        h += '<div class="%s"><div class="ic"><i class="fa-solid %s"></i></div><div><b>%s</b><small>%s</small></div>%s</div>' % (cls, ic, b, s, '<i class="fa-solid fa-circle-check ok"></i>' if i < k else '')
    return h
def route(a, ai, b, bi, mid):
    return ('<div class="route"><div class="node"><div class="c">%s</div>%s</div><div class="dash"><i class="fa-solid %s"></i></div>'
            '<div class="node"><div class="c">%s</div>%s</div></div>') % (ai, a, mid, bi, b)
CN = '<span style="font-size:58px">🇨🇳</span>'; ML = '<span style="font-size:58px">🇲🇱</span>'
HOME = '<i class="fa-solid fa-house-chimney" style="color:#2e7d32"></i>'
def notif(title, body):
    return '<div class="notif"><img src="assets/3a3432a95f38.webp"><div><b>%s</b><small>%s</small></div></div>' % (title, body)

ILL = {
 # ---------- Transitaire ----------
 "welcomeT": lambda k: LOGO + '<div class="kicker" style="margin-top:18px">ESPACE TRANSITAIRE</div><h3>Bienvenue chez Sounsouni&nbsp;!</h3>'
   + '<div class="sub">Vous envoyez des colis vers le Mali.</div>'
   + route('Chine', CN, 'Bamako', ML, 'fa-plane') + ('<div class="row hot" style="margin-top:6px"><div class="ic"><i class="fa-solid fa-truck-fast"></i></div><div><b>Sounsouni s\'occupe de tout</b><small>de l\'aéroport de Bamako jusqu\'à la porte de vos clients</small></div></div>' if k >= 1 else '')
   + ('<div style="margin-top:22px"><span class="chip"><i class="fa-solid fa-shoe-prints"></i> Pas à pas</span><span class="chip"><i class="fa-solid fa-face-smile"></i> Très simple</span></div>' if k >= 2 else ''),
 "accountT": lambda k: '<div class="bubble"><i class="fa-solid fa-mobile-screen-button"></i></div><h3 style="margin-top:26px">Votre compte</h3><div class="sub">Créez-le avec le numéro donné à l\'équipe Sounsouni</div>'
   + '<div class="chip" style="margin-top:26px;font-size:30px;padding:16px 30px">🇨🇳 +86 139 0000 0002</div>'
   + rows([("fa-key", "Ce numéro ouvre votre espace", "C'est très important"), ("fa-right-to-bracket", "Déjà un compte avec ce numéro ?", "Connectez-vous simplement")], k, k - 1 if k else None),
 "lotT": lambda k: '<div class="kicker">LE NUMÉRO DE LOT</div><h3>Même lot = même numéro</h3><div class="sub">Tous les colis qui voyagent ensemble portent le même numéro de lot.</div>'
   + '<div style="display:flex;gap:16px;justify-content:center;margin-top:36px">' + ''.join('<div style="width:180px;height:170px;border-radius:16px;background:linear-gradient(160deg,#d9a86c,#b98445);position:relative;box-shadow:0 14px 26px rgba(110,70,20,.3)"><div style="position:absolute;left:14px;right:14px;bottom:16px;background:#fff;border-radius:8px;padding:10px 4px;font-weight:800;font-size:19px;color:#183a1d">LTA 235-4471</div></div>' for _ in range(3)) + '</div>'
   + '<div style="font-size:46px;color:#2e7d32;margin:24px 0 0"><i class="fa-solid fa-arrow-down"></i></div>'
   + '<div class="row hot"><div class="ic"><i class="fa-solid fa-plane-arrival"></i></div><div><b>À Bamako</b><small>nous récupérons tout le lot d\'un seul coup</small></div></div>',
 "fretT": lambda k: '<div class="kicker">LE FRET</div><h3>Vous n\'avez rien à courir après</h3>'
   + rows([("fa-user", "Votre client paie le fret", "à la réception du colis, en francs CFA"), ("fa-building-columns", "Sounsouni encaisse pour vous", "au taux du jour"), ("fa-hand-holding-dollar", "Sounsouni vous le reverse", "moins la petite commission prévue")], 3),
 "codeT": lambda k: '<div class="bubble"><i class="fa-solid fa-key"></i></div><h3 style="margin-top:24px">Le code de retrait</h3><div class="code" style="margin-top:20px">4137</div>'
   + '<div class="sub">Donnez ce code à votre client.</div><div class="row hot" style="margin-top:34px"><div class="ic" style="background:#c62828"><i class="fa-solid fa-lock"></i></div><div><b>Sans ce code, personne</b><small>ne peut récupérer le colis</small></div></div>',
 "scanT": lambda k: '<div class="kicker">À BAMAKO</div><h3>Laissez-nous faire&nbsp;!</h3>' + route('Aéroport / port', '<i class="fa-solid fa-plane-arrival" style="color:#2e7d32"></i>', 'Équipe Sounsouni', '<i class="fa-solid fa-qrcode" style="color:#2e7d32"></i>', 'fa-boxes-stacked')
   + rows([("fa-people-carry-box", "L'équipe récupère le lot", "à l'aéroport ou au port"), ("fa-barcode", "Chaque colis est scanné", "un par un, à l'arrivée")], 2),
 "notifT": lambda k: '<div class="kicker">NOTIFICATION</div><h3>Arrivé à Bamako&nbsp;!</h3><div class="sub">L\'état change aussitôt, et vous êtes prévenu.</div><div style="height:30px"></div>'
   + notif("Sounsouni", "🛬 Votre colis TR-8K2Q4M est arrivé à Bamako.") + ('<div style="margin-top:30px"><span class="chip"><i class="fa-solid fa-clock"></i> Chaque étape avec l\'heure exacte</span></div>' if k else ''),
 "remisT": lambda k: '<div class="bubble"><i class="fa-solid fa-circle-check"></i></div><h3 style="margin-top:24px">Colis remis&nbsp;!</h3><div class="sub">Votre client a donné son code : vous recevez un message.</div><div style="height:20px"></div>'
   + notif("Sounsouni", "✅ Colis TR-3J9D1K remis au destinataire."),
 "callT": lambda k: '<div class="bubble" style="background:linear-gradient(160deg,#ffb74d,#ef6c00)"><i class="fa-solid fa-phone-volume"></i></div><h3 style="margin-top:24px">Client injoignable&nbsp;?</h3><div class="sub">Ne vous inquiétez pas.</div>'
   + rows([("fa-phone", "Nous l'appelons plusieurs fois", "à des heures différentes"), ("fa-bell", "Toujours injoignable ?", "nous vous prévenons tout de suite")], 2),
 "outroT": lambda k: LOGO + '<h3 style="margin-top:20px">Merci de faire confiance à Sounsouni&nbsp;!</h3>' + route('Chine', CN, 'Mali', ML, 'fa-handshake')
   + '<div class="sub" style="font-family:Fred;font-size:34px;color:#2e7d32">Ensemble, rapprochons la Chine et le Mali&nbsp;!</div>',
 # ---------- Pôle ----------
 "welcomeP": lambda k: LOGO + '<div class="kicker" style="margin-top:18px">PÔLE SOUNSOUNI CHINE</div><h3>Bienvenue dans l\'équipe&nbsp;!</h3>'
   + '<div class="sub">Vous êtes le Pôle Sounsouni dans votre pays.</div>'
   + (rows([("fa-eye", "Nos yeux sur place", "pour nos clients au Mali"), ("fa-hands", "Nos mains sur place", "ils achètent à l'étranger en toute confiance")], 2) if k >= 1 else '')
   + ('<div style="margin-top:22px"><span class="chip"><i class="fa-solid fa-shoe-prints"></i> Pas à pas</span></div>' if k >= 2 else ''),
 "vendorsP": lambda k: '<div class="kicker">VOS VENDEURS</div><h3>Ils vous choisissent</h3>'
   + rows([("fa-store", "Le vendeur s'inscrit", "et choisit son Pôle Sounsouni dans une liste"), ("fa-flag", "Seulement les Pôles de son pays", "🇨🇳 Pôle Sounsouni Chine"), ("fa-user-check", "Il vous choisit", "vous devenez son interlocuteur"), ("fa-inbox", "Toutes ses commandes", "arrivent chez vous")], k + 1, k),
 "moneyP": lambda k: '<div class="bubble"><i class="fa-solid fa-shield-halved"></i></div><h3 style="margin-top:24px">Paiement reçu</h3><div class="sub">Le client a déjà payé Sounsouni.<br>L\'argent est là, en sécurité.</div>'
   + route('Client', ML, 'Sounsouni', '<i class="fa-solid fa-vault" style="color:#2e7d32"></i>', 'fa-money-bill-wave'),
 "checkP": lambda k: '<div class="kicker">CHEZ LE VENDEUR</div><h3>Vérifiez de vos propres yeux</h3>'
   + rows([("fa-box-open", "Le bon article", ""), ("fa-palette", "La bonne couleur", ""), ("fa-list-ol", "La bonne quantité", ""), ("fa-gem", "Et surtout, la bonne qualité", "votre mission la plus importante")], min(k, 4), (k - 1) if 0 < k <= 4 else None)
   + ('<div class="sub" style="margin-top:22px;font-family:Fred;font-size:30px;color:#2e7d32">Votre client ne peut pas voir le produit. Vous, si.</div>' if k >= 5 else ''),
 "boxP": lambda k: '<div class="kicker">SUR LE COLIS</div><h3>Écrivez le code bien lisible</h3><div class="box"><div class="tape"></div><div class="label">SNS-AB12C</div></div>'
   + '<div class="sub" style="margin-top:30px">Notre équipe le reconnaîtra à Bamako.</div>'
   + ('<div class="row hot"><div class="ic"><i class="fa-solid fa-plane-departure"></i></div><div><b>Vous êtes aussi transitaire ?</b><small>Annoncez le colis dans votre Espace Transitaire, avec le même numéro de lot</small></div></div>' if k else ''),
 "scanP": lambda k: '<div class="kicker">À BAMAKO</div><h3>L\'équipe Sounsouni scanne le code</h3><div class="box" style="transform:scale(.8);margin-top:10px"><div class="tape"></div><div class="label">SNS-AB12C</div></div>'
   + '<div style="display:flex;gap:14px;justify-content:center;margin-top:6px"><span class="chip"><i class="fa-solid fa-qrcode"></i> Scanné</span><span class="chip"><i class="fa-solid fa-keyboard"></i> ou tapé à la main</span></div>',
 "notifP": lambda k: '<div class="kicker">NOTIFICATION</div><h3>Arrivé&nbsp;!</h3><div class="sub">Vous le voyez, le client aussi.</div><div style="height:26px"></div>'
   + notif("Sounsouni", "🛬 Commande #AB12C arrivée à Bamako et prise en main par l'équipe Sounsouni.")
   + '<div class="sub" style="margin-top:34px;font-family:Fred;font-size:32px;color:#2e7d32">Votre marchandise est entre de bonnes mains.</div>',
 "trustP": lambda k: '<div class="kicker">TRANSPARENCE</div><h3>Les mêmes étapes, pour tous</h3>'
   + '<div style="display:flex;gap:18px;width:100%;margin-top:30px">' + ''.join('<div style="flex:1;background:#fff;border-radius:24px;padding:22px 14px;box-shadow:0 8px 22px rgba(30,70,20,.12)"><div style="font-size:50px">%s</div><b style="font-size:25px;display:block;margin:8px 0 14px">%s</b>%s</div>' % (f, who, ''.join('<div style="font-size:21px;font-weight:700;text-align:left;padding:7px 0;color:#2e7d32"><i class="fa-solid fa-circle-check"></i> %s</div>' % s for s in ["Paiement reçu", "Transitaire", "En transit", "Arrivé", "En route", "Livrée"])) for f, who in [(ML, "Le client au Mali"), (CN, "Vous, le Pôle")]) + '</div>'
   + '<div class="sub" style="margin-top:24px;font-family:Fred;font-size:31px;color:#2e7d32">La transparence crée la confiance.</div>',
 "fourP": lambda k: '<div class="kicker">VOTRE RÔLE</div><h3>Simple, mais précieux</h3><div class="big4">'
   + ''.join('<div class="%s"><i class="fa-solid %s"></i>%s</div>' % ('' if i < k else 'off', ic, w) for i, (ic, w) in enumerate([("fa-magnifying-glass", "Vérifier"), ("fa-money-bill-transfer", "Payer"), ("fa-plane-departure", "Envoyer"), ("fa-location-dot", "Suivre")])) + '</div>',
 "outroP": lambda k: LOGO + '<h3 style="margin-top:20px">Merci de porter les couleurs de Sounsouni&nbsp;!</h3>' + route('Votre pays', CN, 'Mali', ML, 'fa-bridge')
   + '<div class="sub" style="font-family:Fred;font-size:34px;color:#2e7d32">Ensemble, construisons le pont entre votre pays et le Mali&nbsp;!</div>',
}

# Plan : (repère dans le texte ou None, dict). Clés : il=(scène,k) | sh=écran, z=zoom, f=cible centrée, hl=cible entourée, tap=cible touchée
T_TITLES = ["Bienvenue chez Sounsouni", "Votre compte", "Ouvrir l'Espace Transitaire", "Votre tableau de bord", "Annoncer un colis", "Suivi et numéro de lot", "Le destinataire", "Poids et contenu", "Le mode de livraison", "Point de Retrait ou domicile", "Qui paie la livraison ?", "Le fret encaissé", "Envoyer l'annonce", "Le code de retrait", "Nous prenons le relais", "Votre solde"]
P_TITLES = ["Bienvenue dans l'équipe", "Ouvrir votre espace", "Vos vendeurs", "Une nouvelle commande", "La fiche de la commande", "Vérifier chez le vendeur", "Marquer comme inspecté", "Payer le vendeur", "Remettre au transitaire", "En transit", "Arrivé à Bamako", "Jusqu'à la livraison", "La confiance"]
T_PLAN = [
 [(None, dict(il=("welcomeT", 0))), ("Bonne nouvelle", dict(il=("welcomeT", 1))), ("Dans cette vidéo", dict(il=("welcomeT", 2)))],
 [(None, dict(il=("accountT", 0))), ("C'est très important", dict(il=("accountT", 1))), ("Si vous avez déjà", dict(il=("accountT", 2)))],
 [(None, dict(sh="t03a", hl="menu")), ("bouton menu", dict(sh="t03a", tap="menu")), ("Le menu « Changer", dict(sh="t03b")), ("Tout en bas", dict(sh="t03b", z=1.6, f="transit", hl="transit")), ("Touchez-le", dict(sh="t03b", z=1.6, f="transit", tap="transit")), ("Voilà", dict(sh="t03c", hl="title"))],
 [(None, dict(sh="t04", z=1.5, f="cases", hl="cases")), ("À gauche", dict(sh="t04", z=1.5, f="cases", hl="encours")), ("À droite", dict(sh="t04", z=1.5, f="cases", hl="solde")), ("Juste en dessous", dict(sh="t04", z=1.45, f="conditions", hl="conditions")), ("Pas de surprise", dict(sh="t04"))],
 [(None, dict(sh="t05a", z=1.3, f="annoncer", hl="annoncer")), ("Touchez le grand", dict(sh="t05a", z=1.3, f="annoncer", tap="annoncer")), ("Un formulaire", dict(sh="t05b")), ("On le remplit", dict(sh="t05b", z=1.2, f="formulaire"))],
 [(None, dict(sh="t06a", z=1.6, f="suivi", hl="suivi")), ("Juste en dessous", dict(sh="t06a", z=1.6, f="lot", tap="lot")), ("C'est le numéro", dict(sh="t06b", z=1.6, f="lot", hl="lot")), ("Mettez le même", dict(il=("lotT", 0)))],
 [(None, dict(sh="t07a", z=1.6, f="nom", tap="nom")), ("puis son numéro", dict(sh="t07b", z=1.6, f="nom", tap="tel")), ("Vérifiez bien", dict(sh="t07c", z=1.6, f="tel", hl="tel"))],
 [(None, dict(sh="t08a", z=1.6, f="poids", tap="poids")), ("Par exemple", dict(sh="t08b", z=1.6, f="poids", hl="poids")), ("Puis, si vous voulez", dict(sh="t08b", z=1.6, f="contenu", tap="contenu")), ("des vêtements", dict(sh="t08c", z=1.6, f="contenu", hl="contenu"))],
 [(None, dict(sh="t09a", z=1.4, f="z2")), ("Point de Retrait à Bamako", dict(sh="t09a", z=1.4, f="z2", hl="z1")), ("directement à domicile", dict(sh="t09a", z=1.4, f="z2", hl="z2")), ("en région", dict(sh="t09a", z=1.4, f="z2", hl="z3")), ("Chaque choix montre", dict(sh="t09a", z=1.4, f="z2")), ("Et regardez en bas", dict(sh="t09b", z=1.7, f="prix", hl="prix"))],
 [(None, dict(sh="t10a", z=1.5, f="liste", tap="liste")), ("chaque boutique", dict(sh="t10a", z=1.5, f="liste", hl="liste")), ("livraison à domicile", dict(sh="t10b", z=1.35, f="quartier", hl="commune")), ("le quartier", dict(sh="t10b", z=1.35, f="quartier", hl="quartier")), ("un repère", dict(sh="t10b", z=1.35, f="quartier", hl="repere")), ("Nos livreurs", dict(sh="t10b"))],
 [(None, dict(sh="t11", z=1.15, f="dest")), ("« Le destinataire »", dict(sh="t11", z=1.15, f="dest", tap="dest")), ("« Moi »", dict(sh="t11", z=1.15, f="dest", tap="moi")), ("Vous pouvez choisir", dict(sh="t11", z=1.15, f="dest", hl="dest"))],
 [(None, dict(sh="t12a", z=1.6, f="fret")), ("écrivez ici", dict(sh="t12a", z=1.6, f="fret", tap="fret")), ("L'application le convertit", dict(sh="t12b", z=1.6, f="fret", hl="taux")), ("Votre client le paie", dict(il=("fretT", 0)))],
 [(None, dict(sh="t13a", z=1.4, f="envoyer", hl="envoyer")), ("Touchez « Annoncer", dict(sh="t13a", z=1.4, f="envoyer", tap="envoyer")), ("Et voilà", dict(sh="t13b", hl="carte"))],
 [(None, dict(sh="t14", z=1.2, f="montants")), ("avec l'état", dict(sh="t14", z=1.2, f="montants", hl="statut")), ("Vous y voyez tout", dict(sh="t14", z=1.3, f="montants", hl="montants")), ("le code de retrait", dict(sh="t14", z=1.7, f="code", hl="code")), ("Donnez ce code", dict(il=("codeT", 0))), ("Tant que le colis", dict(sh="t14", z=1.6, f="annuler", hl="annuler"))],
 [(None, dict(il=("scanT", 0))), ("Aussitôt", dict(il=("notifT", 0))), ("Ensuite, vous suivez", dict(sh="t15a", z=1.25, f="carte", hl="histo")), ("Vous recevez un message", dict(il=("remisT", 0))), ("Et si votre client", dict(il=("callT", 0)))],
 [(None, dict(sh="t16", z=1.5, f="solde", hl="solde")), ("Quand Sounsouni vous a réglé", dict(sh="t16", z=1.3, f="detail", hl="detail")), ("Simple, clair", dict(sh="t16")), ("Merci de faire", dict(il=("outroT", 0)))],
]
P_PLAN = [
 [(None, dict(il=("welcomeP", 0))), ("Pour nos clients", dict(il=("welcomeP", 1))), ("Dans cette vidéo", dict(il=("welcomeP", 2)))],
 [(None, dict(sh="p02a", hl="menu")), ("bouton menu", dict(sh="p02a", tap="menu")), ("Dans « Changer", dict(sh="p02b", z=1.5, f="pole", hl="pole")), ("touchez « Espace", dict(sh="p02b", z=1.5, f="pole", tap="pole")), ("Si vous êtes aussi", dict(sh="p02b", z=1.5, f="pole", hl="transit")), ("Vous passez", dict(sh="p02c", hl="title"))],
 [(None, dict(il=("vendorsP", 0))), ("Il ne voit que", dict(il=("vendorsP", 1))), ("S'il vous choisit", dict(il=("vendorsP", 2))), ("Toutes ses commandes", dict(il=("vendorsP", 3)))],
 [(None, dict(sh="p04")), ("La commande apparaît", dict(sh="p04", z=1.3, f="rubrique", hl="carte")), ("Elle a l'état", dict(sh="p04", z=1.7, f="statut", hl="statut")), ("L'argent est là", dict(il=("moneyP", 0)))],
 [(None, dict(sh="p05a", z=1.4, f="numero", tap="numero")), ("Vous y trouvez tout", dict(sh="p05b")), ("Le vendeur", dict(sh="p05b", z=1.35, f="acheteur", hl="vendeur")), ("L'acheteur", dict(sh="p05b", z=1.35, f="acheteur", hl="acheteur")), ("La liste des articles", dict(sh="p05b", z=1.35, f="articles", hl="articles")), ("Le transport", dict(sh="p05b", z=1.6, f="transport", hl="transport")), ("Et le montant", dict(sh="p05b", z=1.6, f="montant", hl="montant"))],
 [(None, dict(il=("checkP", 0))), ("le bon article", dict(il=("checkP", 1))), ("la bonne couleur", dict(il=("checkP", 2))), ("la bonne quantité", dict(il=("checkP", 3))), ("la bonne qualité", dict(il=("checkP", 4))), ("Votre client ne peut", dict(il=("checkP", 5)))],
 [(None, dict(sh="p07a", z=1.45, f="inspect", hl="inspect")), ("touchez « Marquer", dict(sh="p07a", z=1.45, f="inspect", tap="inspect")), ("La date est", dict(sh="p07b", z=1.45, f="valide", hl="valide"))],
 [(None, dict(sh="p08a", z=1.35, f="preuve")), ("Dans le champ", dict(sh="p08a", z=1.35, f="preuve", tap="preuve")), ("écrivez la référence", dict(sh="p08b", z=1.35, f="preuve", hl="preuve")), ("Puis touchez", dict(sh="p08b", z=1.35, f="preuve", tap="bouton")), ("La commande passe", dict(sh="p09a"))],
 [(None, dict(sh="p09a", z=1.35, f="bouton")), ("Touchez « Marquer", dict(sh="p09a", z=1.35, f="bouton", tap="bouton")), ("Un code apparaît", dict(sh="p09b", z=1.55, f="code", hl="code")), ("Écrivez ce code", dict(il=("boxP", 0))), ("Et si c'est vous", dict(il=("boxP", 1)))],
 [(None, dict(sh="p10a", z=1.35, f="bouton")), ("Touchez « Marquer", dict(sh="p10a", z=1.35, f="bouton", tap="bouton")), ("À partir de là", dict(sh="p10b", z=1.3, f="info", hl="info"))],
 [(None, dict(il=("scanP", 0))), ("et scanne le code", dict(sh="p11a", z=1.3, f="champ", hl="scan")), ("ou le tape", dict(sh="p11b", z=1.3, f="champ", hl="champ")), ("Aussitôt", dict(sh="p11b", z=1.3, f="champ", tap="valider")), ("Vous le voyez", dict(sh="p11c", z=1.3, f="arrive", hl="arrive")), ("vous recevez une notification", dict(il=("notifP", 0)))],
 [(None, dict(sh="p12a", z=1.3, f="info")), ("« En route »", dict(sh="p12a", z=1.3, f="info", hl="info")), ("« Livrée »", dict(sh="p12b", z=1.3, f="info", hl="info")), ("Chaque étape s'affiche", dict(sh="p12b", z=1.3, f="histo", hl="histo"))],
 [(None, dict(il=("trustP", 0))), ("Vérifier, payer", dict(il=("fourP", 1))), ("payer", dict(il=("fourP", 2))), ("envoyer", dict(il=("fourP", 3))), ("suivre", dict(il=("fourP", 4))), ("Merci de porter", dict(il=("outroP", 0)))],
]
VIDEOS = {
 "transitaire": dict(audio="a1142", title="Espace Transitaire", pill="Espace Transitaire", titles=T_TITLES, plan=T_PLAN),
 "pole": dict(audio="a1135", title="Pôle Sounsouni", pill="Pôle Sounsouni", titles=P_TITLES, plan=P_PLAN),
}

def chunks(words, maxw=20):
    """Découpe les mots d'une étape en phrases courtes pour les sous-titres : [(début, fin)]."""
    sents, cur = [], []
    for i, w in enumerate(words):
        cur.append(i)
        if (w.rstrip("»").endswith((".", "!", "?", "…")) and w.count(".") < 2) or (w.endswith(":") and len(cur) > 8): sents.append(cur); cur = []
    if cur: sents.append(cur)
    out = []
    for s in sents:  # coupe les phrases trop longues à la virgule la plus centrale
        while len(s) > maxw:
            cands = [j for j in range(5, len(s) - 4) if words[s[j]].endswith((",", ":", ";"))]
            j = min(cands, key=lambda j: abs(j - len(s) / 2)) if cands else len(s) // 2
            out.append(s[:j + 1]); s = s[j + 1:]
        out.append(s)
    merged = []
    for s in out:
        if merged and (len(s) < 5 or len(merged[-1]) < 5) and len(merged[-1]) + len(s) <= 16: merged[-1] = merged[-1] + s
        else: merged.append(s)
    return [(s[0], s[-1] + 1) for s in merged]
