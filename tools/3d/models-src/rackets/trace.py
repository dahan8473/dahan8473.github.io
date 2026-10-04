# A racket from its product photo: the straight-on front shot (transparent
# background) is traced into a frame, a round grip and a string bed, and the
# photo itself is the texture, so decals and colours are the real ones.
#   python trace.py <front.png> <out.glb>
# Standing on the butt cap like racket.glb: Y up, metres, 675 mm long, the
# string bed in the XY plane facing +Z. Nodes racket_body (frame and grip) and
# racket_head (the string bed, which the viewer uses for the head's bounds).
import sys
import cv2
import numpy as np
import trimesh
from PIL import Image
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

LENGTH = 0.675
HEAD_DEPTH = 0.0095   # frame box section, front to back
GRIP_MIN = 0.018      # rows wider than this at the bottom are the grip
BED_TUCK = 0.0015     # the string bed reaches this far under the frame


def trace(src, out):
    img = Image.open(src).convert('RGBA')
    a = np.array(img)
    ys, xs = np.where(a[:, :, 3] > 40)
    pad = 6
    x0, x1, y0, y1 = xs.min() - pad, xs.max() + pad, ys.min() - pad, ys.max() + pad
    a = a[y0:y1, x0:x1]
    H, W = a.shape[:2]
    s = LENGTH / (ys.max() - ys.min())          # metres per pixel
    alpha = a[:, :, 3]

    # Strings are a few px wide, the frame tens: opening wipes the strings.
    solid = (alpha > 128).astype(np.uint8)
    k = int(round(0.0024 / s)) | 1
    thick = cv2.morphologyEx(solid, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(thick)
    thick = (lab == 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])).astype(np.uint8)

    cs, hier = cv2.findContours(thick, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    hier = hier[0]
    outer = max((i for i in range(len(cs)) if hier[i][3] < 0), key=lambda i: cv2.contourArea(cs[i]))
    holes = [i for i in range(len(cs)) if hier[i][3] == outer]
    bed = max(holes, key=lambda i: cv2.contourArea(cs[i]))

    def poly(c):
        c = cv2.approxPolyDP(c, 0.00025 / s, True)[:, 0, :].astype(float)
        return Polygon(c).buffer(0)

    # Where the grip starts: the bottom run of rows wider than GRIP_MIN.
    width = thick.sum(1) * s
    rows = np.where(thick.any(1))[0]
    yg = rows[-1] - int(0.012 / s)   # above the rounded butt cap
    while yg > rows[0] and width[yg - 1] > GRIP_MIN:
        yg -= 1
    head_bottom = cs[bed][:, 0, 1].max()

    cx = (cs[bed][:, 0, 0].min() + cs[bed][:, 0, 0].max()) / 2
    to_m = lambda x, y: ((x - cx) * s, (H - 1 - y) * s - (H - 1 - rows[-1]) * s)
    uv = lambda x, y: (x / (W - 1), 1 - y / (H - 1))

    # Frame: everything above the grip, extruded, deeper in the head than the shaft.
    frame2d = Polygon(poly(cs[outer]).exterior, [poly(cs[bed]).exterior]).buffer(0)
    frame2d = frame2d.intersection(box(-1, -1, W + 1, yg + 1))
    parts = []
    for p in getattr(frame2d, 'geoms', [frame2d]):
        m = trimesh.creation.extrude_polygon(p, 1.0)
        v = m.vertices.copy()
        px, py = v[:, 0].copy(), v[:, 1].copy()
        rowd = np.clip(width[np.clip(py.astype(int), 0, H - 1)], 0.004, 0.03)
        depth = np.where(py < head_bottom + 0.01 / s, HEAD_DEPTH, np.minimum(rowd, HEAD_DEPTH))
        X, Y = to_m(px, py)
        v[:, 0], v[:, 1], v[:, 2] = X, Y, (v[:, 2] - 0.5) * depth
        m.vertices = v
        m.visual = trimesh.visual.TextureVisuals(uv=np.column_stack(uv(px, py)))
        parts.append(m)

    # Grip: elliptical rings following the photo's outline, capped at the butt.
    seg, step = 28, max(1, int(round(0.001 / s)))
    ring_rows = list(range(yg, rows[-1], step)) + [rows[-1]]
    verts, uvs, faces = [], [], []
    for r in ring_rows:
        xsr = np.where(thick[r])[0]
        l, rr = xsr.min(), xsr.max()
        c, half = (l + rr) / 2, (rr - l) / 2
        for j in range(seg):
            t = 2 * np.pi * j / seg
            px = c + half * np.cos(t)
            X, Y = to_m(px, r)
            verts.append((X, Y, half * 0.86 * s * np.sin(t)))
            uvs.append(uv(px, r))
    for i in range(len(ring_rows) - 1):
        for j in range(seg):
            a0, a1 = i * seg + j, i * seg + (j + 1) % seg
            b0, b1 = a0 + seg, a1 + seg
            faces += [(a0, b0, a1), (a1, b0, b1)]
    last = (len(ring_rows) - 1) * seg
    X, Y = to_m(cx, rows[-1])
    verts.append((verts[last][0] * 0 + np.mean([verts[last + j][0] for j in range(seg)]), Y, 0))
    uvs.append(uvs[last])
    capc = len(verts) - 1
    faces += [(last + (j + 1) % seg, last + j, capc) for j in range(seg)]
    grip = trimesh.Trimesh(np.array(verts), np.array(faces), process=False)
    grip.visual = trimesh.visual.TextureVisuals(uv=np.array(uvs))
    parts.append(grip)

    body = trimesh.util.concatenate(parts)

    # String bed: the hole under the frame, flat, the photo with its alpha.
    bed2d = poly(cs[bed]).buffer(BED_TUCK / s)
    v2, f2 = trimesh.creation.triangulate_polygon(bed2d)
    X, Y = to_m(v2[:, 0], v2[:, 1])
    strings = trimesh.Trimesh(np.column_stack([X, Y, np.zeros(len(v2))]), f2, process=False)
    strings.visual = trimesh.visual.TextureVisuals(uv=np.column_stack(uv(v2[:, 0], v2[:, 1])))

    # Transparent pixels carry white, and strings run into the frame's inner
    # edge: spread the nearest solid colour so neither shows on the frame. The
    # frame bleeds from the traced frame, the strings from the photo's alpha.
    def bleed(keep):
        hole = (~keep).astype(np.uint8)
        _, near = cv2.distanceTransformWithLabels(hole, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
        zy, zx = np.where(hole == 0)
        lut = np.zeros((near.max() + 1, 2), int)
        lut[near[zy, zx]] = np.column_stack([zy, zx])
        src = lut[near]
        return a[:, :, :3][src[..., 0], src[..., 1]]

    frame_tex = Image.fromarray(bleed(thick.astype(bool)).astype(np.uint8))
    tex = Image.fromarray(np.dstack([bleed(alpha >= 200), alpha]).astype(np.uint8))
    body.visual.material = trimesh.visual.material.PBRMaterial(
        name='racket_photo', baseColorTexture=frame_tex, metallicFactor=0.0, roughnessFactor=0.42)
    strings.visual.material = trimesh.visual.material.PBRMaterial(
        name='racket_strings', baseColorTexture=tex, metallicFactor=0.0, roughnessFactor=0.6,
        alphaMode='MASK', alphaCutoff=0.45, doubleSided=True)

    scene = trimesh.Scene()
    scene.add_geometry(body, node_name='racket_body', geom_name='racket_body_geo')
    scene.add_geometry(strings, node_name='racket_head', geom_name='racket_head_geo')
    scene.export(out)
    print(out, 'head', round(bed2d.bounds[2] * s - bed2d.bounds[0] * s, 3), 'x', round((bed2d.bounds[3] - bed2d.bounds[1]) * s, 3),
          'grip from', round(to_m(0, yg)[1], 3), 'tris', len(body.faces) + len(strings.faces))


if __name__ == '__main__':
    trace(sys.argv[1], sys.argv[2])
