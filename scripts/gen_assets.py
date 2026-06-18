#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Génère les icônes et illustrations PNG du PowerPoint ColorRoom (Pillow)."""
import os, math
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "assets")
os.makedirs(OUT, exist_ok=True)

INDIGO = (67, 97, 238)
VIOLET = (124, 58, 237)
PINK   = (236, 72, 153)
GREEN  = (6, 214, 160)
AMBER  = (245, 158, 11)
SLATE  = (51, 65, 85)
CYAN   = (34, 211, 238)
RED    = (239, 68, 68)
WHITE  = (255, 255, 255)
DARK   = (15, 23, 42)

S = 256  # canvas icônes
SS = 4   # supersampling

def _mix(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))

def _grad_square(size, c1, c2, radius_ratio=0.26):
    """Carré arrondi à dégradé diagonal."""
    big = size * SS
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    grad = Image.new("RGB", (big, big))
    px = grad.load()
    for y in range(big):
        for x in range(big):
            t = (x + y) / (2 * big)
            px[x, y] = _mix(c1, c2, t)
    mask = Image.new("L", (big, big), 0)
    md = ImageDraw.Draw(mask)
    r = int(big * radius_ratio)
    md.rounded_rectangle([0, 0, big - 1, big - 1], radius=r, fill=255)
    img.paste(grad, (0, 0), mask)
    # reflet glace diagonal en haut
    gloss = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    gd = ImageDraw.Draw(gloss)
    gd.polygon([(0, 0), (big, 0), (0, int(big * 0.6))], fill=(255, 255, 255, 60))
    img = Image.alpha_composite(img, Image.composite(gloss, Image.new("RGBA", (big, big), (0,0,0,0)), mask))
    return img.resize((size, size), Image.LANCZOS)

def icon(name, glyph_fn, c1, c2):
    img = _grad_square(S, c1, c2)
    big = S * SS
    layer = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    glyph_fn(d, big)
    layer = layer.resize((S, S), Image.LANCZOS)
    img = Image.alpha_composite(img, layer)
    img.save(os.path.join(OUT, f"ic_{name}.png"))

LW = 22 * SS  # épaisseur de trait des glyphes (à l'échelle big)
def _lw(big): return max(6, int(big * 0.055))

# ── Glyphes (dessinés en blanc, zone ~ 28%..72% du canvas) ───────────────────
def g_play(d, b):
    m = b * 0.30; d.polygon([(m, m), (m, b - m), (b - m, b / 2)], fill=WHITE)

def g_puzzle(d, b):
    w = _lw(b); c = b // 2; s = b * 0.20
    d.rounded_rectangle([b*0.28, b*0.28, b*0.72, b*0.72], radius=int(b*0.05), outline=WHITE, width=w)
    d.ellipse([c - s/2, b*0.20, c + s/2, b*0.36], fill=WHITE)
    d.ellipse([b*0.64, c - s/2, b*0.80, c + s/2], fill=WHITE)

def g_robot(d, b):
    w = _lw(b)
    d.rounded_rectangle([b*0.28, b*0.34, b*0.72, b*0.70], radius=int(b*0.08), outline=WHITE, width=w)
    d.line([b*0.5, b*0.22, b*0.5, b*0.34], fill=WHITE, width=w)
    d.ellipse([b*0.46, b*0.16, b*0.54, b*0.24], fill=WHITE)
    d.ellipse([b*0.37, b*0.45, b*0.45, b*0.53], fill=WHITE)
    d.ellipse([b*0.55, b*0.45, b*0.63, b*0.53], fill=WHITE)

def g_phone(d, b):
    w = _lw(b)
    d.rounded_rectangle([b*0.36, b*0.22, b*0.64, b*0.78], radius=int(b*0.06), outline=WHITE, width=w)
    d.ellipse([b*0.485, b*0.68, b*0.515, b*0.71], fill=WHITE)

def g_palette(d, b):
    w = _lw(b)
    d.ellipse([b*0.26, b*0.26, b*0.74, b*0.74], outline=WHITE, width=w)
    for (cx, cy) in [(0.42, 0.38), (0.58, 0.36), (0.66, 0.52)]:
        d.ellipse([b*(cx-0.04), b*(cy-0.04), b*(cx+0.04), b*(cy+0.04)], fill=WHITE)

