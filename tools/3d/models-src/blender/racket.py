# Badminton racket, Yonex-style isometric head, T-joint, shaft, wrapped grip. Generic (David to send photos).
# Standing on the butt cap: Z up, string bed in the XZ plane facing -Y. 675 mm long, head 200 x 255 mm.
# The frame colour is its own material (racket_frame) so colour variants are a single material swap.
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

L_TOTAL = 675.0
A_OUT, B_OUT = 100.0, 127.5        # head outer half-width / half-length
PW, PD = 7.6, 10.0                 # frame profile: in-plane width, depth
ZC = L_TOTAL - B_OUT               # head centre height
A_C, B_C = A_OUT - PW / 2, B_OUT - PW / 2
E = 2.55                           # isometric squareness
N_MAINS, N_CROSS = 22, 22
FRAME_COLOR = (0.02, 0.09, 0.36)   # default variant: deep blue


def head_xy(t, a=A_C, b=B_C):
    """Isometric head centre-line point for parameter t (0 = +X, pi/2 = top).
    Squarer top half (broad shoulders), lower half narrowing into the throat."""
    c, s = math.cos(t), math.sin(t)
    e = E + 0.35 if s > 0 else E - 0.35
    x = a * math.copysign(abs(c) ** (2 / e), c)
    z = b * math.copysign(abs(s) ** (2 / e), s)
    if z < 0:
        k = (-z / b)
        x *= 1.0 - 0.17 * k ** 2.0
    return x, ZC + z


def head_loop(n=160, a=A_C, b=B_C):
    return [head_xy(TAU * i / n, a, b) for i in range(n)]


def materials():
    grip_n = tex_grip()
    M = {}
    M['frame'] = mat('racket_frame', FRAME_COLOR, 0.35, 0.28, coat=1.0, coat_rough=0.05)
    M['shaft'] = mat('racket_shaft', (0.03, 0.03, 0.035), 0.3, 0.3, coat=1.0, coat_rough=0.05)
    M['black'] = mat('racket_black', (0.02, 0.02, 0.022), 0.0, 0.45)
    M['bumper'] = mat('racket_bumper', (0.015, 0.015, 0.016), 0.0, 0.6)
    M['grommet'] = mat('racket_grommet', (0.02, 0.02, 0.02), 0.0, 0.5)
    M['strings'] = mat('racket_strings', (0.86, 0.86, 0.84), 0.0, 0.35)
    M['grip'] = mat('racket_grip', (0.03, 0.03, 0.032), 0.0, 0.7, normal=grip_n, nstr=1.0)
    M['cap'] = mat('racket_cap', (0.025, 0.025, 0.028), 0.0, 0.35)
    M['print'] = mat('racket_print', (0.85, 0.85, 0.85), 0.0, 0.45)
    return M


def tex_grip(name='grip_wrap_n', size=512):
    p = os.path.join(TEX, name + '.png')
    if os.path.exists(p):
        return load_img(p, 'Non-Color')
    c = (np.arange(size) + 0.5) / size
    U, V = np.meshgrid(c, c)
    # one tile = once around the handle (u) by one wrap pitch (v): helical overlap edge + fine texture
    ph = (V + U) % 1.0
    h = np.clip(ph * 1.15, 0, 1) ** 0.7            # each wrap rises then drops at the overlap edge
    h += 0.08 * blur_noise(size, 1.2, 4)
    return save_img(name, height_to_normal(h, 6.0), 'Non-Color')


def closed_sweep(name, pts2, prof, mats, normal_axis=Vector((0, 1, 0))):
    """Sweep profile [(s,u)] along a closed path in the XZ plane. s = outward in-plane, u = along Y."""
    P = [Vector((x, 0.0, z)) for x, z in pts2]
    n = len(P)
    loops = []
    for i in range(n):
        T = (P[(i + 1) % n] - P[i - 1]).normalized()
        out = T.cross(normal_axis).normalized()
        c = Vector((0, 0, ZC))
        if out.dot(P[i] - c) < 0:
            out = -out
        loops.append([tuple(P[i] + out * s + normal_axis * u) for s, u in prof])
    bm = bmesh.new()
    vl = [[bm.verts.new(p) for p in L] for L in loops]
    m = len(prof)
    for i in range(n):
        for j in range(m):
            bm.faces.new((vl[i][j], vl[i][(j + 1) % m], vl[(i + 1) % n][(j + 1) % m], vl[(i + 1) % n][j]))
    bm.normal_update()
    ob = new_obj(name, bm, mats)
    fix_normals(ob)
    return ob


