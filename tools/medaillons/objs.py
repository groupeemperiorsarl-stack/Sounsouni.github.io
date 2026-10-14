# Objets modélisés pour les médaillons Sounsouni (exécuté dans medal.py).
# Repère : X à droite, Y en haut de l'image, Z vers la caméra.
TEX = HERE

def P(name, color, rough=0.5, metal=0.0, coat=0.0, trans=0.0, ior=1.45, sheen=0.0, sss=0.0, aniso=0.0):
    m, n, l = mat(name); b = bsdf(n)
    b.inputs['Base Color'].default_value = (*color, 1) if len(color) == 3 else color
    b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    b.inputs['Coat Weight'].default_value = coat; b.inputs['Transmission Weight'].default_value = trans; b.inputs['IOR'].default_value = ior
    b.inputs['Sheen Weight'].default_value = sheen; b.inputs['Subsurface Weight'].default_value = sss
    if aniso: b.inputs['Anisotropic'].default_value = aniso
    return m

def IMG(name, file, rough=0.4, emit=0.0, coat=0.0, alpha=False, metal=0.0):
    m, n, l = mat(name); b = bsdf(n)
    tx = n.new('ShaderNodeTexImage'); tx.image = bpy.data.images.load(os.path.join(TEX, file))
    l.new(tx.outputs['Color'], b.inputs['Base Color'])
    if emit: l.new(tx.outputs['Color'], b.inputs['Emission Color']); b.inputs['Emission Strength'].default_value = emit
    if alpha: l.new(tx.outputs['Alpha'], b.inputs['Alpha'])
    b.inputs['Roughness'].default_value = rough; b.inputs['Coat Weight'].default_value = coat; b.inputs['Metallic'].default_value = metal
    return m

def smooth(o):
    for p in o.data.polygons: p.use_smooth = True

def add(o, root, m=None):
    if m is not None: o.data.materials.append(m)
    o.parent = root; return o

def box(root, size, loc, m, bev=0.0, seg=4, rot=(0, 0, 0), sub=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot); o = bpy.context.active_object; o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bev: b = o.modifiers.new('b', 'BEVEL'); b.width = bev; b.segments = seg; b.limit_method = 'NONE'
    if sub: o.modifiers.new('s', 'SUBSURF').levels = sub
    smooth(o) if (bev or sub) else None
    return add(o, root, m)

def cyl(root, r, depth, loc, m, rot=(0, 0, 0), verts=48, bev=0.0):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, vertices=verts, location=loc, rotation=rot); o = bpy.context.active_object
    if bev: b = o.modifiers.new('b', 'BEVEL'); b.width = bev; b.segments = 4; b.limit_method = 'ANGLE'
    try: bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))
    except Exception: smooth(o)
    return add(o, root, m)

def sphere(root, r, loc, m, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=48, ring_count=24, location=loc); o = bpy.context.active_object; o.scale = scale; smooth(o)
    return add(o, root, m)

def plane(root, size, loc, m, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=rot); o = bpy.context.active_object; o.scale = (size[0], size[1], 1)
    bpy.ops.object.transform_apply(scale=True); return add(o, root, m)

def lat(root, prof, m, loc=(0, 0, 0), rot=(0, 0, 0), steps=96):
    o = lathe('lat', prof, steps, m); o.location = loc; o.rotation_euler = rot; o.parent = root; return o

