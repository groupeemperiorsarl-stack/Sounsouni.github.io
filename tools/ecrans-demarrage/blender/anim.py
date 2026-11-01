"""Décor 3D de l'écran de démarrage Sounsouni (Blender / Cycles).
python3 scene.py <direction: dune|laterite|marche> <moment: aube|impact|final> <sortie.png> [largeur] [échantillons]"""
import bpy, sys, math, random
from mathutils import Vector
D, M, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
W = int(sys.argv[4]) if len(sys.argv) > 4 else 540
SPP = int(sys.argv[5]) if len(sys.argv) > 5 else 48
H = int(W * 844 / 390)
random.seed(4)
import os
T = float(os.environ.get("T", "-1"))
def kf(pts, t=None):
    t = T if t is None else t
    if t <= pts[0][0]: return pts[0][1]
    for (a, va), (b, vb) in zip(pts, pts[1:]):
        if t <= b:
            u = (t - a) / (b - a); u = u * u * (3 - 2 * u)
            if isinstance(va, tuple): return tuple(x + (y - x) * u for x, y in zip(va, vb))
            return va + (vb - va) * u
    return pts[-1][1]
if T >= 0: M = "aube" if T < 1.1 else ("impact" if T < 1.6 else ("pousse" if T < 2.8 else "final"))
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = SPP
sc.cycles.use_denoising = True
try: sc.cycles.denoiser = "OPENIMAGEDENOISE"
except Exception: pass
sc.render.resolution_x, sc.render.resolution_y = W, H
sc.view_settings.view_transform = __import__("os").environ.get("VT","AgX"); sc.view_settings.look = "AgX - Punchy" if sc.view_settings.view_transform=="AgX" else "None"; sc.view_settings.exposure = float(__import__("os").environ.get("EXPO","-0.6"))
sc.cycles.max_bounces = 6

def mat(name):
    m = bpy.data.materials.new(name); m.use_nodes = True; return m, m.node_tree.nodes, m.node_tree.links

# ---------- ciel et soleil ----------
world = bpy.data.worlds.new("w"); sc.world = world; world.use_nodes = True
wn, wl = world.node_tree.nodes, world.node_tree.links
# ciel peint : bleu profond en haut, orange puis or vers l'horizon, halo autour du soleil
import os
SUNROT = math.radians(float(os.environ.get("SUNROT", "345")))
elev = {"aube": -1.5, "impact": 0.8, "pousse": 2.2, "final": float(os.environ.get("ELEV", "3"))}[M]
if T >= 0: elev = kf([(0, -2.0), (1.0, -1.5), (1.4, .8), (2.2, 2.2), (3.2, 3.6), (8, 4.3)])
sdir = Vector((math.sin(SUNROT) * math.cos(math.radians(elev)), math.cos(SUNROT) * math.cos(math.radians(elev)), math.sin(math.radians(elev)))).normalized()
tc = wn.new("ShaderNodeTexCoord"); sep = wn.new("ShaderNodeSeparateXYZ"); wl.new(tc.outputs["Generated"], sep.inputs[0])
mr = wn.new("ShaderNodeMapRange"); mr.inputs[1].default_value = -1; mr.inputs[2].default_value = 1; wl.new(sep.outputs["Z"], mr.inputs[0])
rp = wn.new("ShaderNodeValToRGB"); wl.new(mr.outputs[0], rp.inputs[0])
pal = {"aube": [(0, (.05, .03, .06)), (.5, (.12, .06, .08)), (.53, (.25, .1, .12)), (.62, (.05, .05, .16)), (1, (.004, .006, .03))],
       "impact": [(0, (.1, .05, .03)), (.5, (.9, .35, .12)), (.53, (1.0, .45, .18)), (.6, (.35, .22, .35)), (1, (.02, .04, .14))],
       "pousse": [(0, (.18, .09, .05)), (.5, (1.3, .5, .17)), (.52, (1.15, .5, .2)), (.58, (.55, .38, .42)), (.7, (.15, .2, .45)), (1, (.02, .07, .26))],
       "final": [(0, (.2, .1, .05)), (.5, (1.5, .55, .18)), (.52, (1.25, .55, .22)), (.58, (.6, .45, .45)), (.7, (.2, .3, .6)), (1, (.03, .1, .35))]}[M]
