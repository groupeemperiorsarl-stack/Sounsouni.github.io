from playwright.sync_api import sync_playwright
import os,tempfile; O=tempfile.mkdtemp()+"/"
ok=0;bad=0
def chk(c,m):
    global ok,bad
    if c: ok+=1
    else: bad+=1; print("ÉCHEC",m)
with sync_playwright() as p:
    b=p.chromium.launch()
    for dev,w,h in [("tel",390,844),("ipad",820,1180),("pc",1440,900)]:
        for page in ["index.html","logistique.html","services.html","a-propos.html"]:
            ctx=b.new_context(viewport={"width":w,"height":h},device_scale_factor=1)
            pg=ctx.new_page(); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
            pg.route("**/*",lambda r: r.fulfill(status=200,content_type="application/json",body="[]") if "supabase.co" in r.request.url and "supabase-js" not in r.request.url and "storage" not in r.request.url else r.continue_())
            pg.goto("http://localhost:8765/"+page); pg.wait_for_timeout(3500)
            if page=="index.html":
                vis=pg.evaluate("!document.getElementById('portail').hidden")
                chk(vis,f"{dev} portail visible")
                sw=pg.evaluate("document.getElementById('portail').scrollWidth"); chk(sw<=w,f"{dev} portail largeur {sw}")
                pg.evaluate("document.querySelectorAll('#portail .rv').forEach(e=>e.classList.add('in'))")
                hgt=pg.evaluate("document.getElementById('portail').scrollHeight")
                pg.set_viewport_size({"width":w,"height":hgt}); pg.wait_for_timeout(600)
                pg.screenshot(path=O+f"{dev}-accueil.png")
                chk(pg.evaluate("document.querySelectorAll('#portail [data-sns-map] svg').length")==2,f"{dev} cartes")
                pg.set_viewport_size({"width":w,"height":h})
                pg.click("#portail [data-vit]:nth-child(3)"); chk(pg.inner_text("#vit-feat [data-f=nom]")=="Sac à dos",f"{dev} vitrine")
                pg.click("#portail .door.market .gobtn"); pg.wait_for_timeout(500)
                chk(pg.evaluate("document.getElementById('portail').hidden"),f"{dev} porte marché ferme le portail")
            else:
                sw=pg.evaluate("document.documentElement.scrollWidth"); chk(sw<=w,f"{dev} {page} largeur {sw}")
                pg.evaluate("document.querySelectorAll('.rv').forEach(e=>e.classList.add('in'))"); pg.wait_for_timeout(500)
                pg.screenshot(path=O+f"{dev}-{page[:-5]}.png",full_page=True)
            chk(not errs,f"{dev} {page} erreurs {errs[:2]}")
            ctx.close()
    # compte connecté : pas de portail
    ctx=b.new_context(viewport={"width":390,"height":844}); pg=ctx.new_page()
    pg.add_init_script("localStorage.setItem('sns_has_profile','1')")
    pg.goto("http://localhost:8765/index.html"); pg.wait_for_timeout(1500)
    chk(pg.evaluate("document.getElementById('portail').hidden"),"connecté : pas de portail")
    pg.goto("http://localhost:8765/index.html#accueil"); pg.reload(); pg.wait_for_timeout(1500)
    chk(not pg.evaluate("document.getElementById('portail').hidden"),"#accueil ouvre le portail")
print("réussis",ok,"échoués",bad)