def tube(root, pts, r, m, closed=False):
    cu = bpy.data.curves.new('t', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = r; cu.bevel_resolution = 6
    sp = cu.splines.new('BEZIER'); sp.bezier_points.add(len(pts) - 1); sp.use_cyclic_u = closed
    for bp_, p in zip(sp.bezier_points, pts): bp_.co = p; bp_.handle_left_type = bp_.handle_right_type = 'AUTO'
    o = bpy.data.objects.new('tube', cu); sc.collection.objects.link(o); cu.materials.append(m); o.parent = root; return o

def extrude_outline(root, pts, depth, m, z=0.0, bev=0.01, sub=2):
    bm = bmesh.new(); vs = [bm.verts.new((x, y, z)) for x, y in pts]; f = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f]); bmesh.ops.translate(bm, vec=(0, 0, depth), verts=[v for v in ext['geom'] if isinstance(v, bmesh.types.BMVert)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new('ex'); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new('ex', me); sc.collection.objects.link(o)
    if bev: b = o.modifiers.new('b', 'BEVEL'); b.width = bev; b.segments = 4; b.limit_method = 'NONE'
    if sub: o.modifiers.new('s', 'SUBSURF').levels = sub
    smooth(o); return add(o, root, m)

def text3d(root, body, size, loc, m, depth=0.01, rot=(0, 0, 0)):
    cu = bpy.data.curves.new('txt', 'FONT'); cu.body = body; cu.size = size; cu.extrude = depth; cu.align_x = 'CENTER'; cu.align_y = 'CENTER'
    cu.bevel_depth = depth * 0.3
    o = bpy.data.objects.new('txt', cu); sc.collection.objects.link(o); o.location = loc; o.rotation_euler = rot; cu.materials.append(m); o.parent = root; return o

def newroot():
    r = bpy.data.objects.new('OBJ', None); sc.collection.objects.link(r); return r

def done(root):
    return root, [o for o in bpy.data.objects if o.parent == root or (o.parent and o.parent.parent == root)]

# ---------------- objets ----------------
def b_phone():
    r = newroot()
    frame = P('titane', (0.55, 0.57, 0.6), 0.25, 1.0)
    box(r, (0.50, 1.02, 0.07), (0, 0, 0), frame, bev=0.06, seg=8)
    box(r, (0.47, 0.99, 0.02), (0, 0, 0.032), P('vitre', (0.01, 0.01, 0.012), 0.05, coat=1.0), bev=0.05, seg=8)
    plane(r, (0.43, 0.90), (0, -0.005, 0.0435), IMG('ecran', 'scr_phone.png', 0.15, emit=1.1, coat=1.0))
    cyl(r, 0.022, 0.01, (0, 0.435, 0.044), P('cam', (0, 0, 0), 0.1, coat=1))
    return done(r)

def b_laptop():
    r = newroot()
    alu = P('alu', (0.78, 0.8, 0.83), 0.3, 1.0)
    box(r, (1.0, 0.66, 0.035), (0, 0, 0), alu, bev=0.02, seg=6)
    plane(r, (0.86, 0.36), (0, 0.06, 0.0185), IMG('clavier', 'keyboard.png', 0.5))
    plane(r, (0.32, 0.17), (0, -0.215, 0.0182), P('pave', (0.62, 0.64, 0.67), 0.25, 1.0))
    lid = box(r, (1.0, 0.64, 0.022), (0, 0.33 + 0.32 * math.cos(math.radians(70)), 0.32 * math.sin(math.radians(70))), alu, bev=0.015, seg=6, rot=(math.radians(-110 + 180 - 70 + 70), 0, 0))
    lid.rotation_euler = (math.radians(70), 0, 0)
    scr = plane(r, (0.92, 0.57), (0, 0.33 + 0.32 * math.cos(math.radians(70)) - 0.012 * math.sin(math.radians(70)), 0.32 * math.sin(math.radians(70)) + 0.012 * math.cos(math.radians(70))), IMG('ecran_pc', 'scr_laptop.png', 0.15, emit=1.0, coat=1.0))
    scr.rotation_euler = (math.radians(70 - 180), 0, 0); scr.scale = (1, -1, 1)
    return done(r)

def b_solar():
    r = newroot()
    box(r, (1.0, 0.64, 0.035), (0, 0, 0), P('cadre', (0.75, 0.77, 0.8), 0.3, 1.0), bev=0.008)
    plane(r, (0.95, 0.59), (0, 0, 0.0185), IMG('cellules', 'cells.png', 0.12, coat=1.0, metal=0.3))
    sun = sphere(r, 0.11, (0.38, 0.34, 0.12), P('soleil', (1.0, 0.75, 0.15), 0.3))
    sun.data.materials[0].node_tree.nodes['Principled BSDF'].inputs['Emission Color'].default_value = (1.0, 0.7, 0.15, 1)
    sun.data.materials[0].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 4
    return done(r)

def b_pot():
    r = newroot()
    steel = P('inox', (0.86, 0.87, 0.88), 0.14, 1.0)
    body = [(0.0005, 0), (0.40, 0), (0.43, 0.02), (0.44, 0.06), (0.44, 0.44), (0.455, 0.46), (0.45, 0.47), (0.42, 0.46), (0.42, 0.05), (0.0005, 0.03)]
    lat(r, body, steel)
    lid = [(0.0005, 0.56), (0.08, 0.555), (0.30, 0.52), (0.44, 0.475), (0.46, 0.468), (0.455, 0.46)]
    lat(r, lid, steel)
    knob = P('bakelite', (0.03, 0.03, 0.03), 0.35, coat=0.6)
    sphere(r, 0.06, (0, 0, 0.59), knob, scale=(1, 1, 0.6)); cyl(r, 0.025, 0.04, (0, 0, 0.565), steel)
    for sgn in (-1, 1):
        tube(r, [(sgn * 0.43, 0.0, 0.36), (sgn * 0.55, 0.0, 0.37), (sgn * 0.43, 0.0, 0.40)], 0.022, knob)
    return done(r)

def b_tools():
    r = newroot()
    wood = mat('bois'); w, wn, wl = wood; b = bsdf(wn)
    wv = wn.new('ShaderNodeTexWave'); wv.inputs['Scale'].default_value = 6; wv.inputs['Distortion'].default_value = 6; wv.bands_direction = 'X'
    rp = wn.new('ShaderNodeValToRGB'); rp.color_ramp.elements[0].color = (0.35, 0.18, 0.07, 1); rp.color_ramp.elements[1].color = (0.62, 0.38, 0.18, 1)
    wl.new(wv.outputs['Fac'], rp.inputs['Fac']); wl.new(rp.outputs['Color'], b.inputs['Base Color']); b.inputs['Roughness'].default_value = 0.45; b.inputs['Coat Weight'].default_value = 0.3
    steel = P('acier', (0.62, 0.64, 0.68), 0.22, 1.0)
    a = math.radians(35)
    h = cyl(r, 0.045, 0.95, (0, 0, 0.05), w, rot=(0, math.radians(90), a), verts=32); h.scale = (1, 1.25, 1)
    hx, hy = 0.42 * math.cos(a), 0.42 * math.sin(a)
    box(r, (0.10, 0.36, 0.10), (hx, hy, 0.06), steel, bev=0.02, seg=4, rot=(0, 0, a))
    # clé plate
    b2 = math.radians(-40)
    box(r, (0.78, 0.07, 0.03), (0.02, -0.02, 0.13), P('chrome', (0.9, 0.9, 0.92), 0.08, 1.0), bev=0.012, rot=(0, 0, b2))
    for sgn, rr in ((1, 0.11), (-1, 0.09)):
        cx, cy = 0.02 + sgn * 0.40 * math.cos(b2), -0.02 + sgn * 0.40 * math.sin(b2)
        bpy.ops.mesh.primitive_torus_add(major_radius=rr, minor_radius=0.03, location=(cx, cy, 0.13)); t = bpy.context.active_object; t.scale = (1, 1, 0.5); smooth(t); add(t, r, bpy.data.materials['chrome'])
    return done(r)

def b_ball():
    r = newroot()
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.5)
    bmesh.ops.bevel(bm, geom=list(bm.verts), offset=0.333, offset_type='PERCENT', affect='VERTICES', segments=1) if False else None
    res = bmesh.ops.bevel(bm, geom=list(bm.verts), offset=33.3, offset_type='PERCENT', affect='VERTICES', segments=1)
    for v in bm.verts: v.co = v.co.normalized() * 0.5
    me = bpy.data.meshes.new('ball'); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('ball', me); sc.collection.objects.link(o)
    white = P('cuir_blanc', (0.92, 0.92, 0.9), 0.35, coat=0.5); black = P('cuir_noir', (0.02, 0.02, 0.025), 0.35, coat=0.5)
    me.materials.append(white); me.materials.append(black)
    for p in me.polygons: p.material_index = 1 if len(p.vertices) == 5 else 0
    sol = o.modifiers.new('s', 'SOLIDIFY'); sol.thickness = 0.015
    bv = o.modifiers.new('b', 'BEVEL'); bv.width = 0.012; bv.segments = 3
    sd = o.modifiers.new('sd', 'SUBSURF'); sd.levels = 2
    cast = o.modifiers.new('c', 'CAST'); cast.factor = 1.0
    smooth(o); o.parent = r; o.rotation_euler = (0.4, 0.3, 0.2)
    return done(r)

def b_bottle_baby():
    r = newroot()
    plast = P('plastique', (0.95, 0.97, 1.0), 0.08, trans=1.0, ior=1.49)
    body = [(0.0005, 0), (0.17, 0), (0.19, 0.03), (0.19, 0.62), (0.17, 0.66), (0.16, 0.66), (0.175, 0.62), (0.175, 0.03), (0.0005, 0.015)]
    lat(r, body, plast)
    milk = P('lait', (0.97, 0.95, 0.88), 0.3, sss=1.0)
    lat(r, [(0.0005, 0.018), (0.172, 0.018), (0.172, 0.40), (0.0005, 0.40)], milk)
    ring = P('bague', (0.35, 0.65, 0.95), 0.3, coat=0.6)
    lat(r, [(0.165, 0.64), (0.20, 0.64), (0.205, 0.72), (0.12, 0.74), (0.12, 0.72), (0.165, 0.70)], ring)
    teat = P('tetine', (0.92, 0.78, 0.55), 0.35, trans=0.5, sss=0.5)
    lat(r, [(0.13, 0.72), (0.12, 0.76), (0.06, 0.80), (0.05, 0.86), (0.035, 0.92), (0.0005, 0.935)], teat)
    for k in range(5):
        y = 0.1 + k * 0.11; lat(r, [(0.191, y), (0.196, y), (0.196, y + 0.006), (0.191, y + 0.006)], P('grad%d' % k, (0.35, 0.65, 0.95), 0.4))
    return done(r)

def b_pencils():
    r = newroot()
    cols = [(0.85, 0.12, 0.10), (0.10, 0.45, 0.85), (0.98, 0.75, 0.10)]
    woodm = P('bois_clair', (0.86, 0.66, 0.42), 0.6); lead = P('mine', (0.08, 0.08, 0.09), 0.3, 0.6)
    ferr = P('virole', (0.85, 0.75, 0.45), 0.2, 1.0); eras = P('gomme', (0.95, 0.55, 0.6), 0.7)
    for i, (ang, c) in enumerate(zip((-22, 0, 22), cols)):
        g = bpy.data.objects.new('p', None); sc.collection.objects.link(g); g.parent = r; g.rotation_euler = (0, 0, math.radians(ang)); g.location = (0, -0.05, 0.05 + i * 0.06)
        lac = P('laque%d' % i, c, 0.25, coat=1.0)
        cyl(g, 0.05, 0.70, (0, 0.05, 0), lac, rot=(math.radians(90), 0, 0), verts=6).parent = g
        bpy.ops.mesh.primitive_cone_add(radius1=0.05, radius2=0.012, depth=0.14, vertices=6, location=(0, 0.47, 0), rotation=(math.radians(-90), 0, 0)); co = bpy.context.active_object; add(co, g, woodm)
        bpy.ops.mesh.primitive_cone_add(radius1=0.012, radius2=0.0, depth=0.035, vertices=12, location=(0, 0.555, 0), rotation=(math.radians(-90), 0, 0)); co = bpy.context.active_object; add(co, g, lead)
        cyl(g, 0.052, 0.07, (0, -0.335, 0), ferr, rot=(math.radians(90), 0, 0)).parent = g
        cyl(g, 0.05, 0.06, (0, -0.40, 0), eras, rot=(math.radians(90), 0, 0)).parent = g
    return done(r)

def b_djembe():
    r = newroot()
    wood = mat('bois_djembe'); w, wn, wl = wood; b = bsdf(wn)
    wv = wn.new('ShaderNodeTexWave'); wv.inputs['Scale'].default_value = 3; wv.inputs['Distortion'].default_value = 10; wv.bands_direction = 'Z'
    rp = wn.new('ShaderNodeValToRGB'); rp.color_ramp.elements[0].color = (0.22, 0.09, 0.03, 1); rp.color_ramp.elements[1].color = (0.50, 0.25, 0.10, 1)
    wl.new(wv.outputs['Fac'], rp.inputs['Fac']); wl.new(rp.outputs['Color'], b.inputs['Base Color']); b.inputs['Roughness'].default_value = 0.35; b.inputs['Coat Weight'].default_value = 0.5
    prof = [(0.0005, 0), (0.20, 0), (0.22, 0.02), (0.18, 0.10), (0.11, 0.30), (0.10, 0.40), (0.16, 0.52), (0.27, 0.66), (0.31, 0.78), (0.31, 0.82), (0.0005, 0.82)]
    lat(r, prof, w)
    skin = P('peau', (0.86, 0.74, 0.55), 0.6, sss=0.3)
    lat(r, [(0.0005, 0.84), (0.33, 0.83), (0.335, 0.80), (0.33, 0.77)], skin)
    rope = P('corde', (0.85, 0.15, 0.10), 0.7, sheen=0.5)
    lat(r, [(0.33, 0.755), (0.345, 0.76), (0.345, 0.785), (0.33, 0.79)], rope); lat(r, [(0.165, 0.50), (0.18, 0.505), (0.18, 0.53), (0.165, 0.535)], rope)
    n = 18
    for i in range(n):
        a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 0.5) / n
        tube(r, [(0.34 * math.cos(a0), 0.34 * math.sin(a0), 0.77), (0.185 * math.cos(a1), 0.185 * math.sin(a1), 0.52)], 0.007, rope)
        tube(r, [(0.185 * math.cos(a1), 0.185 * math.sin(a1), 0.52), (0.34 * math.cos(a0 + 2 * math.pi / n), 0.34 * math.sin(a0 + 2 * math.pi / n), 0.77)], 0.007, rope)
    return done(r)

