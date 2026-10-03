# Shared helpers for the gear models (Blender 5.x, run headless).
# Modeling is done in millimetres, Z up, front facing -Y; finalize() scales to metres.
import bpy, bmesh, math, os, sys
import numpy as np
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(HERE, 'textures')
OUT = os.path.abspath(os.path.join(HERE, '..', '..', 'public', 'models'))
SCRATCH = '/private/tmp/claude-501/-Users-DavidLiu/f47a44a5-4dfa-4aae-b40f-735bd11d5e6f/scratchpad/models-test'
FONT_REG = '/System/Library/Fonts/Supplemental/Arial.ttf'
FONT_BOLD = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
os.makedirs(TEX, exist_ok=True)
os.makedirs(OUT, exist_ok=True)

TAU = math.tau


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = 'METRIC'
    sc.unit_settings.length_unit = 'MILLIMETERS'
    return sc


# ---------------------------------------------------------------- shared shapes

def catmull(pts, n=6, closed=False):
    P = [Vector(p) for p in pts]
    out = []
    m = len(P)
    rng = range(m) if closed else range(m - 1)
    for i in rng:
        p0 = P[(i - 1) % m] if (closed or i > 0) else P[i]
        p1 = P[i]
        p2 = P[(i + 1) % m]
        p3 = P[(i + 2) % m] if (closed or i + 2 < m) else P[(i + 1) % m]
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            v = 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
            out.append(tuple(v))
    if not closed:
        out.append(tuple(P[-1]))
    return out


def ribbed_disc(name, r, z0, z1, ribs, depth, mats, top_mat=0, side_mat=1, chamfer=0.4, axis_mat=None):
    """Dial: vertical axis at origin. Ribbed side, flat top (planar UV for labels)."""
    prof = [(0.0, z0, side_mat), (r - chamfer, z0, side_mat), (r, z0 + chamfer, side_mat),
            (r, z1 - chamfer, top_mat if False else side_mat), (r - chamfer, z1, top_mat), (0.0, z1, top_mat)]
    segs = ribs * 4

    def rm(t, k, rr, z):
        if k in (2, 3):
            i = int(round((t / TAU) * segs)) % 4
            return rr - (depth if i >= 2 else 0.0)
        return rr
    ob = lathe(name, prof, segs, mats, rmod=rm)
    # planar UV on top for labels
    uv_planar(ob, 'Z', 1.0 / (2 * r), (0, 0), only=lambda p: p.normal.z > 0.9)
    smooth(ob, 30)
    return ob


def slab_xz(name, pts, y0, y1, mats=()):
    return loft(name, [[(x, y0, z) for x, z in pts], [(x, y1, z) for x, z in pts]], mats)


def uv_side(ob, su, sv):
    """Scale lathe UVs on the dial side (non-top faces) for tiling knurl."""
    me = ob.data
    uv = me.uv_layers.active.data
    for p in me.polygons:
        if abs(p.normal.z) < 0.5:
            for li in p.loop_indices:
                u, v = uv[li].uv
                uv[li].uv = (u * su, v * sv)



def sweep(name, path, prof, mats=(), n_prof=None, up=(0, 0, 1), cap0=True, cap1=True):
    """Sweep a 2D profile along a 3D polyline. prof(t) -> list of (s, u) points (same count for every t),
    s along the side vector, u along the local up vector."""
    P = [Vector(p) for p in path]
    loops = []
    for k, p in enumerate(P):
        t = k / (len(P) - 1)
        if k == 0:
            T = (P[1] - P[0])
        elif k == len(P) - 1:
            T = (P[-1] - P[-2])
        else:
            T = (P[k + 1] - P[k - 1])
        T.normalize()
        S = T.cross(Vector(up))
        if S.length < 1e-6:
            S = Vector((1, 0, 0))
        S.normalize()
        U = S.cross(T).normalized()
        loops.append([tuple(p + S * s_ + U * u_) for s_, u_ in prof(t)])
    return loft(name, loops, mats, cap0=cap0, cap1=cap1)


def rrect_c(w, h, r, n=4):
    """Rounded rect centred at origin as (s,u) list with a fixed vertex count."""
    return [(x, y) for x, y in rrect(w, h, r, n)]

