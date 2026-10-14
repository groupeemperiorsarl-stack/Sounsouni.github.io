# Médaillon Sounsouni — rendu photoréaliste Blender/Cycles
# usage: python medal.py <objet: shoe|watch|...> <sortie.png> [taille] [échantillons]
import bpy, bmesh, math, sys, os, mathutils
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
KIND, OUT = args[0], args[1]
SIZE = int(args[2]) if len(args) > 2 else 640
SPP = int(args[3]) if len(args) > 3 else 128
HERE = os.path.dirname(os.path.abspath(__file__))
V = os.environ.get('SNS_V', '')
def M(r):
    return 0.77 + (r - 0.64) * 0.647 if V else r
ZK = 0.85 if V else 1.0
TK = 0.75 if V else 1.0
GLTF = os.path.join(HERE, '..', 'gltf')
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = SPP
sc.cycles.use_denoising = True
try: sc.cycles.denoiser = 'OPENIMAGEDENOISE'
except Exception: pass
sc.cycles.max_bounces = 12; sc.cycles.transmission_bounces = 12; sc.cycles.glossy_bounces = 8
sc.cycles.caustics_reflective = True; sc.cycles.caustics_refractive = True
sc.render.resolution_x = sc.render.resolution_y = SIZE; sc.render.film_transparent = True
sc.view_settings.view_transform = 'Khronos PBR Neutral'
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'

def mat(name):
    m = bpy.data.materials.new(name); m.use_nodes = True; return m, m.node_tree.nodes, m.node_tree.links
def bsdf(nodes): return nodes.get('Principled BSDF')

# ---------- monde : HDRI studio + ton chaud ----------
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
wn, wl = w.node_tree.nodes, w.node_tree.links
env = wn.new('ShaderNodeTexEnvironment')
env.image = bpy.data.images.load('/home/claude/blend/lib/python3.13/site-packages/bpy/5.2/datafiles/studiolights/world/' + (os.environ.get('SNS_ENV') or ('studio' if V else 'interior')) + '.exr')
bg = wn['Background']; bg.inputs['Strength'].default_value = 0.55
mp = wn.new('ShaderNodeMapping'); mp.inputs['Rotation'].default_value = (0, 0, math.radians(200))
tcw = wn.new('ShaderNodeTexCoord'); wl.new(tcw.outputs['Generated'], mp.inputs['Vector']); wl.new(mp.outputs['Vector'], env.inputs['Vector'])
wl.new(env.outputs['Color'], bg.inputs['Color'])

# ---------- or champagne (rayures fines) ----------
gold, gn, gl = mat('gold'); g = bsdf(gn)
g.inputs['Base Color'].default_value = (0.96, 0.70, 0.33, 1); g.inputs['Metallic'].default_value = 1
g.inputs['Roughness'].default_value = 0.16
tc = gn.new('ShaderNodeTexCoord')
noise = gn.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 900; noise.inputs['Detail'].default_value = 2
wave = gn.new('ShaderNodeTexWave'); wave.inputs['Scale'].default_value = 260; wave.inputs['Distortion'].default_value = 30; wave.wave_type = 'BANDS'
mix = gn.new('ShaderNodeMix'); mix.data_type = 'FLOAT'; mix.inputs['Factor'].default_value = 0.5
gl.new(tc.outputs['Object'], noise.inputs['Vector']); gl.new(tc.outputs['Object'], wave.inputs['Vector'])
gl.new(noise.outputs['Fac'], mix.inputs['A']); gl.new(wave.outputs['Fac'], mix.inputs['B'])
mr = gn.new('ShaderNodeMapRange'); mr.inputs['To Min'].default_value = 0.12; mr.inputs['To Max'].default_value = 0.26
gl.new(mix.outputs['Result'], mr.inputs['Value']); gl.new(mr.outputs['Result'], g.inputs['Roughness'])
# gravure : image en relief (coordonnées UV de la bande)
eng = gn.new('ShaderNodeTexImage'); eng.image = bpy.data.images.load(os.path.join(HERE, 'engrave.png')); eng.image.colorspace_settings.name = 'Non-Color'
uvn = gn.new('ShaderNodeUVMap')
gl.new(uvn.outputs['UV'], eng.inputs['Vector'])
bump = gn.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 1.0; bump.inputs['Distance'].default_value = 0.01
gl.new(eng.outputs['Color'], bump.inputs['Height']); gl.new(bump.outputs['Normal'], g.inputs['Normal'])
gold_plain, gpn, _ = mat('gold_plain'); gp = bsdf(gpn)
gp.inputs['Base Color'].default_value = (0.97, 0.73, 0.37, 1); gp.inputs['Metallic'].default_value = 1; gp.inputs['Roughness'].default_value = 0.12