def b_pills():
    r = newroot()
    amber = P('ambre', (0.75, 0.35, 0.05), 0.05, trans=1.0, ior=1.5)
    lat(r, [(0.0005, 0), (0.20, 0), (0.21, 0.02), (0.21, 0.50), (0.15, 0.56), (0.15, 0.60), (0.14, 0.60), (0.14, 0.565), (0.20, 0.50), (0.20, 0.02), (0.0005, 0.012)], amber)
    cap = P('bouchon', (0.95, 0.95, 0.95), 0.4)
    lat(r, [(0.0005, 0.58), (0.16, 0.58), (0.165, 0.70), (0.0005, 0.71)], cap)
    lab = P('etiquette', (0.95, 0.96, 0.92), 0.6)
    lat(r, [(0.212, 0.14), (0.213, 0.14), (0.213, 0.40), (0.212, 0.40)], lab)
    text3d(r, '+', 0.18, (0, -0.215, 0.27), P('croix', (0.1, 0.55, 0.25), 0.4), depth=0.01, rot=(math.radians(90), 0, 0))
    return done(r)

def b_ebook():
    r = newroot()
    box(r, (0.74, 0.98, 0.05), (0, 0, 0), P('liseuse', (0.08, 0.08, 0.09), 0.3, coat=0.6), bev=0.05, seg=8)
    plane(r, (0.64, 0.84), (0, 0.02, 0.0255), IMG('page', 'page.png', 0.6, emit=0.35))
    book = P('couverture', (0.55, 0.12, 0.12), 0.45, sheen=0.3)
    box(r, (0.62, 0.86, 0.10), (-0.24, 0.10, -0.09), book, bev=0.01, rot=(0, 0, math.radians(14)))
    box(r, (0.60, 0.84, 0.085), (-0.235, 0.10, -0.088), P('pages', (0.96, 0.93, 0.85), 0.8), rot=(0, 0, math.radians(14)))
    return done(r)