def raycast(ob, origin, direction):
    """Ray hit on a mesh object (world space). Returns (location, normal) or (None, None)."""
    from mathutils.bvhtree import BVHTree
    me = ob.data
    mw = ob.matrix_world
    verts = [mw @ v.co for v in me.vertices]
    polys = [tuple(p.vertices) for p in me.polygons]
    tree = BVHTree.FromPolygons(verts, polys)
    loc, nrm, idx, dist = tree.ray_cast(Vector(origin), Vector(direction).normalized())
    return loc, nrm


def project_onto(ob, target, direction, lift=0.08):
    """Shrink-wrap a thin decal mesh onto `target` by casting each vertex along `direction`."""
    from mathutils.bvhtree import BVHTree
    me = target.data
    tree = BVHTree.FromPolygons([target.matrix_world @ v.co for v in me.vertices], [tuple(p.vertices) for p in me.polygons])
    d = Vector(direction).normalized()
    for v in ob.data.vertices:
        loc, nrm, idx, dist = tree.ray_cast(v.co - d * 20.0, d, 60.0)
        if loc is not None:
            v.co = loc - d * lift
    ob.data.update()
    return ob


# ---------------------------------------------------------------- textures

def save_img(name, arr, colorspace='sRGB'):
    """arr: HxWx3 or HxWx4 float 0..1, row 0 = bottom. Saves PNG into TEX, returns bpy image."""
    h, w = arr.shape[:2]
    if arr.shape[2] == 3:
        arr = np.dstack([arr, np.ones((h, w))])
    path = os.path.join(TEX, name + '.png')
    img = bpy.data.images.get(name)
    if img is None:
        img = bpy.data.images.new(name, w, h, alpha=False)
    img.scale(w, h)
    img.pixels.foreach_set(np.clip(arr, 0, 1).astype(np.float32).ravel())
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    img.colorspace_settings.name = colorspace
    return img


def load_img(path, colorspace='sRGB'):
    img = bpy.data.images.load(path, check_existing=True)
    img.colorspace_settings.name = colorspace
    return img


def worley(size, cells, seed=0, jitter=1.0):
    rng = np.random.default_rng(seed)
    pts = 0.5 + (rng.random((cells, cells, 2)) - 0.5) * jitter
    c = (np.arange(size) + 0.5) / size * cells
    X, Y = np.meshgrid(c, c)
    ci = np.floor(X).astype(int)
    cj = np.floor(Y).astype(int)
    f1 = np.full(X.shape, 9.0)
    f2 = np.full(X.shape, 9.0)
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            nx = ci + di
            ny = cj + dj
            p = pts[ny % cells, nx % cells]
            d = np.sqrt((X - nx - p[..., 0]) ** 2 + (Y - ny - p[..., 1]) ** 2)
            f2 = np.where(d < f1, f1, np.minimum(f2, d))
            f1 = np.minimum(f1, d)
    return f1, f2


def blur_noise(size, sigma_px, seed=0):
    rng = np.random.default_rng(seed)
    n = rng.standard_normal((size, size))
    fx = np.fft.fftfreq(size)
    FX, FY = np.meshgrid(fx, fx)
    g = np.exp(-2 * (math.pi ** 2) * (sigma_px ** 2) * (FX ** 2 + FY ** 2))
    r = np.real(np.fft.ifft2(np.fft.fft2(n) * g))
    r = (r - r.mean()) / (r.std() + 1e-9)
    return r


