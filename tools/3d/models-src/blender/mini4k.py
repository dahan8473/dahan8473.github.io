# DJI Mini 4K (gray), unfolded, with four separate spinnable propellers.
# Frame (mm): front faces -Y, Z up, drone's left = +X. Ground z=0.
# Spec: unfolded w/o props 159 x 203 x 56 mm (L x W x H), with props 245 x 289 x 56, 4.7" props, 213 mm diagonal.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib, common
importlib.reload(common)
from common import *
import bmesh
from mathutils import Vector, Matrix

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
HERE_ = os.path.dirname(os.path.abspath(__file__))

FM = (87.0, -55.0)    # front motor (x, y) for the +X (left) side
RM = (81.0, 70.0)     # rear motor
FZ = 47.5             # front motor bell base height
RZ = 18.0             # rear motor bell base height
PROP_R = 59.7         # 4.7 in / 2


def materials():
    M = {}
    M['shell'] = mat('mini4k_shell', (0.40, 0.405, 0.41), 0.0, 0.5)
    M['shell_dark'] = mat('mini4k_trim', (0.16, 0.165, 0.17), 0.0, 0.5)
    M['black'] = mat('mini4k_black', (0.018, 0.018, 0.02), 0.0, 0.45)
    M['vent'] = mat('mini4k_vent', (0.01, 0.01, 0.011), 0.0, 0.8)
    M['motor'] = mat('mini4k_motor', (0.55, 0.56, 0.58), 1.0, 0.32)
    M['motor_dark'] = mat('mini4k_motor_band', (0.05, 0.05, 0.055), 0.6, 0.4)
    M['lens'] = mat('mini4k_lens_glass', (1, 1, 1), 1.0, 0.05, coat=1.0, coat_rough=0.02,
                    base_tex=load_img(os.path.join(TEX, 'lens_glass.png')))
    M['print'] = mat('mini4k_print', (0.12, 0.12, 0.125), 0.0, 0.5)
    M['print_light'] = mat('mini4k_print_light', (0.75, 0.75, 0.75), 0.0, 0.5)
    M['prop'] = mat('mini4k_prop', (0.022, 0.023, 0.025), 0.0, 0.4)
    M['prop_tip'] = mat('mini4k_prop_tip', (0.85, 0.30, 0.04), 0.0, 0.45)
    M['rubber'] = mat('mini4k_rubber', (0.03, 0.03, 0.03), 0.0, 0.85)
    return M


