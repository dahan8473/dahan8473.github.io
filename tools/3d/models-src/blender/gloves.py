# My boxing gloves, hung by their laces from a wall peg: red Fairtex leather
# gloves, the white Fairtex wordmark on the back of each hand and the white
# patch with the red and blue oval logo on the wrist strap. Real-ish scale (mm),
# Z up, front faces -Y. The logos are turned to read upright on the hanging glove.
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
    M['leather'] = mat('gloves_leather', (0.27, 0.011, 0.015), 0.0, 0.3, normal=grain, nstr=0.35, coat=0.45, coat_rough=0.18)
    M['strap'] = mat('gloves_print_white', (0.86, 0.86, 0.84), 0.0, 0.45)
    M['lining'] = mat('gloves_lining', (0.12, 0.01, 0.012), 0.0, 0.8)
    M['ink'] = mat('gloves_print_black', (0.015, 0.015, 0.017), 0.0, 0.45)
    M['red'] = mat('gloves_print_red', (0.7, 0.03, 0.04), 0.0, 0.45)
    M['blue'] = mat('gloves_print_blue', (0.05, 0.12, 0.5), 0.0, 0.45)
    M['lace'] = mat('gloves_lace', (0.9, 0.9, 0.88), 0.0, 0.7)
    M['peg'] = mat('gloves_peg', (0.32, 0.22, 0.14), 0.0, 0.55)
    M['metal'] = mat('gloves_metal', (0.6, 0.6, 0.62), 1.0, 0.3)
    return M


KEYS = ['leather', 'strap', 'lining', 'lace', 'peg', 'metal', 'ink', 'red', 'blue']


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


def sheet(name, w, h, keep, mats, idx, step=2.5):
    """A flat grid w x h in XY, trimmed by keep(x, y) on face centres, so it can bend onto a surface."""
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=max(8, int(w / step)), y_segments=max(6, int(h / step)), size=0.5)
    for v in bm.verts:
        v.co.x *= w
        v.co.y *= h
    gone = [f for f in bm.faces if not keep(f.calc_center_median().x, f.calc_center_median().y)]
    bmesh.ops.delete(bm, geom=gone, context='FACES')
    ob = new_obj(name, bm, mats)
    mat_by(ob, lambda c, n, i: idx)
    return ob


def italic(ob, k=0.22):
    for v in ob.data.vertices:
        v.co.x += k * v.co.y
    ob.data.update()
    return ob


def stick(ob, target, at, lift):
    """Lay a flat XY decal on target's front (-Y) at height `at`, then wrap it onto the surface."""
    hit, hn = raycast(target, Vector((at.x, -300.0, at.z)), Vector((0, 1, 0)))
    if hit is None:
        return ob
    xform(ob, frame(hit, (1, 0, 0), hn) @ tr(0, 0, lift))
    subdivide_long_edges(ob, 2.0)
    project_onto(ob, target, -hn, lift=lift)
    return ob


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

    # Red leather hook-and-loop strap wrapped round the wrist, with its tab end.
    strap = lathe('strap', [(48.5, 92.0, I['leather']), (50.5, 95.0, I['leather']), (50.5, 141.0, I['leather']),
                            (48.5, 144.0, I['leather'])], 48, mats)
    xform(strap, Matrix.Diagonal((1.0, 0.86, 1.0, 1.0)))
    smooth(strap, 50)
    parts.append(strap)

    # The Fairtex wordmark across the back of the hand: white, italic, on a
    # thin black keyline (the same word a touch bigger, just under it).
    fist_ob = parts[0]
    for key, size, lift in (('ink', 41.0, 0.25), ('strap', 38.5, 0.5)):
        w = italic(text_mesh('wordmark', 'Fairtex', size, font=FONT_BOLD, spacing=0.92, mats=mats))
        mat_by(w, lambda c, n, i, key=key: I[key])
        parts.append(stick(w, fist_ob, Vector((-3.0, 0.0, 14.0)), lift))
    # The white patch on the strap with the oval logo: red left, blue right,
    # white inside, the black wordmark across it.
    z0 = 118.0
    patch = stick(sheet('patch', 76.0, 40.0, lambda x, y: True, mats, I['strap']), strap, Vector((0.0, 0.0, z0)), 0.3)
    parts.append(patch)
    ring = lambda a, b: (lambda x, y: (x / a) ** 2 + (y / b) ** 2 <= 1.0)
    for key, keep, lift in (('red', lambda x, y: x <= 0 and ring(30.0, 14.0)(x, y), 0.55), ('blue', lambda x, y: x > 0 and ring(30.0, 14.0)(x, y), 0.55),
                            ('strap', ring(25.0, 10.5), 0.8)):
        parts.append(stick(sheet('oval', 62.0, 30.0, keep, mats, I[key], step=0.6), strap, Vector((0.0, 0.0, z0)), lift))
    wm = italic(text_mesh('patch_word', 'Fairtex', 9.5, font=FONT_BOLD, spacing=0.9, mats=mats))
    mat_by(wm, lambda c, n, i: I['ink'])
    parts.append(stick(wm, strap, Vector((0.0, 0.0, z0)), 1.05))
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