def g_lock(d, b):
    w = _lw(b)
    d.rounded_rectangle([b*0.34, b*0.46, b*0.66, b*0.74], radius=int(b*0.04), fill=WHITE)
    d.arc([b*0.38, b*0.26, b*0.62, b*0.56], start=180, end=360, fill=WHITE, width=w)

def g_network(d, b):
    w = _lw(b); r = b*0.05
    pts = [(0.5, 0.28), (0.30, 0.66), (0.70, 0.66)]
    d.line([b*0.5, b*0.28, b*0.30, b*0.66], fill=WHITE, width=w)
    d.line([b*0.5, b*0.28, b*0.70, b*0.66], fill=WHITE, width=w)
    d.line([b*0.30, b*0.66, b*0.70, b*0.66], fill=WHITE, width=w)
    for (cx, cy) in pts:
        d.ellipse([b*cx-r, b*cy-r, b*cx+r, b*cy+r], fill=WHITE)

def g_container(d, b):
    w = _lw(b)
    for i, yy in enumerate([0.30, 0.46, 0.62]):
        d.rounded_rectangle([b*0.28, b*yy, b*0.72, b*(yy+0.10)], radius=int(b*0.02), outline=WHITE, width=w)

def g_code(d, b):
    w = _lw(b)
    d.line([b*0.42, b*0.34, b*0.30, b*0.5, b*0.42, b*0.66], fill=WHITE, width=w, joint="curve")
    d.line([b*0.58, b*0.34, b*0.70, b*0.5, b*0.58, b*0.66], fill=WHITE, width=w, joint="curve")

def g_cube(d, b):
    w = _lw(b)
    cx, cy = b*0.5, b*0.5; r = b*0.22
    top = [(cx, cy-r), (cx+r, cy-r*0.5), (cx, cy), (cx-r, cy-r*0.5)]
    d.polygon(top, outline=WHITE, width=w)
    d.line([cx, cy, cx, cy+r], fill=WHITE, width=w)
    d.line([cx-r, cy-r*0.5, cx-r, cy+r*0.5, cx, cy+r], fill=WHITE, width=w, joint="curve")
    d.line([cx+r, cy-r*0.5, cx+r, cy+r*0.5, cx, cy+r], fill=WHITE, width=w, joint="curve")

def g_bolt(d, b):
    d.polygon([(b*0.56, b*0.24), (b*0.34, b*0.54), (b*0.48, b*0.54),
               (b*0.44, b*0.76), (b*0.66, b*0.46), (b*0.52, b*0.46)], fill=WHITE)

def g_gear(d, b):
    w = _lw(b); cx, cy = b*0.5, b*0.5; R = b*0.22
    for k in range(8):
        a = math.radians(k*45)
        x1 = cx + math.cos(a)*R; y1 = cy + math.sin(a)*R
        x2 = cx + math.cos(a)*(R+b*0.08); y2 = cy + math.sin(a)*(R+b*0.08)
        d.line([x1, y1, x2, y2], fill=WHITE, width=w)
    d.ellipse([cx-R, cy-R, cx+R, cy+R], outline=WHITE, width=w)
    d.ellipse([cx-b*0.07, cy-b*0.07, cx+b*0.07, cy+b*0.07], fill=WHITE)

def g_target(d, b):
    w = _lw(b); cx, cy = b*0.5, b*0.5
    for rr in [0.22, 0.13]:
        d.ellipse([cx-b*rr, cy-b*rr, cx+b*rr, cy+b*rr], outline=WHITE, width=w)
    d.ellipse([cx-b*0.04, cy-b*0.04, cx+b*0.04, cy+b*0.04], fill=WHITE)

def g_users(d, b):
    for cx in (0.40, 0.60):
        d.ellipse([b*(cx-0.08), b*0.30, b*(cx+0.08), b*0.46], fill=WHITE)
        d.pieslice([b*(cx-0.12), b*0.48, b*(cx+0.12), b*0.80], start=180, end=360, fill=WHITE)

