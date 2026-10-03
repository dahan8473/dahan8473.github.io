# Classical (nylon string) guitar, generic until David sends photos.
# Standing upright on its tail end: Z up along the guitar, soundboard faces -Y, bass strings on -X.
# 650 mm scale, 12 frets to the body, 19 frets, 52 mm nut, slotted headstock with 6 rollers, tie-block bridge.
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

SCALE = 650.0
Z_JOINT = 485.0                  # body/neck joint (12th fret)
Z_NUT = Z_JOINT + SCALE / 2      # 810
Z_SADDLE = Z_NUT - SCALE         # 160
Z_HOLE = 330.0                   # soundhole centre
HOLE_R = 42.5
FB_END = 374.0                   # fingerboard end (just above the soundhole)
FB_T = 6.0                       # fingerboard thickness (front at y = -FB_T)
N_FRETS = 19
NUT_SPAN, SADDLE_SPAN = 43.0, 58.0
Y_NUT_STR, Y_SADDLE_STR = -FB_T - 1.6, -13.6   # string bottom heights at nut / saddle
HEAD_ANGLE = 12.0
STRINGS = [  # name, note, Hz, diameter mm, wound
    ('string_0', 'E2', 82.41, 1.07, True), ('string_1', 'A2', 110.00, 0.89, True),
    ('string_2', 'D3', 146.83, 0.74, True), ('string_3', 'G3', 196.00, 1.02, False),
    ('string_4', 'B3', 246.94, 0.83, False), ('string_5', 'E4', 329.63, 0.71, False)]


def fret_z(n):
    return Z_NUT - SCALE * (1 - 2 ** (-n / 12.0))


def fb_halfwidth(z):
    return 26.0 + (32.0 - 26.0) * (Z_NUT - z) / (Z_NUT - FB_END)


# ---------------------------------------------------------------- textures

def tex_wood(name, c0, c1, lines, warp=0.03, sharp=3.0, size=1024, seed=1, fleck=0.0):
    p = os.path.join(TEX, name + '.png')
    if os.path.exists(p):
        return load_img(p)
    c = (np.arange(size) + 0.5) / size
    U, V = np.meshgrid(c, c)
    n1 = blur_noise(size, 140, seed) * warp
    n2 = blur_noise(size, 6, seed + 1) * warp * 0.15
    ph = (U + n1 + n2) * lines
    g = (0.5 + 0.5 * np.sin(TAU * ph)) ** sharp
    var = blur_noise(size, 90, seed + 2) * 0.06 + blur_noise(size, 2, seed + 3) * 0.02
    col = np.array(c0)[None, None, :] * (1 - g[..., None]) + np.array(c1)[None, None, :] * g[..., None]
    col *= (1 + var)[..., None]
    if fleck:
        f = (blur_noise(size, 1.5, seed + 4) > 2.6).astype(float) * fleck
        col *= (1 - f)[..., None]
    return save_img(name, np.clip(col, 0, 1), 'sRGB')


def tex_rosette(name='rosette', w=1024, h=128):
    p = os.path.join(TEX, name + '.png')
    if os.path.exists(p):
        return load_img(p)
    v = (np.arange(h) + 0.5) / h
    u = (np.arange(w) + 0.5) / w
    U, Vv = np.meshgrid(u, v)
    col = np.zeros((h, w, 3))
    cream = np.array([0.80, 0.70, 0.52])
    black = np.array([0.03, 0.025, 0.02])
    red = np.array([0.45, 0.08, 0.05])
    green = np.array([0.10, 0.28, 0.16])
    tan = np.array([0.55, 0.38, 0.20])
    col[:] = cream
    bands = [(0.00, 0.06, black), (0.06, 0.10, cream), (0.10, 0.14, black), (0.14, 0.17, red),
             (0.83, 0.86, red), (0.86, 0.90, black), (0.90, 0.94, cream), (0.94, 1.00, black)]
    for a, b, cc in bands:
        m = (Vv >= a) & (Vv < b)
        col[m] = cc
    # mosaic band: repeating diamonds of red/green on tan with black outlines (8 tiles across the texture)
    m = (Vv >= 0.17) & (Vv < 0.83)
    tu = (U * 8) % 1.0
    tv = (Vv - 0.17) / 0.66
    d = np.abs(tu - 0.5) + np.abs(tv - 0.5)
    mos = np.where(d[..., None] < 0.22, red, np.where(d[..., None] < 0.30, black, np.where(d[..., None] < 0.42, green, tan)))
    chk = ((np.floor(U * 64) + np.floor(Vv * 24)) % 2)[..., None]
    mos = mos * (0.92 + 0.08 * chk)
    col[m] = mos[m]
    return save_img(name, col, 'sRGB')