if T >= 0:
    P6 = {"aube": [(.05, .03, .06), (.12, .06, .08), (.22, .09, .11), (.12, .06, .14), (.04, .04, .15), (.004, .006, .03)],
          "impact": [(.1, .05, .03), (.9, .35, .12), (1.0, .45, .18), (.55, .3, .38), (.2, .2, .4), (.02, .04, .14)],
          "pousse": [(.18, .09, .05), (1.3, .5, .17), (1.15, .5, .2), (.55, .38, .42), (.15, .2, .45), (.02, .07, .26)],
          "final": [(.2, .1, .05), (1.5, .55, .18), (1.25, .55, .22), (.6, .45, .45), (.2, .3, .6), (.03, .1, .35)]}
    cols6 = [kf([(1.0, P6["aube"][i]), (1.4, P6["impact"][i]), (2.2, P6["pousse"][i]), (3.2, P6["final"][i])]) for i in range(6)]
    pal = list(zip([0, .5, .52, .58, .7, 1], cols6))
el = rp.color_ramp.elements
while len(el) < len(pal): el.new(.5)
for e, (p, c) in zip(el, pal): e.position = p; e.color = (*c, 1)
dot = wn.new("ShaderNodeVectorMath"); dot.operation = "DOT_PRODUCT"; dot.inputs[1].default_value = sdir
wl.new(tc.outputs["Generated"], dot.inputs[0])
cl = wn.new("ShaderNodeMath"); cl.operation = "MAXIMUM"; cl.inputs[1].default_value = 0; wl.new(dot.outputs["Value"], cl.inputs[0])
pw = wn.new("ShaderNodeMath"); pw.operation = "POWER"; pw.inputs[1].default_value = float(os.environ.get("GP","150")); wl.new(cl.outputs[0], pw.inputs[0])
pw2 = wn.new("ShaderNodeMath"); pw2.operation = "POWER"; pw2.inputs[1].default_value = 2500; wl.new(cl.outputs[0], pw2.inputs[0])
glow = wn.new("ShaderNodeMath"); glow.operation = "MULTIPLY_ADD"; glow.inputs[1].default_value = kf([(1.0, .1), (1.4, 1.2), (2.2, 1.4), (3.2, 1.5)]) if T >= 0 else {"aube": .1, "impact": 1.2, "pousse": 1.4, "final": float(os.environ.get("GM","1.5"))}[M]
wl.new(pw.outputs[0], glow.inputs[0]); m2 = wn.new("ShaderNodeMath"); m2.operation = "MULTIPLY"; m2.inputs[1].default_value = kf([(1.2, 0), (1.5, 60), (2.2, 90), (3.2, 120)]) if T >= 0 else {"aube": 0, "impact": 60, "pousse": 90, "final": 120}[M]
wl.new(pw2.outputs[0], m2.inputs[0]); wl.new(m2.outputs[0], glow.inputs[2])
gc = wn.new("ShaderNodeMix"); gc.data_type = "RGBA"; gc.blend_type = "ADD"
wl.new(glow.outputs[0], gc.inputs["Factor"]); wl.new(rp.outputs["Color"], gc.inputs["A"]); gc.inputs["B"].default_value = (1.0, .78, .45, 1)
bg = wn["Background"]; bg.inputs[1].default_value = 1.0
# la lumière du ciel sur le sol reste faible : le soleil rasant fait le relief
lp = wn.new("ShaderNodeLightPath"); bg2 = wn.new("ShaderNodeBackground"); bg2.inputs[1].default_value = .35
wms = wn.new("ShaderNodeMixShader"); wl.new(lp.outputs["Is Camera Ray"], wms.inputs[0])
wl.new(gc.outputs["Result"], bg.inputs[0]); wl.new(gc.outputs["Result"], bg2.inputs[0])
wl.new(bg2.outputs[0], wms.inputs[1]); wl.new(bg.outputs[0], wms.inputs[2]); wl.new(wms.outputs[0], wn["World Output"].inputs[0])
sun_d = bpy.data.lights.new("sun", "SUN"); sun_d.energy = kf([(1.0, .4), (1.4, 2.5), (2.2, 4.5), (3.2, 6.0)]) if T >= 0 else {"aube": .4, "impact": 2.5, "pousse": 4.5, "final": 6.0}[M]
sun_d.color = (1.0, .62, .36) if M != "final" else (1.0, .72, .48); sun_d.angle = math.radians(1.2)
sun = bpy.data.objects.new("sun", sun_d); sc.collection.objects.link(sun)
sun.rotation_mode = "QUATERNION"; sun.rotation_quaternion = (-sdir).to_track_quat("-Z", "Y") if elev > 0 else Vector((0, 1, -.3)).to_track_quat("-Z", "Y")

