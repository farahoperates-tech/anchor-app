#!/usr/bin/env python3
"""Generate Anchor app icons (pure stdlib — no PIL needed)."""
import math
import struct
import zlib


def write_png(path, size, pixels):
    """pixels: flat list of (r, g, b) tuples, row-major."""
    raw = bytearray()
    for y in range(size):
        raw.append(0)  # filter: none
        for x in range(size):
            raw.extend(pixels[y * size + x])

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)  # RGB8
    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", ihdr)
           + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
           + chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(png)


def smoothstep(edge0, edge1, x):
    t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3 - 2 * t)


def dist(x, y, px, py):
    return math.hypot(x - px, y - py)


def seg_dist(x, y, ax, ay, bx, by):
    """distance from point to segment"""
    vx, vy = bx - ax, by - ay
    t = ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy)
    t = max(0.0, min(1.0, t))
    return math.hypot(x - (ax + vx * t), y - (ay + vy * t))


def anchor_sdf(x, y, s):
    """Signed distance to anchor shape; coords in 0..1 space, s = stroke half-width."""
    cx = 0.5
    ring_cy, ring_r = 0.265, 0.085
    shaft_top, shaft_bot = ring_cy + ring_r, 0.76
    bar_y, bar_half = 0.435, 0.16
    arc_cy, arc_r = 0.545, 0.235

    d = abs(dist(x, y, cx, ring_cy) - ring_r) - s          # top ring
    d = min(d, seg_dist(x, y, cx, shaft_top, cx, shaft_bot) - s)   # shaft
    d = min(d, seg_dist(x, y, cx - bar_half, bar_y, cx + bar_half, bar_y) - s)  # crossbar
    # bottom arc: lower half of a circle
    arc = abs(dist(x, y, cx, arc_cy) - arc_r) - s
    arc = max(arc, arc_cy - y)  # keep only y >= arc_cy
    d = min(d, arc)
    # fluke tips at arc ends
    d = min(d, dist(x, y, cx - arc_r, arc_cy + 0.01) - s * 1.9)
    d = min(d, dist(x, y, cx + arc_r, arc_cy + 0.01) - s * 1.9)
    return d


def render(size):
    top = (72, 104, 114)     # lighter teal
    bot = (44, 68, 77)       # deep teal
    sand = (216, 169, 126)
    aa = 1.2 / size
    stroke = 0.028
    px = []
    for j in range(size):
        v = j / (size - 1)
        bg = tuple(round(top[i] + (bot[i] - top[i]) * v) for i in range(3))
        for i_ in range(size):
            u = i_ / (size - 1)
            d = anchor_sdf(u, v, stroke)
            a = 1.0 - smoothstep(-aa, aa, d)
            if a <= 0:
                px.append(bg)
            else:
                px.append(tuple(round(bg[k] + (sand[k] - bg[k]) * a) for k in range(3)))
    return px


for sz in (180, 192, 512):
    write_png(f"icons/icon-{sz}.png", sz, render(sz))
    print(f"icons/icon-{sz}.png done")