def b_gradcap():
    r = newroot()
    blackf = P('feutre', (0.02, 0.02, 0.025), 0.75, sheen=0.6)
    box(r, (0.86, 0.86, 0.03), (0, 0, 0.30), blackf, bev=0.008, rot=(0, 0, math.radians(45)))
    lat(r, [(0.0005, 0.29), (0.30, 0.29), (0.32, 0.10), (0.31, 0.0), (0.0005, 0.0)], blackf)
    gold = P('or_gland', (0.95, 0.70, 0.25), 0.3, 1.0)
    cyl(r, 0.04, 0.02, (0, 0, 0.325), gold)
    tube(r, [(0, 0, 0.33), (0.30, 0.0, 0.325), (0.56, 0.0, 0.31), (0.60, 0.0, 0.12)], 0.009, gold)
    bpy.ops.mesh.primitive_cone_add(radius1=0.05, radius2=0.012, depth=0.16, vertices=24, location=(0.60, 0, 0.06)); add(bpy.context.active_object, r, gold)
    return done(r)

def b_apps():
    r = newroot()
    specs = [((-0.24, 0.20, 0.0), (0.96, 0.30, 0.25), 'play'), ((0.22, 0.12, 0.08), (0.20, 0.55, 0.95), 'chat'), ((-0.02, -0.24, 0.16), (0.25, 0.70, 0.35), 'bars')]
    white = P('blanc_app', (1, 1, 1), 0.3, coat=0.5)
    for (x, y, z), c, g in specs:
        box(r, (0.42, 0.42, 0.10), (x, y, z), P('app_' + g, c, 0.2, coat=1.0), bev=0.09, seg=10)
        if g == 'play': extrude_outline(r, [(x - 0.06, y - 0.09), (x + 0.10, y), (x - 0.06, y + 0.09)], 0.03, white, z=z + 0.05, bev=0.008, sub=0)
        if g == 'chat':
            o = cyl(r, 0.11, 0.03, (x, y + 0.01, z + 0.065), white); extrude_outline(r, [(x - 0.07, y - 0.06), (x - 0.11, y - 0.14), (x - 0.01, y - 0.09)], 0.03, white, z=z + 0.05, bev=0.0, sub=0)
        if g == 'bars':
            for k, h in enumerate((0.10, 0.17, 0.24)): box(r, (0.05, h, 0.03), (x - 0.08 + k * 0.08, y - 0.12 + h / 2, z + 0.065), white, bev=0.01)
    return done(r)