fill_d = bpy.data.lights.new("rebond", "SUN"); fill_d.energy = kf([(1.0, .15), (1.4, .8), (2.2, 1.2), (3.2, 1.6)]) if T >= 0 else {"aube": .15, "impact": .8, "pousse": 1.2, "final": float(os.environ.get("FILL","1.6"))}[M]; fill_d.color = (1.0, .7, .45); fill_d.angle = math.radians(20)
fill = bpy.data.objects.new("rebond", fill_d); sc.collection.objects.link(fill); fill.rotation_euler = (math.radians(62), 0, math.radians(200))
# ---------- sol ----------
bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 18, 0))
g = bpy.context.object
mod = g.modifiers.new("sub", "SUBSURF"); mod.subdivision_type = "SIMPLE"; mod.levels = mod.render_levels = 7
tex = bpy.data.textures.new("dunes", "CLOUDS"); tex.noise_scale = 6.0
disp = g.modifiers.new("d", "DISPLACE"); disp.texture = tex; disp.strength = {"dune": 1.4, "laterite": .35, "marche": .2}[D]; disp.mid_level = .5
m, n, l = mat("sol")
bsdf = n["Principled BSDF"]
coord = n.new("ShaderNodeTexCoord")
# rides de vent (sable) ou terre craquelée (latérite)
wave = n.new("ShaderNodeTexWave"); wave.inputs["Scale"].default_value = {"dune": 7.0, "laterite": 2.0, "marche": 2.0}[D]
wave.inputs["Distortion"].default_value = 14.0; wave.inputs["Detail"].default_value = 5.0; wave.inputs["Detail Scale"].default_value = 1.5
grain = n.new("ShaderNodeTexNoise"); grain.inputs["Scale"].default_value = 900.0; grain.inputs["Detail"].default_value = 2.0
big = n.new("ShaderNodeTexNoise"); big.inputs["Scale"].default_value = 3.0; big.inputs["Detail"].default_value = 6.0
l.new(coord.outputs["Object"], wave.inputs["Vector"]); l.new(coord.outputs["Object"], grain.inputs["Vector"]); l.new(coord.outputs["Object"], big.inputs["Vector"])
ramp = n.new("ShaderNodeValToRGB")
c1, c2 = {"dune": ((.7, .36, .12, 1), (.95, .6, .26, 1)), "laterite": ((.55, .12, .04, 1), (.8, .26, .08, 1)), "marche": ((.38, .22, .12, 1), (.58, .36, .2, 1))}[D]
ramp.color_ramp.elements[0].color = c1; ramp.color_ramp.elements[1].color = c2
l.new(big.outputs["Fac"], ramp.inputs["Fac"]); l.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
bsdf.inputs["Roughness"].default_value = .92
mixb = n.new("ShaderNodeMath"); mixb.operation = "ADD"
mw = n.new("ShaderNodeMath"); mw.operation = "MULTIPLY"; mw.inputs[1].default_value = {"dune": .38, "laterite": .2, "marche": .15}[D]
l.new(wave.outputs["Fac"], mw.inputs[0])
mg = n.new("ShaderNodeMath"); mg.operation = "MULTIPLY"; mg.inputs[1].default_value = .35
l.new(grain.outputs["Fac"], mg.inputs[0]); l.new(mw.outputs[0], mixb.inputs[0]); l.new(mg.outputs[0], mixb.inputs[1])
bump = n.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = .55; bump.inputs["Distance"].default_value = .02
l.new(mixb.outputs[0], bump.inputs["Height"]); l.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
# paillettes du sable (quelques grains brillants)
if D == "dune":
    sp = n.new("ShaderNodeTexVoronoi"); sp.inputs["Scale"].default_value = 1400.0
    l.new(coord.outputs["Object"], sp.inputs["Vector"])
    th = n.new("ShaderNodeMath"); th.operation = "LESS_THAN"; th.inputs[1].default_value = .06
    l.new(sp.outputs["Distance"], th.inputs[0])
    for nm in ("Coat Weight", "Specular IOR Level"):
        if nm in bsdf.inputs: l.new(th.outputs[0], bsdf.inputs[nm]); break
