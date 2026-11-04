import json, subprocess, sys, os
v, dest = sys.argv[1], sys.argv[2]
T = json.load(open("out/%s_timing.json" % v)); src = "out/%s_complet.mp4" % v
os.makedirs(dest, exist_ok=True)
subprocess.run(["cp", src, dest + "/complet.mp4"], check=True)
st = T["steps"]
for i, (a, b) in enumerate(st):
    s = 0 if i == 0 else a - 0.3
    e = (st[i + 1][0] - 0.25) if i + 1 < len(st) else T["total"]
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "%.3f" % s, "-i", src, "-t", "%.3f" % (e - s), "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-af", "afade=t=out:st=%.3f:d=0.2" % (e - s - 0.2), "-movflags", "+faststart", dest + "/etape-%02d.mp4" % (i + 1)], check=True)
    print(v, i + 1, round(e - s, 1), "s")
