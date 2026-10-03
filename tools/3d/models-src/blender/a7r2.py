# Sony A7R II + Tamron 17-70mm F/2.8 Di III-A VC RXD (B070), Sony E.
# Run: blender -b --factory-startup -P a7r2.py -- [--render] [--export]
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib, common
importlib.reload(common)
from common import *
import bmesh
from mathutils import Vector, Matrix

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []

# ---- key dimensions (mm). X: grip at -X; front faces -Y; Z up; body front face y=0.
W = 126.9
HW = W / 2
BACK = 36.0          # back plate
SH = 74.0            # shoulder (top plate) height
MX, MZ = 13.7, 40.8  # lens mount / EVF centre
FLANGE_Y = -3.5      # camera mount flange plane
GRIP_FRONT = -20.8   # grip front (60.3 mm depth to LCD at y=39.5)
HUMP_TOP = 92.0
GRIP_TOP_FRONT = 70.0



def materials():
    leather = tex_leather('leather_n', 1024, cells=26, seed=3, strength=5.0)
    grain = tex_grain('grain_fine_n', 512, sigma=1.3, strength=0.9)
    knurl = tex_knurl('knurl_diamond_n', 512, n=24, strength=6.0, diamond=True)
    M = {}
    M['body'] = mat('a7r2_body', (0.019, 0.019, 0.021), 0.0, 0.55, normal=grain, nstr=0.35)
    M['leather'] = mat('a7r2_leather', (0.017, 0.017, 0.018), 0.0, 0.6, normal=leather, nstr=1.0)
    M['rubber'] = mat('a7r2_rubber', (0.018, 0.018, 0.019), 0.0, 0.78)
    M['button'] = mat('a7r2_button', (0.03, 0.03, 0.032), 0.0, 0.38)
    M['metal'] = mat('a7r2_metal', (0.50, 0.50, 0.52), 1.0, 0.36)
    M['orange'] = mat('a7r2_mount_ring', (0.85, 0.24, 0.05), 0.6, 0.38)
    M['screen'] = mat('a7r2_screen', (0.006, 0.007, 0.009), 0.0, 0.04, coat=1.0, coat_rough=0.02)
    M['print'] = mat('a7r2_print', (0.82, 0.82, 0.80), 0.0, 0.45)
    M['red'] = mat('a7r2_print_red', (0.75, 0.04, 0.04), 0.0, 0.45)
    M['knurl'] = mat('a7r2_dial', (0.035, 0.035, 0.037), 0.3, 0.42, normal=knurl, nstr=1.0)
    M['dark'] = mat('a7r2_cavity', (0.008, 0.008, 0.009), 0.0, 0.7)
    M['sensor'] = mat('a7r2_sensor', (0.05, 0.06, 0.10), 0.7, 0.08)
    M['gold'] = mat('a7r2_contacts', (0.85, 0.65, 0.3), 1.0, 0.25)
    M['expdial'] = mat('a7r2_exp_dial_top', (1, 1, 1), 0.0, 0.45,
                       base_tex=load_img(os.path.join(TEX, 'a7_expdial.png')))
    M['modedial'] = mat('a7r2_mode_dial_top', (1, 1, 1), 0.0, 0.45,
                        base_tex=load_img(os.path.join(TEX, 'a7_modedial.png')))
    M['evf'] = mat('a7r2_evf_glass', (0.01, 0.012, 0.016), 0.0, 0.05, coat=1.0)
    return M