def b_headphones():
    r = newroot()
    leather = P('cuir', (0.78, 0.60, 0.40), 0.45, coat=0.3, sheen=0.3)
    accent = P('metal_rose', (0.85, 0.62, 0.45), 0.2, 1.0)
    pts = [(0.36 * math.cos(math.radians(a)), 0.36 * math.sin(math.radians(a)) + 0.02, 0) for a in range(-15, 196, 15)]
    tube(r, pts, 0.045, leather)
    for sgn in (-1, 1):
        cx = sgn * 0.37
        cyl(r, 0.16, 0.10, (cx, -0.12, 0.02), leather, rot=(0, math.radians(90), 0), bev=0.02)
        cyl(r, 0.13, 0.012, (cx + sgn * 0.052, -0.12, 0.02), accent, rot=(0, math.radians(90), 0))
        bpy.ops.mesh.primitive_torus_add(major_radius=0.12, minor_radius=0.04, location=(cx - sgn * 0.06, -0.12, 0.02), rotation=(0, math.radians(90), 0)); t = bpy.context.active_object; smooth(t); add(t, r, P('coussin', (0.95, 0.93, 0.88), 0.7, sheen=0.6))
    return done(r)

def b_docs():
    r = newroot()
    pg = IMG('feuille', 'doc.png', 0.7)
    for i, (dx, dy, a) in enumerate(((0.06, -0.04, 10), (0.03, -0.02, 4), (0, 0, -3))):
        box(r, (0.62, 0.82, 0.006), (dx, dy, i * 0.008), P('papier%d' % i, (0.97, 0.97, 0.96), 0.7), rot=(0, 0, math.radians(a)))
    plane(r, (0.60, 0.80), (0, 0, 0.021), pg, rot=(0, 0, math.radians(-3)))
    red = P('rouge_pdf', (0.85, 0.08, 0.08), 0.3, coat=0.8)
    box(r, (0.40, 0.18, 0.04), (0.14, -0.27, 0.04), red, bev=0.03, seg=6, rot=(0, 0, math.radians(-3)))
    text3d(r, 'PDF', 0.13, (0.14, -0.27, 0.062), P('blanc_pdf', (1, 1, 1), 0.3), depth=0.006, rot=(0, 0, math.radians(-3)))
    return done(r)