# ---------- anneau : profil tourné (vis) ----------
def lathe(name, prof, steps, material, uv_band=None):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    rings = []
    for i in range(steps):
        a = 2 * math.pi * i / steps
        rings.append([bm.verts.new((r * math.cos(a), r * math.sin(a), z)) for (r, z) in prof])
    bm.verts.ensure_lookup_table()
    uvl = bm.loops.layers.uv.new('UVMap')
    n = len(prof)
    for i in range(steps):
        A, Bn = rings[i], rings[(i + 1) % steps]
        for j in range(n - 1):
            f = bm.faces.new((A[j], Bn[j], Bn[j + 1], A[j + 1]))
            us = [i / steps, (i + 1) / steps, (i + 1) / steps, i / steps]; vs = [j / (n - 1), j / (n - 1), (j + 1) / (n - 1), (j + 1) / (n - 1)]
            for k, l in enumerate(f.loops):
                v = vs[k]
                if uv_band: v = min(1, max(0, (v - uv_band[0]) / (uv_band[1] - uv_band[0])))
                l[uvl].uv = (us[k], v)
    bm.normal_update(); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob)
    for p in me.polygons: p.use_smooth = True
    me.materials.append(material)
    return ob

prof = []
def A(r, z): prof.append((r, z))
def arc(cr, cz, rad, a0, a1, n):
    for i in range(n + 1):
        a = a0 + (a1 - a0) * i / n; A(cr + rad * math.cos(a), cz + rad * math.sin(a))
A(0.640, -0.10)
arc(0.668, 0.075, 0.03, math.pi, 0.05, 14)
A(0.705, 0.052); A(0.718, 0.062)
band0 = len(prof)
arc(0.80, 0.072, 0.088, math.pi * 0.95, math.pi * 0.05, 30)
band1 = len(prof)
A(0.893, 0.072); A(0.905, 0.062)
arc(0.955, 0.062, 0.05, math.pi, 0, 20)
A(1.008, -0.10)
nP = len(prof)
prof = [(M(r), z * ZK) for r, z in prof]
ring = lathe('ring', prof, 360, gold, uv_band=((band0) / (nP - 1), (band1 - 1) / (nP - 1)))
# filets concentriques
def torus(name, R, r, z, material, maj=256, mino=16):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=maj, minor_segments=mino, location=(0, 0, z))
    o = bpy.context.active_object; o.name = name; o.data.materials.append(material)
    for p in o.data.polygons: p.use_smooth = True
    return o
torus('fil1', M(0.705), 0.010 * TK, 0.07 * ZK, gold_plain); torus('fil2', M(0.895), 0.011 * TK, 0.082 * ZK, gold_plain); torus('fil3', M(1.012), 0.014 * TK, -0.02, gold_plain)

bpy.ops.mesh.primitive_uv_sphere_add(radius=0.0135 * TK, segments=12, ring_count=8)
bead = bpy.context.active_object; bead.data.materials.append(gold_plain)
for p in bead.data.polygons: p.use_smooth = True
NB = 150
for i in range(NB):
    a = 2 * math.pi * (i + 0.5) / NB
    for rr, zz in ((0.742, 0.142), (0.858, 0.142)):
        b = bead.copy(); b.data = bead.data; sc.collection.objects.link(b); b.location = (M(rr) * math.cos(a), M(rr) * math.sin(a), zz * ZK)
bpy.data.objects.remove(bead)
for i in range(10):
    a = math.pi / 2 + 2 * math.pi * (i + 0.5) / 10
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.024 * TK, segments=20, ring_count=12, location=(M(0.80) * math.cos(a), M(0.80) * math.sin(a), 0.172 * ZK))
    f = bpy.context.active_object; f.data.materials.append(gold_plain)
    for p in f.data.polygons: p.use_smooth = True