def materials():
    M = {}
    spruce = tex_wood('wood_spruce2', (0.78, 0.58, 0.32), (0.62, 0.42, 0.20), lines=150, warp=0.0025, sharp=5.0, seed=3)
    rose = tex_wood('wood_rosewood3', (0.13, 0.055, 0.028), (0.045, 0.018, 0.01), lines=46, warp=0.0035, sharp=1.6, seed=7)
    maho = tex_wood('wood_mahogany3', (0.34, 0.14, 0.062), (0.25, 0.095, 0.042), lines=90, warp=0.002, sharp=2.0, seed=9)
    ebony = tex_wood('wood_ebony2', (0.035, 0.026, 0.02), (0.018, 0.013, 0.01), lines=60, warp=0.008, sharp=2.0, seed=13)
    M['top'] = mat('guitar_top', (1, 1, 1), 0.0, 0.32, base_tex=spruce, coat=1.0, coat_rough=0.06)
    M['back'] = mat('guitar_back_sides', (1, 1, 1), 0.0, 0.3, base_tex=rose, coat=1.0, coat_rough=0.06)
    M['neck'] = mat('guitar_neck', (1, 1, 1), 0.0, 0.4, base_tex=maho, coat=0.6, coat_rough=0.12)
    M['board'] = mat('guitar_fretboard', (1, 1, 1), 0.0, 0.5, base_tex=ebony)
    M['bridge'] = mat('guitar_bridge', (1, 1, 1), 0.0, 0.4, base_tex=rose)
    M['binding'] = mat('guitar_binding', (0.62, 0.42, 0.22), 0.0, 0.3, coat=1.0, coat_rough=0.06)
    M['rosette'] = mat('guitar_rosette', (1, 1, 1), 0.0, 0.3, base_tex=tex_rosette(), coat=1.0, coat_rough=0.06)
    M['interior'] = mat('guitar_interior', (0.035, 0.02, 0.012), 0.0, 0.9)
    M['bone'] = mat('guitar_bone', (0.86, 0.83, 0.74), 0.0, 0.35)
    M['fret'] = mat('guitar_fret', (0.78, 0.78, 0.75), 1.0, 0.22)
    M['brass'] = mat('guitar_tuner_metal', (0.86, 0.68, 0.38), 1.0, 0.28)
    M['button'] = mat('guitar_tuner_button', (0.82, 0.76, 0.64), 0.0, 0.28)
    M['roller'] = mat('guitar_roller', (0.88, 0.87, 0.83), 0.0, 0.3)
    M['nylon'] = mat('guitar_string_nylon', (0.80, 0.78, 0.70), 0.0, 0.18)
    M['wound'] = mat('guitar_string_wound', (0.82, 0.82, 0.84), 1.0, 0.32)
    return M


# ---------------------------------------------------------------- geometry

def body_outline():
    R = [(0, 0), (60, 3.5), (110, 14), (150, 35), (174, 68), (182, 110), (178, 150), (164, 192), (140, 235),
         (122, 268), (118, 290), (124, 318), (136, 350), (141, 385), (137, 418), (121, 448), (90, 472), (48, 484),
         (0, 487)]
    loop = R + [(-x, z) for x, z in reversed(R[1:-1])]
    return catmull(loop, 3, closed=True)


def depth(z):
    return 95.0 - 5.0 * z / 487.0