def b_gift():
    r = newroot()
    paperm = IMG('papier_cadeau', 'giftpaper.png', 0.45, coat=0.4)
    box(r, (0.62, 0.62, 0.50), (0, 0, 0.25), paperm, bev=0.01)
    satin = P('satin', (0.95, 0.72, 0.25), 0.25, 0.6, sheen=0.4)
    box(r, (0.12, 0.64, 0.52), (0, 0, 0.25), satin, bev=0.005); box(r, (0.64, 0.12, 0.52), (0, 0, 0.25), satin, bev=0.005)
    for a in (35, 145):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.12, minor_radius=0.035, location=(0, 0, 0.55), rotation=(math.radians(70), 0, math.radians(a))); t = bpy.context.active_object; t.scale = (1.4, 1, 0.7); smooth(t); add(t, r, satin)
    sphere(r, 0.05, (0, 0, 0.53), satin)
    return done(r)

def b_perfume():
    r = newroot()
    glass = P('verre_parfum', (0.92, 0.97, 1.0), 0.02, trans=1.0, ior=1.5)
    box(r, (0.42, 0.18, 0.50), (0, 0, 0.25), glass, bev=0.05, seg=8)
    liq = P('liquide', (0.98, 0.40, 0.62), 0.1, sss=1.0)
    box(r, (0.36, 0.13, 0.36), (0, 0, 0.20), liq, bev=0.04, seg=6)
    gold = P('or_bouchon', (0.95, 0.72, 0.30), 0.18, 1.0)
    cyl(r, 0.05, 0.06, (0, 0, 0.53), gold); box(r, (0.22, 0.16, 0.14), (0, 0, 0.62), gold, bev=0.03, seg=6)
    # rouge à lèvres
    case = P('etui', (0.95, 0.72, 0.30), 0.15, 1.0); red = P('rouge', (0.70, 0.02, 0.08), 0.25, coat=0.6)
    cyl(r, 0.06, 0.30, (0.36, -0.05, 0.15), case)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.048, depth=0.16, vertices=48, location=(0.36, -0.05, 0.37)); lp = bpy.context.active_object; smooth(lp); add(lp, r, red)
    return done(r)