def height_to_normal(h, strength):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5 * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5 * strength
    n = np.dstack([-dx, -dy, np.ones_like(h)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return n * 0.5 + 0.5


def tex_leather(name='leather_n', size=1024, cells=40, seed=3, strength=6.0):
    p = os.path.join(TEX, name + '.png')
    if os.path.exists(p):
        return load_img(p, 'Non-Color')
    f1, f2 = worley(size, cells, seed, 0.95)
    edge = np.clip((f2 - f1) / 0.32, 0, 1)
    peb = np.sqrt(edge)  # domed pebbles with creases
    g1, g2 = worley(size, cells * 2, seed + 7, 0.9)
    peb2 = np.sqrt(np.clip((g2 - g1) / 0.3, 0, 1))
    fine = blur_noise(size, 1.2, seed + 1)
    big = blur_noise(size, 40, seed + 2)
    h = peb * (0.75 + 0.12 * big) + 0.35 * peb2 + 0.05 * fine
    return save_img(name, height_to_normal(h, strength), 'Non-Color')


def tex_grain(name='grain_n', size=512, sigma=1.4, strength=1.6, seed=11):
    """Fine sand-textured paint (Sony body finish)."""
    p = os.path.join(TEX, name + '.png')
    if os.path.exists(p):
        return load_img(p, 'Non-Color')
    h = blur_noise(size, sigma, seed) + 0.5 * blur_noise(size, sigma * 3, seed + 1)
    return save_img(name, height_to_normal(h, strength), 'Non-Color')


def tex_knurl(name='knurl_n', size=512, n=24, strength=8.0, diamond=True):
    """Tileable knurl: u around, v along; n pyramids per tile."""
    p = os.path.join(TEX, name + '.png')
    if os.path.exists(p):
        return load_img(p, 'Non-Color')
    c = (np.arange(size) + 0.5) / size
    U, V = np.meshgrid(c, c)
    if diamond:
        a = np.abs(((U + V) * n) % 1.0 - 0.5)
        b = np.abs(((U - V) * n) % 1.0 - 0.5)
        h = np.minimum(a, b)
    else:
        h = np.abs((U * n) % 1.0 - 0.5)
    return save_img(name, height_to_normal(h, strength * n / 24.0), 'Non-Color')


def tex_spun(name='spun_n', size=512, strength=0.6, seed=5):
    """Concentric spun-metal finish for dial tops (planar UV 0..1 centred)."""
    p = os.path.join(TEX, name + '.png')
    if os.path.exists(p):
        return load_img(p, 'Non-Color')
    rng = np.random.default_rng(seed)
    prof = np.convolve(rng.standard_normal(4096), np.ones(5) / 5, 'same')
    c = (np.arange(size) + 0.5) / size - 0.5
    U, V = np.meshgrid(c, c)
    r = np.sqrt(U * U + V * V) * 2
    h = np.interp(r * 180, np.arange(4096), prof) * 0.6
    return save_img(name, height_to_normal(h, strength), 'Non-Color')


def tex_brushed(name='brushed_n', size=512, strength=0.5, seed=8):
    p = os.path.join(TEX, name + '.png')
    if os.path.exists(p):
        return load_img(p, 'Non-Color')
    rng = np.random.default_rng(seed)
    col = rng.standard_normal(size)
    h = np.tile(col[:, None], (1, size)) + 0.15 * blur_noise(size, 2, seed)
    return save_img(name, height_to_normal(h, strength), 'Non-Color')


# ---------------------------------------------------------------- materials

def mat(name, color=(0.5, 0.5, 0.5), metal=0.0, rough=0.5, normal=None, nstr=1.0,
        coat=0.0, coat_rough=0.05, emission=None, estr=1.0, alpha=1.0, base_tex=None,
        rough_tex=None, spec=0.5, ior=1.5, transmission=0.0, alpha_mask=False):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    m.use_backface_culling = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    b.location = (-300, 0)
    nt.links.new(b.outputs[0], out.inputs[0])
    col = tuple(color) + (1.0,) if len(color) == 3 else tuple(color)
    b.inputs['Base Color'].default_value = col
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    b.inputs['IOR'].default_value = ior
    if 'Specular IOR Level' in b.inputs:
        b.inputs['Specular IOR Level'].default_value = spec
    if coat > 0:
        b.inputs['Coat Weight'].default_value = coat
        b.inputs['Coat Roughness'].default_value = coat_rough
    if transmission > 0:
        b.inputs['Transmission Weight'].default_value = transmission
    if emission is not None:
        b.inputs['Emission Color'].default_value = tuple(emission) + (1.0,)
        b.inputs['Emission Strength'].default_value = estr
    if alpha < 1.0:
        b.inputs['Alpha'].default_value = alpha
        m.surface_render_method = 'BLENDED'
    uvn = None

    def uvnode():
        nonlocal uvn
        if uvn is None:
            uvn = nt.nodes.new('ShaderNodeUVMap')
            uvn.location = (-1100, 0)
        return uvn
    if base_tex is not None:
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = base_tex
        t.location = (-800, 300)
        nt.links.new(uvnode().outputs[0], t.inputs[0])
        nt.links.new(t.outputs[0], b.inputs['Base Color'])
        if alpha_mask:
            rnd = nt.nodes.new('ShaderNodeMath')
            rnd.operation = 'ROUND'
            rnd.location = (-500, 450)
            nt.links.new(t.outputs['Alpha'], rnd.inputs[0])
            nt.links.new(rnd.outputs[0], b.inputs['Alpha'])
            m.surface_render_method = 'DITHERED'
    if rough_tex is not None:
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = rough_tex
        t.location = (-800, 0)
        nt.links.new(uvnode().outputs[0], t.inputs[0])
        sep = nt.nodes.new('ShaderNodeSeparateColor')
        sep.location = (-500, 0)
        nt.links.new(t.outputs[0], sep.inputs[0])
        nt.links.new(sep.outputs[1], b.inputs['Roughness'])
    if normal is not None:
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = normal
        t.location = (-800, -300)
        nt.links.new(uvnode().outputs[0], t.inputs[0])
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nm.location = (-500, -300)
        nm.inputs['Strength'].default_value = nstr
        nt.links.new(t.outputs[0], nm.inputs['Color'])
        nt.links.new(nm.outputs[0], b.inputs['Normal'])
    return m


# ---------------------------------------------------------------- mesh building

def new_obj(name, bm=None, mats=()):
    me = bpy.data.meshes.new(name)
    if bm is not None:
        bm.to_mesh(me)
        bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    for m in mats:
        me.materials.append(m)
    return ob


def set_mats(ob, mats):
    ob.data.materials.clear()
    for m in mats:
        ob.data.materials.append(m)


def lathe(name, prof, segs=96, mats=(), rmod=None, cap0=False, cap1=False, phase=0.0,
          uv_v_scale=1.0, smooth_angle=None):
    """prof: list of (r, z) or (r, z, matidx). Revolved around Z. rmod(theta, k, r, z)->r.
    Faces of band k take matidx of point k. UV: u = theta/2pi, v = arc length * uv_v_scale."""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new('UVMap')
    rings = []
    arc = [0.0]
    for k in range(1, len(prof)):
        arc.append(arc[-1] + math.hypot(prof[k][0] - prof[k - 1][0], prof[k][1] - prof[k - 1][1]))
    for k, p in enumerate(prof):
        r, z = p[0], p[1]
        ring = []
        for i in range(segs):
            t = phase + TAU * i / segs
            rr = rmod(t, k, r, z) if rmod else r
            ring.append(bm.verts.new((rr * math.cos(t), rr * math.sin(t), z)))
        rings.append(ring)
    for k in range(len(prof) - 1):
        mi = prof[k][2] if len(prof[k]) > 2 else 0
        for i in range(segs):
            j = (i + 1) % segs
            vs = (rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i])
            if vs[0].co == vs[3].co and vs[1].co == vs[2].co:
                continue
            try:
                f = bm.faces.new(vs)
            except ValueError:
                continue
            f.material_index = mi
            us = (i / segs, (i + 1) / segs, (i + 1) / segs, i / segs)
            vv = (arc[k], arc[k], arc[k + 1], arc[k + 1])
            for l, u, v in zip(f.loops, us, vv):
                l[uvl].uv = (u, v * uv_v_scale)
    for cap, k in ((cap0, 0), (cap1, len(prof) - 1)):
        if cap and prof[k][0] > 1e-6:
            ring = rings[k] if k else list(reversed(rings[k]))
            f = bm.faces.new(ring)
            f.material_index = prof[k][2] if len(prof[k]) > 2 else 0
            for l in f.loops:
                l[uvl].uv = (0.5 + l.vert.co.x / (2 * prof[k][0]), 0.5 + l.vert.co.y / (2 * prof[k][0]))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.normal_update()
    ob = new_obj(name, bm, mats)
    fix_normals(ob)
    if smooth_angle is not None:
        smooth(ob, smooth_angle)
    return ob


def fix_normals(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()


def prism(name, pts, z0, z1, mats=(), cap=True):
    """Extrude a CCW 2D polygon (x,y) from z0 to z1."""
    bm = bmesh.new()
    bot = [bm.verts.new((x, y, z0)) for x, y in pts]
    top = [bm.verts.new((x, y, z1)) for x, y in pts]
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((bot[i], bot[j], top[j], top[i]))
    if cap:
        bm.faces.new(list(reversed(bot)))
        bm.faces.new(top)
    bm.normal_update()
    ob = new_obj(name, bm, mats)
    return ob


def loft(name, loops, mats=(), cap0=True, cap1=True, closed=True):
    """loops: list of lists of 3D points, equal length. Skins consecutive loops."""
    bm = bmesh.new()
    vl = [[bm.verts.new(p) for p in L] for L in loops]
    n = len(loops[0])
    for k in range(len(loops) - 1):
        for i in range(n if closed else n - 1):
            j = (i + 1) % n
            try:
                bm.faces.new((vl[k][i], vl[k][j], vl[k + 1][j], vl[k + 1][i]))
            except ValueError:
                pass
    if cap0:
        bm.faces.new(list(reversed(vl[0])))
    if cap1:
        bm.faces.new(vl[-1])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.normal_update()
    ob = new_obj(name, bm, mats)
    fix_normals(ob)
    return ob


def rrect(w, h, r, n=8, cx=0.0, cy=0.0):
    """CCW rounded rectangle points."""
    r = min(r, w / 2 - 1e-4, h / 2 - 1e-4)
    pts = []
    for (sx, sy, a0) in ((1, 1, 0), (-1, 1, 90), (-1, -1, 180), (1, -1, 270)):
        ccx = cx + sx * (w / 2 - r)
        ccy = cy + sy * (h / 2 - r)
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n)
            pts.append((ccx + r * math.cos(a), ccy + r * math.sin(a)))
    return pts


def superellipse(a, b, e=4.0, n=64, cx=0.0, cy=0.0):
    pts = []
    for i in range(n):
        t = TAU * i / n
        c, s = math.cos(t), math.sin(t)
        x = a * math.copysign(abs(c) ** (2 / e), c)
        y = b * math.copysign(abs(s) ** (2 / e), s)
        pts.append((cx + x, cy + y))
    return pts


def box(name, x0, x1, y0, y1, z0, z1, mats=(), bevel=0.0, seg=3):
    ob = prism(name, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], z0, z1, mats)
    if bevel > 0:
        add_bevel(ob, bevel, seg)
    return ob


