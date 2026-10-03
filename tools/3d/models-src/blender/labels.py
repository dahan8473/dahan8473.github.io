# Printed dial/label textures, drawn with PIL (system python3). Output: textures/*.png
import math, os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(HERE, 'textures')
os.makedirs(TEX, exist_ok=True)
ARIAL = '/System/Library/Fonts/Supplemental/Arial.ttf'
ARIALB = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
S = 1024


def font(sz, bold=True):
    return ImageFont.truetype(ARIALB if bold else ARIAL, sz)


def radial_text(im, txt, ang_deg, rad, sz, color, bold=True, outward=True):
    """Draw txt centred at polar (rad, ang) with its top pointing outward."""
    f = font(sz, bold)
    tw = int(f.getlength(txt)) + 8
    th = sz + 12
    t = Image.new('RGBA', (tw, th), (0, 0, 0, 0))
    ImageDraw.Draw(t).text((tw / 2, th / 2), txt, font=f, fill=color, anchor='mm')
    # rotate so that text 'up' points along the radial direction
    rotd = ang_deg - 90 if outward else ang_deg + 90
    t = t.rotate(rotd, resample=Image.BICUBIC, expand=True)
    a = math.radians(ang_deg)
    cx = S / 2 + rad * math.cos(a)
    cy = S / 2 - rad * math.sin(a)
    im.alpha_composite(t, (int(cx - t.width / 2), int(cy - t.height / 2)))


def disc(bg, rim=None):
    im = Image.new('RGBA', (S, S), bg)
    return im


def a7_expdial():
    # Sony exposure compensation dial top, black, white graduations. 0 faces the back (+Y) = image top.
    im = disc((10, 10, 11, 255))
    d = ImageDraw.Draw(im)
    labels = ['3', '', '', '2', '', '', '1', '', '', '0', '', '', '1', '', '', '2', '', '', '3']
    n = len(labels)
    for i, lab in enumerate(labels):
        ang = 90 + (i - (n - 1) / 2) * (300 / (n - 1))
        if lab:
            col = (235, 235, 235, 255)
            radial_text(im, lab, ang, 360, 92, col)
        else:
            a = math.radians(ang)
            x, y = S / 2 + 380 * math.cos(a), S / 2 - 380 * math.sin(a)
            d.ellipse((x - 11, y - 11, x + 11, y + 11), fill=(225, 225, 225, 255))
    # +/- signs
    radial_text(im, '+', 90 + 165, 300, 70, (235, 235, 235, 255))
    radial_text(im, '−', 90 - 165, 300, 70, (235, 235, 235, 255))
    im.convert('RGB').save(os.path.join(TEX, 'a7_expdial.png'))


def a7_modedial():
    im = disc((12, 12, 13, 255))
    d = ImageDraw.Draw(im)
    items = ['AUTO', 'P', 'A', 'S', 'M', '1', '2', 'MR', 'SCN', '▭', '▶']
    n = len(items)
    for i, lab in enumerate(items):
        ang = 90 + i * 360 / n
        col = (235, 235, 235, 255)
        if lab == 'AUTO':
            a = math.radians(ang)
            # teal AUTO block like the A7R II
            t = Image.new('RGBA', (230, 110), (0, 0, 0, 0))
            dd = ImageDraw.Draw(t)
            dd.rounded_rectangle((4, 4, 226, 106), 14, fill=(40, 160, 150, 255))
            dd.text((115, 55), 'AUTO', font=font(70), fill=(10, 20, 20, 255), anchor='mm')
            t = t.rotate(ang - 90, resample=Image.BICUBIC, expand=True)
            cx, cy = S / 2 + 375 * math.cos(a), S / 2 - 375 * math.sin(a)
            im.alpha_composite(t, (int(cx - t.width / 2), int(cy - t.height / 2)))
        elif lab in ('▭', '▶'):
            a = math.radians(ang)
            cx, cy = S / 2 + 380 * math.cos(a), S / 2 - 380 * math.sin(a)
            d.rectangle((cx - 34, cy - 24, cx + 34, cy + 24), outline=col, width=9)
        else:
            radial_text(im, lab, ang, 375, 96 if len(lab) == 1 else 76, col)
    d.ellipse((S / 2 - 250, S / 2 - 250, S / 2 + 250, S / 2 + 250), fill=(20, 20, 21, 255))
    im.convert('RGB').save(os.path.join(TEX, 'a7_modedial.png'))