def body(M):
    mats = [M['body'], M['leather'], M['rubber'], M['button'], M['metal'], M['orange'], M['screen'],
            M['print'], M['red'], M['knurl'], M['dark'], M['sensor'], M['gold'], M['expdial'],
            M['modedial'], M['evf']]
    idx = {k: i for i, k in enumerate(['body', 'leather', 'rubber', 'button', 'metal', 'orange', 'screen',
                                        'print', 'red', 'knurl', 'dark', 'sensor', 'gold', 'expdial',
                                        'modedial', 'evf'])}
    parts = []

    # -- main shell (top view outline, rounded right corners; left end hidden by grip)
    outline = []
    outline += [(x, y) for x, y in rrect(W, BACK, 5.5, 8, 0, BACK / 2)]
    shell = prism('shell', outline, 0, SH, mats)
    add_bevel(shell, 2.6, 4, 40)
    parts.append(shell)

    # -- grip: top-view curve extruded, top sloping toward the front
    gp = [(-27.0, 6.0), (-27.6, -6.0), (-30.0, -13.5), (-35.5, -18.8), (-44.0, -20.8), (-53.0, -20.3),
          (-59.5, -16.8), (-62.9, -10.5), (-HW, -3.0), (-HW, 6.0), (-HW, 18.0)]
    curve = catmull(gp, 5)
    curve += [(-40.0, 18.0)]
    curve = list(reversed(curve))  # make CCW
    grip = prism('grip', curve, 0, SH, mats)
    bm = bmesh.new()
    bm.from_mesh(grip.data)
    for v in bm.verts:
        if v.co.z > SH - 1:
            y = v.co.y
            v.co.z = min(SH, GRIP_TOP_FRONT + (y - GRIP_FRONT) / (0 - GRIP_FRONT) * (SH - GRIP_TOP_FRONT))
    bm.to_mesh(grip.data)
    bm.free()
    add_bevel(grip, 4.0, 5, 30)
    parts.append(grip)

    # -- EVF hump (loft of rounded rects)
    def hloop(z, w, y0, y1, r):
        return [(MX + x, y, z) for x, y in rrect(w, y1 - y0, r, 6, 0, (y0 + y1) / 2)]
    hump = loft('hump', [hloop(64, 48.6, -2.8, BACK - 0.5, 3.0), hloop(SH, 48.6, -2.8, BACK - 0.5, 3.0),
                         hloop(HUMP_TOP, 35.5, 9.0, BACK - 0.5, 2.5)], mats)
    add_bevel(hump, 2.2, 4, 30)
    parts.append(hump)

    # -- eyepiece block + rubber eyecup with recessed window
    ep = slab_xz('eyepiece', [(MX + x, z) for x, z in rrect(40, 31, 5, 6, 0, 72.5)], BACK - 1, BACK + 1.8, mats)
    add_bevel(ep, 1.0, 2, 30)
    parts.append(ep)
    cup_outer = [(MX + x, z) for x, z in rrect(45, 30, 7.5, 8, 0, 72.0)]
    cup_inner = [(MX + x, z) for x, z in rrect(26, 19, 3, 6, 0, 73.0)]
    loops = []
    for (yy, sc_) in ((BACK - 1, 0.96), (BACK + 3.0, 1.0), (BACK + 9.5, 1.0), (BACK + 11.5, 0.97)):
        loops.append([(MX + (x - MX) * sc_, yy, 72.0 + (z - 72.0) * sc_) for x, z in cup_outer])
    cup = loft('eyecup', loops, mats, cap0=True, cap1=True)
    add_bevel(cup, 1.6, 3, 30)
    win = loft('eyecup_hole', [[(x, BACK + 5.0, z) for x, z in cup_inner], [(x, BACK + 13, z) for x, z in cup_inner]],
               mats)
    boolean(cup, win)
    mat_by(cup, lambda c, n, i: idx['rubber'])
    parts.append(cup)
    glass = prism('evf_glass', [(x, z) for x, z in cup_inner], 0, 0.2, mats)
    xform(glass, Matrix(((1, 0, 0, 0), (0, 0, 1, BACK + 5.2), (0, 1, 0, 0), (0, 0, 0, 1))))
    fix_normals(glass)
    mat_by(glass, lambda c, n, i: idx['evf'])
    parts.append(glass)

    # -- material assignment on shell / grip
    def shell_mat(c, n, i):
        if c.x < -60.5 and 5 < c.z < 60 and abs(n.x) > 0.5:
            return idx['leather']
        return idx['body']
    mat_by(shell, shell_mat)

    def grip_mat(c, n, i):
        if n.z < -0.6 or c.z > 56.5 or c.z < 3.0:
            return idx['body']
        if c.y > 17.5:
            return idx['body']
        return idx['leather']
    mat_by(grip, grip_mat)
    mat_by(hump, lambda c, n, i: idx['body'])

    # -- thumb rest pad on back of grip (leather)
    tp = catmull([(-37.5, 62), (-38.5, 44), (-37.5, 31), (-41, 24.5), (-50, 17), (-53, 9), (-53.5, 5.5),
                  (-62.4, 5.5), (-62.4, 62)], 4, closed=True)
    pad = slab_xz('thumb', tp, BACK - 1.0, BACK + 1.3, mats)
    add_bevel(pad, 0.8, 3, 30)
    mat_by(pad, lambda c, n, i: idx['leather'] if n.y > 0.3 else idx['body'])
    parts.append(pad)
    for p in (shell, grip, hump, pad, ep):
        uv_box(p, 1 / 25.0)
        smooth(p, 33)

    # -- lens mount: orange ring, metal flange, throat, sensor
    M_MOUNT = tr(MX, 0, MZ) @ rot('X', 90)
    cut = lathe('throat_cut', [(23.0, -14.0), (23.0, 6.0)], 64, mats, cap0=True, cap1=True)
    xform(cut, M_MOUNT)
    boolean(shell, cut)
    mount = lathe('mount', [
        (31.6, -0.8, idx['orange']), (31.6, 0.9, idx['orange']), (31.1, 1.25, idx['orange']),
        (29.9, 1.25, idx['metal']), (29.9, 3.2, idx['metal']), (29.5, -FLANGE_Y, idx['metal']),
        (24.0, -FLANGE_Y, idx['metal']), (23.2, 2.9, idx['metal']), (23.0, 2.0, idx['dark']),
        (23.0, -13.8, idx['dark']), (0.0, -13.8, idx['dark'])], 128, mats)
    xform(mount, M_MOUNT)
    smooth(mount, 40)
    parts.append(mount)
    sensor = box('sensor', -18, 18, 0, 0.3, -12, 12, mats)
    xform(sensor, tr(MX, 13.4, MZ))
    mat_by(sensor, lambda c, n, i: idx['sensor'])
    parts.append(sensor)
    for k in range(4):
        a_ = math.radians(45 + 90 * k)
        scw = lathe('screw', [(1.05, 0, idx['metal']), (1.05, 0.25, idx['metal']), (0.0, 0.45, idx['metal'])], 16, mats)
        xform(scw, M_MOUNT @ tr(26.7 * math.cos(a_), 26.7 * math.sin(a_), -FLANGE_Y))
        parts.append(scw)
    for k in range(10):
        a_ = math.radians(-90 - 36 + 72 * k / 9)
        c_ = box('contact', -0.6, 0.6, -0.8, 0.8, 0, 0.3, mats)
        xform(c_, M_MOUNT @ tr(21.0 * math.cos(a_), 21.0 * math.sin(a_), -2.0) @ rot('Z', math.degrees(a_)))
        mat_by(c_, lambda c, n, i: idx['gold'])
        parts.append(c_)

    # -- lens release button (front, lower-left of mount)
    ang = math.radians(212)
    bx, bz = MX + 35.0 * math.cos(ang), MZ + 35.0 * math.sin(ang)
    rel = slab_xz('release', [(x, z) for x, z in rrect(10.5, 6.2, 3.0, 6)], 0, -1.8, mats)
    xform(rel, tr(bx, 0, bz) @ rot('Y', 58))
    add_bevel(rel, 0.6, 2, 30)
    mat_by(rel, lambda c, n, i: idx['button'])
    parts.append(rel)

    # -- AF illuminator, remote sensor
    af = lathe('af_lamp', [(2.2, 0, idx['body']), (2.2, 0.3, idx['body']), (1.7, 0.3, idx['evf']), (0, 0.45, idx['evf'])], 32, mats)
    xform(af, tr(-20.8, 0, 68.6) @ rot('X', 90))
    parts.append(af)
    rs = slab_xz('remote', rrect(3.4, 9.0, 1.7, 6, -47.5, 32.0), -21.4, -19.0, mats)
    mat_by(rs, lambda c, n, i: idx['evf'])
    parts.append(rs)

    # -- front control dial (in the grip, vertical axis)
    fd = ribbed_disc('front_dial', 8.6, -2.2, 2.2, 40, 0.5, [M['button']], top_mat=0, side_mat=0)
    xform(fd, tr(-47.5, -13.8, 60.2))
    parts.append(fd)

    # -- mode dial, exposure dial, C1/C2
    md = ribbed_disc('mode_dial', 9.5, 0.0, 6.8, 64, 0.35, [M['modedial'], M['knurl']], top_mat=0, side_mat=1)
    uv_side(md, 64 / 24.0, 1 / 1.2)
    xform(md, tr(-21.5, 14.0, SH - 0.5))
    parts.append(md)
    ed = ribbed_disc('exp_dial', 8.8, 0.0, 5.2, 72, 0.3, [M['expdial'], M['button']], top_mat=0, side_mat=1)
    xform(ed, tr(-50.0, 23.0, SH - 0.5))
    parts.append(ed)
    for lab, x in (('C1', -44.0), ('C2', -31.5)):
        b_ = lathe('btn_' + lab, [(2.9, 0, idx['button']), (2.9, 1.0, idx['button']), (2.6, 1.3, idx['button']),
                                  (0, 1.3, idx['button'])], 32, mats)
        xform(b_, tr(x, 4.5, SH - 0.3))
        smooth(b_, 40)
        parts.append(b_)
        parts.append(text_on('t_' + lab, lab, 2.4, tr(x, 4.5, SH + 1.0) @ rot('Z', 180), M['print'], FONT_BOLD))

    # -- shutter button + power switch on grip slope
    alpha = math.degrees(math.atan2(SH - GRIP_TOP_FRONT, -GRIP_FRONT))
    sy = -8.6
    sz = GRIP_TOP_FRONT + (sy - GRIP_FRONT) / (-GRIP_FRONT) * (SH - GRIP_TOP_FRONT)
    SM = tr(-41.0, sy, sz) @ rot('X', alpha)
    ring = lathe('power_ring', [(4.9, -1, idx['button']), (7.2, -1, idx['button']), (7.2, 1.0, idx['button']),
                                (6.9, 1.6, idx['button']), (4.9, 1.6, idx['button'])], 64, mats, cap0=False)
    xform(ring, SM)
    smooth(ring, 40)
    parts.append(ring)
    lever = box('power_lever', -2.2, 2.2, 0, 6.0, -1.0, 1.4, mats, bevel=0.6, seg=2)
    xform(lever, SM @ rot('Z', 140) @ tr(0, 5.5, 0))
    mat_by(lever, lambda c, n, i: idx['button'])
    parts.append(lever)
    sb = lathe('shutter', [(4.5, 0, idx['button']), (4.5, 2.4, idx['metal']), (4.1, 2.8, idx['metal']),
                           (2.0, 2.6, idx['metal']), (0, 2.55, idx['metal'])], 64, mats)
    xform(sb, SM)
    smooth(sb, 40)
    parts.append(sb)
    parts.append(text_on('t_onoff', 'ON', 1.9, SM @ tr(-6.5, 6.5, 0.05) @ rot('Z', 180), M['print'], FONT_BOLD))
    parts.append(text_on('t_onoff2', 'OFF', 1.9, SM @ tr(-8.0, 1.5, 0.05) @ rot('Z', 180), M['print'], FONT_BOLD))

    # -- hot shoe (Multi Interface)
    HS = tr(MX, 22.5, HUMP_TOP - 0.2)
    shoe = [box('shoe_base', -11.5, 11.5, -10.5, 10.5, 0, 0.9, mats, bevel=0.3, seg=1)]
    for sx in (-1, 1):
        shoe.append(box('shoe_wall', sx * 9.0 - 0.45, sx * 9.0 + 0.45, -10.5, 10.5, 0, 3.9, mats))
        x0, x1 = sorted((sx * 9.0, sx * 6.9))
        shoe.append(box('shoe_lip', x0, x1, -10.5, 10.5, 3.2, 3.9, mats))
    blk = box('shoe_block', -6.0, 6.0, -10.5, -6.0, 0.5, 2.6, mats, bevel=0.3, seg=1)
    mat_by(blk, lambda c, n, i: idx['button'])
    for s_ in shoe:
        xform(s_, HS)
        mat_by(s_, lambda c, n, i: idx['metal'])
        parts.append(s_)
    xform(blk, HS)
    parts.append(blk)
    for k in range(6):
        pin = box('shoe_pin', -4.6 + k * 1.84 - 0.35, -4.6 + k * 1.84 + 0.35, -10.6, -9.2, 1.2, 1.9, mats)
        xform(pin, HS)
        mat_by(pin, lambda c, n, i: idx['gold'])
        parts.append(pin)

    # -- printed front text
    nf = Vector((0, -18.0, 11.8)).normalized()
    parts.append(text_on('t_sony', 'SONY', 7.6, frame((MX, 3.1, 83.0), (1, 0, 0), nf), M['print'], FONT_BOLD,
                         spacing=1.05, lift=0.05))
    ITAL = '/System/Library/Fonts/Supplemental/Arial Bold Italic.ttf'
    parts.append(text_on('t_alpha', 'α', 10.5, frame((48.5, -0.02, 66.0), (1, 0, 0), (0, -1, 0)), M['print'], ITAL))
    badge = slab_xz('badge', rrect(12.0, 5.6, 1.0, 4, 50.5, 58.6), 0.0, -0.5, mats)
    mat_by(badge, lambda c, n, i: idx['screen'])
    parts.append(badge)
    parts.append(text_on('t_7', '7', 4.6, frame((48.0, -0.52, 58.6), (1, 0, 0), (0, -1, 0)), M['print'], FONT_BOLD))
    parts.append(text_on('t_R', 'R', 4.6, frame((51.6, -0.52, 58.6), (1, 0, 0), (0, -1, 0)), M['red'], FONT_BOLD))
    parts.append(text_on('t_emount', 'E-mount', 2.0, M_MOUNT @ tr(0, 26.5, -FLANGE_Y + 0.02), M['print'], FONT_REG))

    # -- back: LCD module, buttons, labels
    lcd = box('lcd', -20.5, 55.5, BACK - 0.6, BACK + 3.0, 2.2, 52.5, mats, bevel=1.4, seg=3)
    mat_by(lcd, lambda c, n, i: idx['button'])
    parts.append(lcd)
    scr = box('screen', -14.2, 49.2, BACK + 2.95, BACK + 3.15, 8.0, 49.5, mats)
    mat_by(scr, lambda c, n, i: idx['screen'])
    parts.append(scr)
    BK = lambda x, z, y=BACK + 0.0: frame((x, y, z), (-1, 0, 0), (0, 1, 0))
    parts.append(text_on('t_sony_b', 'SONY', 3.2, BK(17.5, 4.6, BACK + 3.1), M['print'], FONT_BOLD))

    def back_btn(name, w, h, r, x, z, depth=1.2, mat_='button', label=None, lsize=1.8):
        b_ = slab_xz(name, rrect(w, h, r, 6, x, z), BACK - 0.3, BACK + depth, mats)
        add_bevel(b_, min(0.5, r * 0.4), 2, 30)
        mat_by(b_, lambda c, n, i: idx[mat_])
        smooth(b_, 40)
        parts.append(b_)
        if label:
            parts.append(text_on('t_' + name, label, lsize, BK(x, z, BACK + depth), M['print'], FONT_BOLD))
    back_btn('menu', 8.6, 4.6, 2.2, 42.8, 59.2, label='MENU', lsize=1.5)
    back_btn('c3', 7.0, 4.6, 2.2, -15.8, 58.6, label='C3', lsize=2.0)
    back_btn('fn', 6.8, 6.8, 3.39, -26.4, 35.0, label='Fn', lsize=2.4)
    back_btn('play', 6.2, 6.0, 2.0, -26.6, 7.4)
    back_btn('trash', 6.2, 6.0, 2.0, -38.0, 7.4)
    back_btn('ael', 8.6, 8.6, 4.29, -28.2, 48.4, depth=2.2)
    lev = lathe('afmf_lever', [(4.6, 0, idx['button']), (6.6, 0, idx['button']), (6.6, 1.0, idx['button']),
                               (4.6, 1.0, idx['button'])], 48, mats)
    xform(lev, tr(-28.2, BACK + 0.2, 48.4) @ rot('X', -90))
    parts.append(lev)
    tab = box('afmf_tab', 5.5, 9.5, 0, 1.0, -1.6, 1.6, mats, bevel=0.4, seg=2)
    xform(tab, tr(-28.2, BACK + 0.2, 48.4) @ rot('Y', -15))
    mat_by(tab, lambda c, n, i: idx['button'])
    parts.append(tab)
    cw = ribbed_disc('ctrl_wheel', 7.9, 0, 1.7, 48, 0.35, [M['button']], top_mat=0, side_mat=0)
    xform(cw, tr(-34.5, BACK - 0.2, 21.4) @ rot('X', -90))
    parts.append(cw)
    back_btn('ctrl_center', 8.0, 8.0, 3.99, -34.5, 21.4, depth=2.4)
    for lab, x, z, s_ in (('AF/MF', -26.0, 56.4, 1.6), ('AEL', -20.5, 41.2, 1.6), ('DISP', -34.5, 31.2, 1.7),
                          ('ISO', -46.0, 21.4, 1.7), ('C4', -45.5, 11.0, 1.7)):
        parts.append(text_on('t_' + lab, lab, s_, BK(x, z, BACK + 0.05), M['print'], FONT_BOLD))
    # rear dial (top-back, horizontal wheel)
    rd = ribbed_disc('rear_dial', 7.2, -2.0, 2.0, 36, 0.5, [M['button']], top_mat=0, side_mat=0)
    xform(rd, tr(-33.0, 31.4, 65.5))
    parts.append(rd)
    # movie button on grip corner
    mv = lathe('movie', [(2.6, 0, idx['button']), (2.6, 1.0, idx['button']), (2.3, 1.2, idx['red']),
                         (0, 1.2, idx['red'])], 32, mats)
    d_ = Vector((-1, 1.1, 0)).normalized()
    xform(mv, frame((-62.2, 36.6, 49.0), (0, 0, 1), d_))
    parts.append(mv)

    # -- top printed text (read from behind)
    TOP = lambda x, y: frame((x, y, SH + 0.02), (-1, 0, 0), (0, 0, 1))
    parts.append(text_on('t_steady', 'SteadyShot INSIDE', 1.9, TOP(46.0, 31.0), M['print'], FONT_REG))
    parts.append(text_on('t_4k', '4K', 2.4, TOP(53.5, 25.5), M['print'], FONT_BOLD))
    fp = lathe('fp_mark', [(1.2, 0, idx['print']), (0.8, 0, idx['print'])], 24, mats)
    xform(fp, tr(31.0, 30.5, SH + 0.03))
    parts.append(fp)
    fpl = box('fp_line', 27.0, 35.0, 30.35, 30.65, SH + 0.02, SH + 0.05, mats)
    mat_by(fpl, lambda c, n, i: idx['print'])
    parts.append(fpl)

    # -- strap lugs
    for sx, ly in ((1, 28.0), (-1, 12.0)):
        lug = box('lug', 0, 3.2, -3.0, 3.0, -3.5, 3.5, mats, bevel=1.0, seg=2)
        xform(lug, tr(sx * HW, ly, 64.5) @ sc(sx, 1, 1))
        fix_normals(lug)
        mat_by(lug, lambda c, n, i: idx['metal'])
        parts.append(lug)
        tor = lathe('ring', [(3.2 + 0.65 * math.cos(t), 0.65 * math.sin(t)) for t in
                             [TAU * k / 10 for k in range(11)]], 24, mats)
        mat_by(tor, lambda c, n, i: idx['metal'])
        xform(tor, tr(sx * (HW + 3.0), ly, 60.0) @ rot('X', 90) @ rot('Y', 20 * sx))
        smooth(tor, 60)
        parts.append(tor)

    # -- port doors on +X side
    for z0, z1 in ((36.0, 58.0), (10.0, 33.0)):
        door = loft('port', [[(HW - 0.4, y, z) for y, z in rrect(24.0, z1 - z0, 2.0, 4, 18.5, (z0 + z1) / 2)],
                             [(HW + 0.18, y, z) for y, z in rrect(24.0, z1 - z0, 2.0, 4, 18.5, (z0 + z1) / 2)]], mats)
        add_bevel(door, 0.12, 1, 30)
        mat_by(door, lambda c, n, i: idx['rubber'])
        parts.append(door)

    # -- tripod socket
    tri_ = lathe('tripod', [(5.0, 0.03, idx['metal']), (3.3, 0.03, idx['metal']), (3.3, 0.05, idx['dark']),
                            (0, 0.05, idx['dark'])], 32, mats)
    xform(tri_, tr(MX, 18.0, 0) @ sc(1, 1, -1))
    fix_normals(tri_)
    parts.append(tri_)

    return parts, mats, idx