def add_bevel(ob, width, seg=3, angle=40, apply=True, profile=0.5, clamp=True):
    md = ob.modifiers.new('bevel', 'BEVEL')
    md.width = width
    md.segments = seg
    md.limit_method = 'ANGLE'
    md.angle_limit = math.radians(angle)
    md.profile = profile
    md.use_clamp_overlap = clamp
    md.harden_normals = False
    if apply:
        apply_mods(ob)
    return md


def subsurf(ob, levels=2, apply=True):
    md = ob.modifiers.new('subsurf', 'SUBSURF')
    md.levels = levels
    md.render_levels = levels
    if apply:
        apply_mods(ob)


def apply_mods(ob):
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.selected_objects:
        o.select_set(False)
    ob.select_set(True)
    for md in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=md.name)


def smooth(ob, angle=35):
    me = ob.data
    for p in me.polygons:
        p.use_smooth = True
    me.set_sharp_from_angle(angle=math.radians(angle))


def flat(ob):
    for p in ob.data.polygons:
        p.use_smooth = False


def boolean(ob, cutter, op='DIFFERENCE', delete_cutter=True, solver='EXACT'):
    md = ob.modifiers.new('bool', 'BOOLEAN')
    md.operation = op
    md.object = cutter
    md.solver = solver
    apply_mods(ob)
    if delete_cutter:
        bpy.data.objects.remove(cutter, do_unlink=True)