def xt_modedial():
    # Fujifilm X-T200 mode dial top: labels only, transparent background (decal over the paint).
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    dark = (25, 25, 26, 255)
    orange = (240, 120, 30, 255)
    items = [('Adv.', orange), ('SP', dark), ('P', dark), ('S', dark), ('A', dark), ('M', dark),
             ('C', dark), ('◐', dark), ('▭', dark), ('SR+', orange)]
    n = len(items)
    for i, (lab, col) in enumerate(items):
        ang = 90 + i * 360 / n
        if lab in ('◐', '▭'):
            a = math.radians(ang)
            cx, cy = S / 2 + 380 * math.cos(a), S / 2 - 380 * math.sin(a)
            d.rectangle((cx - 32, cy - 22, cx + 32, cy + 22), outline=col, width=11)
        else:
            radial_text(im, lab, ang, 380, 100 if len(lab) == 1 else 80, col)
    im.save(os.path.join(TEX, 'xt_modedial.png'))


def xc_front():
    # XC 15-45 front name ring: white text on black, top and bottom arcs (read from the front).
    im = Image.new('RGBA', (S, S), (9, 9, 10, 255))
    def arc(txt, rad, centre_deg, top, sz):
        f = font(sz, bold=False)
        widths = [f.getlength(c) * 1.12 for c in txt]
        total = sum(widths)
        span = math.degrees(total / rad)
        a = centre_deg + (span / 2 if top else -span / 2)
        for c, w in zip(txt, widths):
            half = math.degrees(w / 2 / rad)
            a = a - half if top else a + half
            radial_text(im, c, a, rad, sz, (230, 230, 230, 255), bold=False, outward=top)
            a = a - half if top else a + half
    arc('FUJINON ASPHERICAL LENS', 392, 90, True, 40)
    arc('SUPER EBC XC 15-45mm 1:3.5-5.6 OIS PZ  Ø52', 418, 270, False, 36)
    im.convert('RGB').save(os.path.join(TEX, 'xc_front.png'))


def tamron_front():
    # Front name ring: black ring with white text running around (read from the front).
    im = Image.new('RGBA', (S, S), (8, 8, 9, 255))
    txt = 'TAMRON  17-70mm F/2.8 Di III-A VC RXD   Ø67   B070'
    f = font(46, bold=False)
    # place characters around the circle, clockwise from top-left
    total = sum(f.getlength(c) for c in txt) * 1.15
    rad = 440
    ang0 = 90 + math.degrees(total / rad) / 2
    a = ang0
    for c in txt:
        w = f.getlength(c) * 1.15
        a -= math.degrees(w / 2 / rad)
        radial_text(im, c, a, rad, 46, (225, 225, 225, 255), bold=False)
        a -= math.degrees(w / 2 / rad)
    im.convert('RGB').save(os.path.join(TEX, 'tamron_front.png'))


def lens_glass():
    # Base colour for the front element: deep dark with green/magenta coating rings.
    import numpy as np
    c = (np.arange(S) + 0.5) / S - 0.5
    U, V = np.meshgrid(c, c)
    r = np.sqrt(U * U + V * V) * 2
    col = np.zeros((S, S, 3))
    base = np.array([0.030, 0.034, 0.040])
    col[:] = base
    ring = lambda r0, w: np.exp(-((r - r0) / w) ** 2)
    g = np.clip(r, 0, 1)[..., None]
    inner = np.array([0.040, 0.022, 0.050])   # magenta-violet centre
    outer = np.array([0.030, 0.062, 0.034])   # green edge coating
    col = inner * (1 - g ** 1.5) + outer * g ** 1.5
    col *= (0.75 + 0.25 * np.exp(-((r - 0.62) / 0.25) ** 2))[..., None]
    col *= (r < 1.0)[..., None]
    img = Image.fromarray((np.clip(col, 0, 1) ** (1 / 2.2) * 255).astype('uint8'))  # stored sRGB; used as metallic F0 tint
    img.save(os.path.join(TEX, 'lens_glass.png'))


if __name__ == '__main__':
    a7_expdial()
    a7_modedial()
    xt_modedial()
    xc_front()
    tamron_front()
    lens_glass()
    print('ok')