g.data.materials.append(m)
bpy.ops.object.shade_smooth()

# ---------- décor selon la direction ----------
def cyl(r1, r2, h, loc, rot=(0, 0, 0), m=None):
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=r1, radius2=r2, depth=h, location=loc, rotation=rot)
    o = bpy.context.object
    if m: o.data.materials.append(m)
    return o
if D == "laterite":
    bm, bn, bl = mat("baobab"); bn["Principled BSDF"].inputs["Base Color"].default_value = (.09, .05, .04, 1); bn["Principled BSDF"].inputs["Roughness"].default_value = 1
    def seg(p0, p1, r0, r1):
        d = p1 - p0; o = cyl(r0, r1, d.length, (p0 + p1) / 2, m=bm); o.rotation_mode = "QUATERNION"; o.rotation_quaternion = d.to_track_quat("Z", "Y"); return o
    def branch(p, dirv, L, r, lvl):
        q = p + dirv.normalized() * L; seg(p, q, r, r * .62)
        if lvl == 0: return
        for k in range(random.choice((2, 3))):
            nd = dirv.normalized() + Vector((random.uniform(-.9, .9), random.uniform(-.5, .5), random.uniform(-.1, .5)))
            branch(q, nd, L * random.uniform(.5, .7), r * .55, lvl - 1)
    for bx, by, s in ((-12, 70, 1.5), (13, 95, 1.2), (-26, 110, 1.0)):
        # tronc ventru du baobab
        bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=1, depth=1, location=(bx, by, 0))
        t = bpy.context.object; t.data.materials.append(bm)
        me = t.data
        for v in me.vertices:
            h = v.co.z + .5; prof = 1.0 + .35 * math.sin(math.pi * h) - .25 * h
            v.co.x *= prof * 1.5 * s; v.co.y *= prof * 1.5 * s; v.co.z = h * 7.5 * s
        top = Vector((bx, by, 7.3 * s))
        for k in range(6):
            a = k / 6 * math.tau + random.uniform(-.25, .25)
            branch(top, Vector((math.cos(a), math.sin(a) * .6, random.uniform(.35, .8))), 2.6 * s, .45 * s, 2)
