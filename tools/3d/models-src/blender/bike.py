# Generic modern carbon road bike (disc brakes, 2x11, 700c deep rims). Real scale, ~1.67 m long, ~995 mm wheelbase.
# Frame (mm): X forward, Z up, drive side faces -Y (so it faces +Z in glTF). Ground z = 0.
# Geometry ~ size 56: stack 575, reach 393, HTA 73, STA 73.5, chainstay 408, BB drop 72, rake 45.
# Frame colour is one material (bike_frame): a grey carbon-weave texture multiplied by a colour factor.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib, common
importlib.reload(common)
from common import *
import bmesh
import numpy as np
from mathutils import Vector, Matrix, Quaternion

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
HERE_ = os.path.dirname(os.path.abspath(__file__))

FRAME_COLOR = (0.030, 0.032, 0.036)   # default: gloss carbon black (recolour via bike_frame)
R_WHEEL = 339.0                       # 622 BSD + 28c tyre
RIM_OUT, RIM_DEPTH = 314.0, 45.0
RA = Vector((0.0, 0.0, R_WHEEL))
BB = Vector((401.6, 0.0, 267.0))      # 408 chainstay, 72 drop
HTA, STA = math.radians(73.0), math.radians(73.5)
D_STEER = Vector((math.cos(HTA), 0.0, -math.sin(HTA)))   # steering axis, pointing down
N_STEER = Vector((math.sin(HTA), 0.0, math.cos(HTA)))    # perpendicular, forward
S_SEAT = Vector((-math.cos(STA), 0.0, math.sin(STA)))    # seat tube, pointing up
HT_TOP = BB + Vector((393.0, 0.0, 575.0))
HT_LEN = 165.0
HT_BOT = HT_TOP + D_STEER * HT_LEN
CROWN = HT_BOT + D_STEER * 12.0
A2C, RAKE = 362.7, 45.0
FA = CROWN + D_STEER * A2C + N_STEER * RAKE
CHAIN_Y = -46.0
COGS = [11, 12, 13, 14, 15, 17, 19, 21, 24, 27, 30]
COG_Y0, COG_DY = -62.0, 3.8
CRANK_LEN = 172.5
CRANK_ANG = math.radians(-20.0)       # drive-side arm angle (0 = pointing forward)
STEM_C = HT_TOP - D_STEER * 52.0      # stem steerer-clamp centre on the steering axis (bars pivot)
POST_LEN = 690.0                      # seatpost top along the seat tube from the BB


def pitch_r(n):
    return 12.7 / (2 * math.sin(math.pi / n))


# ---------------------------------------------------------------- textures

def tex_twill(size=512, tows=8):
    """2x2 twill carbon weave: grey base (multiplied by the colour factor) + normal map."""
    pb = os.path.join(TEX, 'carbon_twill.png')
    pn = os.path.join(TEX, 'carbon_twill_n.png')
    if os.path.exists(pb) and os.path.exists(pn):
        return load_img(pb), load_img(pn, 'Non-Color')
    c = (np.arange(size) + 0.5) / size * tows
    U, V = np.meshgrid(c, c)
    i, j = np.floor(U), np.floor(V)
    fu, fv = U - i, V - j
    warp = ((i - j) % 4) < 2
    across = np.where(warp, fu, fv)
    along = np.where(warp, fv, fu)
    pillow = np.sin(np.pi * across) * 0.7 + np.sin(np.pi * along) * 0.3
    fib = 0.08 * np.sin(across * np.pi * 14)
    h = pillow + fib
    base = np.where(warp, 0.80, 1.0) * (0.82 + 0.18 * np.sin(np.pi * across))
    col = np.dstack([base, base, base])
    return save_img('carbon_twill', col, 'sRGB'), save_img('carbon_twill_n', height_to_normal(h, 1.6), 'Non-Color')


def tex_tape(name='bar_tape_n', size=512):
    p = os.path.join(TEX, name + '.png')
    if os.path.exists(p):
        return load_img(p, 'Non-Color')
    c = (np.arange(size) + 0.5) / size
    U, V = np.meshgrid(c, c)
    ph = (V * 1.0 + U) % 1.0
    h = np.clip(ph * 1.1, 0, 1) ** 0.6 + 0.12 * blur_noise(size, 1.0, 12)
    return save_img(name, height_to_normal(h, 5.0), 'Non-Color')


def mat_tinted(name, factor, tex, ntex, rough, coat=1.0, nstr=0.6, metal=0.0):
    """Base colour = texture x factor (exported as baseColorTexture + baseColorFactor)."""
    m = mat(name, (1, 1, 1), metal, rough, normal=ntex, nstr=nstr, coat=coat, coat_rough=0.04)
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    t = nt.nodes.new('ShaderNodeTexImage')
    t.image = tex
    t.location = (-900, 350)
    uvn = [n for n in nt.nodes if n.bl_idname == 'ShaderNodeUVMap'][0]
    nt.links.new(uvn.outputs[0], t.inputs[0])
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.location = (-550, 350)
    ins = {i.identifier: i for i in mix.inputs}
    outs = {o.identifier: o for o in mix.outputs}
    ins['Factor_Float'].default_value = 1.0
    nt.links.new(t.outputs[0], ins['A_Color'])
    ins['B_Color'].default_value = tuple(factor) + (1.0,)
    nt.links.new(outs['Result_Color'], b.inputs['Base Color'])
    return m


def materials():
    tw, twn = tex_twill()
    tape = tex_tape()
    brushed = tex_brushed('brushed_n', 512, strength=0.4)
    grain = tex_grain('grain_fine_n', 512, sigma=1.3, strength=0.9)
    M = {}
    M['frame'] = mat_tinted('bike_frame', FRAME_COLOR, tw, twn, 0.32, coat=1.0, nstr=0.5)
    M['carbon'] = mat_tinted('bike_carbon', (0.028, 0.029, 0.031), tw, twn, 0.35, coat=0.8, nstr=0.5)
    M['rim'] = mat_tinted('bike_rim', (0.026, 0.027, 0.029), tw, twn, 0.38, coat=0.6, nstr=0.4)
    M['decal'] = mat('bike_decal', (0.75, 0.75, 0.74), 0.0, 0.4)
    M['tire'] = mat('bike_tire', (0.022, 0.022, 0.023), 0.0, 0.82)
    M['spoke'] = mat('bike_spoke', (0.02, 0.02, 0.022), 0.6, 0.35)
    M['hub'] = mat('bike_hub', (0.03, 0.03, 0.033), 0.6, 0.32)
    M['rotor'] = mat('bike_rotor', (0.62, 0.62, 0.63), 1.0, 0.3, normal=brushed, nstr=0.6)
    M['alloy'] = mat('bike_groupset', (0.075, 0.077, 0.082), 0.85, 0.32)
    M['steel'] = mat('bike_cassette', (0.55, 0.55, 0.56), 1.0, 0.28)
    M['chain'] = mat('bike_chain', (0.42, 0.42, 0.43), 1.0, 0.36)
    M['tape'] = mat('bike_bar_tape', (0.022, 0.022, 0.024), 0.0, 0.62, normal=tape, nstr=0.8)
    M['hood'] = mat('bike_hoods', (0.02, 0.02, 0.021), 0.0, 0.7)
    M['saddle'] = mat('bike_saddle', (0.024, 0.024, 0.026), 0.0, 0.5, normal=grain, nstr=0.5)
    M['black'] = mat('bike_black', (0.015, 0.015, 0.016), 0.0, 0.45)
    M['bolt'] = mat('bike_bolts', (0.5, 0.5, 0.52), 1.0, 0.3)
    return M


