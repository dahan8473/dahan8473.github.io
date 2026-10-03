# Fujifilm X-T200 (dark silver) + XC 15-45mm F3.5-5.6 OIS PZ kit lens (black).
# Run: blender -b --factory-startup -P xt200.py -- --export [--render]
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib, common
importlib.reload(common)
from common import *
import bmesh
from mathutils import Vector, Matrix

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
HERE_ = os.path.dirname(os.path.abspath(__file__))

# mm; grip at -X, front faces -Y, body front face y=0
W = 121.0
HW = W / 2
D = 31.0            # body shell depth (front face -> back plate)
TOP = 65.0          # top plate top surface
TP0 = 53.7          # top plate lower edge (leatherette below)
BOT = 3.0           # bottom plate height
MX, MZ = 9.0, 31.6  # X mount / EVF centre
HUMP_TOP = 80.7
FLANGE_Y = -2.2

# Paint colour lives in ONE place so it is easy to change (David to confirm the body colour).
PAINT = (0.13, 0.13, 0.138)   # dark silver


def materials():
    leather = tex_leather('leather_xt_n', 1024, cells=30, seed=21, strength=4.5)
    spun = tex_spun('spun2_n', 512, strength=0.5)
    M = {}
    M['paint'] = mat('xt200_paint', PAINT, 0.65, 0.4)
    M['paint_spun'] = mat('xt200_paint_spun', PAINT, 0.7, 0.34, normal=spun, nstr=0.35)
    M['leather'] = mat('xt200_leather', (0.024, 0.024, 0.025), 0.0, 0.6, normal=leather, nstr=1.0)
    M['black'] = mat('xt200_black', (0.025, 0.025, 0.027), 0.0, 0.42)
    M['rubber'] = mat('xt200_rubber', (0.02, 0.02, 0.021), 0.0, 0.8)
    M['screen'] = mat('xt200_screen', (0.006, 0.007, 0.009), 0.0, 0.04, coat=1.0, coat_rough=0.02)
    M['print'] = mat('xt200_print', (0.86, 0.86, 0.84), 0.0, 0.45)
    M['print_dark'] = mat('xt200_print_dark', (0.03, 0.03, 0.03), 0.0, 0.5)
    M['orange'] = mat('xt200_orange', (0.9, 0.35, 0.05), 0.0, 0.45)
    M['chrome'] = mat('xt200_metal', (0.62, 0.62, 0.64), 1.0, 0.25)
    M['glass'] = mat('xt200_evf_glass', (0.01, 0.012, 0.016), 0.0, 0.05, coat=1.0)
    M['decal'] = mat('xt200_mode_dial_labels', (1, 1, 1), 0.0, 0.45, alpha_mask=True,
                     base_tex=load_img(os.path.join(TEX, 'xt_modedial.png')))
    M['dark'] = mat('xt200_cavity', (0.008, 0.008, 0.009), 0.0, 0.8)
    return M