def body(M):
    keys = ['shell', 'shell_dark', 'black', 'vent', 'motor', 'motor_dark', 'lens', 'print', 'print_light', 'rubber']
    mats = [M[k] for k in keys]
    I = {k: i for i, k in enumerate(keys)}
    parts = []

    def assign(ob, key):
        mat_by(ob, lambda c, n, i: I[key])

    # ---- fuselage: loft of rounded sections along Y (front -> back)
    def section(y, a, zb, zt, rt, rb):
        rt = min(rt, a - 0.5, (zt - zb) / 2 - 0.1)
        rb = min(rb, a - 0.5, (zt - zb) / 2 - 0.1)
        pts = []
        nc, ne = 6, 3
        for i in range(ne):  # bottom edge (x from -a+rb to a-rb)
            pts.append((-a + rb + (2 * a - 2 * rb) * i / ne, zb))
        for i in range(nc):  # bottom right corner
            t = -math.pi / 2 + (math.pi / 2) * i / nc
            pts.append((a - rb + rb * math.cos(t), zb + rb + rb * math.sin(t)))
        for i in range(ne):
            pts.append((a, zb + rb + (zt - rt - zb - rb) * i / ne))
        for i in range(nc):
            t = (math.pi / 2) * i / nc
            pts.append((a - rt + rt * math.cos(t), zt - rt + rt * math.sin(t)))
        for i in range(ne):
            pts.append((a - rt - (2 * a - 2 * rt) * i / ne, zt))
        for i in range(nc):
            t = math.pi / 2 + (math.pi / 2) * i / nc
            pts.append((-a + rt + rt * math.cos(t), zt - rt + rt * math.sin(t)))
        for i in range(ne):
            pts.append((-a, zt - rt - (zt - rt - zb - rb) * i / ne))
        for i in range(nc):
            t = math.pi + (math.pi / 2) * i / nc
            pts.append((-a + rb + rb * math.cos(t), zb + rb + rb * math.sin(t)))
        return [(x, y, z) for x, z in pts]
    # key stations: y, half-width, bottom, top, top radius, bottom radius
    K = [(-66.0, 18.0, 30.0, 39.0, 4.0, 3.0), (-63.0, 25.0, 25.5, 43.0, 9.0, 3.0), (-56.0, 29.0, 23.0, 46.0, 12.0, 3.0),
         (-45.0, 31.0, 21.5, 47.8, 14.0, 3.0), (-33.0, 32.0, 12.0, 48.5, 15.0, 6.0), (0.0, 32.0, 9.0, 48.5, 15.0, 7.0),
         (30.0, 31.5, 9.0, 47.5, 14.5, 7.0), (52.0, 30.0, 9.5, 45.0, 13.0, 7.0), (62.0, 27.0, 11.0, 41.5, 11.0, 6.0),
         (67.0, 21.0, 14.0, 36.0, 8.0, 5.0)]
    # smooth stations with catmull in the parameter space
    params = catmull([k for k in K], 3)
    loops = [section(*p) for p in params]
    fus = loft('fuselage', loops, mats)
    smooth(fus, 40)
    # trim: darker gray lower front around the gimbal bay and rear battery end
    def fus_mat(c, n, i):
        if c.y < -36 and n.z < -0.35:
            return I['black']
        return I['shell']
    mat_by(fus, fus_mat)
    parts.append(fus)
    # front vents: two dark slots snapped onto the nose surface
    for sx in (1, -1):
        hit, nrm = raycast(fus, (sx * 19.5, -90.0, 37.5), (0, 1, 0))
        if hit is not None:
            v = box('vent', -3.6, 3.6, -2.0, 2.0, -0.6, 0.4, mats, bevel=0.9, seg=2)
            xform(v, frame(hit, (1, 0, 0), nrm) @ rot('Z', sx * -14))
            assign(v, 'vent')
            parts.append(v)
    hit, nrm = raycast(fus, (0.0, -90.0, 31.0), (0, 1, 0))
    if hit is not None:
        sl = box('nose_slot', -9.0, 9.0, -0.6, 0.6, -0.5, 0.3, mats, bevel=0.5, seg=2)
        xform(sl, frame(hit, (1, 0, 0), nrm))
        assign(sl, 'vent')
        parts.append(sl)
    for k in range(7):
        g = box('grille', -14 + k * 4.4, -12.2 + k * 4.4, 66.0, 67.4, 20.0, 31.0, mats, bevel=0.5, seg=1)
        assign(g, 'vent')
        parts.append(g)
    # battery seam + latch on the back top
    seam = box('seam', -25.0, 25.0, 40.5, 41.0, 46.0, 48.7, mats)
    assign(seam, 'shell_dark')
    parts.append(seam)
    # downward window (bottom)
    dw = box('down_window', -6.0, 6.0, -12.0, 0.0, 8.6, 9.2, mats, bevel=0.8, seg=2)
    assign(dw, 'black')
    parts.append(dw)

    # ---- gimbal camera (3-axis, hanging under the nose)
    yoke = sweep('gimbal_yoke', [(0, -38, 22.5), (0, -44, 17.0)], lambda t: rrect_c(12.0, 7.0, 3.0), mats)
    assign(yoke, 'black')
    parts.append(yoke)
    cam = box('gimbal_cam', -12.0, 12.0, -65.5, -44.0, 5.5, 22.0, mats, bevel=5.0, seg=4)
    assign(cam, 'black')
    smooth(cam, 40)
    parts.append(cam)
    lb = lathe('cam_lens', [(7.2, 0, I['black']), (7.2, 2.5, I['black']), (6.4, 3.2, I['black']), (5.2, 3.2, I['black']),
                            (4.9, 2.6, I['lens']), (0.0, 3.0, I['lens'])], 48, mats)
    me = lb.data
    uv = me.uv_layers.active.data
    for p in me.polygons:
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv[li].uv = (0.5 + co.x / 10.0, 0.5 + co.y / 10.0)
    xform(lb, tr(1.0, -65.0, 13.8) @ rot('X', 90))
    smooth(lb, 40)
    parts.append(lb)
    parts.append(text_on('t_4k', '4K', 2.4, frame((-7.4, -65.55, 18.8), (1, 0, 0), (0, -1, 0)), M['print_light'], FONT_BOLD))

    # ---- arms, motor pods, legs
    def motor_pod(x, y, z_bot, z_top, foot=False):
        pod = lathe('pod', [(0.0, z_bot, I['shell']), (6.5, z_bot, I['shell']), (8.4, z_bot + 2.0, I['shell']),
                            (8.6, z_top - 1.0, I['shell']), (8.2, z_top, I['shell']), (0.0, z_top, I['shell'])], 48, mats)
        xform(pod, tr(x, y, 0))
        smooth(pod, 40)
        parts.append(pod)
        bell = lathe('bell', [(0.0, z_top - 0.1, I['motor']), (7.6, z_top - 0.1, I['motor_dark']), (7.6, z_top + 1.6, I['motor_dark']),
                              (7.8, z_top + 1.8, I['motor']), (7.8, z_top + 4.2, I['motor']), (7.0, z_top + 4.8, I['motor']),
                              (2.5, z_top + 4.8, I['motor']), (2.0, z_top + 5.4, I['motor']), (0.0, z_top + 5.4, I['motor'])],
                     60, mats, rmod=lambda t, k, r, z: r - (0.25 if (k in (4, 5) and int(t / TAU * 60) % 2) else 0))
        xform(bell, tr(x, y, 0))
        smooth(bell, 40)
        parts.append(bell)
        if foot:
            ft = lathe('foot', [(0.0, z_bot - 0.6, I['rubber']), (4.5, z_bot - 0.6, I['rubber']), (5.0, z_bot + 0.2, I['rubber']),
                                (0.0, z_bot + 0.2, I['rubber'])], 24, mats)
            xform(ft, tr(x, y, 0))
            parts.append(ft)

    for sx in (1, -1):
        fx, fy = sx * FM[0], FM[1]
        rx, ry = sx * RM[0], RM[1]
        # front arm: from upper front corner of the body, nearly horizontal, flattened section
        fpath = catmull([(sx * 26.0, -36.0, 40.5), (sx * 50.0, -46.0, 42.5), (sx * 72.0, -52.5, 43.0), (fx, fy, 43.0)], 4)
        arm = sweep('arm_front', fpath, lambda t: rrect_c(13.5 - 2.5 * t, 9.0 - 1.0 * t, 2.3), mats)
        if sx > 0:
            left_arm = arm
        assign(arm, 'shell')
        smooth(arm, 40)
        parts.append(arm)
        motor_pod(fx, fy, 37.5, FZ)
        # front leg (antenna) under the front motor
        leg = loft('leg', [[(fx + sx * 0.5 + x, fy + y, 39.0) for x, y in rrect(8.6, 16.0, 3.6, 4)],
                           [(fx + sx * 2.0 + x, fy + y, 20.0) for x, y in rrect(8.2, 14.5, 3.6, 4)],
                           [(fx + sx * 3.5 + x, fy + y, 1.6) for x, y in rrect(7.4, 12.0, 3.4, 4)]], mats)
        add_bevel(leg, 1.4, 3, 30)
        assign(leg, 'shell')
        smooth(leg, 40)
        parts.append(leg)
        lf = lathe('leg_foot', [(0.0, 0.0, I['rubber']), (3.2, 0.0, I['rubber']), (3.6, 1.8, I['rubber']), (0.0, 1.8, I['rubber'])], 20, mats)
        xform(lf, tr(fx + sx * 3.5, fy, 0) @ sc(1.0, 1.5, 1.0))
        parts.append(lf)
        # rear arm: from lower rear corner, low and swept back
        rpath = catmull([(sx * 25.0, 44.0, 14.0), (sx * 45.0, 55.0, 12.5), (sx * 66.0, 65.0, 11.5), (rx, ry, 11.0)], 4)
        rarm = sweep('arm_rear', rpath, lambda t: rrect_c(12.5 - 2.0 * t, 8.5 - 0.5 * t, 3.2), mats)
        assign(rarm, 'shell')
        smooth(rarm, 40)
        parts.append(rarm)
        motor_pod(rx, ry, 4.5, RZ, foot=True)
        # hinges
        for (hx, hy, hz) in ((sx * 27.5, -36.5, 40.5), (sx * 26.5, 44.5, 14.0)):
            h = lathe('hinge', [(0.0, hz - 5.5, I['shell_dark']), (4.6, hz - 5.5, I['shell_dark']), (4.6, hz + 5.5, I['shell_dark']),
                                (0.0, hz + 5.5, I['shell_dark'])], 32, mats)
            xform(h, tr(hx, hy, 0))
            smooth(h, 40)
            parts.append(h)

    # ---- printing ("MINI 4K" on the front face of the left front arm, snapped to the surface)
    T = Vector((FM[0] - 50.0, FM[1] + 46.0, 0.5)).normalized()
    nrm = T.cross(Vector((0, 0, 1))).normalized()
    if nrm.y > 0:
        nrm = -nrm
    c0 = Vector((63.0, -50.0, 42.9))
    hit, hn = raycast(left_arm, c0 + nrm * 20.0, -nrm)
    if hit is not None:
        parts.append(text_on('t_mini4k', 'MINI 4K', 3.3, frame(hit, T, hn), M['print'], FONT_REG,
                             spacing=1.1, lift=0.08))
    parts.append(text_on('t_dji', 'DJI', 7.0, frame((0, -36.0, 48.56), (1, 0, 0), (0, 0, 1)), M['print'], FONT_BOLD,
                         spacing=1.05))
    return parts