LENS_LEN = 119.3


def lens_materials():
    L = {}
    L['barrel'] = mat('tamron_barrel', (0.022, 0.022, 0.024), 0.0, 0.34)
    L['rubber'] = mat('tamron_rubber', (0.016, 0.016, 0.017), 0.0, 0.72)
    L['gold'] = mat('tamron_gold_ring', (0.78, 0.66, 0.46), 1.0, 0.3)
    L['mount'] = mat('tamron_mount', (0.86, 0.86, 0.87), 1.0, 0.16)
    L['glass'] = mat('tamron_glass', (1, 1, 1), 1.0, 0.06, coat=1.0, coat_rough=0.02,
                     base_tex=load_img(os.path.join(TEX, 'lens_glass.png')))
    L['print'] = mat('tamron_print', (0.85, 0.85, 0.83), 0.0, 0.5)
    L['front'] = mat('tamron_front_ring', (1, 1, 1), 0.0, 0.6,
                     base_tex=load_img(os.path.join(TEX, 'tamron_front.png')))
    L['matte'] = mat('tamron_inner', (0.01, 0.01, 0.011), 0.0, 0.85)
    L['contacts'] = mat('tamron_contacts', (0.9, 0.68, 0.32), 1.0, 0.25)
    return L



def lens(L):
    mats = [L['barrel'], L['rubber'], L['gold'], L['mount'], L['glass'], L['print'], L['front'], L['matte'],
            L['contacts']]
    B, RU, GO, MO, GL, PR, FR, MA, CO = range(9)
    parts = []
    RIBS = 90

    def ribs(t, k, r, z):
        if r >= 36.95 and prof[k][2] == RU:
            i = int(round(t / TAU * RIBS * 4)) % 4
            return r - (0.55 if i >= 2 else 0.0)
        return r
    prof = [
        (21.6, -7.6, MA), (22.4, -7.6, MA), (22.4, -1.2, MO), (27.0, -1.2, MO), (27.4, -0.6, MO), (27.4, 0.0, MO),
        (29.6, 0.0, GO), (30.3, 0.5, GO), (30.3, 3.4, GO),
        (30.5, 3.6, B), (30.5, 12.6, B), (31.4, 14.2, B), (33.4, 16.3, B), (35.4, 18.2, B), (36.5, 19.8, B),
        (36.8, 21.4, B), (36.8, 41.9, B),
        (36.4, 42.1, RU), (37.05, 42.8, RU), (37.05, 55.6, RU), (36.4, 56.3, RU),
        (36.4, 56.5, B), (36.6, 56.6, B), (36.6, 65.0, B), (36.2, 65.2, B),
        (36.2, 65.3, B), (36.4, 65.4, B), (36.4, 71.5, B), (36.6, 71.7, RU),
        (37.3, 72.5, RU), (37.3, 103.6, RU), (36.6, 104.4, RU),
        (35.5, 104.6, B), (35.5, 106.6, B), (36.8, 106.9, B), (36.9, 117.2, B), (37.3, 117.6, B),
        (37.3, 118.9, B), (36.9, 119.3, B), (33.9, 119.3, MA), (33.6, 118.8, MA), (33.6, 115.6, MA),
    ]
    barrel = lathe('tamron_barrel', prof, RIBS * 4, mats, rmod=ribs)
    smooth(barrel, 32)
    parts.append(barrel)
    # sloped front name ring (planar UV texture) + inner retaining ring
    fr = lathe('tamron_front', [(33.6, 115.6, FR), (29.4, 113.2, FR), (29.0, 112.8, MA), (29.0, 110.5, MA)],
               128, mats)
    RT = 36.3
    me = fr.data
    uv = me.uv_layers.active.data
    for p in me.polygons:
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv[li].uv = (0.5 + co.x / (2 * RT), 0.5 + co.y / (2 * RT))
    smooth(fr, 40)
    parts.append(fr)
    # front element: convex dome
    n = 12
    dome = [(28.9 * math.cos(a), 110.6 + 3.4 * math.sin(a), GL) for a in [math.pi / 2 * i / n for i in range(n + 1)]]
    dome[-1] = (0.0, dome[-1][1], GL)
    ge = lathe('tamron_glass', dome, 96, mats)
    me = ge.data
    uv = me.uv_layers.active.data
    for p in me.polygons:
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv[li].uv = (0.5 + co.x / (2 * 28.9), 0.5 + co.y / (2 * 28.9))
    smooth(ge, 60)
    parts.append(ge)
    # rear element + rear opening
    rear = lathe('tamron_rear', [(21.6, -7.6, MA), (17.5, -5.0, MA), (16.5, -5.0, GL), (0.0, -6.5, GL)], 64, mats)
    smooth(rear, 50)
    parts.append(rear)
    # bayonet tabs (4) behind the flange
    for a0, a1 in ((20, 70), (110, 150), (190, 235), (280, 330)):
        segs = []
        for k in range(13):
            a = math.radians(a0 + (a1 - a0) * k / 12)
            segs.append(a)
        bm = bmesh.new()
        rows = []
        for (r_, z_) in ((22.4, -2.2), (26.6, -2.2), (26.6, -3.9), (22.4, -3.9)):
            rows.append([bm.verts.new((r_ * math.cos(a), r_ * math.sin(a), z_)) for a in segs])
        for k in range(4):
            for i in range(12):
                bm.faces.new((rows[k][i], rows[k][i + 1], rows[(k + 1) % 4][i + 1], rows[(k + 1) % 4][i]))
        bm.faces.new([rows[k][0] for k in range(4)])
        bm.faces.new([rows[k][-1] for k in reversed(range(4))])
        tab = new_obj('tamron_tab', bm, mats)
        fix_normals(tab)
        mat_by(tab, lambda c, n_, i: MO)
        parts.append(tab)
    # contacts
    for k in range(10):
        a = math.radians(-90 - 30 + 60 * k / 9)
        c_ = box('tamron_contact', -0.55, 0.55, -0.7, 0.7, 0, 0.25, mats)
        xform(c_, tr(20.6 * math.cos(a), 20.6 * math.sin(a), -1.25) @ rot('Z', math.degrees(a)) @ rot('X', 180))
        mat_by(c_, lambda c, n_, i: CO)
        parts.append(c_)
    # printing
    P = L['print']
    parts.append(wrap_text('t_tamron', 'TAMRON', 3.9, 36.8, math.radians(90), 37.8, P, font=FONT_BOLD, spacing=1.15))
    parts.append(wrap_text('t_name1', '17-70mm F/2.8', 2.5, 36.8, math.radians(122), 33.4, P))
    parts.append(wrap_text('t_name2', 'Di III-A VC RXD', 2.5, 36.8, math.radians(122), 29.6, P))
    parts.append(wrap_text('t_japan', 'DESIGNED IN JAPAN', 2.0, 36.8, math.radians(-2), 31.0, P))
    parts.append(wrap_text('t_b070', 'B070', 2.2, 30.5, math.radians(60), 8.5, P))
    for lab, ang in (('17', 89.4), ('24', 73.0), ('35', 55.0), ('50', 37.0), ('70', 22.6)):
        parts.append(wrap_text('t_f' + lab, lab, 2.6, 36.4, math.radians(ang), 68.4, P, along_axis=True))
    idx_line = box('t_index', -0.25, 0.25, 0, 0.05, 0, 3.2, mats)
    xform(idx_line, tr(0, 36.62, 61.2))
    mat_by(idx_line, lambda c, n_, i: PR)
    parts.append(idx_line)
    dot = lathe('t_hooddot', [(0.6, 0, PR), (0.0, 0, PR)], 16, mats)
    xform(dot, tr(0, 36.92, 112.0) @ rot('X', -90))
    parts.append(dot)
    mdot = lathe('t_mountdot', [(0.9, 0, PR), (0.0, 0, PR)], 16, mats)
    xform(mdot, tr(0, 30.55, 7.0) @ rot('X', -90))
    parts.append(mdot)
    return parts