def build_body(M, mats, I):
    parts = []
    out = body_outline()
    body = loft('body', [[(x, 0.0, z) for x, z in out], [(x, depth(z), z) for x, z in out]], mats)
    add_bevel(body, 2.2, 3, 40)
    cut = lathe('hole_cut', [(HOLE_R, -5.0), (HOLE_R, 45.0)], 96, mats, cap0=True, cap1=True)
    xform(cut, tr(0, 0, Z_HOLE) @ rot('X', -90))
    boolean(body, cut)

    def bm_(c, n, i):
        if (c.x ** 2 + (c.z - Z_HOLE) ** 2) < (HOLE_R + 0.6) ** 2 and c.y > 0.2:
            return I['interior']
        if n.y < -0.95:
            return I['top']
        if n.y > 0.95:
            return I['back']
        if c.y < 3.2:
            return I['binding']
        return I['back']
    mat_by(body, bm_)
    uv_box(body, 1 / 400.0)
    uv_planar(body, '-Y', 1 / 380.0, (0, 245), only=lambda p: p.normal.y < -0.95)
    smooth(body, 35)
    parts.append(body)
    # rosette (annulus decal)
    ros = lathe('rosette', [(HOLE_R + 1.5, 0.0, I['rosette']), (HOLE_R + 13.5, 0.0, I['rosette'])], 192, mats)
    me = ros.data
    uv = me.uv_layers.active.data
    for p in me.polygons:
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            a = math.atan2(co.y, co.x) / TAU % 1.0
            rr = math.hypot(co.x, co.y)
            uv[li].uv = (a * 3.0, (rr - HOLE_R - 1.5) / 12.0)
    # fix wrap seam: faces spanning u 0..1 boundary
    for p in me.polygons:
        us = [uv[li].uv[0] for li in p.loop_indices]
        if max(us) - min(us) > 1.0:
            for li in p.loop_indices:
                if uv[li].uv[0] < 1.5:
                    uv[li].uv = (uv[li].uv[0] + 3.0, uv[li].uv[1])
    xform(ros, tr(0, -0.05, Z_HOLE) @ rot('X', 90))
    me.update()
    if me.polygons[0].normal.y > 0:
        for p in me.polygons:
            p.flip()
    parts.append(ros)
    return parts


def build_bridge(M, mats, I):
    parts = []
    main = slab_xz('bridge_main', rrect(92.0, 26.0, 2.0, 3, 0, 157.0), 0.0, -8.6, mats)
    add_bevel(main, 1.2, 3, 30)
    parts.append(main)
    tie = slab_xz('bridge_tie', rrect(84.0, 11.0, 1.5, 3, 0, 146.5), 0.0, -10.2, mats)
    add_bevel(tie, 1.2, 3, 30)
    parts.append(tie)
    for sx in (1, -1):
        wing = loft('bridge_wing', [[(sx * 45.0, y, z) for z, y in rrect(22.0, 7.6, 1.5, 3, 157.0, -3.9)],
                                    [(sx * 70.0, y, z) for z, y in rrect(19.0, 5.6, 1.5, 3, 157.0, -2.9)],
                                    [(sx * 92.0, y, z) for z, y in rrect(15.0, 3.4, 1.4, 3, 157.0, -1.8)]], mats)
        add_bevel(wing, 0.8, 2, 30)
        parts.append(wing)
    for p in parts:
        mat_by(p, lambda c, n, i: I['bridge'])
        uv_box(p, 1 / 120.0)
        smooth(p, 35)
    inlay = box('tie_inlay', -36.0, 36.0, -10.27, -10.2, 142.5, 150.5, mats)
    me = inlay.data
    me.uv_layers.new(name='UVMap')
    uv = me.uv_layers.active.data
    for p in me.polygons:
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv[li].uv = ((co.x + 36.0) / 72.0 * 1.0, (co.z - 142.5) / 8.0)
    mat_by(inlay, lambda c, n, i: I['rosette'])
    parts.append(inlay)
    return parts


