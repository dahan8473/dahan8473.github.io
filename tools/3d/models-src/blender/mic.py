# DJI Mic Mini: two clip-on transmitters + one camera receiver (black), sitting together.
# TX 26.55 x 26.06 x 15.96 mm (incl. clip); RX 46.50 x 29.61 x 19.32 mm.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib, common
importlib.reload(common)
from common import *
import bmesh
from mathutils import Vector, Matrix

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
HERE_ = os.path.dirname(os.path.abspath(__file__))


def materials():
    knurl = tex_knurl('knurl_pyramid_n', 512, n=16, strength=9.0, diamond=True)
    M = {}
    M['body'] = mat('mic_body', (0.026, 0.026, 0.028), 0.0, 0.42)
    M['facet'] = mat('mic_facet', (0.03, 0.03, 0.033), 0.0, 0.26)
    M['clip'] = mat('mic_clip', (0.02, 0.02, 0.021), 0.0, 0.55)
    M['logo'] = mat('mic_logo', (0.42, 0.42, 0.43), 0.8, 0.32)
    M['print'] = mat('mic_print', (0.8, 0.8, 0.8), 0.0, 0.5)
    M['gold'] = mat('mic_contacts', (0.9, 0.68, 0.32), 1.0, 0.25)
    M['led'] = mat('mic_led', (0.1, 0.9, 0.3), 0.0, 0.3, emission=(0.1, 1.0, 0.3), estr=2.0)
    M['orange'] = mat('mic_orange', (0.9, 0.32, 0.04), 0.0, 0.4)
    M['dark'] = mat('mic_grille', (0.005, 0.005, 0.006), 0.0, 0.85)
    M['dial'] = mat('mic_dial', (0.03, 0.03, 0.032), 0.2, 0.45, normal=knurl, nstr=1.0)
    M['rx'] = mat('mic_rx_body', (0.045, 0.045, 0.048), 0.3, 0.4)
    return M


KEYS = ['body', 'facet', 'clip', 'logo', 'print', 'gold', 'led', 'orange', 'dark', 'dial', 'rx']