KEYS = ['frame', 'carbon', 'rim', 'decal', 'tire', 'spoke', 'hub', 'rotor', 'alloy', 'steel', 'chain', 'tape', 'hood',
        'saddle', 'black', 'bolt']


# ---------------------------------------------------------------- helpers

def sweep_pt(name, path, prof, mats, n0=None, cap0=True, cap1=True):
    """Sweep with parallel-transport frames (robust for 3D paths). prof(t) -> [(s, u)] along N and B."""
    P = [Vector(p) for p in path]
    n = len(P)
    T = [(P[min(i + 1, n - 1)] - P[max(i - 1, 0)]).normalized() for i in range(n)]
    if n0 is None:
        a = Vector((0, 1, 0)) if abs(T[0].y) < 0.9 else Vector((1, 0, 0))
        N = T[0].cross(a).normalized()
    else:
        N = Vector(n0)
        N = (N - T[0] * N.dot(T[0])).normalized()
    loops = []
    for i in range(n):
        if i > 0:
            q = T[i - 1].rotation_difference(T[i])
            N = q @ N
            N = (N - T[i] * N.dot(T[i])).normalized()
        B = T[i].cross(N)
        loops.append([tuple(P[i] + N * s + B * u) for s, u in prof(i / (n - 1))])
    return loft(name, loops, mats, cap0=cap0, cap1=cap1)


def ell(h, w, n=20, e=2.0):
    """Superellipse section: h along N (in-plane), w along B (lateral)."""
    return [(h / 2 * math.copysign(abs(math.cos(t)) ** (2 / e), math.cos(t)),
             w / 2 * math.copysign(abs(math.sin(t)) ** (2 / e), math.sin(t))) for t in [TAU * k / n for k in range(n)]]


def lerp_prof(a, b):
    return lambda t: [(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t) for (x0, y0), (x1, y1) in zip(a, b)]


def tube(name, p0, p1, h0, w0, h1=None, w1=None, mats=(), n=20, e=2.0, steps=8, mid=None):
    h1 = h0 if h1 is None else h1
    w1 = w0 if w1 is None else w1
    pts = [p0, mid, p1] if mid is not None else [p0, p1]
    path = catmull([tuple(p) for p in pts], steps) if mid is not None else \
        [tuple(Vector(p0).lerp(Vector(p1), k / steps)) for k in range(steps + 1)]
    return sweep_pt(name, path, lerp_prof(ell(h0, w0, n, e), ell(h1, w1, n, e)), mats, n0=(0, 0, 1) if
                    abs((Vector(p1) - Vector(p0)).normalized().z) < 0.9 else (1, 0, 0))


def yaxis(ob, at):
    """Lathe objects are built around Z; turn them so the axis is Y (lateral) and move to `at`."""
    xform(ob, tr(*at) @ rot('X', -90))
    return ob


def ring_prism(name, outer, inner, y0, y1, mats):
    """Annulus prism in the XZ plane between two closed loops (same vertex count), spanning y0..y1."""
    bm = bmesh.new()
    L = []
    for loop in (outer, inner):
        L.append(([bm.verts.new((x, y0, z)) for x, z in loop], [bm.verts.new((x, y1, z)) for x, z in loop]))
    n = len(outer)
    (o0, o1), (i0, i1) = L
    for k in range(n):
        j = (k + 1) % n
        bm.faces.new((o0[k], o0[j], o1[j], o1[k]))
        bm.faces.new((i0[j], i0[k], i1[k], i1[j]))
        bm.faces.new((o0[j], o0[k], i0[k], i0[j]))
        bm.faces.new((o1[k], o1[j], i1[j], i1[k]))
    bm.normal_update()
    ob = new_obj(name, bm, mats)
    fix_normals(ob)
    return ob


def toothed(n_teeth, r_root, r_tip, phase=0.0):
    """Tooth outline with flanks and a flat-topped tip (7 points per tooth)."""
    pts = []
    rm = (r_root + r_tip) / 2
    for k in range(n_teeth):
        a = phase + TAU * k / n_teeth
        w = TAU / n_teeth
        for f, r in ((0.0, r_root), (0.16, r_root), (0.30, rm), (0.40, r_tip), (0.60, r_tip), (0.70, rm), (0.84, r_root)):
            t = a + f * w
            pts.append((r * math.cos(t), r * math.sin(t)))
    return pts


def circle(r, n, phase=0.0):
    return [(r * math.cos(phase + TAU * k / n), r * math.sin(phase + TAU * k / n)) for k in range(n)]


def wrap_circle(ob, R, theta_c, plane_y, side=-1):
    """Flat text (x along, y up) bent around a circle of radius R in the XZ plane, sitting at y = plane_y.
    side=-1: readable from -Y (drive side); side=+1: readable from +Y. Text top points outward."""
    subdivide_long_edges(ob, 1.5)
    for v in ob.data.vertices:
        x, y, z = v.co
        t = theta_c + side * x / R
        r = R + y
        v.co = (r * math.cos(t), plane_y, r * math.sin(t))
    ob.data.update()
    return ob


# ---------------------------------------------------------------- frame + fork

