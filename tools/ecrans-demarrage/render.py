import sys, os, shutil, subprocess, time
from playwright.sync_api import sync_playwright
name = sys.argv[1]; fps = int(sys.argv[2]) if len(sys.argv) > 2 else 30; only = sys.argv[3] if len(sys.argv) > 3 else None
out = f"/root/splash/frames_{name}"
if not only: shutil.rmtree(out, ignore_errors=True); os.makedirs(out, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: m.type == "error" and errs.append(m.text))
    pg.goto(f"http://localhost:8899/{name}.html"); pg.wait_for_function("()=>window.READY!==false && window.frame", timeout=60000)
    pg.evaluate("document.fonts.ready"); pg.wait_for_timeout(800)
    dur = pg.evaluate("window.DUR")
    if only:
        for ts in only.split(","):
            pg.evaluate(f"frame({ts})"); pg.wait_for_timeout(50); pg.screenshot(path=f"/root/splash/{name}_t{ts}.png")
    else:
        n = int(dur * fps); t0 = time.time()
        for i in range(n):
            pg.evaluate(f"frame({i / fps})"); pg.screenshot(path=f"{out}/f{i:04d}.jpg", type="jpeg", quality=93)
        print(name, n, "images en", round(time.time() - t0), "s")
    print("erreurs:", errs[:3])
    b.close()
if not only:
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(fps), "-i", f"{out}/f%04d.jpg", "-vf", "scale=720:-2:flags=lanczos", "-c:v", "libx264", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart", f"/root/splash/{name}_silent.mp4"], check=True)