def b_tshirt():
    r = newroot()
    pts = [(-0.14, 0.50), (-0.36, 0.42), (-0.52, 0.22), (-0.40, 0.12), (-0.30, 0.20), (-0.30, -0.48), (0.30, -0.48), (0.30, 0.20), (0.40, 0.12), (0.52, 0.22), (0.36, 0.42), (0.14, 0.50), (0.07, 0.42), (0, 0.40), (-0.07, 0.42)]
    cot = P('coton', (0.98, 0.62, 0.10), 0.85, sheen=0.8)
    extrude_outline(r, pts, 0.06, cot, bev=0.025, sub=2)
    pr = plane(r, (0.34, 0.34), (0, 0.02, 0.064), IMG('impression', 'tshirt_print.png', 0.7, alpha=True))
    pr.data.materials[0].blend_method = 'BLEND' if hasattr(pr.data.materials[0], 'blend_method') else None
    return done(r)

OBJS = {
  'phone': (b_phone, 0.98, (math.radians(-10), math.radians(-12), math.radians(-14))),
  'laptop': (b_laptop, 1.10, (math.radians(-52), 0, math.radians(-12))),
  'solar': (b_solar, 1.10, (math.radians(-38), 0, math.radians(-8))),
  'pot': (b_pot, 0.86, (math.radians(-62), 0, 0)),
  'tools': (b_tools, 1.05, (0, 0, 0)),
  'ball': (b_ball, 0.92, (0, 0, 0)),
  'babybottle': (b_bottle_baby, 1.05, (math.radians(-80), 0, math.radians(-10))),
  'pencils': (b_pencils, 1.0, (math.radians(-10), 0, 0)),
  'djembe': (b_djembe, 1.05, (math.radians(-68), 0, 0)),
  'pills': (b_pills, 1.0, (math.radians(-78), 0, 0)),
  'ebook': (b_ebook, 1.0, (math.radians(-10), math.radians(10), math.radians(-8))),
  'gradcap': (b_gradcap, 1.1, (math.radians(-55), 0, math.radians(10))),
  'apps': (b_apps, 1.0, (math.radians(-12), math.radians(14), 0)),
  'headphones': (b_headphones, 1.05, (math.radians(-15), math.radians(-25), 0)),
  'docs': (b_docs, 0.98, (math.radians(-10), 0, 0)),
  'gift': (b_gift, 0.95, (math.radians(-58), 0, math.radians(30))),
  'perfume': (b_perfume, 1.0, (math.radians(-75), 0, math.radians(-18))),
  'tshirt': (b_tshirt, 1.02, (math.radians(-8), 0, 0)),
}