def tx(M, name):
    mats = [M[k] for k in KEYS]
    I = {k: i for i, k in enumerate(KEYS)}
    parts = []
    W_, H_ = 26.06, 26.55
    body = slab_xz(name + '_body', rrect(W_, H_, 6.8, 8, 0, H_ / 2), -6.6, 5.4, mats)
    add_bevel(body, 2.6, 5, 30)
    mat_by(body, lambda c, n, i: I['body'])
    # facet: shave the upper-right front corner with a tilted plane (crisp crease like the real TX)
    n_out = Vector((0.111, -0.988, 0.111)).normalized()
    bm = bmesh.new(); bm.from_mesh(body.data)
    res = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=1e-4,
                                 plane_co=(-1.0, -6.6, 26.55), plane_no=n_out, clear_outer=True)
    cut_edges = [e for e in res['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
    bmesh.ops.holes_fill(bm, edges=cut_edges, sides=0)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(body.data); bm.free()
    mat_by(body, lambda c, n, i: I['facet'] if (n.y < -0.9 and n.x > 0.05 and n.z > 0.05) else I['body'])
    smooth(body, 28)
    parts.append(body)
    # logo + LED
    parts.append(text_on(name + '_dji', 'DJI', 6.0, frame((3.6, -6.6, 9.2), (1, 0, 0), (0, -1, 0)), M['logo'], FONT_BOLD,
                         spacing=1.05, lift=0.05))
    led = lathe(name + '_led', [(0.7, 0, I['led']), (0.0, 0.1, I['led'])], 16, mats)
    xform(led, tr(-9.6, -6.62, 23.2) @ rot('X', 90))
    parts.append(led)
    # side buttons (-X side)
    for z in (17.5, 9.0):
        b = loft(name + '_btn', [[(-13.05, y, z_) for y, z_ in rrect(4.0, 6.2, 1.9, 4, -0.6, z)],
                                  [(-13.75, y, z_) for y, z_ in rrect(3.6, 5.8, 1.7, 4, -0.6, z)]], mats)
        mat_by(b, lambda c, n, i: I['body'])
        smooth(b, 40)
        parts.append(b)
    # top mic grille dots
    for ix in range(5):
        for iy in range(2):
            d = lathe(name + '_hole', [(0.45, 0, I['dark']), (0.0, 0, I['dark'])], 10, mats)
            xform(d, tr(-4.0 + ix * 2.0, -2.2 + iy * 1.8, H_ + 0.02))
            parts.append(d)
    # bottom pogo contacts
    for ix in range(4):
        d = lathe(name + '_pin', [(0.55, 0, I['gold']), (0.0, 0, I['gold'])], 12, mats)
        xform(d, tr(-3.6 + ix * 2.4, -2.6, -0.02) @ rot('X', 180))
        parts.append(d)
    # back clip: hinge block + spring plate with a small gap
    hb = box(name + '_hinge', -9.0, 9.0, 5.0, 9.4, 20.0, 25.4, mats, bevel=1.2, seg=3)
    mat_by(hb, lambda c, n, i: I['clip'])
    parts.append(hb)
    pl = box(name + '_clip', -9.6, 9.6, 7.2, 9.4, 3.0, 24.0, mats, bevel=0.9, seg=3)
    mat_by(pl, lambda c, n, i: I['clip'])
    parts.append(pl)
    tip = box(name + '_cliptip', -9.0, 9.0, 6.2, 8.0, 2.4, 4.4, mats, bevel=0.7, seg=2)
    mat_by(tip, lambda c, n, i: I['clip'])
    parts.append(tip)
    for p in parts:
        smooth(p, 35) if p.name.endswith(('_hinge', '_clip', '_cliptip')) else None
    ob = join(parts, name)
    return ob


def rx(M, name):
    mats = [M[k] for k in KEYS]
    I = {k: i for i, k in enumerate(KEYS)}
    parts = []
    X0, X1, D_, Z0, Z1 = -19.6, 23.25, 29.6, 2.2, 16.6
    body = prism(name + '_body', rrect(X1 - X0, D_, 6.0, 8, (X0 + X1) / 2, 0), Z0, Z1, mats)
    add_bevel(body, 2.4, 5, 40)
    mat_by(body, lambda c, n, i: I['rx'])
    smooth(body, 30)
    parts.append(body)
    # knurled gain dial on the -X end (axis along X) + collar
    dz, dy = 9.4, 5.5
    collar = lathe(name + '_collar', [(6.3, 0.0, I['rx']), (6.3, 1.6, I['rx']), (0.0, 1.6, I['rx'])], 48, mats)
    xform(collar, tr(X0 + 0.6, dy, dz) @ rot('Y', -90))
    parts.append(collar)
    dial = ribbed_disc(name + '_dial', 6.9, 0.0, 4.6, 36, 0.35, [M['body'], M['dial']], top_mat=0, side_mat=1)
    uv_side(dial, 36 / 16.0, 1 / 1.4)
    xform(dial, tr(X0 - 0.9, dy, dz) @ rot('Y', -90))
    parts.append(dial)
    # top: DJI logo, channel LEDs
    parts.append(text_on(name + '_dji', 'DJI', 10.5, frame((4.5, 3.0, Z1), (1, 0, 0), (0, 0, 1)), M['logo'], FONT_BOLD,
                         spacing=1.05, lift=0.04))
    for k, x in enumerate((12.5, 17.5)):
        led = lathe(name + '_led', [(0.7, 0, I['led']), (0.0, 0.05, I['led'])], 12, mats)
        xform(led, tr(x, -11.2, Z1 + 0.02))
        parts.append(led)
        parts.append(text_on(name + '_ch%d' % k, str(k + 1), 1.8, frame((x, -8.6, Z1), (1, 0, 0), (0, 0, 1)), M['print'],
                             FONT_BOLD))
    # back long face (+Y): MIC RX label, orange button
    BKF = lambda x, z: frame((x, -D_ / 2, z), (1, 0, 0), (0, -1, 0))
    parts.append(text_on(name + '_label', 'MIC RX', 3.0, BKF(0.0, 9.4), M['print'], FONT_BOLD, spacing=1.1))
    ob_ = lathe(name + '_rec', [(2.3, 0, I['orange']), (2.3, 0.6, I['orange']), (1.9, 0.9, I['orange']), (0.0, 0.9, I['orange'])], 24, mats)
    xform(ob_, tr(15.5, -D_ / 2 + 0.4, 9.4) @ rot('X', 90))
    parts.append(ob_)
    # +X end: USB-C port
    port = box(name + '_usbc', X1 - 0.3, X1 + 0.05, -4.6, 4.6, 7.8, 11.0, mats, bevel=1.4, seg=3)
    mat_by(port, lambda c, n, i: I['dark'])
    parts.append(port)
    # folded cold-shoe foot under the body
    foot = box(name + '_foot', -9.3, 9.3, -9.0, 9.0, 0.0, Z0 + 0.4, mats, bevel=0.6, seg=2)
    mat_by(foot, lambda c, n, i: I['clip'])
    parts.append(foot)
    tab = box(name + '_tab', -4.5, 4.5, -D_ / 2 - 0.8, -D_ / 2 + 2.0, 0.4, 3.4, mats, bevel=0.6, seg=2)
    mat_by(tab, lambda c, n, i: I['clip'])
    parts.append(tab)
    ob = join(parts, name)
    return ob


def build():
    reset()
    M = materials()
    t1 = tx(M, 'mic_tx_1')
    t2 = tx(M, 'mic_tx_2')
    r = rx(M, 'mic_rx')
    xform(t1, tr(9.0, -7.0, 0) @ rot('Z', -6))
    xform(t2, tr(38.0, 2.0, 0) @ rot('Z', -24))
    xform(r, tr(-31.0, 6.0, 0) @ rot('Z', 16))
    objs = [t1, t2, r]
    for o in objs:
        bm = bmesh.new(); bm.from_mesh(o.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
        bm.to_mesh(o.data); bm.free()
    # pivots: bottom centre of each device
    piv = {'mic_tx_1': (9.0, -7.0, 0), 'mic_tx_2': (38.0, 2.0, 0), 'mic_rx': (-31.0, 6.0, 0)}
    root, off, size = finalize(objs, root_name='mic_mini', pivots=piv)
    exp = handles(root, objs)
    print('SIZE m', tuple(round(v, 4) for v in size), 'TRIS', stats(objs), [stats([o]) for o in objs])
    return exp, size


if __name__ == '__main__':
    exp, size = build()
    if '--export' in ARGS:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE_, 'mic-mini.blend'))
        export_glb(os.path.join(SCRATCH, 'raw', 'mic-mini.glb'), exp)
    if '--render' in ARGS:
        studio()
        c = Vector((0, 0, size.z / 2))
        rad = size.length / 2
        render_views('mic', c, rad, [
            ('hero', (0.6, -1, 0.55), 60, None),
            ('front', (0.0, -1, 0.15), 60, None),
            ('back34', (-0.7, 1, 0.5), 60, None),
            ('top', (0.0, -0.05, 1), 60, None),
        ], res=(900, 680), samples=24)