VIEWS = [
    ('front34', (0.55, -1, 0.32), 70, None),
    ('back34', (-0.6, 1, 0.42), 70, None),
    ('front', (0, -1, 0), None, 0.15),
    ('top', (0, -0.001, 1), None, 0.15),
    ('back', (0, 1, 0), None, 0.15),
    ('side', (1, 0, 0), None, 0.15),
]

def build():
    reset()
    M = materials()
    parts, mats, idx = body(M)
    lparts = lens(lens_materials())
    for p in lparts:
        xform(p, tr(MX, FLANGE_Y, MZ) @ rot('X', 90))
    cam = join(parts, 'a7r2')
    tam = join(lparts, 'tamron')
    for o in (cam, tam):
        bm = bmesh.new(); bm.from_mesh(o.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
        bm.to_mesh(o.data); bm.free()
    root, off, size = finalize([cam, tam], root_name='a7r2_tamron', pivots={'tamron': (MX, FLANGE_Y, MZ)})
    objs = handles(root, [cam, tam])
    print('SIZE m', tuple(round(v, 4) for v in size), 'TRIS', stats([cam, tam]), 'cam', stats([cam]), 'lens', stats([tam]))
    return objs, cam, tam, size


if __name__ == '__main__' and '--export' in ARGS:
    objs, cam, tam, size = build()
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'a7r2-tamron.blend'))
    export_glb(os.path.join(SCRATCH, 'raw', 'a7r2-tamron.glb'), objs)
    if '--render' in ARGS:
        studio()
        c = Vector((0, 0, size.z / 2))
        rad = size.length / 2
        if '--nolens' in ARGS:
            bpy.data.objects['tamron_geo'].hide_render = True
            c = Vector((0, 0.02, 0.048))
            render_views('a7body', c, 0.08, [('ref1', (0.42, -1, 0.42), 60, None), ('ref2', (-0.25, 1, 0.3), 60, None),
                                             ('ref3', (-0.55, 1, 0.55), 60, None)], res=(900, 680), samples=24)
        else:
            render_views('a7r2', c, rad, [
                ('hero', (0.75, -1, 0.42), 60, None),
                ('back34', (-0.7, 1, 0.5), 60, None),
                ('side', (1, -0.02, 0.05), 60, None),
                ('top', (0.0, -0.25, 1), 60, None),
            ], res=(900, 680), samples=24)
    sys.exit(0)

if __name__ == '__main__':
    reset()
    M = materials()
    parts, mats, idx = body(M)
    lparts = lens(lens_materials()) if '--nolens' not in ARGS else []
    for p in lparts:
        xform(p, tr(MX, FLANGE_Y, MZ) @ rot('X', 90))
    parts += lparts
    print('TRIS', stats(parts))
    if '--render' in ARGS:
        studio()
        for p in parts:
            p.data.transform(Matrix.Scale(0.001, 4))
        which = [v for v in VIEWS if v[0] in ARGS] or VIEWS[:2]
        render_views('a7_wip', (0, 0.01, 0.048), 0.085, which, res=(800, 600), samples=16)