def build_neck(M, mats, I):
    parts = []

    def dsec(z, w, d, p=1.0, n=16):
        pts = []
        for k in range(n + 1):
            t = math.pi * k / n
            c = math.cos(t)
            pts.append(((w / 2) * math.copysign(abs(c) ** p, c), d * math.sin(t), z))
        return pts

    def neck_depth(z):
        base = 21.0 + 2.0 * (Z_NUT - min(z, Z_NUT)) / (Z_NUT - Z_JOINT)
        if z > Z_NUT:
            base = 21.0 - (z - Z_NUT) * 0.12
        # Spanish heel: grows toward the body below ~565 mm
        if z < 566.0:
            u = (566.0 - z) / (566.0 - 489.0)
            base += (85.5 - 23.0) * u ** 2.2
        return base
    zs = [489.0, 491.0, 494.0, 498.0, 503.0, 509.0, 516.0, 524.0, 533.0, 543.0, 554.0, 566.0, 580.0]
    zs += [580.0 + k * (Z_NUT + 12.0 - 580.0) / 12 for k in range(1, 13)]
    secs = []
    for z in zs:
        w = 2 * min(fb_halfwidth(max(z, FB_END)), 31.0)
        d = neck_depth(z)
        p = 1.0 + max(0.0, d - 23.0) / 22.0
        secs.append(dsec(z, w, d, p))
    neck = loft('neck', secs, mats)
    smooth(neck, 40)
    parts.append(neck)
    for p in parts:
        mat_by(p, lambda c, n, i: I['neck'])
        uv_box(p, 1 / 300.0)
    # fingerboard
    fb = slab_xz('fretboard', [(-26.0, Z_NUT), (-32.0, FB_END), (32.0, FB_END), (26.0, Z_NUT)], 0.0, -FB_T, mats)
    add_bevel(fb, 0.6, 2, 30)
    mat_by(fb, lambda c, n, i: I['board'])
    uv_box(fb, 1 / 300.0)
    smooth(fb, 35)
    return parts, fb


def headstock_matrix():
    a = math.radians(HEAD_ANGLE)
    L = Vector((0, math.sin(a), math.cos(a)))
    Tn = Vector((0, math.cos(a), -math.sin(a)))
    o = Vector((0, -1.0, Z_NUT + 4.0))
    return Matrix(((1, L.x, Tn.x, o.x), (0, L.y, Tn.y, o.y), (0, L.z, Tn.z, o.z), (0, 0, 0, 1)))


ROLL_S = (52.0, 86.0, 120.0)


def build_head(M, mats, I):
    parts = []
    HM = headstock_matrix()
    right = [(27.0, 0.0), (33.0, 12.0), (37.5, 30.0), (37.5, 168.0), (35.5, 177.0), (28.0, 184.0), (16.0, 187.0),
             (6.0, 184.0), (0.0, 180.0)]
    outline = right + [(-x, s) for x, s in reversed(right[:-1])]
    head = prism('head', outline, 0.0, 19.0, mats)
    add_bevel(head, 1.4, 2, 40)
    for sx in (1, -1):
        sl = prism('slot', rrect(16.0, 112.0, 7.9, 6, sx * 17.0, 86.0), -5.0, 25.0, mats)
        boolean(head, sl)
    xform(head, HM)
    face_n = HM.to_3x3() @ Vector((0, 0, -1))
    mat_by(head, lambda c, n, i: I['back'] if n.dot(face_n) > 0.95 else I['neck'])
    uv_box(head, 1 / 300.0)
    smooth(head, 35)
    parts.append(head)
    for sx in (1, -1):
        plate = box('tuner_plate', 37.5 if sx > 0 else -39.2, 39.2 if sx > 0 else -37.5, 34.0, 138.0, 2.5, 16.5, mats,
                    bevel=0.5, seg=1)
        xform(plate, HM)
        mat_by(plate, lambda c, n, i: I['brass'])
        parts.append(plate)
        for s in ROLL_S:
            rl = lathe('roller', [(5.0, 0.0, I['roller']), (5.0, 21.0, I['roller'])], 24, mats, cap0=True, cap1=True)
            xform(rl, HM @ tr(-27.5 if sx < 0 else 6.5, s, 9.5) @ rot('Y', 90))
            smooth(rl, 40)
            parts.append(rl)
            gear = lathe('gear', [(6.8, 0.0, I['brass']), (6.8, 3.0, I['brass'])], 24, mats, cap0=True, cap1=True)
            xform(gear, HM @ tr(sx * 39.0 - (3.0 if sx < 0 else 0.0), s, 9.5) @ rot('Y', 90))
            parts.append(gear)
            shaft = lathe('shaft', [(1.8, 0.0, I['brass']), (1.8, 30.0, I['brass'])], 16, mats, cap0=True, cap1=True)
            xform(shaft, HM @ tr(sx * 43.5, s + 8.0, 4.0))
            parts.append(shaft)
            prof = [(9.0 * math.sin(t), 7.5 * -math.cos(t), I['button']) for t in [math.pi * k / 10 for k in range(11)]]
            prof[0] = (0.0, prof[0][1], I['button'])
            prof[-1] = (0.0, prof[-1][1], I['button'])
            btn = lathe('button', prof, 24, mats)
            xform(btn, HM @ tr(sx * 43.5, s + 8.0, 39.0) @ sc(0.42, 1.0, 1.0))
            smooth(btn, 60)
            parts.append(btn)
    return parts


