# Printed decals for the Fairtex gloves, drawn with PIL (system python3):
#   python3 gloves_tex.py   ->  gloves_tex/decals.png (2048 x 1024 RGBA atlas)
# Atlas (pixels, origin top left):
#   wordmark  [   0,   0, 1280, 512]  big white "Fairtex" with a black outline (back of the hand)
#   oval      [1280,   0, 2048, 512]  the oval logo for the strap patch (red/blue swoosh, black script)
#   badge     [   0, 512,  512,1024]  round "HAND MADE IN THAILAND / GENUINE LEATHER" stamp (white)
#   size      [ 512, 512,  640, 768]  the "10" in a box, black, reads bottom to top
# The script face is Kaushan Script (OFL, Google Fonts), thickened and outlined to get
# close to Fairtex's heavy brush wordmark. It is fetched into the scratch dir if missing.
import math, os, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'gloves_tex')
os.makedirs(OUT, exist_ok=True)
SCRATCH = os.environ.get('MODELS_SCRATCH', '/private/tmp/claude-501/-Users-DavidLiu/f47a44a5-4dfa-4aae-b40f-735bd11d5e6f/scratchpad/models-test')
SCRIPT = os.environ.get('GLOVES_FONT', os.path.join(SCRATCH, 'KaushanScript-Regular.ttf'))
SANS_B = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
W, H = 2048, 1024
WHITE = (250, 250, 247, 255)
BLACK = (14, 14, 16, 255)
RED = (214, 32, 44, 255)
BLUE = (34, 64, 168, 255)


def script_font(sz):
    if not os.path.exists(SCRIPT):
        os.makedirs(os.path.dirname(SCRIPT), exist_ok=True)
        subprocess.run(['curl', '-sfL', '-o', SCRIPT,
                        'https://github.com/google/fonts/raw/main/ofl/kaushanscript/KaushanScript-Regular.ttf'], check=True)
    return ImageFont.truetype(SCRIPT, sz)


def mask_text(size, txt, font, xy, stroke=0):
    m = Image.new('L', size, 0)
    ImageDraw.Draw(m).text(xy, txt, font=font, fill=255, anchor='mm', stroke_width=stroke, stroke_fill=255)
    return m


def dilate(m, r):
    return m.filter(ImageFilter.MaxFilter(r * 2 + 1)) if r > 0 else m


def shear(img, k):
    """Lean the letters right a little more (brushy italic)."""
    w, h = img.size
    return img.transform((w, h), Image.AFFINE, (1, k, -k * h / 2, 0, 1, 0), resample=Image.BICUBIC)


def wordmark():
    w, h = 1280, 512
    f = script_font(300)
    fill = mask_text((w, h), 'Fairtex', f, (w / 2 + 40, h / 2 + 10), stroke=10)
    # the swash on the F: a brush stroke sweeping left and up off its top bar
    sw = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(sw)
    pts = []
    for i in range(41):
        t = i / 40
        x = 360 - 215 * t
        y = 158 + 22 * t + 26 * t ** 3
        r = 21 * (1 - t ** 1.4) + 4
        d.ellipse((x - r, y - r, x + r, y + r), fill=255)
    fill = ImageChops.lighter(fill, sw)
    fill = shear(fill, 0.08)
    # Fairtex's letters are taller and tighter than the font's: squeeze the word into the
    # region (outline margin left around it) so it reads like the real wordmark
    x0, y0, x1, y1 = fill.getbbox()
    m = 22
    fill2 = Image.new('L', (w, h), 0)
    fill2.paste(fill.crop((x0, y0, x1, y1)).resize((w - 2 * m, h - 2 * m), Image.LANCZOS), (m, m))
    fill = fill2
    out = dilate(fill, 15).filter(ImageFilter.GaussianBlur(1.2))
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    img.paste(Image.new('RGBA', (w, h), BLACK), (0, 0), out)
    img.paste(Image.new('RGBA', (w, h), WHITE), (0, 0), fill.filter(ImageFilter.GaussianBlur(0.8)))
    return img


def ellipse_mask(size, cx, cy, a, b, ss=4):
    w, h = size
    m = Image.new('L', (w * ss, h * ss), 0)
    ImageDraw.Draw(m).ellipse(((cx - a) * ss, (cy - b) * ss, (cx + a) * ss, (cy + b) * ss), fill=255)
    return m.resize((w, h), Image.LANCZOS)


def oval():
    w, h = 768, 512
    cx, cy = w / 2, h / 2
    a, b = 350, 205
    outer = ellipse_mask((w, h), cx, cy, a, b)
    inner = ellipse_mask((w, h), cx, cy, a - 9, b - 9)
    ring = ImageChops.subtract(outer, inner)
    # swooshes: crescents between the rim and an ellipse pushed off centre
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    ang = np.degrees(np.arctan2(-(yy - cy) / b, (xx - cx) / a)) % 360

    def crescent(dx, dy, a1, b1, lo, hi):
        e = np.array(ImageChops.subtract(ellipse_mask((w, h), cx, cy, a - 16, b - 16),
                                         ellipse_mask((w, h), cx + dx, cy + dy, a1, b1))).astype(float) / 255
        span = (ang - lo) % 360
        width = (hi - lo) % 360
        fade = np.clip(np.minimum(span, width - span) / 18.0, 0, 1) * (span <= width)
        return Image.fromarray((e * fade * 255).astype(np.uint8))
    red = crescent(46, -8, a - 36, b - 22, 105, 300)
    blue = crescent(-46, 10, a - 36, b - 22, 290, 95)
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    img.paste(Image.new('RGBA', (w, h), RED), (0, 0), red)
    img.paste(Image.new('RGBA', (w, h), BLUE), (0, 0), blue)
    img.paste(Image.new('RGBA', (w, h), (20, 22, 40, 255)), (0, 0), ring)
    f = script_font(206)
    t = mask_text((w, h), 'Fairtex', f, (cx + 6, cy + 8), stroke=4)
    t = shear(t, 0.06)
    img.paste(Image.new('RGBA', (w, h), BLACK), (0, 0), t)
    return img


