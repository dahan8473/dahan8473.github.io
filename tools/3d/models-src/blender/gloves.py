# Fairtex BGV1 "Breathable" boxing gloves, red, 10 oz: a pair hanging from one lace loop.
# blender -b --factory-startup -P gloves.py -- [--export] [--render] [--ref]
#   (or: ./make.sh gloves.py gloves --render)
# Decal atlas: python3 gloves_tex.py (gloves_tex/decals.png).
#
# Each glove is modelled in its own frame (mm): Z up the glove axis from the cuff opening (z=0) to the
# top of the fist (~250), back of the hand facing -Y, palm +Y. The right glove has its thumb on -X;
# the left glove is the mirror image (decals are placed after mirroring so they still read).
# The padded body is a signed distance field (smooth unions of rounded boxes and capsules, seams
# and piping as grooves and ridges along seam surfaces), meshed with surface nets, projected
# back onto the surface, decimated. Strap, patch, decals and lace are built as their own meshes.
#
# Hanging: the gloves hang fist down from their laces, tied at the cuff. The printing is turned
# 180 degrees on the leather (and mirrored across the glove) so it reads upright as they hang;
# --ref builds them standing with the printing the right way up for the product-photo check.
# Origin = top of the lace
# loop (the hang point), which goes over the card edge: the plane Y=0 is the card, gloves hang in
# front of it (-Y, toward the camera), and the loop's tail runs down behind it.
# Export: gloves (root) > glove_l, glove_r (pivots at the lace knots on the cuffs) > *_geo, + lace.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib, common
importlib.reload(common)
from common import *
import bmesh
import numpy as np
from mathutils import Vector, Matrix

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
HERE_ = os.path.dirname(os.path.abspath(__file__))
GT = os.path.join(HERE_, 'gloves_tex')
os.makedirs(GT, exist_ok=True)

GRID = float(os.environ.get('GLOVES_GRID', '1.0'))   # SDF sampling step, mm
BODY_TRIS = int(os.environ.get('GLOVES_TRIS', '12000'))

# ------------------------------------------------------------------ SDF helpers (numpy, float32)


def _len(*c):
    return np.sqrt(sum(x * x for x in c))


def sd_round_box(X, Y, Z, c, b, r):
    qx = np.abs(X - c[0]) - (b[0] - r)
    qy = np.abs(Y - c[1]) - (b[1] - r)
    qz = np.abs(Z - c[2]) - (b[2] - r)
    return _len(np.maximum(qx, 0), np.maximum(qy, 0), np.maximum(qz, 0)) + np.minimum(np.maximum(np.maximum(qx, qy), qz), 0) - r