def join(objs, name=None):
    objs = [o for o in objs if o is not None]
    for o in bpy.context.selected_objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    if name:
        ob.name = name
        ob.data.name = name
    return ob


def xform(ob, mat):
    ob.data.transform(mat)
    if mat.to_3x3().determinant() < 0:  # mirrored transform: restore outward winding
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        bmesh.ops.reverse_faces(bm, faces=bm.faces, flip_multires=False)
        bm.to_mesh(ob.data)
        bm.free()
    ob.data.update()
    return ob


def rot(axis, deg):
    return Matrix.Rotation(math.radians(deg), 4, axis)


def tr(x, y, z):
    return Matrix.Translation((x, y, z))


def sc(x, y=None, z=None):
    y = x if y is None else y
    z = x if z is None else z
    return Matrix.Diagonal((x, y, z, 1.0))


def mat_by(ob, fn):
    """fn(center Vector, normal Vector, current_index) -> new index or None."""
    me = ob.data
    for p in me.polygons:
        r = fn(p.center, p.normal, p.material_index)
        if r is not None:
            p.material_index = r


def uvlayer(me):
    if not me.uv_layers:
        me.uv_layers.new(name='UVMap')
    if me.uv_layers.active is None:
        me.uv_layers.active = me.uv_layers[0]
    return me.uv_layers.active