def g_chat(d, b):
    w = _lw(b)
    d.rounded_rectangle([b*0.26, b*0.30, b*0.74, b*0.62], radius=int(b*0.08), outline=WHITE, width=w)
    d.polygon([(b*0.36, b*0.62), (b*0.36, b*0.74), (b*0.48, b*0.62)], fill=WHITE)
    for cx in (0.40, 0.50, 0.60):
        d.ellipse([b*(cx-0.025), b*0.44, b*(cx+0.025), b*0.49], fill=WHITE)

def g_check(d, b):
    w = int(_lw(b)*1.2)
    d.line([b*0.32, b*0.52, b*0.45, b*0.66, b*0.70, b*0.34], fill=WHITE, width=w, joint="curve")

def g_chart(d, b):
    w = _lw(b)
    for i, (xx, h) in enumerate([(0.34, 0.18), (0.48, 0.30), (0.62, 0.24)]):
        d.rounded_rectangle([b*xx, b*(0.70-h), b*(xx+0.08), b*0.70], radius=int(b*0.01), fill=WHITE)

def g_doc(d, b):
    w = _lw(b)
    d.rounded_rectangle([b*0.34, b*0.26, b*0.66, b*0.74], radius=int(b*0.04), outline=WHITE, width=w)
    for yy in (0.40, 0.50, 0.60):
        d.line([b*0.42, b*yy, b*0.58, b*yy], fill=WHITE, width=int(w*0.7))

def g_eye(d, b):
    w = _lw(b); cx, cy = b*0.5, b*0.5
    d.ellipse([b*0.26, b*0.36, b*0.74, b*0.64], outline=WHITE, width=w)
    d.ellipse([cx-b*0.08, cy-b*0.08, cx+b*0.08, cy+b*0.08], fill=WHITE)

ICONS = {
    "play": (g_play, INDIGO, _mix(INDIGO, WHITE, 0.25)),
    "puzzle": (g_puzzle, VIOLET, _mix(VIOLET, WHITE, 0.25)),
    "robot": (g_robot, PINK, _mix(PINK, WHITE, 0.25)),
    "phone": (g_phone, GREEN, _mix(GREEN, WHITE, 0.25)),
    "palette": (g_palette, AMBER, _mix(AMBER, WHITE, 0.25)),
    "lock": (g_lock, SLATE, _mix(SLATE, WHITE, 0.30)),
    "network": (g_network, CYAN, _mix(CYAN, WHITE, 0.25)),
    "container": (g_container, INDIGO, VIOLET),
    "code": (g_code, VIOLET, PINK),
    "cube": (g_cube, INDIGO, CYAN),
    "bolt": (g_bolt, AMBER, _mix(AMBER, PINK, 0.4)),
    "gear": (g_gear, SLATE, _mix(SLATE, INDIGO, 0.4)),
    "target": (g_target, PINK, VIOLET),
    "users": (g_users, GREEN, INDIGO),
    "chat": (g_chat, VIOLET, INDIGO),
    "check": (g_check, GREEN, _mix(GREEN, WHITE, 0.2)),
    "chart": (g_chart, INDIGO, _mix(INDIGO, WHITE, 0.25)),
    "doc": (g_doc, SLATE, _mix(SLATE, WHITE, 0.3)),
    "eye": (g_eye, CYAN, INDIGO),
}
for nm, (fn, c1, c2) in ICONS.items():
    icon(nm, fn, c1, c2)