if D == "marche":
    cols = [(.85, .1, .1), (.95, .65, .05), (.05, .45, .2), (.1, .25, .75), (.8, .3, .6), (.95, .45, .1), (.55, .1, .5), (.0, .55, .55)]
    night = M == "aube"
    def emis(name, col, stren):
        lm, ln, ll = mat(name); e = ln.new("ShaderNodeEmission"); e.inputs[0].default_value = (*col, 1); e.inputs[1].default_value = stren
        ll.new(e.outputs[0], ln["Material Output"].inputs[0]); return lm
    bulb = emis("ampoule", (1, .72, .38), kf([(1.0, 90), (3.2, 45)]) if T >= 0 else (90 if night else 45))
    poles = []
    for row, (y0, n) in enumerate(((15, 9), (22, 11), (30, 13))):
        for i in range(n):
            x = -15 + 30 * (i + random.uniform(.15, .85)) / n; y = y0 + random.uniform(-1.5, 1.5)
            cm, cn, _ = mat(f"bache{row}_{i}"); cn["Principled BSDF"].inputs["Base Color"].default_value = (*random.choice(cols), 1)
            cn["Principled BSDF"].inputs["Roughness"].default_value = .8
            w = random.uniform(1.8, 3.0); kind = random.random()
            if kind < .35:   # parasol
                bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=w * .7, radius2=.05, depth=.7, location=(x, y, 2.5)); bpy.context.object.data.materials.append(cm)
                cyl(.04, .04, 2.5, (x, y, 1.25))
            else:            # bâche inclinée
                bpy.ops.mesh.primitive_plane_add(size=1, location=(x, y, random.uniform(2.2, 2.7)), rotation=(math.radians(random.uniform(-18, -6)), 0, 0))
                o = bpy.context.object; o.scale = (w, random.uniform(1.6, 2.2), 1); o.data.materials.append(cm)
                for px in (-1, 1): cyl(.04, .04, 2.5, (x + px * w * .45, y - .7, 1.25))
            poles.append(Vector((x, y, 2.6)))
            # étal et marchandises
            bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, .45)); t = bpy.context.object; t.scale = (w * .8, 1.0, .9)
            tm, tn, _ = mat(f"etal{row}_{i}"); tn["Principled BSDF"].inputs["Base Color"].default_value = (.25, .15, .08, 1); t.data.materials.append(tm)
            for k in range(random.randint(4, 9)):
                gm2, gn2, _ = mat(f"m{row}_{i}_{k}"); gn2["Principled BSDF"].inputs["Base Color"].default_value = (*random.choice(cols), 1)
                bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=random.uniform(.12, .22), location=(x + random.uniform(-w * .35, w * .35), y + random.uniform(-.35, .35), 1.0))
                bpy.context.object.data.materials.append(gm2)
            if random.random() < .6:
                bpy.ops.mesh.primitive_uv_sphere_add(radius=.07, location=(x, y - .3, 2.05)); bpy.context.object.data.materials.append(bulb)
    # guirlandes d'ampoules entre les poteaux
    poles.sort(key=lambda p: (round(p.y / 5), p.x))
    for p0, p1 in zip(poles, poles[1:]):
        if (p1 - p0).length > 7: continue
        for k in range(1, 8):
            u = k / 8; q = p0.lerp(p1, u); q.z -= .45 * math.sin(math.pi * u)
            bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=6, radius=.045, location=q); bpy.context.object.data.materials.append(bulb)