def build():
    reset()
    M = materials()
    keys = list(M.keys())
    mats = [M[k] for k in keys]
    I = {k: i for i, k in enumerate(keys)}
    parts = []
    # ---- head frame
    prof = rrect_c(PW, PD, 2.6, 3)
    head = closed_sweep('frame', head_loop(200), prof, mats)
    mat_by(head, lambda c, n, i: I['frame'])
    smooth(head, 50)
    # ---- bumper guard over the top of the head
    top = [head_xy(math.radians(a)) for a in np.linspace(38, 142, 60)]
    P = [Vector((x, 0.0, z)) for x, z in top]
    loops = []
    bprof = [(s + 0.5, u) for s, u in rrect_c(PW * 0.55, PD + 1.0, 2.2, 3)]
    for i in range(len(P)):
        T = (P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]).normalized()
        out = T.cross(Vector((0, 1, 0))).normalized()
        if out.dot(P[i] - Vector((0, 0, ZC))) < 0:
            out = -out
        loops.append([tuple(P[i] + out * (PW * 0.28 + s) + Vector((0, 1, 0)) * u) for s, u in bprof])
    bump = loft('bumper', loops, mats)
    mat_by(bump, lambda c, n, i: I['bumper'])
    smooth(bump, 50)
    parts.append(bump)
    # ---- strings (mains vertical, crosses horizontal), ending at the inner frame edge
    ai, bi = A_C - PW / 2, B_C - PW / 2
    inner = head_loop(400, ai, bi)

    def span_vertical(x):
        zs = []
        for k in range(len(inner)):
            (x0, z0), (x1, z1) = inner[k], inner[(k + 1) % len(inner)]
            if (x0 - x) * (x1 - x) <= 0 and x0 != x1:
                zs.append(z0 + (z1 - z0) * (x - x0) / (x1 - x0))
        return min(zs), max(zs)

    def span_horizontal(z):
        xs = []
        for k in range(len(inner)):
            (x0, z0), (x1, z1) = inner[k], inner[(k + 1) % len(inner)]
            if (z0 - z) * (z1 - z) <= 0 and z0 != z1:
                xs.append(x0 + (x1 - x0) * (z - z0) / (z1 - z0))
        return min(xs), max(xs)
    sr = 0.36
    strs = []
    grom = []
    main_sp = 2 * ai * 0.94 / (N_MAINS - 1)
    for k in range(N_MAINS):
        x = -ai * 0.94 + k * main_sp
        z0, z1 = span_vertical(x)
        s_ = box('main', x - sr, x + sr, -sr, sr, z0 - 1.0, z1 + 1.0, mats)
        strs.append(s_)
        for zz in (z0, z1):
            grom.append((x, zz))
    zlo, zhi = ZC - bi * 0.86, ZC + bi * 0.95
    cross_sp = (zhi - zlo) / (N_CROSS - 1)
    for k in range(N_CROSS):
        z = zlo + k * cross_sp
        x0, x1 = span_horizontal(z)
        yo = sr * 1.6 * (1 if k % 2 else -1)
        s_ = box('cross', x0 - 1.0, x1 + 1.0, yo - sr, yo + sr, z - sr, z + sr, mats)
        strs.append(s_)
        for xx in (x0, x1):
            grom.append((xx, z))
    for s_ in strs:
        mat_by(s_, lambda c, n, i: I['strings'])
    strings = join(strs, 'strings')
    # grommets on the outer face of the frame where strings exit
    for gx, gz in grom:
        v = Vector((gx, 0, gz - ZC))
        d = v.normalized()
        pt = Vector((gx, 0, gz)) + d * (PW + 0.2)
        g = lathe('grommet', [(1.2, 0, I['grommet']), (1.2, 0.8, I['grommet']), (0.0, 0.8, I['grommet'])], 10, mats)
        xform(g, frame(pt, (0, 1, 0), d))
        parts.append(g)
    # ---- T-joint (throat piece), shaft, ferrule, handle, butt cap
    zb = ZC - B_C - PW / 2      # outer bottom of the frame
    tj = loft('tjoint', [[(x, y, zb + 6.0) for x, y in rrect(22.0, 9.0, 3.0, 4)],
                         [(x, y, zb - 4.0) for x, y in rrect(14.0, 8.6, 3.0, 4)],
                         [(x, y, zb - 16.0) for x, y in rrect(8.6, 8.0, 3.0, 4)]], mats)
    mat_by(tj, lambda c, n, i: I['black'])
    smooth(tj, 45)
    parts.append(tj)
    shaft = lathe('shaft', [(3.6, 214.0, I['shaft']), (3.4, zb - 14.0, I['shaft'])], 24, mats)
    smooth(shaft, 50)
    ferrule = lathe('ferrule', [(12.0, 198.0, I['black']), (11.0, 205.0, I['black']), (6.0, 214.0, I['black']),
                                (3.9, 220.0, I['black']), (3.6, 222.0, I['black'])], 32, mats)
    smooth(ferrule, 50)
    parts.append(ferrule)
    # octagonal handle with grip wrap (8 flats, rounded corners), flaring at the butt
    def oct_sec(z, r):
        pts = []
        for k in range(8):
            a0 = TAU * k / 8 + math.pi / 8
            for j in range(3):  # rounded corner: 3 verts per corner
                a = a0 + (j - 1) * 0.12
                rr = r * (1.0 if j == 1 else 0.985)
                pts.append((rr * math.cos(a), rr * math.sin(a), z))
        return pts
    hz = [8.0, 14.0, 24.0, 60.0, 120.0, 180.0, 196.0, 200.0]
    hr = [15.2, 14.6, 13.6, 13.3, 13.2, 13.0, 12.6, 12.0]
    handle = loft('handle', [oct_sec(z, r) for z, r in zip(hz, hr)], mats)
    me = handle.data
    uv = uvlayer(me).data
    for p in me.polygons:
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            u = (math.atan2(co.y, co.x) / TAU) % 1.0
            uv[li].uv = (u, co.z / 26.0)
    for p in me.polygons:
        us = [uv[li].uv[0] for li in p.loop_indices]
        if max(us) - min(us) > 0.5:
            for li in p.loop_indices:
                if uv[li].uv[0] < 0.5:
                    uv[li].uv = (uv[li].uv[0] + 1.0, uv[li].uv[1])
    mat_by(handle, lambda c, n, i: I['grip'])
    smooth(handle, 50)
    parts.append(handle)
    cap = lathe('butt_cap', [(0.0, 0.0, I['cap']), (13.0, 0.0, I['cap']), (15.6, 1.6, I['cap']), (16.0, 4.5, I['cap']),
                             (15.6, 8.5, I['cap']), (0.0, 8.5, I['cap'])], 48, mats)
    smooth(cap, 40)
    parts.append(cap)
    # small spec print on the shaft (weight / grip class)
    st = wrap_text('t_spec', '4U G5', 2.6, 3.45, math.radians(-90), 300.0, M['print'], along_axis=True, font=FONT_BOLD)
    parts.append(st)
    for p in (tj, ferrule, cap):
        uv_box(p, 1 / 50.0)
    rest = join(parts, 'racket_parts')
    for o in (head, shaft, rest, strings):
        bm = bmesh.new(); bm.from_mesh(o.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
        bm.to_mesh(o.data); bm.free()
    head.name = 'racket_head'
    shaft.name = 'racket_shaft'
    rest.name = 'racket_body'
    strings.name = 'racket_strings'
    objs = [head, shaft, rest, strings]
    root, off, size = finalize(objs, root_name='racket', pivots={})
    exp = handles(root, objs)
    print('SIZE m', tuple(round(v, 4) for v in size), 'TRIS', stats(objs), [stats([o]) for o in objs])
    return exp, size


if __name__ == '__main__':
    exp, size = build()
    if '--export' in ARGS:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE_, 'racket.blend'))
        export_glb(os.path.join(SCRATCH, 'raw', 'racket.glb'), exp)
    if '--render' in ARGS:
        studio(size=6)
        c = Vector((0, 0, size.z / 2))
        rad = size.length / 2
        render_views('racket', c, rad, [('front', (0.35, -1, 0.15), 50, None), ('side', (1, -0.15, 0.1), 50, None)],
                     res=(600, 900), samples=24)
        render_views('racket', Vector((0, 0, 0.42)), 0.07, [('throat', (0.5, -1, 0.3), 60, None)], res=(900, 680), samples=24)
        render_views('racket', Vector((0, 0, ZC / 1000.0)), 0.15, [('headfront', (0, -1, 0), None, 0.3)], res=(700, 800), samples=16)
        render_views('racket', Vector((0, 0, 0.1)), 0.11, [('grip', (0.6, -1, 0.2), 60, None)], res=(900, 680), samples=24)