# ---------- émeraudes taille brillant (verre physique) ----------
gem, emn, eml = mat('emerald'); e = bsdf(emn)
e.inputs['Base Color'].default_value = (0.02, 0.55, 0.18, 1); e.inputs['Transmission Weight'].default_value = 1.0
e.inputs['Roughness'].default_value = 0.0; e.inputs['IOR'].default_value = 1.58
emn['Material Output'].target = 'ALL'
# absorption en volume : vert profond
vol = emn.new('ShaderNodeVolumeAbsorption'); vol.inputs['Color'].default_value = (0.05, 0.75, 0.25, 1); vol.inputs['Density'].default_value = 18
eml.new(vol.outputs['Volume'], emn['Material Output'].inputs['Volume'])
def brilliant(name, rad, depth):
    bm = bmesh.new(); seg = 16
    table = [bm.verts.new((rad * 0.55 * math.cos(2 * math.pi * i / 8 + math.pi / 8), rad * 0.55 * math.sin(2 * math.pi * i / 8 + math.pi / 8), depth * 0.42)) for i in range(8)]
    girdle = [bm.verts.new((rad * math.cos(2 * math.pi * i / seg), rad * math.sin(2 * math.pi * i / seg), depth * 0.08)) for i in range(seg)]
    girdle2 = [bm.verts.new((rad * math.cos(2 * math.pi * i / seg), rad * math.sin(2 * math.pi * i / seg), 0)) for i in range(seg)]
    cul = bm.verts.new((0, 0, -depth))
    bm.faces.new(table)
    for i in range(8):
        a, b = table[i], table[(i + 1) % 8]; g0, g1, g2 = girdle[2 * i], girdle[(2 * i + 1) % seg], girdle[(2 * i + 2) % seg]
        bm.faces.new((a, g1, b)); bm.faces.new((a, g0, g1)); bm.faces.new((b, g1, g2))
    for i in range(seg):
        bm.faces.new((girdle[i], girdle2[i], girdle2[(i + 1) % seg], girdle[(i + 1) % seg]))
        bm.faces.new((girdle2[(i + 1) % seg], girdle2[i], cul))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o); me.materials.append(gem); return o
NG = 10
for i in range(NG):
    a = math.pi / 2 + 2 * math.pi * i / NG
    GK = 0.82 if V else 1.0
    x, y = M(0.955) * math.cos(a), M(0.955) * math.sin(a)
    gm = brilliant('gem%d' % i, 0.075 * GK, 0.07 * GK); gm.location = (x, y, 0.135 * ZK)
    c = torus('cup%d' % i, 0.083 * GK, 0.02 * GK, 0.118 * ZK, gold_plain, 48, 12); c.location = (x, y, 0.118 * ZK)
    for k in range(4):
        pa = 2 * math.pi * k / 4 + math.pi / 4 + a
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.022 * GK, segments=16, ring_count=10, location=(x + 0.082 * GK * math.cos(pa), y + 0.082 * GK * math.sin(pa), 0.16 * ZK))
        pr = bpy.context.active_object; pr.data.materials.append(gold_plain)
        for p in pr.data.polygons: p.use_smooth = True

# ---------- velours vert (cuvette) ----------
vel, vn, vl = mat('velvet'); v = bsdf(vn)
v.inputs['Base Color'].default_value = (0.018, 0.20, 0.07, 1) if V else (0.006, 0.09, 0.03, 1); v.inputs['Roughness'].default_value = 0.9
v.inputs['Sheen Weight'].default_value = 0.7; v.inputs['Sheen Tint'].default_value = (0.5, 1.0, 0.55, 1) if V else (0.25, 0.7, 0.32, 1); v.inputs['Sheen Roughness'].default_value = 0.35
vnoise = vn.new('ShaderNodeTexNoise'); vnoise.inputs['Scale'].default_value = 600; vnoise.inputs['Detail'].default_value = 4
vb = vn.new('ShaderNodeBump'); vb.inputs['Strength'].default_value = 0.25
vl.new(vnoise.outputs['Fac'], vb.inputs['Height']); vl.new(vb.outputs['Normal'], v.inputs['Normal'])
vprof = [(0.0005 + M(0.67) * i / 24, -0.075 + 0.055 * (i / 24) ** 2) for i in range(25)]
lathe('velvet', vprof, 180, vel)

