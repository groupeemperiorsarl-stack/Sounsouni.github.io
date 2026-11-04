# Fabrique tous les calques fixes (fond, pastilles, sous-titres karaoké, téléphone, main, illustrations).
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from story import VIDEOS, ILL, chunks
from playwright.sync_api import sync_playwright
D = os.path.dirname(os.path.abspath(__file__)); O = D + "/layers"; os.makedirs(O, exist_ok=True)
which = sys.argv[1:] or list(VIDEOS)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 760, "height": 1300}, device_scale_factor=1)
    pg.goto("file://" + D + "/stage.html"); pg.wait_for_timeout(1500)
    pg.evaluate("document.fonts.ready"); pg.wait_for_timeout(800)
    def shot(fn, arg, path):
        pg.evaluate("([f,a])=>mk[f](a)", [fn, arg]); pg.evaluate("document.fonts.ready")
        pg.wait_for_timeout(60 if fn == "cap" else 250)
        pg.locator("#L").screenshot(path=path, omit_background=True)
    shot("phone", {}, O + "/phone.png"); shot("hand", {}, O + "/hand.png"); shot("hand", {"press": True}, O + "/hand_press.png")
    for v in which:
        V = VIDEOS[v]; steps = json.load(open(D + "/" + V["audio"] + ".steps.json"))
        os.makedirs(O + "/" + v, exist_ok=True)
        shot("bg", {"title": V["pill"]}, O + "/%s/bg.png" % v)
        shot("title", {"k": "GUIDE SOUNSOUNI", "h": V["title"], "p": "%d étapes, expliquées geste par geste" % len(steps)}, O + "/%s/title.png" % v)
        done = set()
        for si, st in enumerate(steps):
            n = si + 1; words = [w["w"] for w in st["words"]]
            shot("spill", {"n": n, "m": len(steps)}, O + "/%s/spill%02d.png" % (v, n))
            for ci, (a, b_) in enumerate(chunks(words) if not os.environ.get("ILLONLY") else []):
                for k in range(0, b_ - a + 1):
                    shot("cap", {"title": V["titles"][si], "words": words[a:b_], "k": k}, O + "/%s/cap%02d_%02d_%02d.png" % (v, n, ci, k))
            for cue, bt in V["plan"][si]:
                if "il" in bt and bt["il"] not in done:
                    done.add(bt["il"]); name, k = bt["il"]
                    shot("ill", {"html": ILL[name](k)}, O + "/%s/ill_%s_%d.png" % (v, name, k))
            print(v, "étape", n, "ok", flush=True)