def string_points(i):
    r = STRINGS[i][3] / 2
    xn = -NUT_SPAN / 2 + i * NUT_SPAN / 5
    xs = -SADDLE_SPAN / 2 + i * SADDLE_SPAN / 5
    nut = Vector((xn, Y_NUT_STR - r, Z_NUT))
    sad = Vector((xs, Y_SADDLE_STR - r, Z_SADDLE))
    return nut, sad, r


def tube(name, pts, r, mats, sides=8, up=(0, 1, 0)):
    prof = lambda t: [(r * math.cos(TAU * k / sides), r * math.sin(TAU * k / sides)) for k in range(sides)]
    return sweep(name, pts, prof, mats, up=up)


def build_strings(M, mats, I):
    strings = []
    ends = []
    HM = headstock_matrix()
    for i, (nm, note, hz, dia, wound) in enumerate(STRINGS):
        nut, sad, r = string_points(i)
        seg = 96
        pts = [tuple(sad.lerp(nut, k / seg)) for k in range(seg + 1)]
        st = tube(nm, pts, r, [M['wound'] if wound else M['nylon']], sides=8)
        smooth(st, 80)
        strings.append(st)
        key = 'wound' if wound else 'nylon'
        # behind the saddle: over the tie block and into its hole
        xs = sad.x
        tb = [tuple(sad), (xs, -10.3 - r, 150.5), (xs * 0.97, -10.3 - r, 143.0), (xs * 0.97, -6.0, 141.0)]
        e1 = tube(nm + '_tail', tb, r, mats, sides=6)
        mat_by(e1, lambda c, n, j, k=key: I[k])
        ends.append(e1)
        # beyond the nut: down to the roller (bass side -X: rollers k=2,1,0 for strings 0,1,2)
        side = -1 if i < 3 else 1
        k = (2 - i) if i < 3 else (i - 3)
        s = ROLL_S[k]
        land = HM @ Vector((side * (11.0 + 4.0 * (2 - k)), s, 9.5 - 5.0 - r))
        e2 = tube(nm + '_head', [tuple(nut), tuple(nut + Vector((0, 0, 4.0))), tuple(land)], r, mats, sides=6)
        mat_by(e2, lambda c, n, j, k=key: I[k])
        ends.append(e2)
        wrap = lathe(nm + '_wrap', [(5.0 + 2 * r, -1.5, I[key]), (5.0 + 2 * r, 1.5, I[key])], 20, mats)
        xform(wrap, HM @ tr(side * (11.0 + 4.0 * (2 - k)), s, 9.5) @ rot('Y', 90))
        ends.append(wrap)
    return strings, ends


def build_frets(M, mats, I):
    frets = []
    for n in range(1, N_FRETS + 1):
        z = fret_z(n)
        hw = fb_halfwidth(z) - 0.3
        prof = lambda t: [(1.15 * math.sin(math.pi * k / 8), 1.2 * math.cos(math.pi * k / 8)) for k in range(9)]
        f = sweep('fret_%d' % n, [(-hw, -FB_T + 0.05, z), (hw, -FB_T + 0.05, z)], prof, [M['fret']])
        smooth(f, 50)
        frets.append(f)
    return frets