# ── Illustration : grille de 42 dalles LED ──────────────────────────────────
def led_grid(path, cols=6, rows=7, transparent_bg=False):
    cell, gap, pad = 130, 16, 40
    W = pad*2 + cols*cell + (cols-1)*gap
    H = pad*2 + rows*cell + (rows-1)*gap
    big = 2
    img = Image.new("RGBA", (W*big, H*big), (0,0,0,0) if transparent_bg else (*DARK, 255))
    d = ImageDraw.Draw(img)
    palette = [INDIGO, VIOLET, PINK, GREEN, AMBER, CYAN, RED,
               _mix(VIOLET, PINK, 0.5), _mix(INDIGO, CYAN, 0.5)]
    import random; random.seed(7)
    for r in range(rows):
        for c in range(cols):
            x = (pad + c*(cell+gap))*big
            y = (pad + r*(cell+gap))*big
            col = random.choice(palette)
            # halo
            d.rounded_rectangle([x-6*big, y-6*big, x+(cell+6)*big, y+(cell+6)*big],
                                radius=int(cell*0.28)*big, fill=(*col, 40))
            d.rounded_rectangle([x, y, x+cell*big, y+cell*big],
                                radius=int(cell*0.22)*big, fill=(*col, 255))
            # reflet
            d.polygon([(x, y), (x+cell*big, y), (x, y+int(cell*0.55)*big)], fill=(255,255,255,55))
    img.resize((W, H), Image.LANCZOS).save(path)
led_grid(os.path.join(OUT, "led_grid.png"))

# ── Illustration : diagramme CIE simplifié (fer à cheval + triangle) ─────────
def cie(path):
    W = H = 720; big = 2
    img = Image.new("RGBA", (W*big, H*big), (0,0,0,0))
    d = ImageDraw.Draw(img)
    # "fer à cheval" approx par un polygone coloré
    horseshoe = [(0.18,0.05),(0.07,0.30),(0.05,0.55),(0.12,0.78),(0.35,0.92),
                 (0.60,0.85),(0.78,0.62),(0.72,0.38),(0.52,0.18),(0.30,0.08)]
    pts = [(x*W*big, y*H*big) for (x,y) in horseshoe]
    # remplissage dégradé grossier par bandes
    d.polygon(pts, fill=(*_mix(GREEN, INDIGO, 0.3), 70), outline=(*SLATE,255))
    # triangle gamut RVB
    tri = [(0.62,0.30),(0.30,0.75),(0.20,0.35)]
    tpts = [(x*W*big, y*H*big) for (x,y) in tri]
    d.polygon(tpts, outline=(*WHITE,255), width=4*big)
    cols = [RED, GREEN, INDIGO]
    for (x,y), col in zip(tri, cols):
        d.ellipse([x*W*big-12*big, y*H*big-12*big, x*W*big+12*big, y*H*big+12*big], fill=(*col,255))
    # point mesuré
    mx, my = 0.40, 0.50
    d.ellipse([mx*W*big-10*big, my*H*big-10*big, mx*W*big+10*big, my*H*big+10*big], fill=(*WHITE,255))
    d.ellipse([mx*W*big-5*big, my*H*big-5*big, mx*W*big+5*big, my*H*big+5*big], fill=(*PINK,255))
    img.resize((W,H), Image.LANCZOS).save(path)
cie(os.path.join(OUT, "cie.png"))

# ── Illustration : 3 téléphones (multijoueur) ───────────────────────────────
def phones(path):
    W, H = 900, 520; big = 2
    img = Image.new("RGBA", (W*big, H*big), (0,0,0,0))
    d = ImageDraw.Draw(img)
    cols = [GREEN, AMBER, PINK]
    for i, col in enumerate(cols):
        x = (120 + i*270)*big; y = (60 + (i%2)*40)*big
        w, h = 220*big, 380*big
        d.rounded_rectangle([x, y, x+w, y+h], radius=40*big, fill=(*DARK,255), outline=(*SLATE,255), width=3*big)
        d.rounded_rectangle([x+18*big, y+50*big, x+w-18*big, y+h-60*big], radius=18*big, fill=(20,26,40,255))
        # grosse pastille couleur
        d.rounded_rectangle([x+50*big, y+120*big, x+w-50*big, y+h-130*big], radius=24*big, fill=(*col,255))
        d.polygon([(x+50*big, y+120*big), (x+w-50*big, y+120*big), (x+50*big, y+200*big)], fill=(255,255,255,55))
        # home dot
        d.ellipse([x+w/2-8*big, y+h-40*big, x+w/2+8*big, y+h-24*big], outline=(*SLATE,255), width=2*big)
    img.resize((W,H), Image.LANCZOS).save(path)
phones(os.path.join(OUT, "phones.png"))

print("Assets générés dans", OUT)
print(sorted(os.listdir(OUT)))