# ---------- dôme de verre (vrai verre, coque mince) ----------
glass, gln, _ = mat('glass'); gb = bsdf(gln)
gb.inputs['Base Color'].default_value = (1, 1, 1, 1); gb.inputs['Transmission Weight'].default_value = 1.0
gb.inputs['Roughness'].default_value = 0.0; gb.inputs['IOR'].default_value = 1.45
base, hgt = M(0.668), 0.25
Rs = (base * base + hgt * hgt) / (2 * hgt); th = math.asin(base / Rs)
dprof_out = [(Rs * math.sin(th * (1 - i / 40)), Rs * math.cos(th * (1 - i / 40)) - (Rs - hgt) + 0.03) for i in range(41)]
dprof_out[-1] = (0.0005, dprof_out[-1][1])
dome = lathe('dome', dprof_out, 220, glass)
if V == 'B': dome.hide_render = True
sol = dome.modifiers.new('s', 'SOLIDIFY'); sol.thickness = 0.012; sol.offset = -1

# ---------- objet de la catégorie ----------
def import_glb(name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(GLTF, name + '.glb'))
    new = [o for o in bpy.data.objects if o not in before]
    root = bpy.data.objects.new('OBJ', None); sc.collection.objects.link(root)
    for o in new:
        if o.parent is None: o.parent = root
    return root, new
def fit(root, new, target, rot, lift=0.0, offset=(0, 0)):
    root.rotation_euler = rot
    bpy.context.view_layer.update()
    pts = []
    for o in new:
        if o.type == 'MESH':
            for c in o.bound_box: pts.append(o.matrix_world @ mathutils.Vector(c))
    mn = mathutils.Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = mathutils.Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    target *= {'A': 1.18, 'B': 1.42}.get(V, 1.0)
    size = max(mx.x - mn.x, mx.y - mn.y); s = target / size
    root.scale = (s, s, s); bpy.context.view_layer.update()
    ctr = (mn + mx) / 2
    if V == 'B': lift += 0.30
    root.location = (-ctr.x * s + offset[0], -ctr.y * s + offset[1], -mn.z * s - 0.068 + lift)

SPEC = {
  'shoe': ('MaterialsVariantsShoe', 1.12, (math.radians(55), 0, math.radians(-30))),
  'watch': ('ChronographWatch', 0.90, (math.radians(10), 0, 0)),
  'corset': ('Corset', 1.0, (math.radians(70), 0, 0)),
  'duck': ('Duck', 0.86, (math.radians(70), 0, math.radians(-25))),
  'toycar': ('ToyCar', 0.98, (math.radians(60), 0, math.radians(-25))),
  'sunglasses': ('SunglassesKhronos', 0.98, (math.radians(70), 0, 0)),
  'fridge': ('CommercialRefrigerator', 0.95, (math.radians(-75), math.radians(25), 0)),
  'sofa': ('GlamVelvetSofa', 1.18, (math.radians(-75), math.radians(25), 0)),
  'car': ('CarConcept', 1.15, (math.radians(-78), math.radians(35), 0)),
  'avocado': ('Avocado', 0.85, (math.radians(-70), math.radians(30), 0)),
  'water': ('WaterBottle', 0.95, (math.radians(-80), 0, math.radians(-12))),
  'plant': ('DiffuseTransmissionPlant', 1.0, (math.radians(-75), 0, 0)),
}
if KIND in SPEC:
    nm, tgt, rot = SPEC[KIND]
    if len(args) > 4: rot = tuple(math.radians(float(x)) for x in args[4].split(','))
    root, new = import_glb(nm); fit(root, new, tgt, rot)


# ---------- objets modélisés ici (pas de modèle libre disponible) ----------
def paper(name, color, stripe=None):
    m, n, l = mat(name); b = bsdf(n); b.inputs['Base Color'].default_value = color; b.inputs['Roughness'].default_value = 0.62
    nz = n.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 140; nz.inputs['Detail'].default_value = 8
    bp = n.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.12; l.new(nz.outputs['Fac'], bp.inputs['Height']); l.new(bp.outputs['Normal'], b.inputs['Normal'])
    return m
