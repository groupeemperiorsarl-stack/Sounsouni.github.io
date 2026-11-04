import json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from shots import T, P
from playwright.sync_api import sync_playwright
D = os.path.dirname(os.path.abspath(__file__))
OUT = D + "/shots"; os.makedirs(OUT, exist_ok=True)
SEED = open(D + "/harness_seed.js").read()
HELP = """window.Q=function(sel,txt){var best=null,ba=1e12;document.querySelectorAll(sel).forEach(function(e){if((e.innerText||'').indexOf(txt)<0)return;var r=e.getBoundingClientRect();if(r.width<=0)return;var a=r.width*r.height;if(a<ba){ba=a;best=e;}});return best;};
window.EL=function(s){return s.indexOf('js:')===0?eval(s.slice(3)):document.querySelector(s);};"""
only = sys.argv[1:]
meta = {}
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("dialog", lambda d: d.accept())
    def route(r):
        u = r.request.url
        if "supabase.co" in u and "supabase-js" not in u:
            return r.fulfill(status=200, content_type="application/json", body=json.dumps({"success": False}) if "/functions/" in u else "[]")
        return r.continue_()
    pg.route("**/*", route)
    pg.add_init_script("try{localStorage.setItem('sounsouni_language','fr')}catch(e){}")
    pg.goto("http://localhost:8765/index.html"); pg.wait_for_timeout(3500)
    pg.wait_for_function("()=>typeof state!=='undefined'&&typeof render==='function'", timeout=20000)
    pg.wait_for_timeout(2500)
    pg.wait_for_timeout(7000)
    pg.evaluate("()=>{"+SEED+"}"); pg.evaluate("()=>{"+HELP+"}")
    # Gèle les listes pour que la synchro de fond ne les vide pas.
    pg.evaluate("""()=>{['orders','externalParcels'].forEach(function(k){var v=state[k];Object.defineProperty(state,k,{configurable:true,get:function(){return v},set:function(n){if(window.__allow)v=n;}});});}""")
    for name, s in list(T.items()) + list(P.items()):
        if only and name not in only: continue
        pg.evaluate("()=>{var t=document.querySelectorAll('.toast,#toast');t.forEach(function(x){x.remove()});document.querySelectorAll('.modal-overlay').forEach(function(m){});}")
        pg.evaluate("()=>{window.__allow=true;clearTimeout(window._toastTimer);state.toastMsg=null;}")
        try:
            pg.evaluate("()=>{" + s["js"] + "}")
        except Exception as e:
            print("JS ERR", name, e); continue
        pg.evaluate("()=>{window.__allow=false}")
        pg.wait_for_timeout(500)
        if s.get("scroll"):
            pg.evaluate("""(s)=>{var e=EL(s);if(!e)return;var m=e.closest('.modal-sheet');var r=e.getBoundingClientRect();
              if(m&&m.scrollHeight>m.clientHeight){m.scrollTop+=r.top-180;}else{window.scrollBy(0,r.top-170);}}""", s["scroll"])
            pg.wait_for_timeout(400)
        boxes = {}
        for k, sel in s["targets"].items():
            r = pg.evaluate("(s)=>{var e=EL(s);if(!e)return null;var r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]}", sel)
            boxes[k] = r
            if r is None: print("  ?? cible manquante", name, k)
        pg.screenshot(path=f"{OUT}/{name}.png")
        meta[name] = boxes
        print(name, "ok", {k: (None if v is None else [round(x) for x in v]) for k, v in boxes.items()})
    old = json.load(open(OUT + "/boxes.json")) if os.path.exists(OUT + "/boxes.json") else {}
    old.update(meta); json.dump(old, open(OUT + "/boxes.json", "w"), indent=1)
    print("errors:", errs[:5])