# ---------- fruit (image du logo, posée dans la scène) ----------
img = bpy.data.images.load("/root/blend/fruit_noleaf.png" if (T >= 0 or M != "final") else "/root/blend/fruit.png")
fm, fn, fl = mat("fruit")
ti = fn.new("ShaderNodeTexImage"); ti.image = img
fb = fn["Principled BSDF"]; 
fb.inputs["Roughness"].default_value = .6
uvn = fn.new("ShaderNodeTexCoord"); sepu = fn.new("ShaderNodeSeparateXYZ"); fl.new(uvn.outputs["UV"], sepu.inputs[0])
shade = fn.new("ShaderNodeMapRange"); shade.inputs[1].default_value = 0; shade.inputs[2].default_value = .3; shade.inputs[3].default_value = .62; shade.inputs[4].default_value = 1; fl.new(sepu.outputs["Y"], shade.inputs[0])
tint = fn.new("ShaderNodeMix"); tint.data_type = "RGBA"; tint.blend_type = "MULTIPLY"; tint.inputs["Factor"].default_value = 1
fl.new(ti.outputs["Color"], tint.inputs["A"]); tint.inputs["B"].default_value = (1.0, .93, .8, 1)
dark = fn.new("ShaderNodeMix"); dark.data_type = "RGBA"; dark.blend_type = "MULTIPLY"; dark.inputs["Factor"].default_value = 1
fl.new(tint.outputs["Result"], dark.inputs["A"]); cr = fn.new("ShaderNodeCombineColor"); fl.new(shade.outputs[0], cr.inputs[0]); fl.new(shade.outputs[0], cr.inputs[1]); fl.new(shade.outputs[0], cr.inputs[2]); fl.new(cr.outputs[0], dark.inputs["B"])
em = fn.new("ShaderNodeEmission"); fl.new(dark.outputs["Result"], em.inputs[0]); em.inputs[1].default_value = 1.6 * 2 ** (-0.6 - sc.view_settings.exposure)
add = fn.new("ShaderNodeAddShader"); fl.new(em.outputs[0], add.inputs[1]); fb.inputs["Base Color"].default_value=(0,0,0,1)
tr = fn.new("ShaderNodeBsdfTransparent"); mx = fn.new("ShaderNodeMixShader")
fl.new(ti.outputs["Alpha"], mx.inputs[0]); fl.new(tr.outputs[0], mx.inputs[1]); fl.new(add.outputs[0], mx.inputs[2])
fl.new(mx.outputs[0], fn["Material Output"].inputs[0])
fw = 2.2; fh = fw * img.size[1] / img.size[0]
grow = {"aube": 0.0, "impact": .25, "pousse": .6, "final": 1.0}[M]
if T >= 0:
    u = min(1, max(0, (T - 1.2) / 1.6)); grow = 0 if u <= 0 else 1 - (1 - u) ** 3
dg = bpy.context.evaluated_depsgraph_get()
hit = sc.ray_cast(dg, Vector((0, 0, 20)), Vector((0, 0, -1)))
ground_z = hit[1].z if hit[0] else 0.0
if grow > 0:
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, ground_z + fh / 2 - .05 - (1 - grow) * fh), rotation=(math.radians(90), 0, 0))
    f = bpy.context.object; f.scale = (fw, fh, 1); f.data.materials.append(fm)
    f.visible_shadow = True
if T >= 0 and T > 2.45:
    limg = bpy.data.images.load("/root/blend/leaf.png")
    lmt, lnn, lll = mat("feuille"); lti = lnn.new("ShaderNodeTexImage"); lti.image = limg
    lem = lnn.new("ShaderNodeEmission"); lll.new(lti.outputs["Color"], lem.inputs[0]); lem.inputs[1].default_value = em.inputs[1].default_value
    ltr = lnn.new("ShaderNodeBsdfTransparent"); lmx = lnn.new("ShaderNodeMixShader"); lll.new(lti.outputs["Alpha"], lmx.inputs[0]); lll.new(ltr.outputs[0], lmx.inputs[1]); lll.new(lem.outputs[0], lmx.inputs[2])
    lll.new(lmx.outputs[0], lnn["Material Output"].inputs[0])
    u = min(1, (T - 2.45) / .9); c = 2.6; k = 1 + (c + 1) * (u - 1) ** 3 + c * (u - 1) ** 2
    lw, lh = fw * .451, fh * .2996
    ox, oz = -fw / 2 + fw * (.558 + .12 * .451), ground_z + fh - .05 - fh * .38 * .2996
    bpy.ops.object.empty_add(location=(ox, -.01, oz)); piv = bpy.context.object
    bpy.ops.mesh.primitive_plane_add(size=1, location=(ox + lw * (.5 - .12), -.01, oz + lh * (.38 - .5)), rotation=(math.radians(90), 0, 0))
    lf = bpy.context.object; lf.scale = (lw, lh, 1); lf.data.materials.append(lmt); lf.parent = piv; lf.matrix_parent_inverse = piv.matrix_world.inverted()
    piv.scale = (max(k, .001),) * 3; piv.rotation_euler = (0, math.radians(-50 * (1 - k)), 0)