def uv_box(ob, scale=1.0, offset=(0, 0)):
    """Triplanar-style box projection into UVMap (units * scale)."""
    me = ob.data
    uv = uvlayer(me).data
    for p in me.polygons:
        n = p.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            if ax == 0:
                u, v = co.y * (1 if n.x > 0 else -1), co.z
            elif ax == 1:
                u, v = co.x * (-1 if n.y > 0 else 1), co.z
            else:
                u, v = co.x, co.y * (1 if n.z > 0 else -1)
            uv[li].uv = (u * scale + offset[0], v * scale + offset[1])


def uv_planar(ob, axis='Z', scale=1.0, center=(0, 0), only=None):
    me = ob.data
    uv = uvlayer(me).data
    for p in me.polygons:
        if only is not None and not only(p):
            continue
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            if axis == 'Z':
                u, v = co.x, co.y
            elif axis == 'Y':
                u, v = -co.x, co.z
            elif axis == '-Y':
                u, v = co.x, co.z
            else:
                u, v = co.y, co.z
            uv[li].uv = ((u - center[0]) * scale + 0.5, (v - center[1]) * scale + 0.5)


def ensure_uv(ob):
    if not ob.data.uv_layers:
        uv_box(ob, 0.05)


# ---------------------------------------------------------------- shared shapes

def catmull(pts, n=6, closed=False):
    P = [Vector(p) for p in pts]
    out = []
    m = len(P)
    rng = range(m) if closed else range(m - 1)
    for i in rng:
        p0 = P[(i - 1) % m] if (closed or i > 0) else P[i]
        p1 = P[i]
        p2 = P[(i + 1) % m]
        p3 = P[(i + 2) % m] if (closed or i + 2 < m) else P[(i + 1) % m]
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            v = 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
            out.append(tuple(v))
    if not closed:
        out.append(tuple(P[-1]))
    return out


def ribbed_disc(name, r, z0, z1, ribs, depth, mats, top_mat=0, side_mat=1, chamfer=0.4, axis_mat=None):
    """Dial: vertical axis at origin. Ribbed side, flat top (planar UV for labels)."""
    prof = [(0.0, z0, side_mat), (r - chamfer, z0, side_mat), (r, z0 + chamfer, side_mat),
            (r, z1 - chamfer, top_mat if False else side_mat), (r - chamfer, z1, top_mat), (0.0, z1, top_mat)]
    segs = ribs * 4

    def rm(t, k, rr, z):
        if k in (2, 3):
            i = int(round((t / TAU) * segs)) % 4
            return rr - (depth if i >= 2 else 0.0)
        return rr
    ob = lathe(name, prof, segs, mats, rmod=rm)
    # planar UV on top for labels
    uv_planar(ob, 'Z', 1.0 / (2 * r), (0, 0), only=lambda p: p.normal.z > 0.9)
    smooth(ob, 30)
    return ob


def slab_xz(name, pts, y0, y1, mats=()):
    return loft(name, [[(x, y0, z) for x, z in pts], [(x, y1, z) for x, z in pts]], mats)


def uv_side(ob, su, sv):
    """Scale lathe UVs on the dial side (non-top faces) for tiling knurl."""
    me = ob.data
    uv = me.uv_layers.active.data
    for p in me.polygons:
        if abs(p.normal.z) < 0.5:
            for li in p.loop_indices:
                u, v = uv[li].uv
                uv[li].uv = (u * su, v * sv)


# ---------------------------------------------------------------- text

def text_mesh(name, body, size, font=FONT_BOLD, align='CENTER', valign='CENTER', extrude=0.0,
              spacing=1.0, res=3, mats=()):
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = body
    cu.font = bpy.data.fonts.load(font, check_existing=True)
    cu.size = size
    cu.align_x = align
    cu.align_y = valign
    cu.extrude = extrude
    cu.space_character = spacing
    cu.resolution_u = res
    cu.fill_mode = 'FRONT' if extrude == 0 else 'BOTH'
    ob = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.curves.remove(cu)
    out = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(out)
    for m in mats:
        me.materials.append(m)
    # merge + triangulate fill for robustness
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4 * size)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    flat(out)
    return out


def text_on(name, body, size, matrix, mat_, font=FONT_BOLD, align='CENTER', spacing=1.0, lift=0.03):
    """Flat printed text. matrix maps text XY plane (text +Z = surface normal) to world."""
    ob = text_mesh(name, body, size, font=font, align=align, spacing=spacing, mats=(mat_,))
    xform(ob, matrix @ tr(0, 0, lift))
    return ob


