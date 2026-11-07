# Generates the Stormcaller Bow pixel-art textures (needs Pillow).
# Usage: python3 tools/gen_bow_texture.py src/main/resources/assets/stormcaller/textures/item
import sys, math
from PIL import Image
out = sys.argv[1]

OUT  = (20, 18, 48, 255)
DARK = (44, 46, 110, 255)
MID  = (72, 84, 176, 255)
HI   = (128, 156, 240, 255)
COP  = (196, 112, 52, 255)
COPH = (240, 170, 96, 255)
GOLD = (255, 214, 72, 255)
GOLDD= (176, 120, 24, 255)
STR  = (120, 228, 255, 255)
STRH = (230, 255, 255, 255)
SHAFT= (172, 176, 210, 255)
FLET = (220, 240, 255, 255)
HEAD = (255, 236, 110, 255)
HEADD= (232, 168, 40, 255)
SPARK= (190, 250, 255, 255)

T = (14.5, 1.5)   # top tip
B = (1.5, 14.5)   # bottom tip
C = (2.2, 2.2)    # curve control (bulges to the top-left)

def bez(t):
    return ((1-t)**2*T[0] + 2*(1-t)*t*C[0] + t*t*B[0],
            (1-t)**2*T[1] + 2*(1-t)*t*C[1] + t*t*B[1])

def frame(pull):
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    px = im.load()
    def put(x, y, c, over=True):
        x, y = int(math.floor(x)), int(math.floor(y))
        if 0 <= x < 16 and 0 <= y < 16 and (over or px[x, y][3] == 0):
            px[x, y] = c

    # string first so the limbs draw over its ends
    N = (7.5 + pull * 1.3, 7.5 + pull * 1.3)  # nock point, moves back as you draw
    for a, b in ((T, N), (N, B)):
        n = 40
        for i in range(n + 1):
            t = i / n
            put(a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t, STR)
    if pull:
        put(N[0], N[1], STRH)

    # limb: thick outline pass, then fill, then inner highlight
    samples = [bez(i / 200) for i in range(201)]
    for (x, y) in samples:
        for dx in (-0.7, 0, 0.7):
            for dy in (-0.7, 0, 0.7):
                put(x + dx, y + dy, OUT)
    for (x, y) in samples:
        put(x, y, DARK)
        put(x + 0.45, y + 0.45, MID)   # inner (string-side) face is lit
    for i, (x, y) in enumerate(samples):
        if 30 < i < 170 and i % 2 == 0:
            put(x + 0.9, y + 0.9, HI, over=False)

    # copper tips
    for tip, d in ((T, (-1, 1)), (B, (1, -1))):
        put(tip[0], tip[1], COPH)
        put(tip[0] + d[0]*0.0, tip[1] + d[1]*0.0, COPH)
    put(13.5, 1.5, COP); put(14.5, 2.5, COP); put(15.5, 1.5, COPH)
    put(1.5, 13.5, COP); put(2.5, 14.5, COP); put(1.5, 15.5, COPH)

    # charged arrow
    if pull:
        length = (N[0] - 1.6) * math.sqrt(2)
        dx, dy = -1 / math.sqrt(2), -1 / math.sqrt(2)
        sx, sy = N[0], N[1]
        # fletching at the nock
        put(sx + 1, sy, FLET); put(sx, sy + 1, FLET)
        for i in range(1, int(length * 1.42)):
            x, y = sx + dx * i * 0.72, sy + dy * i * 0.72
            put(x, y, SHAFT)
        hx, hy = sx + dx * length, sy + dy * length
        put(hx, hy, HEAD); put(hx + 1, hy, HEADD); put(hx, hy + 1, HEADD)
        # sparks crackling off the head
        if pull >= 2:
            put(hx + 2, hy - 1, SPARK, over=False); put(hx - 1, hy + 2, SPARK, over=False)
        if pull >= 3:
            put(hx + 1, hy - 1, SPARK, over=False); put(hx - 1, hy + 1, SPARK, over=False)
    # gold grip wrap at the middle of the curve, with a dark band
    gx, gy = bez(0.5)
    for (x, y) in [(gx-1, gy), (gx, gy-1), (gx, gy), (gx+1, gy-1), (gx-1, gy+1), (gx+1, gy)]:
        put(x, y, GOLD)
    put(gx, gy, GOLDD)
    put(gx-1, gy+1, GOLDD)

    # lightning-bolt notches on the limbs
    for t in (0.22, 0.78):
        x, y = bez(t)
        put(x + 0.5, y + 0.5, GOLD)

    return im

names = ["stormcaller_bow", "stormcaller_bow_pulling_0", "stormcaller_bow_pulling_1", "stormcaller_bow_pulling_2"]
frames = [frame(0), frame(1), frame(2), frame(3)]
for n, f in zip(names, frames):
    f.save(f"{out}/{n}.png")

