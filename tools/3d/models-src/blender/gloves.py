# My boxing gloves, hung by their laces from a wall peg: a pair of 14 oz black
# leather gloves with white wrist straps. Real-ish scale (mm), Z up, front faces -Y.
# Exported as two handles: 'peg' (still) and 'pair' (both gloves and the lace),
# pivoting at the peg so the viewer can swing them. Leather is one material
# (gloves_leather) so the page can recolour it.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib, common
importlib.reload(common)
from common import *
import bmesh
from mathutils import Vector, Matrix

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
HERE_ = os.path.dirname(os.path.abspath(__file__))

PEG = Vector((0.0, 0.0, 430.0))   # where the lace hangs from


def materials():
    grain = tex_grain('grain_fine_n', 512, sigma=1.3, strength=0.9)
    M = {}
    M['leather'] = mat('gloves_leather', (0.018, 0.018, 0.02), 0.0, 0.34, normal=grain, nstr=0.35, coat=0.35, coat_rough=0.2)
    M['strap'] = mat('gloves_strap', (0.86, 0.86, 0.84), 0.0, 0.5, normal=grain, nstr=0.2)
    M['lining'] = mat('gloves_lining', (0.05, 0.05, 0.055), 0.0, 0.8)
    M['lace'] = mat('gloves_lace', (0.9, 0.9, 0.88), 0.0, 0.7)
    M['peg'] = mat('gloves_peg', (0.32, 0.22, 0.14), 0.0, 0.55)
    M['metal'] = mat('gloves_metal', (0.6, 0.6, 0.62), 1.0, 0.3)
    return M


KEYS = ['leather', 'strap', 'lining', 'lace', 'peg', 'metal']


