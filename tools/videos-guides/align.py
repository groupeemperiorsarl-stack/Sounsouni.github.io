# Aligne le texte écrit (paragraphe = étape) sur les mots horodatés de Whisper.
# Sortie : <nom>.steps.json = [{step, start, end, words:[{w (écrit), s, e}]}]
import json, re, sys, difflib, unicodedata
S = "/tmp/claude-0/-home-claude/fd6547ca-a8fa-5cbd-8595-59ca0e32cc71/scratchpad"
def norm(w):
    w = unicodedata.normalize("NFD", w.lower()); w = "".join(c for c in w if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]", "", w)
def run(audio, textfile):
    paras = [p.strip() for p in open(S + "/textes/" + textfile).read().split("\n\n") if p.strip()]
    disp = []  # (step, mot affiché)
    for i, p in enumerate(paras):
        p = re.sub(r"\[[^\]]*\]\s*", "", p)
        for w in p.split():
            disp.append((i, w))
    W = json.load(open(S + "/video/audio/" + audio + "_net.json"))["words"]
    a = [norm(w) for _, w in disp]; b = [norm(x["w"]) for x in W]
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    t = [None] * len(disp)
    for blk in sm.get_matching_blocks():
        for k in range(blk.size): t[blk.a + k] = (W[blk.b + k]["s"], W[blk.b + k]["e"])
    # Interpolation des mots non retrouvés
    n = len(t); known = [i for i in range(n) if t[i]]
    for i in range(n):
        if t[i]: continue
        prv = max([k for k in known if k < i], default=None); nxt = min([k for k in known if k > i], default=None)
        s0 = t[prv][1] if prv is not None else 0.0; s1 = t[nxt][0] if nxt is not None else W[-1]["e"]
        span = (nxt if nxt is not None else n) - (prv if prv is not None else -1)
        pos = i - (prv if prv is not None else -1)
        a0 = s0 + (s1 - s0) * (pos - 1) / span; a1 = s0 + (s1 - s0) * pos / span
        t[i] = (round(a0, 2), round(a1, 2))
    steps = []
    for i in range(len(paras)):
        ws = [{"w": disp[k][1], "s": t[k][0], "e": t[k][1]} for k in range(n) if disp[k][0] == i]
        steps.append({"step": i + 1, "start": ws[0]["s"], "end": ws[-1]["e"], "words": ws})
    matched = sum(1 for blk in sm.get_matching_blocks() for _ in range(blk.size))
    print(audio, "mots écrits", n, "retrouvés", matched, "whisper", len(b))
    for s in steps: print("  étape", s["step"], s["start"], "→", s["end"], " ".join(w["w"] for w in s["words"][:8]))
    json.dump(steps, open(S + "/video/" + audio + ".steps.json", "w"), ensure_ascii=False)
run(sys.argv[1], sys.argv[2])