def sd_round_rect2(U, V, c, b, r):
    qx = np.abs(U - c[0]) - (b[0] - r)
    qy = np.abs(V - c[1]) - (b[1] - r)
    return _len(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - r


def seg_dist(X, Y, Z, a, b):
    ax, ay, az = a
    bx, by, bz = b[0] - ax, b[1] - ay, b[2] - az
    px, py, pz = X - ax, Y - ay, Z - az
    h = np.clip((px * bx + py * by + pz * bz) / (bx * bx + by * by + bz * bz), 0, 1)
    return _len(px - bx * h, py - by * h, pz - bz * h)


def seg_dist2(U, V, a, b):
    bx, by = b[0] - a[0], b[1] - a[1]
    px, py = U - a[0], V - a[1]
    h = np.clip((px * bx + py * by) / (bx * bx + by * by), 0, 1)
    return _len(px - bx * h, py - by * h)


def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b + (a - b) * h - k * h * (1 - h)


def smax(a, b, k):
    return -smin(-a, -b, k)


def bump(S, amp, w):
    return amp * np.exp(-(S / w) ** 2)


def sstep(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def sd_ellipse2(U, V, a, b):
    k0 = _len(U / a, V / b)
    k1 = _len(U / (a * a), V / (b * b))
    return k0 * (k0 - 1) / np.maximum(k1, 1e-6)


# cuff cross-section (also used to wrap the strap)
CUFF_CY = -4.0


def cuff_ab(Z):
    fl = np.clip((34.0 - Z) / 34.0, 0, 1) ** 2
    return 52.5 + 2.5 * fl, 45.0 + 2.0 * fl


_rng = np.random.default_rng(7)
_NOISE = [(_rng.normal(size=3), _rng.uniform(0, TAU), a) for a in (0.35, 0.3, 0.25, 0.2, 0.18, 0.15)]


def puff(X, Y, Z):
    out = np.zeros_like(X)
    for k, (d, ph, a) in enumerate(_NOISE):
        d = d / np.linalg.norm(d) * (TAU / (70.0 - 7 * k))
        out += a * np.sin(X * d[0] + Y * d[1] + Z * d[2] + ph)
    return out


def sd_ellipsoid(X, Y, Z, c, r):
    px, py, pz = (X - c[0]) / r[0], (Y - c[1]) / r[1], (Z - c[2]) / r[2]
    k0 = _len(px, py, pz)
    k1 = _len(px / r[0], py / r[1], pz / r[2])
    return k0 * (k0 - 1) / np.maximum(k1, 1e-6)


def sd_round_cone(X, Y, Z, a, b, r1, r2):
    bx, by, bz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
    l2 = bx * bx + by * by + bz * bz
    rr = r1 - r2
    a2 = l2 - rr * rr
    il2 = 1.0 / l2
    px, py, pz = X - a[0], Y - a[1], Z - a[2]
    y = px * bx + py * by + pz * bz
    z = y - l2
    qx, qy, qz = px * l2 - bx * y, py * l2 - by * y, pz * l2 - bz * y
    x2 = qx * qx + qy * qy + qz * qz
    y2 = y * y * l2
    z2 = z * z * l2
    k = math.copysign(1.0, rr) * rr * rr * x2
    d_top = np.sqrt(x2 + z2) * il2 - r2
    d_bot = np.sqrt(x2 + y2) * il2 - r1
    d_mid = (np.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1
    return np.where(np.sign(z) * a2 * z2 > k, d_top, np.where(np.sign(y) * a2 * y2 < k, d_bot, d_mid))


FIST_C = (0.0, -6.0, 168.0)
SLIT = ((18.0, 98.0), (18.0, 130.0))   # the palm vent, (x, z) ends
SLIT_R = 3.0
SLIT_Y = 22.0   # how deep the slot goes


def glove_sdf(P, s):
    """Signed distance (mm, negative inside) for one glove. s=+1 right glove (thumb on -X), -1 left."""
    X = P[:, 0] * s
    Y = P[:, 1]
    Z = P[:, 2]
    # cuff: elliptical tube, rounded at the opening, flaring a touch toward it
    a, b = cuff_ab(Z)
    d2 = sd_ellipse2(X, Y - CUFF_CY, a, b)
    w0, w1 = d2 + 3.0, np.maximum(-Z, Z - 140.0) + 3.0
    cuff = np.minimum(np.maximum(w0, w1), 0) + _len(np.maximum(w0, 0), np.maximum(w1, 0)) - 3.0
    # fist: a rounded block pulled toward an ellipsoid, narrowing toward the wrist
    tz = 1.0 - 0.12 * sstep(200.0 - Z, 0.0, 100.0)
    Xt = X / tz
    box = sd_round_box(Xt, Y, Z, FIST_C, (69.0, 52.0, 72.0), 31.0)
    ell = sd_ellipsoid(Xt, Y, Z, FIST_C, (72.0, 57.0, 82.0))
    fist = 0.8 * box + 0.2 * ell
    # padding: the back of the hand puffs out like a pillow
    env = np.clip(1 - (X / 60.0) ** 2, 0, 1) * np.clip(1 - ((Z - 170.0) / 64.0) ** 2, 0, 1)
    fist -= 3.5 * env * sstep(-Y, 20.0, 45.0)
    # knuckle pad: the back swells over the knuckles and rolls round onto the fist front,
    # and sits flatter lower down where it runs into the wrist
    across = np.clip(1 - (X / 64.0) ** 2, 0, 1)
    fist -= 5.5 * np.exp(-((Z - 202.0) / 24.0) ** 2) * across * sstep(-Y, 5.0, 40.0)
    fist += 2.6 * np.exp(-((Z - 122.0) / 17.0) ** 2) * across * sstep(-Y, 25.0, 45.0)
    # fingers curled over onto the palm side
    roll = seg_dist(X / tz, Y, Z, (-22.0, 16.0, 180.0), (22.0, 16.0, 180.0)) - 44.0
    palm = sd_round_box(X, Y, Z, (14.0, 8.0, 118.0), (42.0, 31.0, 26.0), 21.0)
    thumb = sd_round_cone(X, Y, Z, (-30.0, 27.0, 101.0), (-37.0, 40.0, 188.0), 17.0, 24.0)
    d = smin(fist, roll, 9.0 + 18.0 * sstep(np.abs(X), 28.0, 56.0))
    d = smin(d, palm, 14.0)
    d = smin(d, cuff, 20.0)
    d = smin(d, thumb, 4.5)
    # the opening: a short dark lined well
    ai, bi = a - 6.0, b - 6.0
    inner = np.maximum(sd_ellipse2(X, Y - CUFF_CY, ai, bi), Z - 40.0)
    d = smax(d, -inner, 2.5)
    # rolled rim at the opening and piping where the fist meets the cuff
    d -= bump(Z - 3.0, 1.3, 2.4) * (Z < 12)
    d -= bump(Z - 88.0, 2.3, 1.8)
    d += bump(Z - 84.2, 0.8, 0.8) + bump(Z - 91.8, 0.8, 0.8)
    # back panel outline seam (welt) seen from the back of the hand
    S = sd_round_rect2(X, Z, (2.0, 166.0), (55.0, 66.0), 42.0)
    back = sstep(-Y, 12.0, 28.0) * sstep(Z, 98.0, 106.0)
    d += bump(S, 0.85, 1.1) * back
    d -= bump(S - 2.6, 0.35, 1.0) * back
    # side welts running over the top
    for xs in (-57.0, 57.0):
        S2 = X - xs * tz
        d += bump(S2, 0.45, 1.0) * sstep(Y, -30.0, -12.0) * sstep(Z, 104.0, 114.0)
    # fingertip crease and the seam along it, palm side
    d += bump(Z - 137.0, 3.4, 2.6) * sstep(Y, 22.0, 36.0)
    # palm panel seam, a U around the palm
    S3 = sd_round_rect2(X, Z, (18.0, 112.0), (30.0, 22.0), 14.0)
    d += bump(S3, 0.9, 1.0) * sstep(Y, 28.0, 38.0) * (Z > 92)
    # breathable vent: a slit in the palm with a raised lip
    slx = seg_dist2(X, Z, SLIT[0], SLIT[1])
    d = smax(d, -np.maximum(slx - SLIT_R, SLIT_Y - Y), 1.0)
    d -= bump(slx - SLIT_R - 2.8, 1.1, 1.8) * sstep(Y, 28.0, 38.0)
    # thumb seam along its outer side
    # leather wrinkles over the knuckles and the wrist bend
    for (u0, v0, u1, v1, amp) in ((-44, 220, -24, 230, 0.6), (-52, 204, -38, 212, 0.5), (30, 228, 47, 219, 0.55),
                                  (-6, 233, 10, 235, 0.4), (44, 120, 58, 112, 0.45), (-50, 112, -62, 104, 0.4)):
        dd = seg_dist2(X, Z, (u0, v0), (u1, v1))
        d += bump(dd, amp, 1.1) * sstep(-Y, 0.0, 20.0)
    # hand made padding: slow undulations
    d += puff(X, Y, Z) * 0.55 * (Z > 86)
    return d


# ------------------------------------------------------------------ surface nets


def surface_nets(fn, lo, hi, h):
    lo = np.array(lo, float)
    n = [int(math.ceil((hi[i] - lo[i]) / h)) + 1 for i in range(3)]
    xs = [lo[i] + h * np.arange(n[i]) for i in range(3)]
    F = np.empty(n, np.float32)
    Yg, Zg = np.meshgrid(xs[1], xs[2], indexing='ij')
    step = 16
    for i0 in range(0, n[0], step):
        i1 = min(n[0], i0 + step)
        Xg = np.repeat(xs[0][i0:i1], Yg.size)
        P = np.stack([Xg, np.tile(Yg.ravel(), i1 - i0), np.tile(Zg.ravel(), i1 - i0)], 1).astype(np.float32)
        F[i0:i1] = fn(P).reshape(i1 - i0, n[1], n[2])
    inside = F < 0
    nc = (n[0] - 1, n[1] - 1, n[2] - 1)
    acc = np.zeros(nc + (3,), np.float64)
    cnt = np.zeros(nc, np.int32)
    quads = []
    for ax in range(3):
        sl0 = [slice(None)] * 3
        sl1 = [slice(None)] * 3
        sl0[ax] = slice(0, -1)
        sl1[ax] = slice(1, None)
        f0, f1 = F[tuple(sl0)], F[tuple(sl1)]
        in0 = inside[tuple(sl0)]
        ch = in0 != inside[tuple(sl1)]
        idx = np.nonzero(ch)
        t = f0[idx] / (f0[idx] - f1[idx])
        pos = np.stack([xs[k][idx[k]] for k in range(3)], 1)
        pos[:, ax] += t * h
        b, c = (ax + 1) % 3, (ax + 2) % 3
        for db in (0, 1):
            for dc in (0, 1):
                ci = [idx[0].copy(), idx[1].copy(), idx[2].copy()]
                ci[b] = ci[b] - db
                ci[c] = ci[c] - dc
                ok = (ci[b] >= 0) & (ci[b] < nc[b]) & (ci[c] >= 0) & (ci[c] < nc[c])
                flat = np.ravel_multi_index((ci[0][ok], ci[1][ok], ci[2][ok]), nc)
                np.add.at(acc.reshape(-1, 3), flat, pos[ok])
                np.add.at(cnt.reshape(-1), flat, 1)
        # one quad per crossing edge that has all four neighbouring cells
        ok = (idx[b] >= 1) & (idx[b] < nc[b]) & (idx[c] >= 1) & (idx[c] < nc[c]) & (idx[ax] < nc[ax])
        e = [idx[0][ok], idx[1][ok], idx[2][ok]]
        flip = ~in0[idx][ok]
        corners = []
        for db, dc in ((1, 1), (0, 1), (0, 0), (1, 0)):
            ci = [e[0].copy(), e[1].copy(), e[2].copy()]
            ci[b] = ci[b] - db
            ci[c] = ci[c] - dc
            corners.append(np.ravel_multi_index(tuple(ci), nc))
        q = np.stack(corners, 1)
        q[flip] = q[flip][:, ::-1]
        quads.append(q)
    quads = np.concatenate(quads)
    act = cnt.reshape(-1) > 0
    vid = np.full(act.size, -1, np.int64)
    vid[act] = np.arange(act.sum())
    V = acc.reshape(-1, 3)[act] / cnt.reshape(-1)[act][:, None]
    Q = vid[quads]
    Q = Q[(Q >= 0).all(1)]
    return V, Q


def project_to_surface(V, fn, iters=3, e=0.25):
    for _ in range(iters):
        f = fn(V.astype(np.float32)).astype(np.float64)
        g = np.zeros_like(V)
        for k in range(3):
            dv = np.zeros(3)
            dv[k] = e
            g[:, k] = (fn((V + dv).astype(np.float32)) - fn((V - dv).astype(np.float32))) / (2 * e)
        gg = np.maximum((g * g).sum(1), 1e-6)
        step = (f / gg)[:, None] * g * 0.9
        ln = np.linalg.norm(step, axis=1, keepdims=True)
        V = V - step * np.minimum(1.0, (0.6 * GRID) / np.maximum(ln, 1e-9))
    return V


def mesh_from_arrays(name, V, Q, mats=()):
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(V))
    me.vertices.foreach_set('co', V.astype(np.float32).ravel())
    me.loops.add(Q.size)
    me.loops.foreach_set('vertex_index', Q.astype(np.int32).ravel())
    me.polygons.add(len(Q))
    me.polygons.foreach_set('loop_start', np.arange(0, Q.size, 4, dtype=np.int32))
    me.update(calc_edges=True)
    me.validate()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    for m in mats:
        me.materials.append(m)
    return ob


# ------------------------------------------------------------------ materials

LEATHER = (0.205, 0.0072, 0.0135)   # linear; deep crimson, a little blue in it like the real ones


def tex_grain(size=512):
    p = os.path.join(GT, 'grain_n.png')
    if os.path.exists(p):
        return load_img(p, 'Non-Color')
    f1, f2 = worley(size, 34, 21, 0.9)
    peb = np.sqrt(np.clip((f2 - f1) / 0.35, 0, 1))
    g1, g2 = worley(size, 68, 22, 0.9)
    fine = np.sqrt(np.clip((g2 - g1) / 0.3, 0, 1))
    h = peb * (0.8 + 0.2 * blur_noise(size, 30, 23)) + 0.3 * fine + 0.06 * blur_noise(size, 1.0, 24)
    n = height_to_normal(h, 3.0)
    h_, w_ = n.shape[:2]
    img = bpy.data.images.new('gloves_grain_n', w_, h_, alpha=False)
    img.pixels.foreach_set(np.dstack([n, np.ones((h_, w_))]).astype(np.float32).ravel())
    img.filepath_raw = p
    img.file_format = 'PNG'
    img.save()
    img.colorspace_settings.name = 'Non-Color'
    return img


def materials():
    M = {}
    # soft sheen rather than gloss: a broad base highlight under a thin, fairly rough coat
    M['leather'] = mat('gloves_leather', LEATHER, 0.0, 0.5, normal=tex_grain(), nstr=0.14, coat=0.3, coat_rough=0.34)
    M['patch'] = mat('gloves_patch', (0.86, 0.86, 0.84), 0.0, 0.6)
    M['lining'] = mat('gloves_lining', (0.02, 0.02, 0.022), 0.0, 0.92)
    M['lace'] = mat('gloves_lace', (0.80, 0.78, 0.72), 0.0, 0.85)
    dec = load_img(os.path.join(GT, 'decals.png'), 'sRGB')
    m = mat('gloves_decal', (1, 1, 1), 0.0, 0.4, base_tex=dec)
    nt = m.node_tree
    tex = [n for n in nt.nodes if n.type == 'TEX_IMAGE'][0]
    bsdf = [n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'][0]
    nt.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
    m.surface_render_method = 'BLENDED'
    M['decal'] = m
    return M


KEYS = ['leather', 'patch', 'decal', 'lining', 'lace']
ATLAS = (2048.0, 1024.0)
REG = {'word': (0, 0, 1280, 512), 'oval': (1280, 0, 2048, 512), 'badge': (0, 512, 512, 1024), 'ten': (512, 512, 640, 768)}


def reg_uv(key, u, v):
    """u, v in 0..1 across a region (v up) -> atlas UV."""
    x0, y0, x1, y1 = REG[key]
    return ((x0 + u * (x1 - x0)) / ATLAS[0], 1.0 - (y1 - v * (y1 - y0)) / ATLAS[1])


# ------------------------------------------------------------------ parts


def grid_mesh(name, nu, nv, pos, uv, mats, mi):
    """Quad grid; pos(i, j) -> 3D, uv(i, j) -> (u, v). Faces wound so +u x +v is the front."""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new('UVMap')
    vs = [[bm.verts.new(pos(i, j)) for j in range(nv + 1)] for i in range(nu + 1)]
    for i in range(nu):
        for j in range(nv):
            f = bm.faces.new((vs[i][j], vs[i + 1][j], vs[i + 1][j + 1], vs[i][j + 1]))
            f.material_index = mi
            for l, (a, b) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                l[uvl].uv = uv(a, b)
    return new_obj(name, bm, mats)


def orient(ob, outward):
    """Flip all faces if most face normals disagree with outward(center) (a Vector)."""
    me = ob.data
    score = sum(p.normal.dot(outward(p.center)) for p in me.polygons)
    if score < 0:
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
        bm.to_mesh(me)
        bm.free()
    me.update()


def body(s, M, mats, I):
    fn = lambda P: glove_sdf(P, s)
    lo = (-90.0, -68.0, -5.0)
    hi = (90.0, 72.0, 246.0)
    V, Q = surface_nets(fn, lo, hi, GRID)
    V = project_to_surface(V, fn)
    ob = mesh_from_arrays('glove_body', V, Q, mats)
    nq = len(ob.data.polygons)
    md = ob.modifiers.new('dec', 'DECIMATE')
    md.ratio = min(1.0, BODY_TRIS / (2.0 * nq))
    apply_mods(ob)
    me = ob.data
    for p in me.polygons:
        c = p.center
        X = c.x * s
        a, b = cuff_ab(np.array([c.z]))
        e = (X / (a[0] - 5.0)) ** 2 + ((c.y - CUFF_CY) / (b[0] - 5.0)) ** 2
        sl = seg_dist2(np.array([X]), np.array([c.z]), SLIT[0], SLIT[1])[0]
        inside = (c.z < 42.0 and e < 1.0) or (sl < SLIT_R + 0.35 and c.y > SLIT_Y - 1.0)
        p.material_index = I['lining'] if inside else I['leather']
        p.use_smooth = True
    unwrap(ob, 60.0)
    return ob


def unwrap(ob, tile_mm):
    for o in bpy.context.selected_objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(55), island_margin=0.003, correct_aspect=True)
    bpy.ops.object.mode_set(mode='OBJECT')
    me = ob.data
    uv = me.uv_layers.active.data
    a3 = auv = 0.0
    for p in me.polygons:
        a3 += p.area
        pts = [uv[li].uv for li in p.loop_indices]
        auv += abs(sum(pts[k].x * pts[(k + 1) % len(pts)].y - pts[(k + 1) % len(pts)].x * pts[k].y for k in range(len(pts)))) / 2
    f = (1.0 / tile_mm) / math.sqrt(auv / a3)
    for l in uv:
        l.uv = (l.uv.x * f, l.uv.y * f)


# --- the cuff surface (right-glove frame, X = x * s): base radius along each ray from the cuff axis


def cuff_ray(theta, z):
    a, b = cuff_ab(np.asarray(z, float))
    d = np.stack([a * np.cos(theta), b * np.sin(theta)], -1)
    d /= np.linalg.norm(d, axis=-1, keepdims=True)
    lo = 1.0 / np.sqrt((d[..., 0] / a) ** 2 + (d[..., 1] / b) ** 2) - 3.0
    hi = np.full(np.shape(theta), 90.0)
    for _ in range(32):
        m = (lo + hi) / 2
        P = np.stack([d[..., 0] * m, CUFF_CY + d[..., 1] * m, np.broadcast_to(z, np.shape(m))], -1).reshape(-1, 3)
        inside = (glove_sdf(P.astype(np.float32), 1.0) < 0).reshape(np.shape(m))
        lo = np.where(inside, m, lo)
        hi = np.where(inside, hi, m)
    r = (lo + hi) / 2
    nrm = np.stack([np.cos(theta) / a, np.sin(theta) / b], -1)
    nrm /= np.linalg.norm(nrm, axis=-1, keepdims=True)
    base = np.stack([d[..., 0] * r, CUFF_CY + d[..., 1] * r], -1)
    return base, nrm


STRAP_Z = (10.0, 82.0)
STRAP_T = 4.2
FLAP = (math.radians(58), math.radians(132))   # strap end overlapping on the palm side


def strap_thick(theta):
    t = np.asarray(theta) % TAU
    on = sstep(t, FLAP[0], FLAP[0] + 0.035) * (1 - sstep(t, FLAP[1] - 0.3, FLAP[1]))
    return STRAP_T + 2.4 * on


def strap_profile():
    """(z, off(T)) pairs around the strap section, inner tuck -> bottom -> outer face -> top -> tuck."""
    z0, z1 = STRAP_Z
    R = 1.4
    pr = [(z0 + 1.0, lambda T: T * 0 - 1.2), (z0, lambda T: T * 0)]
    for k in range(5):
        a = math.radians(-90 + 90 * k / 4)
        pr.append((z0 + R + R * math.sin(a), lambda T, c=math.cos(a): T - R + R * c))
    for zz in (z0 + 4.4, z1 - 4.4):   # stitch lines
        pr += [(zz - 0.9, lambda T: T), (zz, lambda T: T - 0.35), (zz + 0.9, lambda T: T)]
    for k in range(5):
        a = math.radians(90 * k / 4)
        pr.append((z1 - R + R * math.sin(a), lambda T, c=math.cos(a): T - R + R * c))
    pr += [(z1, lambda T: T * 0), (z1 - 1.0, lambda T: T * 0 - 1.2)]
    return pr


def strap(M, mats, I):
    """Velcro strap around the cuff, right-glove frame. Rows: theta; columns: profile."""
    z0, z1 = STRAP_Z
    prof = strap_profile()
    th = list(np.linspace(0, TAU, 113)[:-1])
    th += [FLAP[0] - 0.01, FLAP[0] + 0.006, FLAP[0] + 0.018, FLAP[0] + 0.03]
    th = np.array(sorted(set(round(t, 5) for t in th)))
    zs = np.array([z for z, _ in prof])
    TH, ZZ = np.meshgrid(th, zs, indexing='ij')
    base, nrm = cuff_ray(TH, ZZ)
    T = strap_thick(TH)
    off = np.stack([fo(T[:, k]) for k, (_, fo) in enumerate(prof)], 1)
    P = np.concatenate([base + nrm * off[..., None], ZZ[..., None]], -1)
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new('UVMap')
    nt, npf = P.shape[:2]
    vs = [[bm.verts.new(tuple(P[i, k])) for k in range(npf)] for i in range(nt)]
    # arc length along the outer surface for UVs
    outer = P[:, npf // 2, :2]
    seg = np.linalg.norm(np.roll(outer, -1, 0) - outer, axis=1)
    arc = np.concatenate([[0], np.cumsum(seg)])
    for i in range(nt):
        j = (i + 1) % nt
        for k in range(npf - 1):
            f = bm.faces.new((vs[i][k], vs[j][k], vs[j][k + 1], vs[i][k + 1]))
            f.material_index = I['leather']
            for l, (ii, kk) in zip(f.loops, ((i, k), (i + 1, k), (i + 1, k + 1), (i, k + 1))):
                l[uvl].uv = (arc[ii] / 60.0, P[ii % nt, kk, 2] / 60.0)
    ob = new_obj('strap', bm, mats)
    orient(ob, lambda c: Vector((c.x, c.y - CUFF_CY, 0)))
    for p in ob.data.polygons:
        p.use_smooth = True
    ob.data.set_sharp_from_angle(angle=math.radians(50))
    return ob


_ARC = {}


def strap_surface(u, z, lift):
    """Point and outward normal on the strap's outer face, right-glove frame; u = arc mm from the
    back centre (theta = 270 deg), positive toward +X."""
    if 'th' not in _ARC:
        th = np.linspace(math.radians(200), math.radians(340), 400)
        base, nrm = cuff_ray(th, np.full_like(th, float(np.mean(STRAP_Z))))
        outer = base + nrm * STRAP_T
        seg = np.linalg.norm(np.diff(outer, axis=0), axis=1)
        arc = np.concatenate([[0], np.cumsum(seg)])
        arc -= np.interp(math.radians(270), th, arc)
        _ARC['th'], _ARC['arc'] = th, arc
    t = np.interp(u, _ARC['arc'], _ARC['th'])
    b2, n2 = cuff_ray(np.atleast_1d(t), np.atleast_1d(np.float64(z)))
    p = b2[0] + n2[0] * (STRAP_T + lift)
    return Vector((p[0], p[1], z)), Vector((n2[0][0], n2[0][1], 0)).normalized()


PATCH_U = (-45.0, 45.0)
PATCH_Z = (14.6, 77.4)
PATCH_RIM = 2.2   # the red leather binding round the white


def _rim_steps(a, b, n):
    r = PATCH_RIM
    return np.concatenate([[a, a + 0.45, a + r / 2, a + r - 0.45, a + r, a + r + 0.5],
                           np.linspace(a + r + 1.4, b - r - 1.4, n),
                           [b - r - 0.5, b - r, b - r + 0.45, b - r / 2, b - 0.45, b]])


def patch(s, mats, I):
    """White patch on the back of the strap, bound in red leather: a thin slab, the binding a
    rounded bead round its edge."""
    u0, u1 = PATCH_U
    z0, z1 = PATCH_Z
    us = _rim_steps(u0, u1, 26)
    zs = _rim_steps(z0, z1, 14)
    nu, nv = len(us) - 1, len(zs) - 1
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new('UVMap')

    def P(u, z, lift):
        p, n = strap_surface(u * s, z, lift)
        return Vector((p.x * s, p.y, p.z))

    def edge(u, z):
        return min(u - u0, u1 - u, z - z0, z1 - z)

    def lift_at(u, z):
        e = edge(u, z)
        if e < PATCH_RIM:
            return 0.45 + 0.75 * math.sin(math.pi * e / PATCH_RIM)
        return 0.62
    top = [[bm.verts.new(P(u, z, lift_at(u, z))) for z in zs] for u in us]
    for i in range(nu):
        for j in range(nv):
            f = bm.faces.new((top[i][j], top[i + 1][j], top[i + 1][j + 1], top[i][j + 1]))
            rim = edge((us[i] + us[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2) < PATCH_RIM
            f.material_index = I['leather'] if rim else I['patch']
    ring = [(i, 0) for i in range(nu)] + [(nu, j) for j in range(nv)] + [(i, nv) for i in range(nu, 0, -1)] + [(0, j) for j in range(nv, 0, -1)]
    bot = [bm.verts.new(P(us[i], zs[j], -0.4)) for i, j in ring]
    n = len(ring)
    for k in range(n):
        a, b = ring[k], ring[(k + 1) % n]
        f = bm.faces.new((top[b[0]][b[1]], top[a[0]][a[1]], bot[k], bot[(k + 1) % n]))
        f.material_index = I['leather']
    ob = new_obj('patch', bm, mats)
    orient(ob, lambda c: Vector((c.x, c.y - CUFF_CY, 0)))
    for p in ob.data.polygons:
        p.use_smooth = True
    ob.data.set_sharp_from_angle(angle=math.radians(60))
    return ob


def decal_uv(key, flip, nu, nv):
    """Grid (i, j) -> atlas UV; flip turns the print 180 degrees on the grid."""
    if flip:
        return lambda i, j: reg_uv(key, 1 - i / nu, 1 - j / nv)
    return lambda i, j: reg_uv(key, i / nu, j / nv)


def patch_decal(name, s, key, uc, zc, w, h, nu, nv, mats, I, flip):
    def pos(i, j):
        u = uc + (i / nu - 0.5) * w
        z = zc + (j / nv - 0.5) * h
        p, n = strap_surface(u * s, z, 0.85)
        return (p.x * s, p.y, p.z)
    ob = grid_mesh(name, nu, nv, pos, decal_uv(key, flip, nu, nv), mats, I['decal'])
    orient(ob, lambda c: Vector((c.x, c.y - CUFF_CY, 0)))
    return ob


def back_decal(name, target, key, cx, cz, w, h, ang, nu, nv, mats, I, flip):
    """Grid in the XZ plane in front of the back of the hand, projected along +Y onto target."""
    ca, sa = math.cos(math.radians(ang)), math.sin(math.radians(ang))

    def pos(i, j):
        u = (i / nu - 0.5) * w
        v = (j / nv - 0.5) * h
        return (cx + u * ca - v * sa, -120.0, cz + u * sa + v * ca)
    ob = grid_mesh(name, nu, nv, pos, decal_uv(key, flip, nu, nv), mats, I['decal'])
    from mathutils.bvhtree import BVHTree
    me = target.data
    tree = BVHTree.FromPolygons([v.co for v in me.vertices], [tuple(p.vertices) for p in me.polygons])
    for v in ob.data.vertices:
        loc, nrm, idx, dist = tree.ray_cast(Vector((v.co.x, -200.0, v.co.z)), Vector((0, 1, 0)), 400.0)
        if loc is None:
            raise RuntimeError('decal %s misses the glove at %s' % (name, tuple(v.co)))
        v.co = loc - Vector((0, 1, 0)) * 0.3
    ob.data.update()
    orient(ob, lambda c: Vector((0, -1, 0)))
    return ob


KNOT_LOCAL = (0.0, CUFF_CY + 37.0, -1.0)


def glove(s, M, name, flip=True):
    mats = [M[k] for k in KEYS]
    I = {k: i for i, k in enumerate(KEYS)}
    b = body(s, M, mats, I)
    st = strap(M, mats, I)
    if s < 0:
        xform(st, sc(-1, 1, 1))
    pa = patch(s, mats, I)
    parts = [b, st, pa]
    # decals: the big wordmark and the round stamp on the back of the hand, the oval logo and size on
    # the patch. Flipped: each print turned 180 degrees and its offset across the glove mirrored, so
    # the hanging glove (turned over by place_matrix) shows the product photo's layout upright.
    f = -1.0 if flip else 1.0
    parts.append(back_decal('word', b, 'word', f * -2.0 * s, 184.0, 104.0, 104.0 * 512 / 1280, 8.0, 40, 16, mats, I, flip))
    parts.append(back_decal('badge', b, 'badge', f * 12.0 * s, 134.0, 27.0, 27.0, 0.0, 12, 12, mats, I, flip))
    parts.append(patch_decal('oval', s, 'oval', f * -4.0, 46.0, 74.0, 74.0 * 512 / 768, 28, 18, mats, I, flip))
    parts.append(patch_decal('ten', s, 'ten', f * 37.5, 46.0, 6.2, 12.4, 3, 6, mats, I, flip))
    ob = join(parts, name)
    return ob


# ------------------------------------------------------------------ lace


def tube(name, pts, r, nseg, mats, mi, cap=True):
    """Round cord along a polyline, parallel-transport frames (no twist flips on vertical runs)."""
    P = [Vector(p) for p in pts]
    n = len(P)
    T = []
    for k in range(n):
        t = (P[min(k + 1, n - 1)] - P[max(k - 1, 0)]).normalized()
        T.append(t)
    N = T[0].cross(Vector((0.3, 0.2, 1.0))).normalized()
    frames = []
    for k in range(n):
        if k:
            q = T[k - 1].rotation_difference(T[k])
            N = (q @ N)
            N = (N - T[k] * N.dot(T[k])).normalized()
        frames.append((N.copy(), T[k].cross(N).normalized()))
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new('UVMap')
    rings = []
    for k in range(n):
        Nk, Bk = frames[k]
        rings.append([bm.verts.new(P[k] + (Nk * math.cos(TAU * i / nseg) + Bk * math.sin(TAU * i / nseg)) * r)
                      for i in range(nseg)])
    acc = [0.0]
    for k in range(1, n):
        acc.append(acc[-1] + (P[k] - P[k - 1]).length)
    for k in range(n - 1):
        for i in range(nseg):
            j = (i + 1) % nseg
            f = bm.faces.new((rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]))
            f.material_index = mi
            for l, (kk, ii) in zip(f.loops, ((k, i), (k, i + 1), (k + 1, i + 1), (k + 1, i))):
                l[uvl].uv = (ii / nseg, acc[kk] / 20.0)
    if cap:
        for k, sgn in ((0, -1), (n - 1, 1)):
            c = bm.verts.new(P[k] + T[k] * sgn * r * 0.6)
            for i in range(nseg):
                j = (i + 1) % nseg
                f = bm.faces.new((rings[k][i], rings[k][j], c) if sgn > 0 else (rings[k][j], rings[k][i], c))
                f.material_index = mi
    ob = new_obj(name, bm, mats)
    fix_normals(ob)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


LACE_R = 1.6
BEND = 1.8


def lace(M, kl, kr):
    mats = [M[k] for k in KEYS]
    I = {k: i for i, k in enumerate(KEYS)}
    zc = -(BEND + LACE_R)
    xo = LACE_R + 0.6

    def over(x, front_to_back):
        out = []
        for i in range(9):
            ph = math.pi * i / 8
            y = -BEND * math.cos(ph)
            out.append((x, y if front_to_back else -y, zc + BEND * math.sin(ph)))
        return out
    kl, kr = Vector(kl), Vector(kr)
    a = Vector((-xo, -BEND, zc))
    b = Vector((xo, -BEND, zc))
    # left strand: knot -> up to the edge, over, down the back, across, back up, over, down to the right knot
    left = [kl + (a - kl) * t for t in np.linspace(0, 1, 14)[:-1]]
    right = [b + (kr - b) * t for t in np.linspace(0, 1, 14)[1:]]
    back = [(-xo, BEND, zc - 6), (-xo * 0.9, BEND + 0.2, -26), (0, BEND + 0.6, -33), (xo * 0.9, BEND + 0.2, -26), (xo, BEND, zc - 6)]
    pts = [tuple(p) for p in left] + over(-xo, True) + back + over(xo, False) + [tuple(p) for p in right]
    parts = [tube('lace_cord', pts, LACE_R, 10, mats, I['lace'])]
    for k, side in ((kl, -1), (kr, 1)):
        knot = tube('knot', [k + Vector((-3.2, 0, 0.5)), k + Vector((0, -0.6, 2.2)), k + Vector((3.2, 0, 0.5))],
                    2.6, 10, mats, I['lace'])
        tail = tube('tail', catmull([k + Vector((1.5, -1.0, -0.5)), k + Vector((side * 4, -3.0, -8)),
                                     k + Vector((side * 3, -4.0, -18))], 4), LACE_R * 0.9, 8, mats, I['lace'])
        parts += [knot, tail]
    return join(parts, 'lace')


# ------------------------------------------------------------------ assembly


def place_matrix(knot, yaw, roll, pitch):
    return (tr(*knot) @ rot('Z', yaw) @ rot('Y', roll) @ rot('X', pitch) @ rot('Y', 180) @ tr(*(-Vector(KNOT_LOCAL))))


def verts_world(ob):
    me = ob.data
    V = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get('co', V)
    return V.reshape(-1, 3)


def apply_matrix(V, Mx):
    A = np.array(Mx, np.float64)
    return (V @ A[:3, :3].T) + A[:3, 3]


HANG = {
    # side, knot (mm, world: x right, -y toward the viewer, z up), yaw, roll, pitch (deg)
    'glove_l': (-1, (-36.0, -6.0, -62.0), -30.0, 7.0, 4.0),
    'glove_r': (1, (38.0, -26.0, -74.0), 24.0, -7.0, 3.0),
}


def build():
    reset()
    M = materials()
    obs = {}
    mtx = {}
    for name, (s, knot, yaw, roll, pitch) in HANG.items():
        ob = glove(s, M, name)
        Mx = place_matrix(knot, yaw, roll, pitch)
        xform(ob, Mx)
        # rest against the card: nothing behind y = -1.2
        V = verts_world(ob)
        dy = -1.2 - float(V[:, 1].max())
        xform(ob, tr(0, dy, 0))
        mtx[name] = tr(0, dy, 0) @ Mx
        obs[name] = ob
    # the front glove must clear the back one (strap/patch included near the cuff)
    gl, gr = obs['glove_l'], obs['glove_r']
    inv = mtx['glove_l'].inverted()
    moved = 0.0
    for _ in range(120):
        V = apply_matrix(verts_world(gr), inv)
        d = glove_sdf(V.astype(np.float32), -1.0)
        need = np.where(V[:, 2] < 96.0, 5.0, 1.0)
        pen = float((need - d).max())
        if pen <= 0:
            break
        st = min(4.0, max(0.5, pen * 0.5))
        xform(gr, tr(0, -st, 0))
        mtx['glove_r'] = tr(0, -st, 0) @ mtx['glove_r']
        moved += st
    knots = {n: mtx[n] @ Vector(KNOT_LOCAL) for n in obs}
    print('SIZE front glove moved', moved, 'knots', {n: tuple(round(c, 1) for c in k) for n, k in knots.items()})
    la = lace(M, knots['glove_l'], knots['glove_r'])
    objs = [gl, gr, la]
    # mm -> m, pivots at the knots
    S = Matrix.Scale(0.001, 4)
    for ob in objs:
        ob.data.transform(S)
        piv = knots.get(ob.name)
        if piv is not None:
            p = piv * 0.001
            ob.data.transform(tr(*(-p)))
            ob.location = p
        ob.data.update()
    bpy.context.view_layer.update()
    root = bpy.data.objects.new('gloves', None)
    bpy.context.scene.collection.objects.link(root)
    root.empty_display_size = 0.05
    exp = handles(root, objs, direct=('lace',))
    mn = Vector((1e9,) * 3)
    mx = Vector((-1e9,) * 3)
    for o in objs:
        for v in o.data.vertices:
            co = o.matrix_world @ v.co
            mn = Vector(map(min, mn, co))
            mx = Vector(map(max, mx, co))
    print('SIZE bounds m', tuple(round(v, 4) for v in mn), tuple(round(v, 4) for v in mx), 'TRIS', stats(objs),
          [stats([o]) for o in objs])
    return exp, mn, mx


def build_ref():
    """The two gloves standing like the product photo: left glove from the back, right glove palm on."""
    reset()
    M = materials()
    gl = glove(-1, M, 'ref_l', flip=False)
    gr = glove(1, M, 'ref_r', flip=False)
    xform(gl, tr(-78, 0, 0) @ rot('Z', -8))
    xform(gr, tr(78, 30, 0) @ rot('Z', 180 + 18))
    for o in (gl, gr):
        o.data.transform(Matrix.Scale(0.001, 4))
        o.data.update()
    return [gl, gr]


def backdrop(dark=False):
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0, 0.0004, -0.4), rotation=(math.pi / 2, 0, 0))
    bd = bpy.context.active_object
    bd.name = '_card'
    bd.scale = (0.9, 0.8, 1)
    col = (0.06, 0.06, 0.065) if dark else (0.62, 0.62, 0.6)
    bd.data.materials.append(mat('_card', col, 0.0, 0.7))
    return bd


if __name__ == '__main__':
    if '--ref' in ARGS:
        objs = build_ref()
        studio(floor=True, world=0.25, scale=2.4)
        render_views('gloves_ref', Vector((0, 0, 0.125)), 0.2, [('front', (0, -1, 0.08), 70, None)], res=(1000, 900), samples=24)
        sys.exit(0)
    exp, mn, mx = build()
    if '--export' in ARGS:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE_, 'gloves.blend'))
        export_glb(os.path.join(SCRATCH, 'raw', 'gloves.glb'), exp)
    if '--render' in ARGS:
        studio(floor=False, world=0.25, scale=2.4)
        backdrop()
        c = (mn + mx) / 2
        rad = (mx - mn).length / 2
        render_views('gloves', c, rad, [
            ('front', (0.0, -1, 0.04), 70, None),
            ('q34', (0.55, -1, 0.25), 70, None),
            ('left34', (-0.6, -1, 0.1), 70, None),
        ], res=(800, 1000), samples=24)
        gr = bpy.data.objects['glove_r_geo']
        bb = [gr.matrix_world @ Vector(v) for v in gr.bound_box]
        cr = sum(bb, Vector()) / 8
        render_views('gloves', cr, 0.13, [('rclose', (0.2, -1, 0.1), 80, None)], res=(900, 1000), samples=24)
