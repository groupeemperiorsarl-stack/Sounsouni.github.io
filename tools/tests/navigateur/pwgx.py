import time, json, urllib.request, sys
from playwright.sync_api import sync_playwright
SRV = "http://localhost:8787"
def tok(i): return urllib.request.urlopen(SRV + "/token?id=" + i).read().decode()
def setoff(v): urllib.request.urlopen(SRV + "/offline?v=" + ("1" if v else "0")).read()
def dump(): return json.loads(urllib.request.urlopen(SRV + "/dump").read())
ACC = {
  "CHEF": {"id": "CHEF", "name": "Moussa", "shopName": "Quincaillerie Moussa", "sellerType": "entreprise", "phone": "+22370000010", "role": "acheteur", "hasPassword": True},
  "COMPTA": {"id": "COMPTA", "name": "Fanta", "phone": "+22370000011", "role": "acheteur", "hasPassword": True},
  "CAISSE": {"id": "CAISSE", "name": "Ali", "phone": "+22370000012", "role": "acheteur", "hasPassword": True},
  "PART": {"id": "PART", "name": "Oumar", "phone": "+22370000013", "role": "acheteur", "hasPassword": True},
}
fails = []
PG = []
def nap(x):
    if PG: PG[0].wait_for_timeout(int(x*1000))
    else: nap(x)

def check(name, cond, info=""):
    print(("  ✔ " if cond else "  ✘ ") + name + ("" if cond else "  " + str(info)))
    if not cond: fails.append(name)

def route_factory(state):
    def handle(route):
        req = route.request
        if "gestion-sync" in req.url and req.method == "POST":
            if state.get("off"):
                return route.abort()
            r = urllib.request.Request(SRV + "/", data=(req.post_data or "").encode(), headers={k: v for k, v in req.headers.items() if k.lower() in ("content-type", "x-session-token")}, method="POST")
            try:
                resp = urllib.request.urlopen(r); body = resp.read(); code = resp.status
            except urllib.error.HTTPError as e:
                body = e.read(); code = e.code
            return route.fulfill(status=code, content_type="application/json", body=body, headers={"Access-Control-Allow-Origin": "*"})
        if req.method != "GET" and "supabase" in req.url: return route.abort()
        return route.continue_()
    return handle

def login(pg, who):
    a = ACC[who]
    pg.evaluate("""([a,t])=>{state.accounts=state.accounts.filter(x=>x.id!==a.id);state.accounts.push(a);state.profile=Object.assign({},a);state.sessionToken=t;state.view='market';state.showOnboarding=false;state.language='fr';render();}""", [a, tok(who)])
    nap(0.5)

def newpage(b, who, wide):
    st = {}
    vp = {"width": 1440, "height": 900} if wide else {"width": 390, "height": 844}
    c = b.new_context(viewport=vp, is_mobile=not wide, has_touch=not wide, service_workers="block")
    pg = c.new_page(); errs = []
    pg.route("**/*", route_factory(st)); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("dialog", lambda d: d.accept(st.get("prompt", "")))
    pg.goto("http://localhost:8765/", wait_until="load"); PG.append(pg) if not PG else None; nap(5)
    login(pg, who)
    return pg, st, errs, c

def overflow(pg):
    return pg.evaluate("()=>{const r=document.getElementById('gx-root');if(!r)return 0;let w=0;r.querySelectorAll('*').forEach(e=>{const b=e.getBoundingClientRect();if(b.right>w&&getComputedStyle(e).position!=='fixed')w=b.right});return Math.round(w-window.innerWidth)}")

