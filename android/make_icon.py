from PIL import Image, ImageDraw, ImageFilter
import math

SIZE = 432


def make_icon():
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))

    # background rounded square, deep space gradient
    bg = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(bg)
    top = (18, 12, 38, 255)
    bottom = (8, 6, 20, 255)
    for y in range(SIZE):
        t = y / SIZE
        r = int(top[0] + (bottom[0] - top[0]) * t)
        g = int(top[1] + (bottom[1] - top[1]) * t)
        b = int(top[2] + (bottom[2] - top[2]) * t)
        d.line([(0, y), (SIZE, y)], fill=(r, g, b, 255))
    mask = Image.new("L", (SIZE, SIZE), 0)
    md = ImageDraw.Draw(mask)
    radius = int(SIZE * 0.22)
    md.rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=radius, fill=255)
    img = Image.composite(bg, img, mask)

    # glow layer for the orb
    glow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    cx, cy = SIZE // 2, int(SIZE * 0.56)
    for rad, alpha in [(200, 40), (160, 55), (120, 80), (85, 130)]:
        gd.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=(79, 224, 255, alpha))
    glow = glow.filter(ImageFilter.GaussianBlur(18))
    img = Image.alpha_composite(img, glow)

    # neon track chevrons converging toward the orb (motion / speed cue)
    track = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    td = ImageDraw.Draw(track)
    vp = (cx, int(SIZE * 0.30))
    for side in (-1, 1):
        base_x = cx + side * int(SIZE * 0.44)
        base_y = SIZE + 20
        td.line([(base_x, base_y), vp], fill=(120, 90, 255, 160), width=10)
    for side in (-1, 1):
        base_x = cx + side * int(SIZE * 0.20)
        base_y = SIZE + 20
        td.line([(base_x, base_y), vp], fill=(79, 224, 255, 130), width=7)
    track = track.filter(ImageFilter.GaussianBlur(1))
    img = Image.alpha_composite(img, track)

    # the orb itself (player), glossy sphere with rim light
    orb_r = int(SIZE * 0.165)
    orb = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    od = ImageDraw.Draw(orb)
    for i in range(orb_r, 0, -1):
        t = i / orb_r
        r = int(30 + (140 - 30) * (1 - t))
        g = int(190 + (235 - 190) * (1 - t))
        b = int(255)
        od.ellipse([cx - i, cy - i, cx + i, cy + i], fill=(r, g, b, 255))
    # rim highlight
    hi = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    hd = ImageDraw.Draw(hi)
    hr = int(orb_r * 0.45)
    hx, hy = cx - int(orb_r * 0.35), cy - int(orb_r * 0.4)
    hd.ellipse([hx - hr, hy - hr, hx + hr, hy + hr], fill=(255, 255, 255, 210))
    hi = hi.filter(ImageFilter.GaussianBlur(6))
    orb = Image.alpha_composite(orb, hi)
    img = Image.alpha_composite(img, orb)

    # outer rounded-square border glow
    border = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    bd = ImageDraw.Draw(border)
    bd.rounded_rectangle([4, 4, SIZE - 5, SIZE - 5], radius=radius, outline=(79, 224, 255, 180), width=6)
    img = Image.alpha_composite(img, border)

    return img


icon = make_icon()
sizes = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}
import os
base = os.path.dirname(os.path.abspath(__file__))
for folder, px in sizes.items():
    outdir = os.path.join(base, "res", folder)
    os.makedirs(outdir, exist_ok=True)
    resized = icon.resize((px, px), Image.LANCZOS)
    resized.save(os.path.join(outdir, "ic_launcher.png"))
print("done")