if grow > 0:
    shm, shn, shl = mat("ombre"); shn.remove(shn["Principled BSDF"])
    gr = shn.new("ShaderNodeTexGradient"); gr.gradient_type = "SPHERICAL"; tcs = shn.new("ShaderNodeTexCoord"); shl.new(tcs.outputs["Object"], gr.inputs[0])
    tp = shn.new("ShaderNodeBsdfTransparent"); dk = shn.new("ShaderNodeBsdfDiffuse"); dk.inputs[0].default_value = (0, 0, 0, 1)
    mxs = shn.new("ShaderNodeMixShader"); pwv = shn.new("ShaderNodeMath"); pwv.operation = "POWER"; pwv.inputs[1].default_value = 1.6
    shl.new(gr.outputs["Fac"], pwv.inputs[0]); mul = shn.new("ShaderNodeMath"); mul.operation = "MULTIPLY"; mul.inputs[1].default_value = .75 * grow
    shl.new(pwv.outputs[0], mul.inputs[0]); shl.new(mul.outputs[0], mxs.inputs[0]); shl.new(tp.outputs[0], mxs.inputs[1]); shl.new(dk.outputs[0], mxs.inputs[2])
    shl.new(mxs.outputs[0], shn["Material Output"].inputs[0])
    bpy.ops.mesh.primitive_plane_add(size=2, location=(0, .1, ground_z + .02)); so = bpy.context.object; so.scale = (fw * .62, .7, 1); so.data.materials.append(shm)
# graine lumineuse qui tombe / éclat à l'impact
if (T >= 0 and T < 2.6) or M in ("aube", "impact"):
    gm, gn, gl = mat("graine"); e = gn.new("ShaderNodeEmission"); e.inputs[0].default_value = (1, .78, .35, 1); e.inputs[1].default_value = 60 if M == "aube" else 200
    gl.new(e.outputs[0], gn["Material Output"].inputs[0])
    seed_z = 3.0 if M == "aube" else .15
    if T >= 0:
        u = min(1, max(0, (T - .25) / .85)); seed_z = 4.6 - (4.6 - .1) * u ** 3
        if T >= 1.1: seed_z = .15
        e.inputs[1].default_value = 60 if T < 1.1 else 200 * math.exp(-(T - 1.1) / .3)
    if T < 0 or T < 1.7:
        bpy.ops.mesh.primitive_uv_sphere_add(radius=.07 if (M == "aube") else .25 * (math.exp(-(T - 1.1) / .3) if T >= 0 else 1), location=(0, 0, ground_z + seed_z)); bpy.context.object.data.materials.append(gm)
        pl = bpy.data.lights.new("lueur", "POINT"); pl.energy = (60 if T < 1.1 else 900 * math.exp(-(T - 1.1) / .35)) if T >= 0 else (60 if M == "aube" else 900); pl.color = (1, .75, .4); pl.shadow_soft_size = .3
        o = bpy.data.objects.new("lueur", pl); o.location = (0, 0, ground_z + (seed_z if M == "aube" else .4)); sc.collection.objects.link(o)
if (T >= 0 and 1.1 <= T < 3.6) or (T < 0 and M in ("impact", "pousse")):
    pm, pn, pl2 = mat("poussiere"); pn["Principled BSDF"].inputs["Base Color"].default_value = (*c2[:3], 1)
    for i in range(260):
        a = random.uniform(0, math.tau); r = random.uniform(.2, 2.2) if M == "impact" else random.uniform(.9, 1.6); h = (random.uniform(.05, 1.6) * (1.2 - r / 2.4)) if M == "impact" else random.uniform(.02, 1.2)
        loc = (math.cos(a) * r, math.sin(a) * r * .6, ground_z + max(.02, h)); rad = random.uniform(.008, .03)
        if T >= 0:
            dt = T - 1.1; sp_ = random.uniform(1.2, 3.2); vz = random.uniform(1.5, 4.0)
            x_ = math.cos(a) * sp_ * dt; y_ = math.sin(a) * sp_ * .6 * dt; z_ = max(.02, vz * dt - 4.9 * dt * dt)
            loc = (x_, y_, ground_z + z_); rad *= max(0, 1 - max(0, dt - 1.3) / 1.2)
            if rad <= 0: continue
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=rad, location=loc)
        bpy.context.object.data.materials.append(pm)