def body(M):
    keys = ['paint', 'paint_spun', 'leather', 'black', 'rubber', 'screen', 'print', 'print_dark', 'orange',
            'chrome', 'glass', 'decal', 'dark']
    mats = [M[k] for k in keys]
    I = {k: i for i, k in enumerate(keys)}
    parts = []

    def assign(ob, key):
        mat_by(ob, lambda c, n, i: I[key])

    # -- bottom plate, leather body, top plate
    bp = prism('bottom', rrect(W, D, 6.0, 8, 0, D / 2), 0, BOT, mats)
    add_bevel(bp, 1.0, 3, 40)
    assign(bp, 'paint')
    lb = prism('leather_body', rrect(W - 0.6, D - 0.6, 5.7, 8, 0, D / 2), BOT - 0.2, TP0 + 0.2, mats)
    assign(lb, 'leather')
    tp = prism('top_plate', rrect(W, D, 6.0, 8, 0, D / 2), TP0, TOP, mats)
    add_bevel(tp, 2.2, 4, 40)
    assign(tp, 'paint')
    # front grip bulge (leather)
    gp = catmull([(-33.0, 1.0), (-34.5, -5.0), (-39.0, -10.0), (-47.0, -12.0), (-55.0, -10.5), (-59.4, -6.0),
                  (-HW + 0.3, 0.0), (-HW + 0.3, 6.0)], 5)
    gp = list(reversed(gp + [(-33.0, 6.0)]))
    grip = prism('grip', gp, BOT + 0.6, TP0 - 0.6, mats)
    add_bevel(grip, 3.5, 4, 30)
    assign(grip, 'leather')
    # back thumb grip (leather)
    tg = catmull([(-40.5, 2.0), (-41.5, 20.0), (-41.0, 40.0), (-43.0, 52.5), (-HW + 0.3, 52.5), (-HW + 0.3, 2.0)], 4,
                 closed=True)
    tg = [(x, min(max(z, BOT + 0.8), TP0 - 1.0)) for x, z in tg]
    thumb = slab_xz('thumb', tg, D - 1.0, D + 4.2, mats)
    add_bevel(thumb, 1.8, 4, 30)
    assign(thumb, 'leather')
    for p in (bp, lb, tp, grip, thumb):
        uv_box(p, 1 / 25.0)
        smooth(p, 33)
        parts.append(p)

    # -- EVF hump: vertical band then sloped roof
    def hl(z, hw, y0, y1, r):
        return [(MX + x, y, z) for x, y in rrect(2 * hw, y1 - y0, r, 6, 0, (y0 + y1) / 2)]
    hump = loft('hump', [hl(TOP - 4.0, 22.9, -1.6, D - 0.6, 2.5), hl(72.5, 22.9, -1.6, D - 0.6, 2.5),
                         hl(HUMP_TOP, 13.2, 8.5, D - 0.6, 2.0)], mats)
    add_bevel(hump, 1.6, 4, 25)
    assign(hump, 'paint')
    uv_box(hump, 1 / 25.0)
    smooth(hump, 30)
    parts.append(hump)

    # -- hot shoe (ISO, silver rails)
    HS = tr(MX, 20.0, HUMP_TOP - 0.1)
    for (x0, x1, y0, y1, z0, z1) in ((-11.0, 11.0, -9.5, 9.5, 0, 0.8), (-9.6, -8.8, -9.5, 9.5, 0, 3.1),
                                     (8.8, 9.6, -9.5, 9.5, 0, 3.1), (-9.6, -7.4, -9.5, 9.5, 2.5, 3.1),
                                     (7.4, 9.6, -9.5, 9.5, 2.5, 3.1)):
        b_ = box('shoe', x0, x1, y0, y1, z0, z1, mats, bevel=0.2, seg=1)
        xform(b_, HS)
        assign(b_, 'chrome')
        parts.append(b_)
    pin = lathe('shoe_pin', [(1.6, 0, I['chrome']), (1.6, 1.0, I['chrome']), (0, 1.0, I['chrome'])], 16, mats)
    xform(pin, HS @ tr(0, 1.0, 0.7))
    parts.append(pin)

    # -- round rubber eyecup + window, VIEW MODE button
    cup = lathe('eyecup', [(0.0, 0.0, I['rubber']), (12.6, 0.0, I['rubber']), (13.0, 2.0, I['rubber']), (13.0, 9.0, I['rubber']),
                           (12.2, 11.8, I['rubber']), (10.6, 12.2, I['rubber']), (9.6, 11.0, I['rubber']),
                           (9.4, 6.0, I['dark']), (0.0, 6.0, I['glass'])], 64, mats)
    xform(cup, tr(MX, D - 0.5, 63.0) @ rot('X', -90))
    smooth(cup, 40)
    parts.append(cup)
    vm = slab_xz('view_mode', rrect(5.5, 7.0, 1.4, 4, MX - 16.5, 60.5), D - 0.5, D + 1.3, mats)
    add_bevel(vm, 0.4, 2, 30)
    assign(vm, 'black')
    parts.append(vm)
    parts.append(text_on('t_vm', 'VIEW\nMODE', 1.15, frame((MX - 16.5, D + 1.3, 60.5), (-1, 0, 0), (0, 1, 0)), M['print'], FONT_BOLD))

    # -- mount (X mount, mostly hidden by the lens)
    MM = tr(MX, 0, MZ) @ rot('X', 90)
    cut = lathe('throat_cut', [(22.0, -12.0), (22.0, 5.0)], 64, mats, cap0=True, cap1=True)
    xform(cut, MM)
    boolean(lb, cut)
    mount = lathe('mount', [(27.0, -0.5, I['black']), (27.0, 0.6, I['black']), (26.4, 1.0, I['chrome']),
                            (26.4, -FLANGE_Y, I['chrome']), (22.6, -FLANGE_Y, I['chrome']), (22.0, 1.5, I['dark']),
                            (22.0, -12.0, I['dark']), (0.0, -12.0, I['dark'])], 96, mats)
    xform(mount, MM)
    smooth(mount, 40)
    parts.append(mount)
    sens = box('sensor', -12.0, 12.0, 0, 0.3, -8.0, 8.0, mats)
    xform(sens, tr(MX, 11.7, MZ))
    assign(sens, 'glass')
    parts.append(sens)
    # lens release button (lower left of mount)
    rel = lathe('release', [(3.0, 0, I['black']), (3.0, 1.6, I['black']), (2.6, 2.0, I['black']), (0, 2.0, I['black'])], 32, mats)
    xform(rel, tr(-20.5, 0.1, 9.5) @ rot('X', 90))
    smooth(rel, 40)
    parts.append(rel)

    # -- top controls
    # mode dial (next to the hump on the grip side)
    md_base = lathe('mode_base', [(11.4, 0, I['paint']), (11.4, 1.4, I['paint']), (0, 1.4, I['paint'])], 64, mats)
    xform(md_base, tr(-21.6, 12.5, TOP - 0.3))
    parts.append(md_base)
    md = ribbed_disc('mode_dial', 10.8, 0.0, 7.4, 90, 0.28, [M['paint_spun'], M['paint']], top_mat=0, side_mat=1)
    xform(md, tr(-21.6, 12.5, TOP + 1.0))
    parts.append(md)
    dec = lathe('mode_labels', [(10.3, 0, I['decal']), (0.0, 0, I['decal'])], 64, mats)
    uv_planar(dec, 'Z', 1.0 / (2 * 10.8))
    xform(dec, tr(-21.6, 12.5, TOP + 8.43))
    parts.append(dec)
    # right (+X) dial
    rd = ribbed_disc('right_dial', 10.2, 0.0, 7.6, 90, 0.28, [M['paint_spun'], M['paint']], top_mat=0, side_mat=1)
    xform(rd, tr(44.5, 13.5, TOP - 0.3))
    parts.append(rd)
    # command dial (back corner, grip side)
    cd = ribbed_disc('command_dial', 8.0, 0.0, 5.6, 70, 0.28, [M['paint_spun'], M['paint']], top_mat=0, side_mat=1)
    xform(cd, tr(-51.5, 19.5, TOP - 0.3))
    parts.append(cd)
    # shutter button with threaded collar
    col = lathe('shutter_collar', [(6.6, 0, I['paint']), (6.6, 2.4, I['paint']), (6.1, 3.0, I['paint']), (4.9, 3.0, I['paint']),
                                   (4.9, 2.0, I['paint'])], 64, mats, rmod=None)
    xform(col, tr(-38.5, 3.0, TOP - 0.3))
    smooth(col, 40)
    parts.append(col)
    sb = lathe('shutter', [(4.8, 0, I['paint']), (4.8, 4.2, I['paint']), (4.3, 4.8, I['paint']), (0, 4.6, I['paint'])], 64, mats)
    xform(sb, tr(-38.5, 3.0, TOP - 0.3))
    smooth(sb, 40)
    parts.append(sb)
    # ON/OFF lever + label, Fn (orange) button
    lev = box('onoff', -3.5, 3.5, -1.3, 1.3, 0, 2.2, mats, bevel=0.6, seg=2)
    xform(lev, tr(-36.0, 15.5, TOP - 0.2))
    assign(lev, 'black')
    parts.append(lev)
    TOPF = lambda x, y: frame((x, y, TOP + 0.02), (-1, 0, 0), (0, 0, 1))
    parts.append(text_on('t_onoff', 'ON/OFF', 1.7, TOPF(-36.0, 19.6), M['print_dark'], FONT_BOLD))
    fn = lathe('fn', [(2.3, 0, I['paint']), (2.3, 1.0, I['paint']), (1.6, 1.2, I['orange']), (0, 1.25, I['orange'])], 32, mats)
    xform(fn, tr(-53.5, 4.0, TOP - 0.2))
    parts.append(fn)

    # -- front printing and AF lamp
    parts.append(text_on('t_fuji', 'FUJIFILM', 6.2, frame((MX, -1.62, 66.8), (1, 0, 0), (0, -1, 0)), M['print'],
                         FONT_BOLD, spacing=1.04))
    parts.append(text_on('t_xt200', 'X-T200', 5.3, frame((43.5, -0.02, 57.0), (1, 0, 0), (0, -1, 0)), M['print'],
                         FONT_REG, spacing=1.08))
    af = lathe('af_lamp', [(2.4, 0, I['paint']), (2.4, 0.3, I['paint']), (1.9, 0.3, I['glass']), (0, 0.45, I['glass'])], 32, mats)
    xform(af, tr(-22.5, 0, 59.0) @ rot('X', 90))
    parts.append(af)

    # -- back: vari-angle LCD + hinge, buttons
    lcd = box('lcd', -37.5, 52.5, D - 0.5, D + 4.0, 3.8, 52.0, mats, bevel=1.6, seg=3)
    assign(lcd, 'black')
    parts.append(lcd)
    scr = box('screen', -30.0, 47.5, D + 3.95, D + 4.15, 6.0, 49.6, mats)
    assign(scr, 'screen')
    parts.append(scr)
    hinge = lathe('hinge', [(2.0, 0, I['black']), (2.0, 44.0, I['black'])], 24, mats, cap0=True, cap1=True)
    xform(hinge, tr(54.5, D + 2.0, 6.0))
    parts.append(hinge)
    BK = lambda x, z, y: frame((x, y, z), (-1, 0, 0), (0, 1, 0))

    def bbtn(name, r, x, z, depth=1.4, label=None, ls=1.2, y0=D - 0.4):
        b_ = lathe(name, [(r, 0, I['black']), (r, depth - 0.3, I['black']), (r - 0.3, depth, I['black']),
                          (0, depth, I['black'])], 32, mats)
        xform(b_, tr(x, y0, z) @ rot('X', -90))
        smooth(b_, 40)
        parts.append(b_)
        if label:
            parts.append(text_on('t_' + name, label, ls, BK(x, z, y0 + depth), M['print'], FONT_BOLD))
    # top-plate back face buttons
    bbtn('delete', 3.0, 51.0, 58.4)
    bbtn('play', 3.0, 40.0, 58.4)
    bbtn('q', 3.1, -22.0, 58.0)
    bbtn('ael', 3.1, -33.0, 58.0)
    # back grip column: focus lever, MENU/OK, DISP/BACK
    fl = lathe('focus_lever', [(3.2, 0, I['black']), (3.2, 2.0, I['black']), (1.2, 2.4, I['black']), (1.2, 4.6, I['black']),
                               (2.4, 5.0, I['black']), (2.4, 6.2, I['black']), (0, 6.4, I['black'])], 32, mats)
    xform(fl, tr(-49.5, D + 3.4, 23.5) @ rot('X', -90))
    smooth(fl, 40)
    parts.append(fl)
    bbtn('menu_ok', 3.6, -49.5, 13.0, depth=1.2, label='MENU\nOK', ls=1.0, y0=D + 3.6)
    bbtn('disp_back', 3.6, -49.5, 5.8, depth=1.2, label='DISP\nBACK', ls=1.0, y0=D + 3.6)

    # -- strap lugs (triangular eyelets at top plate level)
    for sx in (1, -1):
        lug = prism('lug', [(0, -3.2), (4.2, 0.0), (0, 3.2)], -1.0, 1.0, mats)
        xform(lug, tr(sx * HW, 10.0, 54.5) @ rot('X', 90) @ sc(sx, 1, 1))
        fix_normals(lug)
        add_bevel(lug, 0.5, 2, 30)
        assign(lug, 'chrome')
        parts.append(lug)

    # -- port cover on +X side, tripod socket
    door = loft('port', [[(HW - 0.4, y, z) for y, z in rrect(14.0, 26.0, 2.0, 4, 15.5, 30.0)],
                         [(HW + 0.25, y, z) for y, z in rrect(14.0, 26.0, 2.0, 4, 15.5, 30.0)]], mats)
    add_bevel(door, 0.15, 1, 30)
    assign(door, 'rubber')
    parts.append(door)
    tri_ = lathe('tripod', [(4.8, 0.03, I['chrome']), (3.2, 0.03, I['chrome']), (3.2, 0.05, I['dark']), (0, 0.05, I['dark'])], 32, mats)
    xform(tri_, tr(MX, 16.0, 0) @ sc(1, 1, -1))
    fix_normals(tri_)
    parts.append(tri_)
    return parts