def frame(origin, xaxis, normal):
    """Matrix whose X->xaxis, Z->normal, Y = Z x X, translation origin."""
    z = Vector(normal).normalized()
    x = Vector(xaxis)
    x = (x - z * x.dot(z)).normalized()
    y = z.cross(x)
    m = Matrix((
        (x.x, y.x, z.x, origin[0]),
        (x.y, y.y, z.y, origin[1]),
        (x.z, y.z, z.z, origin[2]),
        (0, 0, 0, 1)))
    return m


def subdivide_long_edges(ob, maxlen):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    for _ in range(4):
        long = [e for e in bm.edges if e.calc_length() > maxlen]
        if not long:
            break
        bmesh.ops.subdivide_edges(bm, edges=long, cuts=1, use_grid_fill=False)
        bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()


def wrap_cyl(ob, R, lift=0.03):
    """Text built in a plane: X = arc length around circumference, Y = axial position.
    Maps to cylinder around Z: theta = X/R, z = Y, radius = R + lift + local z."""
    subdivide_long_edges(ob, max(0.6, R * 0.04))
    for v in ob.data.vertices:
        x, y, z = v.co
        t = x / R
        rr = R + lift + z
        v.co = (rr * math.cos(t), rr * math.sin(t), y)
    ob.data.update()
    return ob


def wrap_text(name, body_, size, R, theta_c, s_c, mat_, along_axis=False, font=FONT_REG, lift=0.03,
              spacing=1.0):
    """Printed text on a cylinder around local Z (lens axis). Circumferential text reads toward -theta
    with its top toward the mount; axial text (along_axis) reads toward the mount with top toward +theta."""
    ob = text_mesh(name, body_, size, font=font, mats=(mat_,), spacing=spacing)
    subdivide_long_edges(ob, max(0.5, R * 0.03))
    for v in ob.data.vertices:
        x, y, z = v.co
        if along_axis:
            t = theta_c + y / R
            s_ = s_c - x
        else:
            t = theta_c - x / R
            s_ = s_c - y
        rr = R + lift
        v.co = (rr * math.cos(t), rr * math.sin(t), s_)
    ob.data.update()
    return ob


# ---------------------------------------------------------------- finalize / export

def finalize(objs, scale=0.001, ground=True, center_xy=True, root_name=None, pivots=None):
    """Scale mm->m, put min Z at 0 and center XY. pivots: {obj: Vector(mm)} origin positions.
    Returns root empty with objs parented (identity transforms)."""
    objs = [o for o in objs if o is not None]
    pivots = pivots or {}
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for o in objs:
        if o.type != 'MESH':
            continue
        for v in o.data.vertices:
            co = o.matrix_world @ v.co
            mn = Vector(map(min, mn, co))
            mx = Vector(map(max, mx, co))
    off = Vector((-(mn.x + mx.x) / 2 if center_xy else 0, -(mn.y + mx.y) / 2 if center_xy else 0,
                  -mn.z if ground else 0))
    for o in objs:
        if o.type == 'MESH':
            o.data.transform(o.matrix_world)
            o.matrix_world = Matrix.Identity(4)
            o.data.transform(Matrix.Scale(scale, 4) @ tr(*off))
            piv = pivots.get(o.name)
            if piv is not None:
                p = (Vector(piv) + off) * scale
                o.data.transform(tr(*(-p)))
                o.location = p
            o.data.update()
    bpy.context.view_layer.update()
    root = None
    if root_name:
        root = bpy.data.objects.new(root_name, None)
        bpy.context.scene.collection.objects.link(root)
        root.empty_display_size = 0.05
    return root, off, (mx - mn) * scale


def parent(child, par):
    bpy.context.view_layer.update()
    mw = child.matrix_world.copy()
    child.parent = par
    child.matrix_parent_inverse = par.matrix_world.inverted()
    child.matrix_world = mw


def handles(root, objs, extras=None, direct=()):
    """Wrap each mesh in a named empty 'handle' at the mesh origin (pivot). The mesh becomes '<name>_geo'.
    Mesh quantization in gltf-transform rewrites mesh-node transforms, so viewers should animate the handle.
    Returns the list of objects to export."""
    extras = extras or {}
    out = [root]
    bpy.context.view_layer.update()
    for o in objs:
        nm = o.name
        if nm in direct:  # named mesh node directly under the root (no pivot handle needed)
            for k, v in extras.get(nm, {}).items():
                o[k] = v
            o.data.name = nm
            parent(o, root)
            out.append(o)
            continue
        h = bpy.data.objects.new(nm + '__h', None)
        bpy.context.scene.collection.objects.link(h)
        h.empty_display_size = 0.01
        h.location = o.location.copy()
        o.name = nm + '_geo'
        o.data.name = nm + '_geo'
        h.name = nm
        for k, v in extras.get(nm, {}).items():
            h[k] = v
        bpy.context.view_layer.update()
        parent(h, root)
        parent(o, h)
        out += [h, o]
    return out