def rope_mat(color):
    m, n, l = mat('rope'); b = bsdf(n); b.inputs['Base Color'].default_value = color; b.inputs['Roughness'].default_value = 0.7
    b.inputs['Sheen Weight'].default_value = 0.4; return m
def bag(root, w, h, d, m, rm, loc, rotz):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.active_object; o.scale = (w, d, h); o.location = (0, 0, h / 2)
    bpy.ops.object.transform_apply(scale=True, location=True)
    bv = o.modifiers.new('b', 'BEVEL'); bv.width = 0.006; bv.segments = 3
    o.data.materials.append(m)
    # pli du soufflet : léger creux sur les côtés
    o.parent = root
    for sgn in (-1, 1):
        cu = bpy.data.curves.new('h', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 0.007; cu.bevel_resolution = 4
        sp = cu.splines.new('BEZIER'); sp.bezier_points.add(2)
        pts = [(-w * 0.22, sgn * d * 0.5, h - 0.01), (0, sgn * d * 0.5, h + h * 0.32), (w * 0.22, sgn * d * 0.5, h - 0.01)]
        for bp_, p in zip(sp.bezier_points, pts): bp_.co = p; bp_.handle_left_type = bp_.handle_right_type = 'AUTO'
        ho = bpy.data.objects.new('handle', cu); sc.collection.objects.link(ho); cu.materials.append(rm); ho.parent = root
        ho.location = loc; ho.rotation_euler = (0, 0, rotz)
    o.location = loc; o.rotation_euler = (0, 0, rotz)
def build_bags():
    root = bpy.data.objects.new('OBJ', None); sc.collection.objects.link(root)
    g = paper('pg', (0.03, 0.22, 0.75, 1)); c = paper('pc', (0.95, 0.42, 0.04, 1))
    bag(root, 0.42, 0.50, 0.17, g, rope_mat((0.85, 0.72, 0.45, 1)), (-0.10, 0.02, 0), math.radians(-14))
    bag(root, 0.30, 0.36, 0.13, c, rope_mat((0.96, 0.92, 0.82, 1)), (0.22, -0.10, 0), math.radians(18))
    return root, [o for o in bpy.data.objects if o.parent == root]
def build_tie():
    root = bpy.data.objects.new('OBJ', None); sc.collection.objects.link(root)
    silk, n, l = mat('silk'); b = bsdf(n)
    b.inputs['Roughness'].default_value = 0.42; b.inputs['Sheen Weight'].default_value = 0.1; b.inputs['Sheen Tint'].default_value = (0.7, 0.75, 1, 1)
    b.inputs['Anisotropic'].default_value = 0.4
    wv = n.new('ShaderNodeTexWave'); wv.wave_type = 'BANDS'; wv.bands_direction = 'DIAGONAL'; wv.inputs['Scale'].default_value = 7; wv.wave_profile = 'SAW'
    ramp = n.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].color = (0.01, 0.04, 0.32, 1); ramp.color_ramp.elements[1].color = (0.01, 0.04, 0.32, 1)
    e1 = ramp.color_ramp.elements.new(0.80); e1.color = (0.01, 0.04, 0.32, 1); e2 = ramp.color_ramp.elements.new(0.86); e2.color = (0.85, 0.62, 0.22, 1)
    ramp.color_ramp.elements[-1].position = 0.92
    l.new(wv.outputs['Fac'], ramp.inputs['Fac']); l.new(ramp.outputs['Color'], b.inputs['Base Color'])
    # contour de la cravate (vue de face), extrudé
    outline = [(0, 0.98), (0.075, 0.90), (0.06, 0.80), (0.10, 0.25), (0.16, 0.05), (0, -0.07), (-0.16, 0.05), (-0.10, 0.25), (-0.06, 0.80), (-0.075, 0.90)]
    bm = bmesh.new(); vs = [bm.verts.new((x, y, 0)) for x, y in outline]; f = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f]); bmesh.ops.translate(bm, vec=(0, 0, 0.035), verts=[v for v in ext['geom'] if isinstance(v, bmesh.types.BMVert)])
    me = bpy.data.meshes.new('tie'); bm.to_mesh(me); bm.free()
    t = bpy.data.objects.new('tie', me); sc.collection.objects.link(t); me.materials.append(silk); t.parent = root
    bv = t.modifiers.new('b', 'BEVEL'); bv.width = 0.012; bv.segments = 4
    sd = t.modifiers.new('s', 'SUBSURF'); sd.levels = 2
    bend = t.modifiers.new('bend', 'SIMPLE_DEFORM'); bend.deform_method = 'BEND'; bend.angle = math.radians(-18); bend.deform_axis = 'Y'
    # nœud
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0.93, 0.05)); k = bpy.context.active_object; k.scale = (0.11, 0.10, 0.05)
    k.modifiers.new('b', 'BEVEL').width = 0.03; k.modifiers.new('s', 'SUBSURF').levels = 2; k.data.materials.append(silk); k.parent = root
    # col de chemise blanc
    cot, cn, cl = mat('cotton'); cb = bsdf(cn); cb.inputs['Base Color'].default_value = (0.93, 0.94, 0.96, 1); cb.inputs['Roughness'].default_value = 0.7; cb.inputs['Sheen Weight'].default_value = 0.5
    for sgn in (-1, 1):
        bm = bmesh.new(); pts = [(sgn * 0.02, 1.06), (sgn * 0.30, 1.10), (sgn * 0.26, 0.80), (sgn * 0.06, 0.86)]
        vs = [bm.verts.new((x, y, 0.06)) for x, y in pts]; bm.faces.new(vs if sgn > 0 else vs[::-1])
        me = bpy.data.meshes.new('col'); bm.to_mesh(me); bm.free(); co = bpy.data.objects.new('col', me); sc.collection.objects.link(co)
        so = co.modifiers.new('s', 'SOLIDIFY'); so.thickness = 0.02; bv = co.modifiers.new('b', 'BEVEL'); bv.width = 0.008; bv.segments = 3
        co.modifiers.new('sd', 'SUBSURF').levels = 1; me.materials.append(cot); co.parent = root
    return root, [o for o in bpy.data.objects if o.parent == root]