def lens_materials():
    L = {}
    L['barrel'] = mat('xc1545_barrel', (0.025, 0.025, 0.027), 0.0, 0.4)
    L['ring'] = mat('xc1545_zoom_ring', (0.02, 0.02, 0.022), 0.0, 0.5)
    L['mount'] = mat('xc1545_mount', (0.03, 0.03, 0.032), 0.0, 0.35)
    L['glass'] = mat('xc1545_glass', (1, 1, 1), 1.0, 0.06, coat=1.0, coat_rough=0.02,
                     base_tex=load_img(os.path.join(TEX, 'lens_glass.png')))
    L['print'] = mat('xc1545_print', (0.86, 0.86, 0.84), 0.0, 0.5)
    L['front'] = mat('xc1545_front_ring', (1, 1, 1), 0.0, 0.6, base_tex=load_img(os.path.join(TEX, 'xc_front.png')))
    L['matte'] = mat('xc1545_inner', (0.01, 0.01, 0.011), 0.0, 0.85)
    L['red'] = mat('xc1545_index', (0.8, 0.05, 0.04), 0.0, 0.5)
    L['contacts'] = mat('xc1545_contacts', (0.9, 0.68, 0.32), 1.0, 0.25)
    return L


def lens(L):
    mats = [L['barrel'], L['ring'], L['mount'], L['glass'], L['print'], L['front'], L['matte'], L['red'], L['contacts']]
    B, RG, MO, GL, PR, FR, MA, RD, CO = range(9)
    parts = []
    RIBS = 160

    def ribs(t, k, r, z):
        if prof[k][2] == RG and r >= 31.25:
            i = int(round(t / TAU * RIBS * 4)) % 4
            return r - (0.3 if i >= 2 else 0.0)
        return r
    prof = [(19.5, -6.5, MA), (21.0, -6.5, MO), (21.0, -1.0, MO), (26.6, -1.0, MO), (26.6, 0.0, MO),
            (28.8, 0.0, B), (29.6, 0.8, B), (29.6, 21.2, B), (30.3, 21.6, B),
            (30.6, 22.0, RG), (31.3, 22.6, RG), (31.3, 37.4, RG), (30.6, 38.0, RG),
            (30.5, 38.3, B), (30.5, 43.2, B), (29.9, 44.2, B), (27.0, 44.2, MA), (26.2, 43.6, MA), (26.2, 43.0, MA)]
    barrel = lathe('xc_barrel', prof, RIBS * 4, mats, rmod=ribs)
    smooth(barrel, 32)
    parts.append(barrel)
    fr = lathe('xc_front', [(26.2, 43.0, FR), (23.2, 41.3, FR), (22.7, 41.0, MA), (22.7, 40.0, MA)], 128, mats)
    RT = 30.5
    me = fr.data
    uv = me.uv_layers.active.data
    for p in me.polygons:
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv[li].uv = (0.5 + co.x / (2 * RT), 0.5 + co.y / (2 * RT))
    smooth(fr, 40)
    parts.append(fr)
    n = 10
    dome = [(22.7 * math.cos(a), 40.1 + 2.2 * math.sin(a), GL) for a in [math.pi / 2 * i / n for i in range(n + 1)]]
    dome[-1] = (0.0, dome[-1][1], GL)
    ge = lathe('xc_glass', dome, 72, mats)
    me = ge.data
    uv = me.uv_layers.active.data
    for p in me.polygons:
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv[li].uv = (0.5 + co.x / (2 * 22.7), 0.5 + co.y / (2 * 22.7))
    smooth(ge, 60)
    parts.append(ge)
    rear = lathe('xc_rear', [(19.5, -6.5, MA), (15.0, -4.5, MA), (14.0, -4.5, GL), (0.0, -5.6, GL)], 48, mats)
    smooth(rear, 50)
    parts.append(rear)
    for a0, a1 in ((25, 75), (145, 195), (265, 315)):
        segs = [math.radians(a0 + (a1 - a0) * k / 10) for k in range(11)]
        bm = bmesh.new()
        rows = [[bm.verts.new((r_ * math.cos(a), r_ * math.sin(a), z_)) for a in segs]
                for (r_, z_) in ((21.0, -2.0), (24.2, -2.0), (24.2, -3.6), (21.0, -3.6))]
        for k in range(4):
            for i in range(10):
                bm.faces.new((rows[k][i], rows[k][i + 1], rows[(k + 1) % 4][i + 1], rows[(k + 1) % 4][i]))
        bm.faces.new([rows[k][0] for k in range(4)])
        bm.faces.new([rows[k][-1] for k in reversed(range(4))])
        tab = new_obj('xc_tab', bm, mats)
        fix_normals(tab)
        mat_by(tab, lambda c, n_, i: MO)
        parts.append(tab)
    for k in range(10):
        a = math.radians(-90 - 28 + 56 * k / 9)
        c_ = box('xc_contact', -0.5, 0.5, -0.6, 0.6, 0, 0.25, mats)
        xform(c_, tr(19.8 * math.cos(a), 19.8 * math.sin(a), -1.05) @ rot('Z', math.degrees(a)) @ rot('X', 180))
        mat_by(c_, lambda c, n_, i: CO)
        parts.append(c_)
    P = L['print']
    parts.append(wrap_text('t_1545', '15-45', 3.2, 29.6, math.radians(90), 12.0, P, along_axis=True, font=FONT_REG))
    dot = lathe('xc_dot', [(0.8, 0, RD), (0.0, 0, RD)], 16, mats)
    xform(dot, tr(0, 29.65, 3.0) @ rot('X', -90))
    parts.append(dot)
    parts.append(wrap_text('t_ois', 'OIS', 2.0, 29.6, math.radians(150), 9.0, P, font=FONT_REG))
    return parts