def build_frame(M):
    mats = [M[k] for k in KEYS]
    I = {k: i for i, k in enumerate(KEYS)}
    F = I['frame']
    parts = []

    def paint(ob, key='frame'):
        mat_by(ob, lambda c, n, i: I[key])
        smooth(ob, 40)
        uv_box(ob, 1 / 20.0)
        parts.append(ob)
        return ob
    # head tube (tapered, slightly aero) and fork crown
    ht0 = HT_TOP - D_STEER * 9.0
    ht1 = HT_BOT + D_STEER * 4.0
    paint(tube('head_tube', ht0, ht1, 52.0, 45.0, 62.0, 55.0, mats, n=28, e=2.2))
    cap = lathe('ht_cap', [(23.0, 0.0, I['black']), (23.0, 3.0, I['black']), (0.0, 3.0, I['black'])], 32, mats)
    q = Vector((0, 0, 1)).rotation_difference(-D_STEER)
    xform(cap, tr(*ht0) @ q.to_matrix().to_4x4())
    parts.append(cap)
    crown = tube('fork_crown', HT_BOT, HT_BOT + D_STEER * 28.0, 62.0, 56.0, 46.0, 98.0, mats, n=28, e=2.4, steps=6)
    paint(crown)
    # main triangle
    tt0 = HT_TOP + D_STEER * 24.0
    tt1 = BB + S_SEAT * 520.0
    paint(tube('top_tube', tt0, tt1, 36.0, 40.0, 27.0, 28.0, mats, n=24, e=2.3))
    dt0 = HT_TOP + D_STEER * 128.0
    dt1 = BB + Vector((-6.0, 0, 6.0))
    paint(tube('down_tube', dt0, dt1, 54.0, 50.0, 54.0, 64.0, mats, n=28, e=2.4))
    st0 = BB + S_SEAT * -8.0
    st1 = BB + S_SEAT * 560.0
    paint(tube('seat_tube', st0, st1, 44.0, 46.0, 34.0, 32.0, mats, n=24, e=2.2))
    bbs = lathe('bb_shell', [(0.0, -43.5, F), (24.5, -43.5, F), (26.5, -41.5, F), (26.5, 41.5, F), (24.5, 43.5, F),
                             (0.0, 43.5, F)], 40, mats)
    yaxis(bbs, BB)
    paint(bbs)
    # chainstays & seatstays, dropouts
    for sy in (-1, 1):
        cs0 = BB + Vector((-18.0, sy * 34.0, 4.0))
        cs1 = RA + Vector((14.0, sy * 74.0, -4.0))
        mid = cs0.lerp(cs1, 0.55) + Vector((0, sy * 6.0, -6.0))
        paint(tube('chainstay', cs0, cs1, 30.0, 22.0, 16.0, 13.0, mats, n=18, e=2.3, steps=10, mid=mid))
        ss0 = BB + S_SEAT * 455.0 + Vector((-4.0, sy * 12.0, 0.0))
        ss1 = RA + Vector((10.0, sy * 74.0, 14.0))
        mid = ss0.lerp(ss1, 0.5) + Vector((0, sy * 10.0, 0.0))
        paint(tube('seatstay', ss0, ss1, 17.0, 14.0, 13.0, 12.0, mats, n=16, e=2.2, steps=10, mid=mid))
        dro = slab_xz('dropout', rrect(38.0, 40.0, 14.0, 6, RA.x + 6.0, RA.z + 4.0), sy * 71.2, sy * 79.0, mats)
        paint(dro)
        # fork legs: from the crown to the front dropouts (aero, tapering)
        f0 = HT_BOT + D_STEER * 20.0 + Vector((0, sy * 34.0, 0))
        f1 = FA + Vector((0, sy * 56.0, 0)) + N_STEER * -4.0
        fmid = CROWN + D_STEER * (A2C * 0.55) + N_STEER * (RAKE * 0.35) + Vector((0, sy * 48.0, 0))
        paint(tube('fork_leg', f0, f1, 40.0, 24.0, 24.0, 13.0, mats, n=18, e=2.4, steps=12, mid=fmid))
        fdo = slab_xz('fork_tip', rrect(26.0, 30.0, 10.0, 6, FA.x, FA.z + 3.0), sy * 50.2, sy * 61.0, mats)
        paint(fdo)
    # thru axles (non-drive levers)
    for c_, half in ((RA, 80.0), (FA, 62.0)):
        ax = lathe('thru_axle', [(0.0, -half, I['black']), (7.0, -half, I['black']), (7.0, half, I['black']),
                                 (0.0, half, I['black'])], 24, mats)
        yaxis(ax, c_)
        parts.append(ax)
        lev = box('axle_lever', -4.0, 38.0, half - 1.0, half + 6.0, -5.0, 5.0, mats, bevel=2.0, seg=2)
        xform(lev, tr(*c_) @ rot('Y', 25))
        mat_by(lev, lambda c, n, i: I['black'])
        smooth(lev, 40)
        parts.append(lev)
    # headset spacers + top cap (on the steering axis)
    for k in range(2):
        sp = lathe('spacer', [(0.0, 0.0, I['black']), (19.5, 0.0, I['black']), (19.5, 9.5, I['black']),
                              (0.0, 9.5, I['black'])], 32, mats)
        q = Vector((0, 0, 1)).rotation_difference(-D_STEER)
        xform(sp, tr(*(HT_TOP - D_STEER * (12.0 + 10.0 * k))) @ q.to_matrix().to_4x4())
        smooth(sp, 40)
        parts.append(sp)
    # seatpost (aero carbon), clamp
    sp0 = BB + S_SEAT * 470.0
    sp1 = BB + S_SEAT * POST_LEN
    post = tube('seatpost', sp0, sp1, 30.0, 23.0, 30.0, 23.0, mats, n=20, e=2.4, steps=4)
    mat_by(post, lambda c, n, i: I['carbon'])
    smooth(post, 40)
    uv_box(post, 1 / 20.0)
    parts.append(post)
    clamp = tube('seat_clamp', BB + S_SEAT * 552.0, BB + S_SEAT * 566.0, 40.0, 36.0, 40.0, 36.0, mats, n=24, steps=1)
    mat_by(clamp, lambda c, n, i: I['frame'])
    smooth(clamp, 40)
    uv_box(clamp, 1 / 20.0)
    parts.append(clamp)
    # disc brake calipers (non-drive side, +Y)
    def caliper(center, ang_deg, rotor_r, rotor_y, name):
        a = math.radians(ang_deg)
        p = center + Vector((math.cos(a) * (rotor_r - 4.0), rotor_y, math.sin(a) * (rotor_r - 4.0)))
        cb = box(name, -26.0, 26.0, -11.0, 11.0, -10.0, 13.0, mats, bevel=4.0, seg=3)
        xform(cb, tr(*p) @ rot('Y', -(ang_deg - 90.0)))
        mat_by(cb, lambda c, n, i: I['alloy'])
        smooth(cb, 40)
        parts.append(cb)
    caliper(RA, 72.0, 70.0, 56.0, 'caliper_rear')
    caliper(FA, 118.0, 80.0, 44.0, 'caliper_front')
    # down tube decal (both sides), snapped to the surface
    dt_dir = (dt0 - dt1).normalized()
    dt_obj = [p for p in parts if p.name.startswith('down_tube')][0]
    for sy in (-1, 1):
        c0 = dt1.lerp(dt0, 0.55)
        hit, hn = raycast(dt_obj, c0 + Vector((0, sy * 80.0, 0)), Vector((0, -sy, 0)))
        if hit is not None:
            xa = dt_dir if sy < 0 else -dt_dir
            t_ = text_on('t_dt', 'AERO  CARBON', 13.0, frame(hit, xa, hn), M['decal'], FONT_BOLD, spacing=1.15, lift=0.5)
            subdivide_long_edges(t_, 1.2)
            project_onto(t_, dt_obj, -hn, lift=0.1)
            parts.append(t_)
    return parts


# ---------------------------------------------------------------- wheels