def prop(name, M, spin):
    """2-blade 4.7in prop centred on its hub. spin=+1 CCW seen from above, -1 CW."""
    mats = [M['prop'], M['prop_tip'], M['motor']]
    parts = []
    hub = lathe(name + '_hub', [(0.0, 0.0, 0), (5.2, 0.0, 0), (5.2, 2.6, 0), (3.0, 3.2, 2), (0.0, 3.4, 2)], 32, mats)
    smooth(hub, 40)
    parts.append(hub)
    for b in range(2):
        loops = []
        rs = [5.0, 8.0, 12.0, 17.0, 23.0, 29.0, 35.0, 41.0, 46.0, 50.0, 53.5, 56.0, 58.0, 59.2, 59.7]
        for r in rs:
            u = min(1.0, (r - 5.0) / 15.0)
            chord = 8.0 + 6.0 * u - 6.5 * max(0.0, (r - 22.0) / 37.7) ** 1.3
            if r > 56.0:
                chord *= max(0.15, math.sqrt(max(0.0, 1 - ((r - 56.0) / 3.75) ** 2)))
            pitch = math.degrees(math.atan(66.0 / (TAU * max(r, 14.0))))
            th = 1.5 - 0.9 * (r / 59.7)
            sweep_ = -0.0016 * (r - 10.0) ** 2 if r > 10 else 0.0
            sec = []
            for i in range(12):
                ph = TAU * i / 12
                cu = 0.5 * chord * math.cos(ph)
                cv = 0.5 * th * math.sin(ph) * (1.0 if math.sin(ph) > 0 else 0.35)
                a = math.radians(pitch)
                yy = cu * math.cos(a) - cv * math.sin(a) + sweep_
                zz = cu * math.sin(a) + cv * math.cos(a)
                sec.append((r, spin * yy, 1.8 + zz))
            loops.append(sec)
        bl = loft(name + '_blade', loops, mats)
        mat_by(bl, lambda c, n, i: 1 if c.x > 54.0 else 0)
        smooth(bl, 50)
        if b == 1:
            xform(bl, rot('Z', 180))
        parts.append(bl)
    pr = join(parts, name)
    return pr