def blob(name, radii, segs, deform, mats, idx):
    """A uv sphere scaled to radii, then pushed around by deform(x, y, z) -> (x, y, z)."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs[0], v_segments=segs[1], radius=1.0)
    for v in bm.verts:
        x, y, z = v.co.x * radii[0], v.co.y * radii[1], v.co.z * radii[2]
        v.co = Vector(deform(x, y, z))
    ob = new_obj(name, bm, mats)
    mat_by(ob, lambda c, n, i: idx)
    smooth(ob, 80)
    uv_box(ob, 1 / 40.0)
    return ob


def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def glove(M, side):
    """One glove, fist centred at the origin, cuff up. side=+1: thumb on +X (right glove)."""
    mats = [M[k] for k in KEYS]
    I = {k: i for i, k in enumerate(KEYS)}
    parts = []

    def fist(x, y, z):
        # Bean shaped: full and round at the knuckles (bottom front), narrowing to the wrist,
        # the palm side (+Y) a little flatter than the striking side (-Y).
        taper = 1.0 - 0.2 * smoothstep(-10, 90, z)
        y *= 0.86 if y > 0 else 1.0
        y -= 10.0 * smoothstep(-40, -90, z) * (1 if y < 0 else 0.3)   # fingers curl forward at the bottom
        return (x * taper, y * taper, z)
    parts.append(blob('fist', (72.0, 64.0, 96.0), (48, 32), fist, mats, I['leather']))

    # Thumb: a long capsule tucked along the side, joined to the fist at its top.
    def thumb(x, y, z):
        return (x, y, z)
    th = blob('thumb', (22.0, 24.0, 56.0), (24, 18), thumb, mats, I['leather'])
    xform(th, tr(side * 52.0, -8.0, 4.0) @ rot('Y', side * -10.0) @ rot('X', 10.0))
    parts.append(th)

    # Cuff: a tapered sleeve up from the wrist, slightly oval, open at the top with a dark lining.
    cuff = lathe('cuff', [(50.0, 50.0, I['leather']), (46.0, 90.0, I['leather']), (47.0, 150.0, I['leather']),
                          (48.0, 178.0, I['leather']), (44.0, 182.0, I['lining']), (40.0, 172.0, I['lining']),
                          (36.0, 120.0, I['lining'])], 48, mats)
    xform(cuff, Matrix.Diagonal((1.0, 0.86, 1.0, 1.0)))
    smooth(cuff, 60)
    uv_box(cuff, 1 / 40.0)
    parts.append(cuff)

    # White hook-and-loop strap wrapped round the wrist, with its tab end.
    strap = lathe('strap', [(48.5, 92.0, I['strap']), (50.5, 95.0, I['strap']), (50.5, 141.0, I['strap']),
                            (48.5, 144.0, I['strap'])], 48, mats)
    xform(strap, Matrix.Diagonal((1.0, 0.86, 1.0, 1.0)))
    smooth(strap, 50)
    parts.append(strap)
    tab = box('strap_tab', -26.0, 26.0, -6.0, 0.0, 95.0, 141.0, mats, bevel=4.0, seg=3)
    xform(tab, tr(side * 12.0, -44.5, 0.0))
    mat_by(tab, lambda c, n, i: I['strap'])
    smooth(tab, 40)
    parts.append(tab)

    # A white stripe across the knuckles, the one bit of trim.
    stripe = blob('stripe', (73.5, 65.5, 10.0), (48, 8), lambda x, y, z: (x * 0.96, y, z - 28.0), mats, I['strap'])
    bm = bmesh.new(); bm.from_mesh(stripe.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y > -18.0], context='VERTS')
    bm.to_mesh(stripe.data); bm.free()
    parts.append(stripe)
    return parts


def build():
    reset()
    M = materials()
    mats = [M[k] for k in KEYS]
    I = {k: i for i, k in enumerate(KEYS)}
    # Two gloves hanging a little apart, one turned toward you, the other away.
    right = join(glove(M, 1), 'glove_r')
    left = join(glove(M, -1), 'glove_l')
    xform(right, tr(-64.0, 6.0, 120.0) @ rot('Z', -18.0) @ rot('Y', 8.0))
    xform(left, tr(68.0, -10.0, 100.0) @ rot('Z', 24.0) @ rot('Y', -10.0))
    # The lace: from inside each cuff, up over the peg.
    lace_parts = []
    for top, out in ((Vector((-56.0, 6.0, 300.0)), -1), (Vector((60.0, -10.0, 280.0)), 1)):
        path = catmull([tuple(top), tuple(top.lerp(PEG, 0.5) + Vector((out * 10.0, -4.0, 0.0))), tuple(PEG + Vector((out * 6.0, -6.0, 4.0)))], 10)
        lace = sweep('lace', path, lambda t: [(2.6 * math.cos(a), 2.6 * math.sin(a)) for a in [TAU * k / 8 for k in range(8)]], mats)
        mat_by(lace, lambda c, n, i: I['lace'])
        smooth(lace, 60)
        lace_parts.append(lace)
    over = sweep('lace_over', catmull([tuple(PEG + Vector((-6.0, -6.0, 4.0))), tuple(PEG + Vector((0.0, -8.0, 9.0))),
                                       tuple(PEG + Vector((6.0, -6.0, 4.0)))], 6),
                 lambda t: [(2.6 * math.cos(a), 2.6 * math.sin(a)) for a in [TAU * k / 8 for k in range(8)]], mats)
    mat_by(over, lambda c, n, i: I['lace'])
    smooth(over, 60)
    pair = join([right, left] + lace_parts + [over], 'pair')
    # The peg: a short wooden dowel out of the wall, with a metal plate behind it.
    peg = lathe('peg', [(0.0, 0.0, I['metal']), (16.0, 0.0, I['metal']), (16.0, 3.0, I['metal']), (6.0, 3.0, I['peg']),
                        (6.0, 46.0, I['peg']), (8.5, 48.0, I['peg']), (8.5, 54.0, I['peg']), (0.0, 55.0, I['peg'])], 32, mats)
    xform(peg, tr(PEG.x, 40.0, PEG.z - 2.0) @ rot('X', 90))
    smooth(peg, 40)
    objs = [pair, peg]
    for o in objs:
        bm = bmesh.new(); bm.from_mesh(o.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
        bm.to_mesh(o.data); bm.free()
    global off
    root, off, size = finalize(objs, root_name='gloves', pivots={'pair': tuple(PEG), 'peg': tuple(PEG)})
    exp = handles(root, objs, extras={'pair': {'swing_axis': [0, 0, 1]}})
    print('SIZE m', tuple(round(v, 4) for v in size), 'TRIS', stats(objs))
    return exp, size


if __name__ == '__main__':
    exp, size = build()
    if '--export' in ARGS:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE_, 'gloves.blend'))
        export_glb(os.path.join(SCRATCH, 'raw', 'gloves.glb'), exp)
    if '--render' in ARGS:
        studio(size=6, scale=1.4)
        c = Vector((0, 0, size.z / 2))
        rad = size.length / 2
        render_views('gloves', c, rad, [
            ('front', (0.0, -1, 0.1), 40, None),
            ('three', (0.6, -1, 0.25), 40, None),
            ('side', (1, -0.15, 0.1), 40, None),
        ], res=(800, 800), samples=32)