def build():
    reset()
    M = materials()
    parts = body(M)
    lparts = lens(lens_materials())
    for p in lparts:
        xform(p, tr(MX, FLANGE_Y, MZ) @ rot('X', 90))
    cam = join(parts, 'xt200')
    ln = join(lparts, 'xc1545')
    for o in (cam, ln):
        bm = bmesh.new(); bm.from_mesh(o.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
        bm.to_mesh(o.data); bm.free()
    root, off, size = finalize([cam, ln], root_name='xt200_kit', pivots={'xc1545': (MX, FLANGE_Y, MZ)})
    objs = handles(root, [cam, ln])
    print('SIZE m', tuple(round(v, 4) for v in size), 'TRIS', stats([cam, ln]), 'cam', stats([cam]), 'lens', stats([ln]))
    return objs, cam, ln, size


if __name__ == '__main__':
    objs, cam, ln, size = build()
    if '--export' in ARGS:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE_, 'xt200.blend'))
        export_glb(os.path.join(SCRATCH, 'raw', 'xt200.glb'), objs)
    if '--render' in ARGS:
        studio()
        c = Vector((0, 0, size.z / 2))
        rad = size.length / 2
        render_views('xt200', c, rad, [
            ('hero', (0.75, -1, 0.42), 60, None),
            ('back34', (-0.7, 1, 0.5), 60, None),
            ('front', (0, -1, 0.02), None, 0.15),
            ('top', (0.0, -0.25, 1), 60, None),
            ('ref_a', (-0.3, -1, 0.55), 60, None),
            ('ref_e', (0.0, 1, 0.12), 60, None),
        ], res=(900, 680), samples=24)