exec(open(os.path.join(HERE, 'objs.py')).read())
BUILD = {'bags': (build_bags, 0.95, (math.radians(-62), 0, 0)), 'tie': (build_tie, 1.08, (math.radians(-8), 0, math.radians(-16)))}
BUILD.update(OBJS)
if KIND in BUILD:
    fn, tgt, rot = BUILD[KIND]
    if len(args) > 4: rot = tuple(math.radians(float(x)) for x in args[4].split(','))
    root, new = fn(); fit(root, new, tgt, rot)

# ---------- lumières : soleil chaud en haut à gauche, rebond vert, éclats ----------
def area(name, loc, size, energy, color, target=(0, 0, 0)):
    l = bpy.data.lights.new(name, 'AREA'); l.energy = energy; l.color = color; l.shape = 'RECTANGLE'; l.size = size; l.size_y = size * 0.35
    o = bpy.data.objects.new(name, l); sc.collection.objects.link(o); o.location = loc
    d = mathutils.Vector(target) - mathutils.Vector(loc); o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler(); return o
area('key', (-3.0, 3.5, 4.5), 2.5, 260, (1.0, 0.9, 0.75))
area('fill', (3.5, -1.0, 3.0), 3.0, 60, (1.0, 0.97, 0.9))
area('bounce', (0.5, -3.5, 1.2), 3.0, 45, (0.6, 1.0, 0.6))
area('spark', (-1.2, 1.2, 5.0), 0.3, 40, (1, 1, 1))
if V:
    sp = bpy.data.lights.new('spot', 'SPOT'); sp.energy = 420; sp.spot_size = math.radians(28); sp.spot_blend = 0.6; sp.color = (1, 0.97, 0.9); sp.shadow_soft_size = 0.4
    so = bpy.data.objects.new('spot', sp); sc.collection.objects.link(so); so.location = (-1.2, 1.6, 4.6)
    so.rotation_euler = (mathutils.Vector((0, 0, 0.1)) - so.location).to_track_quat('-Z', 'Y').to_euler()

# ---------- caméra ----------
cd = bpy.data.cameras.new('cam'); cd.lens = 120; cd.sensor_width = 36
cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (0, -1.25, 9.6)
cam.rotation_euler = (mathutils.Vector((0, 0, 0)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print('RENDU', OUT)