def arc_text(img, txt, cx, cy, rad, centre_deg, sz, color, top=True, spacing=1.12):
    f = ImageFont.truetype(SANS_B, sz)
    widths = [f.getlength(c) * spacing for c in txt]
    span = math.degrees(sum(widths) / rad)
    a = centre_deg + (span / 2 if top else -span / 2)
    for c, cw in zip(txt, widths):
        half = math.degrees(cw / 2 / rad)
        a = a - half if top else a + half
        t = Image.new('RGBA', (sz * 2, sz * 2), (0, 0, 0, 0))
        ImageDraw.Draw(t).text((sz, sz), c, font=f, fill=color, anchor='mm')
        t = t.rotate(a - 90 if top else a + 90, resample=Image.BICUBIC)
        r = math.radians(a)
        x = cx + rad * math.cos(r)
        y = cy - rad * math.sin(r)
        img.alpha_composite(t, (int(x - sz), int(y - sz)))
        a = a - half if top else a + half


THAI = [(0.52, 0.02), (0.62, 0.06), (0.66, 0.14), (0.78, 0.18), (0.86, 0.26), (0.96, 0.33), (0.92, 0.46),
        (0.84, 0.52), (0.72, 0.50), (0.66, 0.58), (0.58, 0.60), (0.52, 0.66), (0.44, 0.62), (0.40, 0.70),
        (0.36, 0.80), (0.42, 0.90), (0.50, 0.98), (0.44, 0.99), (0.34, 0.88), (0.28, 0.74), (0.30, 0.58),
        (0.34, 0.48), (0.24, 0.40), (0.20, 0.28), (0.30, 0.16), (0.40, 0.08)]


def badge():
    s = 512
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    big = Image.new('RGBA', (s * 2, s * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    c = s
    d.ellipse((c - 470, c - 470, c + 470, c + 470), outline=WHITE, width=26)
    d.ellipse((c - 318, c - 318, c + 318, c + 318), outline=WHITE, width=12)
    # Thailand, in outline, behind THAILAND
    pts = [(c - 150 + x * 300, c - 260 + y * 560) for x, y in THAI]
    d.polygon(pts, outline=WHITE, width=10)
    img = big.resize((s, s), Image.LANCZOS)
    arc_text(img, 'HAND MADE IN', s / 2, s / 2, 197, 90, 44, WHITE, top=True)
    arc_text(img, 'GENUINE LEATHER', s / 2, s / 2, 197, 270, 40, WHITE, top=False)
    f = ImageFont.truetype(SANS_B, 52)
    band = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(band).rectangle((s / 2 - 150, s / 2 - 36, s / 2 + 150, s / 2 + 36), fill=(0, 0, 0, 0))
    ImageDraw.Draw(img).text((s / 2, s / 2 + 4), 'THAILAND', font=f, fill=WHITE, anchor='mm', stroke_width=7,
                             stroke_fill=(0, 0, 0, 0))
    return img


def size_tag():
    w, h = 128, 256
    img = Image.new('RGBA', (h, w), (0, 0, 0, 0))   # drawn landscape, rotated to read bottom to top
    d = ImageDraw.Draw(img)
    d.rectangle((40, 18, 216, 110), outline=BLACK, width=7)
    d.text((128, 66), '10', font=ImageFont.truetype(SANS_B, 76), fill=BLACK, anchor='mm')
    return img.rotate(90, expand=True)


def main():
    atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    atlas.alpha_composite(wordmark(), (0, 0))
    atlas.alpha_composite(oval(), (1280, 0))
    atlas.alpha_composite(badge(), (0, 512))
    atlas.alpha_composite(size_tag(), (512, 512))
    # bleed colour into transparent texels so mipmaps/filtering don't darken the edges
    a = np.array(atlas).astype(float)
    alpha = a[..., 3:4] / 255
    col = Image.fromarray(a[..., :3].astype(np.uint8))
    blur = np.array(col.filter(ImageFilter.GaussianBlur(6))).astype(float)
    wsum = np.array(Image.fromarray((alpha[..., 0] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))).astype(float)[..., None] / 255
    premul = np.array(Image.fromarray((a[..., :3] * alpha).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))).astype(float)
    fill = premul / np.maximum(wsum, 1e-3)
    rgb = np.where(alpha > 0.02, a[..., :3], np.clip(fill, 0, 255))
    out = np.dstack([rgb, a[..., 3]]).astype(np.uint8)
    Image.fromarray(out, 'RGBA').save(os.path.join(OUT, 'decals.png'))
    # preview on red leather
    prev = Image.new('RGBA', (W, H), (150, 22, 28, 255))
    prev.alpha_composite(atlas)
    prev.convert('RGB').resize((1024, 512)).save(os.path.join(SCRATCH, 'gloves_decals_preview.png'))
    print('ok', os.path.join(OUT, 'decals.png'))


if __name__ == '__main__':
    main()
