#!/usr/bin/env python3
"""TWIN SOCCER — uygulama simgesi üreteci (harici bağımlılık yok).

Saf Python ile PNG yazar: koyu yeşil sahalı, beyaz toplu, elektrik yeşili
halkalı özgün bir simge üretir ve Android mipmap klasörlerine yazar.
"""
import math, os, struct, zlib

def png(path, w, h, px):
    def chunk(t, d):
        c = t + d
        return struct.pack(">I", len(d)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)
    raw = b"".join(b"\x00" + bytes(px[y * w * 4:(y + 1) * w * 4]) for y in range(h))
    data = (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9))
            + chunk(b"IEND", b""))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, "wb").write(data)

def blend(dst, i, col, a):
    for k in range(3):
        dst[i + k] = int(dst[i + k] * (1 - a) + col[k] * a)
    dst[i + 3] = max(dst[i + 3], int(255 * a))

def draw(size, full_bleed):
    """full_bleed=True → adaptive foreground (şeffaf zemin, %66 güvenli alan)."""
    px = bytearray(size * size * 4)
    cx = cy = size / 2
    R = size * (0.34 if full_bleed else 0.46)
    ss = 2  # kenar yumuşatma örneklemesi
    for y in range(size):
        for x in range(size):
            i = (y * size + x) * 4
            acc = [0.0, 0.0, 0.0, 0.0]
            for sy in range(ss):
                for sx in range(ss):
                    fx = x + (sx + 0.5) / ss
                    fy = y + (sy + 0.5) / ss
                    d = math.hypot(fx - cx, fy - cy)
                    col, a = None, 0.0
                    if not full_bleed:
                        # köşeleri yuvarlatılmış koyu kare zemin
                        r = size * 0.22
                        qx = max(abs(fx - cx) - (size / 2 - r), 0)
                        qy = max(abs(fy - cy) - (size / 2 - r), 0)
                        if math.hypot(qx, qy) <= r:
                            t = fy / size
                            col = (int(6 + 10 * t), int(18 + 30 * t), int(14 + 22 * t))
                            a = 1.0
                    # dış halka (elektrik yeşili)
                    if R * 0.86 <= d <= R:
                        col, a = (43, 245, 160), 1.0
                    # saha dairesi
                    elif d < R * 0.86:
                        t = (fy - (cy - R)) / (2 * R)
                        col, a = (int(14 + 18 * t), int(70 + 44 * t), int(38 + 26 * t)), 1.0
                    # orta saha çizgisi
                    if abs(fx - cx) < size * 0.012 and d < R * 0.86:
                        col, a = (215, 245, 230), 1.0
                    # top
                    bd = math.hypot(fx - cx, fy - cy + size * 0.02)
                    if bd < R * 0.34:
                        sh = 1 - (bd / (R * 0.34)) * 0.35
                        col, a = (int(245 * sh), int(250 * sh), int(255 * sh)), 1.0
                        br = R * 0.34
                        # merkez beşgen + çevresinde 5 yama
                        if bd < br * 0.30:
                            col = (24, 32, 44)
                        for k in range(5):
                            pa = k * 2 * math.pi / 5 - math.pi / 2
                            sxp = cx + math.cos(pa) * br * 0.66
                            syp = cy - size * 0.02 + math.sin(pa) * br * 0.66
                            if math.hypot(fx - sxp, fy - syp) < br * 0.26:
                                col = (24, 32, 44)
                    if a > 0 and col:
                        acc[0] += col[0]; acc[1] += col[1]; acc[2] += col[2]; acc[3] += 1
            n = ss * ss
            if acc[3] > 0:
                cov = acc[3] / n
                blend(px, i, (acc[0] / acc[3], acc[1] / acc[3], acc[2] / acc[3]), cov)
    return px

RES = "android/app/src/main/res"
for folder, size in [("mipmap-mdpi", 48), ("mipmap-hdpi", 72), ("mipmap-xhdpi", 96),
                     ("mipmap-xxhdpi", 144), ("mipmap-xxxhdpi", 192)]:
    png(f"{RES}/{folder}/ic_launcher.png", size, size, draw(size, False))
    png(f"{RES}/{folder}/ic_launcher_round.png", size, size, draw(size, False))
    fg = int(size * 108 / 48)
    png(f"{RES}/{folder}/ic_launcher_foreground.png", fg, fg, draw(fg, True))
    print("yazıldı:", folder, size)