def build():
    reset()
    M = materials()
    keys = list(M.keys())
    mats = [M[k] for k in keys]
    I = {k: i for i, k in enumerate(keys)}
    static = []
    static += build_body(M, mats, I)
    static += build_bridge(M, mats, I)
    neck_parts, fb = build_neck(M, mats, I)
    static += neck_parts
    static += build_head(M, mats, I)
    strings, ends = build_strings(M, mats, I)
    static += ends
    frets = build_frets(M, mats, I)
    nut = box('nut', -26.0, 26.0, 0.0, -(FB_T + 2.3), Z_NUT, Z_NUT + 5.0, mats, bevel=0.9, seg=3)
    mat_by(nut, lambda c, n, i: I['bone'])
    smooth(nut, 40)
    sad = box('saddle', -39.0, 39.0, -6.0, Y_SADDLE_STR, Z_SADDLE - 1.6, Z_SADDLE + 1.6, mats, bevel=1.2, seg=4)
    mat_by(sad, lambda c, n, i: I['bone'])
    smooth(sad, 40)
    gbody = join(static, 'guitar_body')
    bm = bmesh.new(); bm.from_mesh(gbody.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bm.to_mesh(gbody.data); bm.free()
    objs = [gbody, fb, nut, sad] + frets + strings
    piv = {}
    extras = {}
    for i, st in enumerate(strings):
        n_, s_, r = string_points(i)
        piv[st.name] = tuple((n_ + s_) / 2)
    for n, f in enumerate(frets, 1):
        piv[f.name] = (0.0, -FB_T, fret_z(n))
    piv['nut'] = (0.0, -FB_T, Z_NUT)
    piv['saddle'] = (0.0, Y_SADDLE_STR, Z_SADDLE)
    root, off, size = finalize(objs, root_name='guitar', pivots=piv)

    def gl(p):  # mm (pre-finalize) -> glTF metres (Y up)
        q = (Vector(p) + off) * 0.001
        return [round(q.x, 5), round(q.z, 5), round(-q.y, 5)]
    for i, (nm, note, hz, dia, wound) in enumerate(STRINGS):
        n_, s_, r = string_points(i)
        extras[nm] = {'note': note, 'freq_hz': hz, 'gauge_mm': dia, 'wound': wound, 'scale_m': SCALE / 1000.0,
                      'nut': gl(n_), 'saddle': gl(s_)}
    for n in range(1, N_FRETS + 1):
        d = SCALE * (1 - 2 ** (-n / 12.0))
        extras['fret_%d' % n] = {'fret': n, 'from_nut_m': round(d / 1000.0, 5)}
    direct = {o.name for o in [fb, nut, sad] + frets + strings}
    exp = handles(root, objs, extras=extras, direct=direct)
    print('SIZE m', tuple(round(v, 4) for v in size), 'TRIS', stats(objs), 'body', stats([gbody]),
          'strings', stats(strings), 'frets', stats(frets))
    return exp, size


if __name__ == '__main__':
    exp, size = build()
    if '--export' in ARGS:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE_, 'guitar.blend'))
        export_glb(os.path.join(SCRATCH, 'raw', 'guitar.glb'), exp)
    if '--render' in ARGS:
        studio(size=6)
        c = Vector((0, 0, size.z / 2))
        rad = size.length / 2
        render_views('guitar', c, rad, [
            ('front', (0.25, -1, 0.15), 50, None),
            ('back', (-0.3, 1, 0.2), 50, None),
        ], res=(700, 900), samples=24)
        # close-ups
        render_views('guitar', Vector((0, 0, 0.17)), 0.13, [('bridge', (0.3, -1, 0.5), 60, None)], res=(900, 680), samples=24)
        render_views('guitar', Vector((0, 0.02, 0.9)), 0.12, [('head', (0.6, -1, 0.3), 60, None)], res=(900, 680), samples=24)
        render_views('guitar', Vector((0, 0.04, 0.5)), 0.1, [('heel', (-0.8, 1, 0.1), 60, None)], res=(900, 680), samples=16)