def build_wheel(M, front):
    mats = [M[k] for k in KEYS]
    I = {k: i for i, k in enumerate(KEYS)}
    parts = []
    # rim (deep carbon, blunt profile), closed cross-section revolved around the axle
    rp = [(RIM_OUT, -12.4), (309.0, -13.5), (298.0, -14.1), (285.0, -13.4), (276.0, -10.8), (271.0, -6.5),
          (269.0, -2.0), (269.0, 2.0), (271.0, 6.5), (276.0, 10.8), (285.0, 13.4), (298.0, 14.1), (309.0, 13.5),
          (RIM_OUT, 12.4), (312.5, 10.6), (310.8, 9.6), (310.8, -9.6), (312.5, -10.6), (RIM_OUT, -12.4)]
    rim = lathe('rim', [(r, y, I['rim']) for r, y in rp], 192, mats)
    me = rim.data
    uv = uvlayer(me).data
    for p in me.polygons:
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv[li].uv = (co.x / 20.0, co.y / 20.0 + co.z / 20.0)
    smooth(rim, 50)
    yaxis(rim, (0, 0, 0))
    parts.append(rim)
    # tyre: C-shaped section seated between the hooks
    tc, trr = 324.6, 14.4
    tp = [(tc + trr * math.cos(math.radians(a)), trr * math.sin(math.radians(a))) for a in np.linspace(-128, 128, 23)]
    tp = [(311.2, tp[0][1])] + tp + [(311.2, tp[-1][1]), (311.2, tp[0][1])]
    tire = lathe('tire', [(r, y, I['tire']) for r, y in tp], 192, mats)
    smooth(tire, 60)
    yaxis(tire, (0, 0, 0))
    parts.append(tire)
    # hub
    if front:
        hp = [(0.0, -50.0), (8.5, -50.0), (12.0, -47.0), (15.0, -45.0), (15.0, -38.0), (24.0, -37.0), (24.5, -33.0),
              (15.0, -31.5), (13.0, 0.0), (15.0, 31.5), (24.5, 33.0), (24.0, 37.0), (16.0, 38.0), (16.0, 41.0),
              (21.0, 41.5), (21.0, 45.0), (12.0, 47.0), (8.5, 50.0), (0.0, 50.0)]
        fl_y = (-35.0, 35.0)
        rotor_y, rotor_r = 44.0, 80.0
    else:
        hp = [(0.0, -71.0), (8.5, -71.0), (12.0, -68.0), (17.5, -66.0), (17.5, -24.0), (25.0, -22.0), (25.5, -18.0),
              (16.0, -16.0), (14.0, 10.0), (16.0, 32.0), (25.5, 34.0), (25.0, 38.0), (17.0, 39.0), (17.0, 52.0),
              (21.0, 52.5), (21.0, 57.5), (12.0, 66.0), (8.5, 71.0), (0.0, 71.0)]
        fl_y = (-20.0, 36.0)
        rotor_y, rotor_r = 56.0, 70.0
    hub = lathe('hub', [(r, y, I['hub']) for r, y in hp], 48, mats)
    smooth(hub, 40)
    yaxis(hub, (0, 0, 0))
    parts.append(hub)
    # spokes: 24, 2-cross, alternating flanges; bladed section
    NS = 24
    for k in range(NS):
        side = 0 if k % 2 == 0 else 1
        fy = fl_y[side]
        a_rim = TAU * k / NS
        lead = 1 if (k // 2) % 2 == 0 else -1
        a_hub = a_rim + lead * math.radians(60.0) * (1 if side == 0 else -1)
        p0 = Vector((24.0 * math.cos(a_hub), fy, 24.0 * math.sin(a_hub)))
        p1 = Vector((270.0 * math.cos(a_rim), 1.6 if side else -1.6, 270.0 * math.sin(a_rim)))
        sp = sweep_pt('spoke', [tuple(p0), tuple(p1)], lambda t: ell(2.1, 0.9, 6), mats, n0=(0, 1, 0))
        mat_by(sp, lambda c, n, i: I['spoke'])
        parts.append(sp)
        nip = lathe('nipple', [(1.9, 0.0, I['spoke']), (1.9, 8.0, I['spoke']), (1.2, 10.0, I['spoke'])], 8, mats)
        d_ = (p0 - p1).normalized()
        q = Vector((0, 0, 1)).rotation_difference(d_)
        xform(nip, tr(*(p1 - d_ * 1.0)) @ q.to_matrix().to_4x4())
        parts.append(nip)
    # disc rotor (non-drive side): braking ring + 6 curved arms + centre-lock carrier
    ring = ring_prism('rotor_ring', circle(rotor_r, 96), circle(rotor_r - 16.5, 96), rotor_y - 0.9, rotor_y + 0.9, mats)
    mat_by(ring, lambda c, n, i: I['rotor'])
    me = ring.data
    uv = uvlayer(me).data
    for p in me.polygons:
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv[li].uv = (math.hypot(co.x, co.z) / 40.0, math.atan2(co.z, co.x) / TAU * 4)
    parts.append(ring)
    for k in range(6):
        a = TAU * k / 6
        pts = []
        for f in np.linspace(0, 1, 7):
            r = 19.0 + (rotor_r - 16.0 - 19.0) * f
            t = a + 0.35 * f
            pts.append((r * math.cos(t), rotor_y, r * math.sin(t)))
        arm = sweep_pt('rotor_arm', pts, lambda t: ell(1.6, 7.0 - 2.0 * t, 8, 3.0), mats, n0=(0, 1, 0))
        mat_by(arm, lambda c, n, i: I['rotor'])
        parts.append(arm)
    carrier = lathe('rotor_carrier', [(0.0, rotor_y - 3.0, I['hub']), (21.0, rotor_y - 3.0, I['hub']),
                                      (21.0, rotor_y + 2.0, I['hub']), (0.0, rotor_y + 2.0, I['hub'])], 32, mats)
    yaxis(carrier, (0, 0, 0))
    parts.append(carrier)
    # cassette (rear, drive side)
    if not front:
        for k, n_t in enumerate(COGS):
            y = COG_Y0 + k * COG_DY
            pr = pitch_r(n_t)
            outer = toothed(n_t, pr - 2.4, pr + 2.5)
            inner = circle(17.5, len(outer))
            cog = ring_prism('cog', outer, inner, y - 0.9, y + 0.9, mats)
            mat_by(cog, lambda c, n, i: I['steel'])
            parts.append(cog)
        lock = lathe('lockring', [(0.0, COG_Y0 - 3.5, I['alloy']), (16.0, COG_Y0 - 3.5, I['alloy']),
                                  (16.0, COG_Y0 - 0.9, I['alloy']), (0.0, COG_Y0 - 0.9, I['alloy'])], 24, mats)
        yaxis(lock, (0, 0, 0))
        parts.append(lock)
    # valve
    va = math.radians(-90.0 + 7.5)
    valve = lathe('valve', [(0.0, 0.0, I['bolt']), (3.0, 0.0, I['bolt']), (3.0, 34.0, I['bolt']), (2.2, 36.0, I['bolt']),
                            (0.0, 36.0, I['bolt'])], 12, mats)
    q = Vector((0, 0, 1)).rotation_difference(Vector((-math.cos(va), 0, -math.sin(va))))
    xform(valve, tr(270.5 * math.cos(va), 0, 270.5 * math.sin(va)) @ q.to_matrix().to_4x4())
    parts.append(valve)
    # rim decals, both sides
    for side_y, side in ((-14.25, -1), (14.25, 1)):
        for k, ang in enumerate((90.0, 270.0)):
            t_ = text_mesh('t_rim', 'CARBON  45', 13.0, font=FONT_BOLD, spacing=1.2, mats=(M['decal'],))
            wrap_circle(t_, 287.0, math.radians(ang), side_y * 1.06, side=side)
            project_onto(t_, rim, (0, -side, 0), lift=0.08)
            parts.append(t_)
    return parts


# ---------------------------------------------------------------- drivetrain

def build_crank(M):
    """Crankset around the BB centre (built at the origin, axis Y). Returns (crank_parts, pedal_l, pedal_r, pedal pivots)."""
    mats = [M[k] for k in KEYS]
    I = {k: i for i, k in enumerate(KEYS)}
    parts = []
    # chainrings 50/34 (drive side)
    for n_t, y in ((50, CHAIN_Y), (34, CHAIN_Y + 7.6)):
        pr = pitch_r(n_t)
        outer = toothed(n_t, pr - 2.8, pr + 3.0, phase=0.02)
        inner = circle(pr - (14.0 if n_t == 50 else 11.0), len(outer))
        cr = ring_prism('chainring', outer, inner, y - 1.9, y + 1.9, mats)
        mat_by(cr, lambda c, n, i: I['alloy'])
        smooth(cr, 30)
        parts.append(cr)
    # spindle
    sp = lathe('spindle', [(0.0, -57.0, I['alloy']), (12.0, -57.0, I['alloy']), (12.0, 57.0, I['alloy']),
                           (0.0, 57.0, I['alloy'])], 32, mats)
    yaxis(sp, (0, 0, 0))
    parts.append(sp)
    # arms: drive side at CRANK_ANG, left side opposite. Hollow-forged look: rounded section tapering.
    ends = {}
    for side, ang in ((-1, CRANK_ANG), (1, CRANK_ANG + math.pi)):
        d = Vector((math.cos(ang), 0, math.sin(ang)))
        y0, y1 = side * 52.0, side * 66.0
        pts = [Vector((0, y0, 0)) + d * (-6.0), Vector((0, (y0 + y1) / 2, 0)) + d * (CRANK_LEN * 0.5),
               Vector((0, y1, 0)) + d * (CRANK_LEN + 9.0)]
        path = catmull([tuple(p) for p in pts], 8)
        arm = sweep_pt('crank_arm', path, lerp_prof(ell(36.0, 17.0, 20, 2.6), ell(21.0, 14.0, 20, 2.6)), mats, n0=(0, 1, 0))
        mat_by(arm, lambda c, n, i: I['alloy'])
        smooth(arm, 40)
        parts.append(arm)
        eye = d * CRANK_LEN
        boss = lathe('pedal_boss', [(0.0, y1 - side * 7.0, I['alloy']), (11.0, y1 - side * 7.0, I['alloy']),
                                    (11.0, y1 + side * 7.5, I['alloy']), (0.0, y1 + side * 7.5, I['alloy'])], 24, mats)
        yaxis(boss, (eye.x, 0, eye.z))
        smooth(boss, 40)
        parts.append(boss)
        bolt = lathe('crank_bolt', [(0.0, 0.0, I['black']), (10.0, 0.0, I['black']), (10.0, 4.0, I['black']), (0.0, 4.0, I['black'])], 16, mats)
        yaxis(bolt, (0, side * 57.0 - (4.0 if side < 0 else 0.0), 0))
        parts.append(bolt)
        ends[side] = Vector((eye.x, side * 73.5, eye.z))
        if side < 0:
            # 4-arm spider joining the arm to the rings
            for k in range(4):
                a = ang + math.radians(45 + 90 * k)
                q = [(0.0, CHAIN_Y + 3.5, 0.0), (90.0 * math.cos(a) * 0.55, CHAIN_Y + 2.5, 90.0 * math.sin(a) * 0.55),
                     (90.0 * math.cos(a), CHAIN_Y + 2.2, 90.0 * math.sin(a))]
                spd = sweep_pt('spider', catmull(q, 4), lerp_prof(ell(5.0, 22.0, 12, 3.0), ell(5.0, 12.0, 12, 3.0)), mats,
                               n0=(0, 1, 0))
                mat_by(spd, lambda c, n, i: I['alloy'])
                smooth(spd, 40)
                parts.append(spd)
                bl = lathe('ring_bolt', [(0.0, 0.0, I['bolt']), (4.5, 0.0, I['bolt']), (4.5, 2.0, I['bolt']), (0.0, 2.0, I['bolt'])], 12, mats)
                yaxis(bl, (90.0 * math.cos(a) * 0.98, CHAIN_Y - 4.0, 90.0 * math.sin(a) * 0.98))
                parts.append(bl)
    # pedals (Look-style road pedals), pivots on the pedal spindle axis
    pedals = {}
    for side in (-1, 1):
        e = ends[side]
        pp = []
        ax = lathe('pedal_axle', [(0.0, 0.0, I['steel']), (6.5, 0.0, I['steel']), (6.5, 14.0, I['steel']), (0.0, 14.0, I['steel'])], 16, mats)
        xform(ax, tr(e.x, e.y, e.z) @ rot('X', 90 if side < 0 else -90))
        pp.append(ax)
        body = loft('pedal_body', [[(e.x + x, e.y + side * 12.0, e.z + z) for x, z in rrect(70.0, 15.0, 6.0, 4, -2.0, -1.0)],
                                   [(e.x + x, e.y + side * 36.0, e.z + z) for x, z in rrect(84.0, 17.0, 7.0, 4, -6.0, -1.0)],
                                   [(e.x + x, e.y + side * 64.0, e.z + z) for x, z in rrect(66.0, 15.0, 6.0, 4, -10.0, -1.0)]],
                    mats)
        add_bevel(body, 2.0, 2, 30)
        mat_by(body, lambda c, n, i: I['black'])
        smooth(body, 40)
        pp.append(body)
        plate = box('pedal_plate', e.x - 30.0, e.x + 20.0, e.y + side * 18.0, e.y + side * 54.0, e.z + 7.2, e.z + 8.4, mats,
                    bevel=0.6, seg=1)
        mat_by(plate, lambda c, n, i: I['steel'])
        pp.append(plate)
        ped = join(pp, 'pedal_right' if side < 0 else 'pedal_left')
        pedals[side] = ped
    return parts, pedals, ends


def chain_path():
    """Chain centre-line (x, z) in the chain plane: ring top -> cog (wrap rear) -> guide pulley (front) ->
    tension pulley (rear/bottom) -> ring bottom -> ring wrap (front)."""
    rr, rc = pitch_r(50), pitch_r(15)
    rp = pitch_r(11)
    G = Vector((RA.x + 8.0, RA.z - 64.0))
    Tn = Vector((RA.x + 30.0, RA.z - 138.0))
    B2 = Vector((BB.x, BB.z))
    C2 = Vector((RA.x, RA.z))
    pts = []

    def arc(c, r, a0, a1, n):
        for k in range(n + 1):
            a = a0 + (a1 - a0) * k / max(n, 1)
            pts.append(Vector((c.x + r * math.cos(a), c.y + r * math.sin(a))))
    # upper run: tangent between ring top and cog top (approx. common tangent angle)
    dv = B2 - C2
    phi = math.atan2(dv.y, dv.x)
    beta = math.asin((rr - rc) / dv.length)
    up = phi + math.pi / 2 + beta
    pts.append(Vector((B2.x + rr * math.cos(up), B2.y + rr * math.sin(up))))
    arc(C2, rc, up, math.radians(250.0), 14)               # around the back of the cog
    arc(G, rp, math.radians(160.0), math.radians(-30.0), 10)   # front of guide pulley
    arc(Tn, rp, math.radians(175.0), math.radians(275.0), 8)  # rear/bottom of tension pulley
    lo = phi - math.pi / 2 - beta
    arc(B2, rr, lo, up, 40)                                  # bottom -> front -> top of the ring
    return pts


def build_chain(M):
    mats = [M[k] for k in KEYS]
    I = {k: i for i, k in enumerate(KEYS)}
    pts = chain_path()
    # resample at half-link pitch (12.7 mm)
    seg = [(pts[k], pts[k + 1]) for k in range(len(pts) - 1)] + [(pts[-1], pts[0])]
    L = sum((b - a).length for a, b in seg)
    nlinks = int(round(L / 12.7))
    step = L / nlinks
    samples = []
    acc, k, s_ = 0.0, 0, 0.0
    targets = [i * step for i in range(nlinks)]
    cum = [0.0]
    for a, b in seg:
        cum.append(cum[-1] + (b - a).length)

    def at(d):
        for k in range(len(seg)):
            if cum[k + 1] >= d:
                a, b = seg[k]
                t = (d - cum[k]) / max(1e-6, (cum[k + 1] - cum[k]))
                return a.lerp(b, t)
        return seg[-1][1]
    P = [at(d) for d in targets]
    parts = []
    for i in range(nlinks):
        a, b = P[i], P[(i + 1) % nlinks]
        mid = (a + b) / 2
        ang = math.degrees(math.atan2(b.y - a.y, b.x - a.x))
        outer = i % 2 == 0
        for sy in (-1, 1):
            off = (5.6 if outer else 4.4) * sy
            pl = box('link', -8.6, 8.6, -0.45, 0.45, -3.7, 3.7, mats, bevel=1.6, seg=1)
            xform(pl, tr(mid.x, CHAIN_Y + off, mid.y) @ rot('Y', -ang))
            mat_by(pl, lambda c, n, i_: I['chain'])
            parts.append(pl)
        rl = lathe('roller', [(0.0, -4.0, I['chain']), (3.8, -4.0, I['chain']), (3.8, 4.0, I['chain']), (0.0, 4.0, I['chain'])], 8, mats)
        yaxis(rl, (a.x, CHAIN_Y, a.y))
        parts.append(rl)
    return parts


def build_derailleurs(M):
    mats = [M[k] for k in KEYS]
    I = {k: i for i, k in enumerate(KEYS)}
    parts = []
    G = Vector((RA.x + 8.0, CHAIN_Y, RA.z - 64.0))
    Tn = Vector((RA.x + 30.0, CHAIN_Y, RA.z - 138.0))
    rp = pitch_r(11)
    for c_ in (G, Tn):
        po = toothed(11, rp - 2.4, rp + 2.3)
        pul = ring_prism('pulley', po, circle(4.0, len(po)), c_.y - 1.4, c_.y + 1.4, mats)
        xform(pul, tr(c_.x, 0, c_.z))
        mat_by(pul, lambda c, n, i: I['black'])
        parts.append(pul)
        hb = lathe('pulley_hub', [(0.0, -5.5, I['bolt']), (5.0, -5.5, I['bolt']), (5.0, 5.5, I['bolt']), (0.0, 5.5, I['bolt'])], 12, mats)
        yaxis(hb, (c_.x, c_.y, c_.z))
        parts.append(hb)
    # cage plates (outer & inner)
    for yo in (-6.5, 6.5):
        cg = sweep_pt('rd_cage', [(G.x - 6.0, CHAIN_Y + yo, G.z + 14.0), (G.x, CHAIN_Y + yo, G.z),
                                  ((G.x + Tn.x) / 2 + 4.0, CHAIN_Y + yo, (G.z + Tn.z) / 2), (Tn.x, CHAIN_Y + yo, Tn.z),
                                  (Tn.x + 6.0, CHAIN_Y + yo, Tn.z - 14.0)],
                      lambda t: ell(1.6, 26.0 - 4.0 * abs(t - 0.5), 12, 3.0), mats, n0=(0, 1, 0))
        mat_by(cg, lambda c, n, i: I['alloy'])
        smooth(cg, 40)
        parts.append(cg)
    # derailleur body (parallelogram) from the hanger to the cage pivot, outboard of the cassette
    body = sweep_pt('rd_body', catmull([(RA.x + 12.0, -82.0, RA.z - 10.0), (RA.x - 6.0, -78.0, RA.z - 34.0),
                                        (G.x - 4.0, -66.0, G.z + 10.0)], 4),
                    lerp_prof(ell(26.0, 16.0, 16, 2.6), ell(20.0, 20.0, 16, 2.4)), mats, n0=(0, 1, 0))
    mat_by(body, lambda c, n, i: I['alloy'])
    smooth(body, 40)
    parts.append(body)
    piv = lathe('rd_pivot', [(0.0, -70.0, I['alloy']), (10.0, -70.0, I['alloy']), (10.0, -52.0, I['alloy']), (0.0, -52.0, I['alloy'])], 20, mats)
    yaxis(piv, (G.x - 4.0, 0, G.z + 12.0))
    parts.append(piv)
    hanger = box('hanger', -6.0, 22.0, -80.0, -72.0, -22.0, 6.0, mats, bevel=2.0, seg=2)
    xform(hanger, tr(RA.x, 0, RA.z))
    mat_by(hanger, lambda c, n, i: I['black'])
    parts.append(hanger)
    # front derailleur: cage hugging the big ring behind the seat tube, braze-on mount
    rr = pitch_r(50)
    for yo in (-9.5, 3.0):
        arcp = [(BB.x + (rr + 9.0) * math.cos(math.radians(a)), CHAIN_Y + yo, BB.z + (rr + 9.0) * math.sin(math.radians(a)))
                for a in np.linspace(104, 136, 7)]
        cg = sweep_pt('fd_cage', arcp, lambda t: ell(14.0, 1.6, 12, 3.0), mats, n0=(0, 0, 1))
        mat_by(cg, lambda c, n, i: I['alloy'])
        parts.append(cg)
    fdb = BB + S_SEAT * 175.0
    fd = sweep_pt('fd_body', [(fdb.x - 14.0, -30.0, fdb.z - 6.0), (fdb.x - 30.0, -40.0, fdb.z - 30.0)],
                  lambda t: ell(22.0, 16.0, 12, 2.6), mats, n0=(0, 1, 0))
    mat_by(fd, lambda c, n, i: I['alloy'])
    smooth(fd, 40)
    parts.append(fd)
    return parts


# ---------------------------------------------------------------- cockpit + saddle

BAR_C = STEM_C + Vector((math.cos(math.radians(11.0)), 0, math.sin(math.radians(11.0)))) * 100.0


def bar_side(sy):
    """Drop-bar half path relative to the bar centre (x fwd, y lateral, z up), from the clamp outward."""
    pts = [(0, 40, 0), (0.5, 75, 0), (2, 130, 0), (5, 178, -0.5), (16, 199, -2), (40, 206, -6), (64, 209, -18),
           (78, 211, -42), (78, 212, -72), (68, 213, -100), (46, 214, -118), (18, 215, -125), (-12, 215, -122)]
    return [tuple(BAR_C + Vector((x, sy * y, z))) for x, y, z in pts]


def build_bars(M):
    mats = [M[k] for k in KEYS]
    I = {k: i for i, k in enumerate(KEYS)}
    parts = []
    q = Vector((0, 0, 1)).rotation_difference(-D_STEER)
    QM = q.to_matrix().to_4x4()
    # stem: steerer clamp, body, faceplate, top cap
    clampc = lathe('stem_clamp', [(0.0, -20.0, I['carbon']), (17.5, -20.0, I['carbon']), (19.0, -18.0, I['carbon']),
                                  (19.0, 18.0, I['carbon']), (17.5, 20.0, I['carbon']), (0.0, 20.0, I['carbon'])], 32, mats)
    xform(clampc, tr(*STEM_C) @ QM)
    parts.append(clampc)
    topcap = lathe('top_cap', [(0.0, 20.0, I['black']), (16.0, 20.0, I['black']), (16.0, 23.5, I['black']), (0.0, 24.5, I['black'])],
                   24, mats)
    xform(topcap, tr(*STEM_C) @ QM)
    parts.append(topcap)
    stem = sweep_pt('stem', [tuple(STEM_C), tuple(STEM_C.lerp(BAR_C, 0.5)), tuple(BAR_C)],
                    lerp_prof(ell(36.0, 34.0, 20, 2.6), ell(34.0, 36.0, 20, 2.6)), mats, n0=(0, 0, 1))
    face = lathe('stem_face', [(0.0, -25.0, I['carbon']), (19.0, -25.0, I['carbon']), (20.0, -23.0, I['carbon']),
                               (20.0, 23.0, I['carbon']), (19.0, 25.0, I['carbon']), (0.0, 25.0, I['carbon'])], 32, mats)
    yaxis(face, BAR_C)
    for o in (stem, face, clampc):
        mat_by(o, lambda c, n, i: I['carbon'])
        smooth(o, 40)
        uv_box(o, 1 / 20.0)
    parts += [stem, face]
    for sx in (-1, 1):
        for sz in (-1, 1):
            bo = lathe('stem_bolt', [(0.0, 0.0, I['bolt']), (3.2, 0.0, I['bolt']), (3.2, 2.0, I['bolt']), (0.0, 2.0, I['bolt'])], 10, mats)
            xform(bo, tr(*(BAR_C + Vector((19.5, sx * 14.0, sz * 12.0)))) @ rot('Y', 90))
            parts.append(bo)
    # handlebar: carbon centre + taped hoods/drops
    cpath = [tuple(BAR_C + Vector((0, y, 0))) for y in np.linspace(-75, 75, 13)]

    def cprof(t):
        r = 15.9 if abs(t - 0.5) < 0.27 else 15.9 - (abs(t - 0.5) - 0.27) / 0.23 * 3.9
        return ell(2 * r, 2 * r, 20)
    centre = sweep_pt('bar_centre', cpath, cprof, mats, n0=(0, 0, 1))
    mat_by(centre, lambda c, n, i: I['carbon'])
    smooth(centre, 50)
    uv_box(centre, 1 / 20.0)
    parts.append(centre)
    for sy in (-1, 1):
        path = catmull(bar_side(sy), 4)
        taped = sweep_pt('bar_tape', path, lambda t: ell(27.0, 27.0, 20), mats, n0=(1, 0, 0))
        me = taped.data
        uv = uvlayer(me).data
        nring = 20
        for p in me.polygons:
            for li in p.loop_indices:
                vi = me.loops[li].vertex_index
                uv[li].uv = ((vi % nring) / nring, (vi // nring) * 0.12)
        mat_by(taped, lambda c, n, i: I['tape'])
        smooth(taped, 50)
        parts.append(taped)
        plug = lathe('bar_plug', [(0.0, 0.0, I['black']), (13.8, 0.0, I['black']), (13.8, 3.0, I['black']), (0.0, 4.0, I['black'])], 20, mats)
        endp = Vector(path[-1])
        dirp = (Vector(path[-1]) - Vector(path[-2])).normalized()
        xform(plug, tr(*endp) @ Vector((0, 0, 1)).rotation_difference(dirp).to_matrix().to_4x4())
        parts.append(plug)
        # hood (shifter body) on top of the bend, and the brake/shift lever blade
        hood = sweep_pt('hood', catmull([tuple(BAR_C + Vector((62.0, sy * 210.0, -22.0))),
                                         tuple(BAR_C + Vector((90.0, sy * 211.0, -12.0))),
                                         tuple(BAR_C + Vector((118.0, sy * 212.0, 4.0)))], 5),
                        lerp_prof(ell(40.0, 30.0, 18, 2.4), ell(30.0, 24.0, 18, 2.4)), mats, n0=(0, 0, 1))
        mat_by(hood, lambda c, n, i: I['hood'])
        smooth(hood, 40)
        parts.append(hood)
        horn = sweep_pt('hood_horn', catmull([tuple(BAR_C + Vector((112.0, sy * 212.0, 1.0))),
                                              tuple(BAR_C + Vector((122.0, sy * 212.0, 9.0))),
                                              tuple(BAR_C + Vector((128.0, sy * 212.0, 16.0)))], 4),
                        lerp_prof(ell(26.0, 22.0, 16, 2.4), ell(9.0, 12.0, 16, 2.2)), mats, n0=(0, 0, 1))
        mat_by(horn, lambda c, n, i: I['hood'])
        smooth(horn, 50)
        parts.append(horn)
        lever = sweep_pt('lever', catmull([tuple(BAR_C + Vector((120.0, sy * 212.0, -6.0))),
                                           tuple(BAR_C + Vector((118.0, sy * 213.0, -50.0))),
                                           tuple(BAR_C + Vector((106.0, sy * 214.0, -100.0))),
                                           tuple(BAR_C + Vector((88.0, sy * 215.0, -138.0)))], 5),
                         lerp_prof(ell(20.0, 13.0, 14, 2.6), ell(12.0, 10.0, 14, 2.6)), mats, n0=(1, 0, 0))
        mat_by(lever, lambda c, n, i: I['alloy'])
        smooth(lever, 40)
        parts.append(lever)
    return parts


def build_saddle(M):
    mats = [M[k] for k in KEYS]
    I = {k: i for i, k in enumerate(KEYS)}
    parts = []
    top = BB + S_SEAT * POST_LEN
    c0 = top + Vector((-12.0, 0.0, 40.0))
    W = [(-148, 92), (-142, 128), (-128, 140), (-100, 140), (-60, 128), (-25, 98), (10, 66), (45, 48), (80, 40),
         (108, 34), (124, 22), (130, 8)]
    secs = []
    for x, w in W:
        ztop = 3.0 * (x / 130.0) ** 2 - 2.5 + (1.5 if x > 90 else 0.0)
        hh = 8.0 if x > -140 else 6.0
        sec = []
        for k in range(20):
            t = TAU * k / 20
            cy, sz = math.cos(t), math.sin(t)
            y = (w / 2) * math.copysign(abs(cy) ** (2 / 2.4), cy)
            z = hh * math.copysign(abs(sz) ** (2 / (3.0 if sz > 0 else 2.0)), sz)
            sec.append(tuple(c0 + Vector((x, y, ztop + z - hh))))
        secs.append(sec)
    sad = loft('saddle', secs, mats)
    mat_by(sad, lambda c, n, i: I['saddle'])
    smooth(sad, 45)
    uv_box(sad, 1 / 30.0)
    parts.append(sad)
    for sy in (-1, 1):
        rp = catmull([(c0.x + 96.0, sy * 10.0, c0.z - 12.0), (c0.x + 50.0, sy * 20.0, c0.z - 30.0),
                      (c0.x - 40.0, sy * 22.0, c0.z - 31.0), (c0.x - 108.0, sy * 36.0, c0.z - 14.0)], 6)
        rail = sweep_pt('rail', rp, lambda t: ell(7.0, 7.0, 10), mats, n0=(0, 0, 1))
        mat_by(rail, lambda c, n, i: I['steel'])
        smooth(rail, 50)
        parts.append(rail)
    head = box('post_head', -26.0, 26.0, -27.0, 27.0, -6.0, 9.0, mats, bevel=3.0, seg=2)
    xform(head, tr(*(c0 + Vector((-8.0, 0.0, -38.0)))))
    mat_by(head, lambda c, n, i: I['alloy'])
    smooth(head, 40)
    parts.append(head)
    return parts


# ---------------------------------------------------------------- build / export

def build():
    reset()
    M = materials()
    frame_parts = build_frame(M) + build_chain(M) + build_derailleurs(M) + build_saddle(M)
    wf = build_wheel(M, True)
    wr = build_wheel(M, False)
    for p in wf:
        xform(p, tr(*FA))
    for p in wr:
        xform(p, tr(*RA))
    cparts, pedals, ends = build_crank(M)
    for p in cparts + list(pedals.values()):
        xform(p, tr(*BB))
    bars = build_bars(M)
    objs = []
    for nm, ps in (('frame', frame_parts), ('wheel_front', wf), ('wheel_rear', wr), ('crank', cparts), ('bars', bars)):
        o = join(ps, nm)
        bm = bmesh.new(); bm.from_mesh(o.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
        bm.to_mesh(o.data); bm.free()
        objs.append(o)
    pr, pl = pedals[-1], pedals[1]
    objs += [pr, pl]
    piv = {'frame': tuple(BB), 'wheel_front': tuple(FA), 'wheel_rear': tuple(RA), 'crank': tuple(BB),
           'bars': tuple(STEM_C), 'pedal_right': tuple(BB + ends[-1]), 'pedal_left': tuple(BB + ends[1])}
    global off
    root, off, size = finalize(objs, root_name='bike', pivots=piv)
    steer = -D_STEER
    extras = {
        'wheel_front': {'spin_axis': [0, 0, 1], 'forward_sign': -1, 'radius_m': R_WHEEL / 1000.0},
        'wheel_rear': {'spin_axis': [0, 0, 1], 'forward_sign': -1, 'radius_m': R_WHEEL / 1000.0},
        'crank': {'spin_axis': [0, 0, 1], 'forward_sign': -1, 'crank_length_m': CRANK_LEN / 1000.0},
        'pedal_right': {'spin_axis': [0, 0, 1], 'note': 'counter-rotate to keep level'},
        'pedal_left': {'spin_axis': [0, 0, 1], 'note': 'counter-rotate to keep level'},
        'bars': {'steer_axis': [round(steer.x, 4), round(steer.z, 4), round(-steer.y, 4)]},
    }
    exp = handles(root, objs, extras=extras)
    # pedals ride on the crank: nest their handles under the crank handle
    hmap = {o.name: o for o in exp}
    for nm in ('pedal_right', 'pedal_left'):
        parent(hmap[nm], hmap['crank'])
    print('SIZE m', tuple(round(v, 4) for v in size), 'TRIS', stats(objs), {o.name: stats([o]) for o in objs})
    return exp, size


if __name__ == '__main__':
    exp, size = build()
    if '--export' in ARGS:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE_, 'bike.blend'))
        export_glb(os.path.join(SCRATCH, 'raw', 'bike.glb'), exp)
    if '--render' in ARGS:
        studio(size=12, scale=3.0)
        c = Vector((0, 0, size.z / 2))
        rad = size.length / 2
        render_views('bike', c, rad, [
            ('side', (0.0, -1, 0.05), 45, None),
            ('hero', (0.7, -1, 0.35), 45, None),
            ('rear34', (-0.8, 1, 0.4), 45, None),
            ('top', (0.0, -0.08, 1), 45, None),
        ], res=(1000, 680), samples=24)
        bbw = (BB + off) * 0.001
        render_views('bike', bbw + Vector((-0.17, 0, 0.05)), 0.24, [('drive', (0.15, -1, 0.2), 50, None)], res=(1000, 680), samples=24)
        cw = (STEM_C + off) * 0.001
        render_views('bike', cw + Vector((0.05, 0, -0.05)), 0.24, [('cockpit', (0.8, -1, 0.5), 50, None)], res=(1000, 680), samples=24)