with sync_playwright() as p:
    b = p.chromium.launch()
    print("== Chef sur ordinateur")
    chef, cst, cerr, _ = newpage(b, "CHEF", True)
    chef.evaluate("()=>gestionRefresh(true)"); nap(1.5)
    chef.click("[data-action='toggle-role-menu']"); nap(0.8)
    check("menu Changer de rôle : bouton Créer ma gestion", chef.locator("[data-action='gx-create']").count() == 1)
    cst["prompt"] = "Quincaillerie Moussa"
    chef.click("[data-action='gx-create']")
    try: chef.wait_for_selector("#gx-root .gx-side", timeout=15000)
    except Exception as e: print("    attente:", e)
    check("la gestion s'ouvre (grand écran, menu à gauche)", chef.locator("#gx-root.gx-wide .gx-side").count() == 1)
    chef.screenshot(path="/root/work/gx-chef-home.png")
    # nouvel article
    chef.click(".gx-nav[data-v='items']"); nap(0.4)
    chef.click("[data-a='new'][data-v='item']"); nap(0.4)
    chef.fill("#name", "Ciment CPA 50kg"); chef.fill("#price", "5500"); chef.fill("#cost", "4800"); chef.fill("#unit", "sac"); chef.fill("#stock0", "40")
    chef.click("[data-a='save-item']"); nap(0.4)
    chef.click("[data-a='new'][data-v='item']"); nap(0.3)
    chef.fill("#name", "Fer à béton 10"); chef.fill("#price", "4000"); chef.fill("#cost", "3200"); chef.fill("#stock0", "3"); chef.fill("#alertAt", "5")
    chef.click("[data-a='save-item']"); nap(0.4)
    check("2 articles dans le tableau", chef.locator(".gx-table tbody tr").count() == 2, chef.locator(".gx-table tbody tr").count())
    chef.screenshot(path="/root/work/gx-chef-items.png")
    # vente
    chef.click(".gx-nav[data-v='sales']"); nap(0.3)
    chef.click("[data-a='new'][data-v='sale']"); nap(0.4)
    chef.click(".gx-pick-list button:has-text('Ciment')"); chef.click("[data-a='lqty'][data-d='1']"); nap(0.2)
    check("total vente 2 sacs = 11 000 F", "11 000 F" in chef.inner_text(".gx-total"), chef.inner_text(".gx-total"))
    chef.screenshot(path="/root/work/gx-chef-sale.png")
    chef.click("[data-a='save-sale']"); nap(0.6)
    check("reçu affiché après la vente", chef.locator(".gx-receipt").count() == 1)
    chef.click("[data-a='modal-close']"); nap(1.5)
    d = dump()
    check("les lignes sont arrivées au serveur", len(d["tables"].get("gestion_ops", [])) == 5, len(d["tables"].get("gestion_ops", [])))
    # invitations
    chef.click(".gx-nav[data-v='members']"); nap(1.2)
    for ph, role in (("+223 70 00 00 11", "comptable"), ("+22370000012", "caissier"), ("+22370000013", "partenaire")):
        chef.wait_for_selector("#gx-inv-phone", timeout=10000); chef.fill("#gx-inv-phone", ph); chef.select_option("#gx-inv-role", role); chef.click("[data-a='invite']"); nap(1.2)
    check("3 invitations envoyées", len([m for m in dump()["tables"]["gestion_members"] if m["status"] == "invited"]) == 3)
    check("notification au comptable (cible : Changer de rôle)", any(n["data"]["userId"] == "COMPTA" and n["data"]["target"] == "role-menu" for n in dump()["notifs"]))
    chef.screenshot(path="/root/work/gx-chef-members.png")

    print("== Comptable sur téléphone")
    co, kst, kerr, _ = newpage(b, "COMPTA", False)
    co.evaluate("()=>gestionRefresh(true)"); nap(1.5)
    co.click("[data-action='toggle-role-menu']"); nap(0.8)
    check("invitation visible dans Changer de rôle", co.locator("[data-action='gx-accept']").count() == 1)
    co.screenshot(path="/root/work/gx-compta-invite.png")
    co.click("[data-action='gx-accept']")
    try: co.wait_for_selector("#gx-root .gx-bottom", timeout=15000)
    except Exception as e: print("    attente:", e, co.evaluate("()=>JSON.stringify(state.gestion)"))
    check("après Rejoindre, la gestion s'ouvre (téléphone)", co.locator("#gx-root.gx-narrow .gx-bottom").count() == 1)
    nap(1.5)
    check("le comptable voit la vente du chef", "11 000 F" in co.inner_text("#gx-root"))
    check("rien ne dépasse la largeur du téléphone", overflow(co) <= 1, overflow(co))
    co.screenshot(path="/root/work/gx-compta-home.png")
    # hors connexion : dépense
    kst["off"] = True
    co.evaluate("()=>{Object.defineProperty(navigator,'onLine',{get:()=>false,configurable:true});window.dispatchEvent(new Event('offline'))}")
    co.click("[data-a='new'][data-v='expense']"); nap(0.4)
    co.select_option("#cat", "loyer"); co.fill("#amount", "75000"); co.click("[data-a='save-expense']"); nap(0.5)
    sync_txt = co.inner_text("#gx-sync")
    check("hors connexion : dépense gardée, 1 en attente", "1" in sync_txt and ("connexion" in sync_txt.lower() or "attente" in sync_txt.lower()), sync_txt)
    co.screenshot(path="/root/work/gx-compta-offline.png")
    co.reload(wait_until="load"); nap(5); login(co, "COMPTA")
    co.evaluate("()=>{Object.defineProperty(navigator,'onLine',{get:()=>false,configurable:true})}")
    co.evaluate("()=>gestionOpen(gestionState().companies[0].id)"); nap(2.5)
    check("après redémarrage sans réseau : la dépense est toujours là", "75 000" in co.inner_text("#gx-root"), co.inner_text("#gx-root")[:300])
    kst["off"] = False
    co.evaluate("()=>{Object.defineProperty(navigator,'onLine',{get:()=>true,configurable:true});window.dispatchEvent(new Event('online'))}"); nap(2.5)
    check("retour du réseau : envoyée au serveur", any(o["data"]["k"] == "expense" for o in dump()["tables"]["gestion_ops"]))
    check("indicateur « À jour »", "jour" in co.inner_text("#gx-sync").lower(), co.inner_text("#gx-sync"))

    print("== Caissier et partenaire")
    ca, _, aerr, _ = newpage(b, "CAISSE", False)
    ca.evaluate("()=>gestionRefresh(true)"); nap(1.2)
    ca.evaluate("()=>gestionRespond(gestionState().invites[0].id,true)"); nap(4)
    check("caissier : pas d'onglet Dépenses", ca.locator(".gx-bottom [data-v='expenses']").count() == 0)
    ca.click("[data-a='new'][data-v='sale']"); nap(0.4)
    ca.click(".gx-pick-list button:has-text('Fer')"); ca.select_option("#mode", "om"); ca.click("[data-a='save-sale']"); nap(2)
    check("vente du caissier envoyée", sum(1 for o in dump()["tables"]["gestion_ops"] if o["data"]["k"] == "sale") == 2)
    ca.screenshot(path="/root/work/gx-caisse.png")
    pa, _, perr, _ = newpage(b, "PART", False)
    pa.evaluate("()=>gestionRefresh(true)"); nap(1.2)
    pa.evaluate("()=>gestionRespond(gestionState().invites[0].id,true)"); nap(4)
    check("partenaire : pas de bouton Nouvelle vente", pa.locator("[data-a='new']").count() == 0)
    pa.click(".gx-bottom [data-v='reports']"); nap(0.6)
    check("partenaire voit le chiffre d'affaires (15 000 F)", "15 000 F" in pa.inner_text("#gx-root"), pa.inner_text("#gx-root")[:400])
    pa.screenshot(path="/root/work/gx-partenaire.png")

    print("== Retour chez le chef")
    nap(1)
    chef.evaluate("()=>{}"); chef.click(".gx-nav[data-v='home']"); nap(21.5)
    t = chef.inner_text("#gx-root")
    check("le chef reçoit la dépense et la vente du caissier", "75 000" in t and "15 000" in t, t[:500])
    check("alerte stock bas (Fer : 2 ≤ 5)", chef.locator(".gx-chip.warn").count() >= 1)
    chef.click(".gx-nav[data-v='reports']"); nap(0.6)
    chef.screenshot(path="/root/work/gx-chef-reports.png")
    chef.click(".gx-nav[data-v='settings']"); nap(0.6)
    chef.screenshot(path="/root/work/gx-chef-settings.png")
    for name, errs in (("chef", cerr), ("comptable", kerr), ("caissier", aerr), ("partenaire", perr)):
        gx = [e for e in errs if "gestion" in e or "gx" in e or "SnsGestion" in e]
        check("aucune erreur JavaScript (" + name + ")", not gx, gx[:3])
        if errs: print("    (autres erreurs page, " + name + "):", errs[:2])
    b.close()
print("\nÉCHECS:", fails if fails else "aucun")