if M == "aube" and (T < 0 or .25 < T < 1.1):
    tm2, tn2, tl2 = mat("trainee"); tn2.remove(tn2["Principled BSDF"]); e2 = tn2.new("ShaderNodeEmission"); e2.inputs[0].default_value = (1, .8, .45, 1)
    gr2 = tn2.new("ShaderNodeTexGradient"); tco = tn2.new("ShaderNodeTexCoord"); sp2 = tn2.new("ShaderNodeSeparateXYZ"); tl2.new(tco.outputs["Generated"], sp2.inputs[0])
    mr2 = tn2.new("ShaderNodeMath"); mr2.operation = "MULTIPLY"; mr2.inputs[1].default_value = 5; tl2.new(sp2.outputs["Z"], mr2.inputs[0]); tl2.new(mr2.outputs[0], e2.inputs[1])
    tr2 = tn2.new("ShaderNodeBsdfTransparent"); ad2 = tn2.new("ShaderNodeAddShader"); tl2.new(e2.outputs[0], ad2.inputs[0]); tl2.new(tr2.outputs[0], ad2.inputs[1])
    tl2.new(ad2.outputs[0], tn2["Material Output"].inputs[0])
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=.035, radius2=.0, depth=(1.8 if T < 0 else .2 + 2.0 * min(1, (T - .25) / .85) ** 2), location=(0, 0, ground_z + (3.9 if T < 0 else seed_z + (.2 + 2.0 * min(1, (T - .25) / .85) ** 2) / 2)), rotation=(math.pi, 0, 0)); bpy.context.object.data.materials.append(tm2)
# étoiles (aube)
if M == "aube" and D != "marche":
    stm, stn, stl = mat("etoile"); e = stn.new("ShaderNodeEmission"); e.inputs[1].default_value = 25; stl.new(e.outputs[0], stn["Material Output"].inputs[0])
    for i in range(120):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=random.uniform(.03, .08), location=(random.uniform(-40, 40), random.uniform(70, 90), random.uniform(10, 60)))
        bpy.context.object.data.materials.append(stm)

# ---------- brume du matin ----------
vm, vn, vl = mat("brume"); vn.remove(vn["Principled BSDF"])
vs = vn.new("ShaderNodeVolumePrincipled"); vs.inputs["Density"].default_value = {"dune": .0035, "laterite": .005, "marche": .006}[D]
vs.inputs["Color"].default_value = (1, .8, .6, 1); vs.inputs["Anisotropy"].default_value = .5
vl.new(vs.outputs[0], vn["Material Output"].inputs["Volume"])
if os.environ.get("FOG", "0") == "1":
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 30, 6)); fog = bpy.context.object; fog.scale = (90, 70, 14); fog.data.materials.append(vm)

# ---------- caméra ----------
cam_d = bpy.data.cameras.new("cam"); cam_d.lens = 32; cam_d.sensor_fit = "VERTICAL"
cam = bpy.data.objects.new("cam", cam_d); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (0, -11.0, ground_z + float(os.environ.get("CZ","1.8")))
if T >= 0: cam.location = (0, kf([(0, -12.8), (8, -11.0)]), ground_z + kf([(0, 2.05), (8, 1.8)]))
tgt = Vector((0, 0, ground_z + float(os.environ.get("TZ_","1.2")))); cam.rotation_mode = "QUATERNION"; cam.rotation_quaternion = (tgt - cam.location).to_track_quat("-Z", "Y")
cam_d.dof.use_dof = True; cam_d.dof.focus_distance = 11.0; cam_d.dof.aperture_fstop = {"dune": 4.0, "laterite": 2.8, "marche": float(os.environ.get("FST",".12"))}[D]
from bpy_extras.object_utils import world_to_camera_view
bpy.context.view_layer.update()
sp_ = world_to_camera_view(sc, cam, cam.location + sdir * 80)
import json; json.dump({"sun": [sp_.x, 1 - sp_.y], "elev": elev, "moment": M, "t": T}, open(OUT + ".json", "w"))
sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print("rendu", OUT)