def export_glb(path, objs):
    for o in bpy.context.selected_objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True, export_apply=True,
        export_yup=True, export_texcoords=True, export_normals=True, export_tangents=False,
        export_materials='EXPORT', export_image_format='AUTO', export_cameras=False,
        export_lights=False, export_extras=True, export_animations=False)
    print('EXPORTED', path, os.path.getsize(path))


def stats(objs):
    tris = 0
    for o in objs:
        if o.type == 'MESH':
            o.data.calc_loop_triangles()
            tris += len(o.data.loop_triangles)
    return tris


# ---------------------------------------------------------------- render

def studio(ground_z=0.0, size=4.0, world=0.18, floor=True, scale=1.0):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.eevee.taa_render_samples = 24
    try:
        sc.eevee.use_raytracing = True
    except Exception:
        pass
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Medium High Contrast'
    w = bpy.data.worlds.new('studio')
    sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    # simple vertical gradient world for reflections
    nt = w.node_tree
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    nt.links.new(sep.outputs['Z'], ramp.inputs[0])
    ramp.color_ramp.elements[0].position = 0.45
    ramp.color_ramp.elements[0].color = (0.05, 0.05, 0.055, 1)
    ramp.color_ramp.elements[1].position = 0.75
    ramp.color_ramp.elements[1].color = (0.9, 0.9, 0.92, 1)
    nt.links.new(ramp.outputs[0], bg.inputs[0])
    bg.inputs[1].default_value = world

    def area(name, loc, target, energy, sizex, sizey=None, color=(1, 1, 1)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'RECTANGLE'
        ld.size = sizex
        ld.size_y = sizey or sizex
        ld.color = color
        lo = bpy.data.objects.new(name, ld)
        sc.collection.objects.link(lo)
        lo.location = loc
        d = Vector(target) - Vector(loc)
        lo.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        return lo
    k = scale
    area('key', (0.35 * k, -0.45 * k, 0.55 * k), (0, 0, 0.03 * k), 9 * k * k, 0.5 * k)
    area('fill', (-0.5 * k, -0.2 * k, 0.25 * k), (0, 0, 0.03 * k), 3 * k * k, 0.6 * k)
    area('rim', (-0.1 * k, 0.5 * k, 0.45 * k), (0, 0, 0.03 * k), 6 * k * k, 0.4 * k)
    area('top', (0, 0, 0.8 * k), (0, 0, 0), 4 * k * k, 0.8 * k)
    if floor:
        bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 0, ground_z))
        fl = bpy.context.active_object
        fl.name = '_floor'
        fm = mat('_floor', (0.55, 0.55, 0.56), 0, 0.6)
        fl.data.materials.append(fm)
    return sc


def look_cam(name, target, direction, dist, lens=60, ortho=None):
    sc = bpy.context.scene
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    cd.clip_start = 0.005
    cd.clip_end = 50
    if ortho:
        cd.type = 'ORTHO'
        cd.ortho_scale = ortho
    co = bpy.data.objects.new(name, cd)
    sc.collection.objects.link(co)
    d = Vector(direction).normalized()
    co.location = Vector(target) + d * dist
    co.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    return co


def render_views(prefix, target, radius, views, res=(900, 680), samples=24):
    """views: list of (tag, direction, lens_or_None, ortho_scale_or_None)."""
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.eevee.taa_render_samples = samples
    sc.render.film_transparent = False
    paths = []
    for tag, d, lens, ortho in views:
        if ortho:
            cam = look_cam('cam_' + tag, target, d, radius * 6, ortho=ortho)
        else:
            lens = lens or 60
            fov = 2 * math.atan(18 / lens)
            dist = radius / math.sin(fov / 2) * 1.05
            cam = look_cam('cam_' + tag, target, d, dist, lens=lens)
        sc.camera = cam
        p = os.path.join(SCRATCH, 'renders', f'{prefix}_{tag}.png')
        sc.render.filepath = p
        bpy.ops.render.render(write_still=True)
        paths.append(p)
        print('RENDERED', p)
    return paths