def build():
    reset()
    M = materials()
    parts = body(M)
    drone = join(parts, 'mini4k')
    bm = bmesh.new(); bm.from_mesh(drone.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bm.to_mesh(drone.data); bm.free()
    props = []
    pivots = {}
    spins = {}
    # DJI quad X: front-left & rear-right spin CW, front-right & rear-left CCW (seen from above)
    for nm, sx, (mx, my), z, spin in (('prop_fl', 1, FM, FZ, -1), ('prop_fr', -1, FM, FZ, 1),
                                      ('prop_rl', 1, RM, RZ, 1), ('prop_rr', -1, RM, RZ, -1)):
        p = prop(nm, M, spin)
        hz = z + 5.4
        xform(p, tr(sx * mx, my, hz) @ rot('Z', 35 if sx > 0 else -35))
        pivots[nm] = (sx * mx, my, hz)
        spins[nm] = {'spin': spin}
        props.append(p)
    root, off, size = finalize([drone] + props, root_name='mini4k_drone', pivots=pivots, center_xy=False)
    objs = handles(root, [drone] + props, extras=spins)
    print('SIZE m', tuple(round(v, 4) for v in size), 'TRIS', stats([drone] + props), 'body', stats([drone]),
          'prop', stats(props[:1]))
    return objs, drone, props, size


if __name__ == '__main__':
    objs, drone, props, size = build()
    if '--export' in ARGS:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE_, 'mini4k.blend'))
        export_glb(os.path.join(SCRATCH, 'raw', 'mini4k.glb'), objs)
    if '--render' in ARGS:
        studio()
        c = Vector((0, 0, size.z / 2))
        rad = size.length / 2
        render_views('mini4k', c, rad, [
            ('hero', (0.75, -1, 0.5), 60, None),
            ('front', (0.0, -1, 0.08), 60, None),
            ('top', (0.0, -0.05, 1), 60, None),
            ('back34', (-0.7, 1, 0.45), 60, None),
        ], res=(900, 680), samples=24)
        render_views('mini4k', Vector((0.06, -0.05, 0.035)), 0.05, [('arm', (0.2, -1, 0.25), 60, None)], res=(900, 680), samples=16)
        render_views('mini4k', c, rad, [('ref_b', (0.0, -1, 0.02), 60, None), ('ref_m2', (-0.55, -1, 0.42), 60, None)],
                     res=(900, 680), samples=16)
