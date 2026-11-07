# Generates the 3D Stormcaller Bow item models, their textures, and preview renders.
# Needs Pillow.
#
# Usage (from lightning-bow/):
#   python3 tools/gen_bow_model.py src/main/resources/assets/stormcaller [preview_dir]
#
# Model space is Minecraft's 0-16 cube: x right, y up, z toward the viewer.
# The bow lies in the same diagonal as the flat sprite so the vanilla bow hand poses fit.
import json
import math
import os
import sys

from PIL import Image, ImageDraw

ASSETS = sys.argv[1]
PREVIEW = sys.argv[2] if len(sys.argv) > 2 else None

ZC = 8.0  # depth centre

# ------------------------------------------------------------------ textures

# 4x4 swatches in a 16x16 atlas: (col,row) -> base colour
SWATCH = {
    "limb":    (0, 0, (52, 56, 132)),
    "limb_hi": (1, 0, (104, 128, 226)),
    "gold":    (2, 0, (250, 200, 64)),
    "leather": (3, 0, (40, 30, 44)),
    "copper":  (0, 1, (190, 104, 50)),
    "copperhi":(1, 1, (238, 160, 92)),
    "silver":  (2, 1, (188, 192, 220)),
    "fletch":  (3, 1, (236, 246, 255)),
    "head":    (0, 2, (255, 228, 96)),
    "dark":    (1, 2, (22, 20, 50)),
}


def build_atlas():
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    px = im.load()
    for name, (cx, cy, (r, g, b)) in SWATCH.items():
        for y in range(4):
            for x in range(4):
                # subtle grain so faces don't look flat
                k = 1.0 + 0.08 * (((x * 3 + y * 5 + cx * 7) % 4) - 1.5) / 1.5
                if name in ("limb", "leather"):
                    k = 1.0 + (0.10 if y % 2 == 0 else -0.06)
                px[cx * 4 + x, cy * 4 + y] = (min(255, int(r * k)), min(255, int(g * k)), min(255, int(b * k)), 255)
    return im


def build_energy():
    """Animated crackling energy: a bright band sweeps diagonally across a cyan field."""
    frames = 8
    im = Image.new("RGBA", (16, 16 * frames), (0, 0, 0, 255))
    px = im.load()
    for f in range(frames):
        for y in range(16):
            for x in range(16):
                d = ((x + y) - f * 4) % 32
                band = max(0.0, 1.0 - abs(d - 8) / 5.0)
                flicker = 0.85 + 0.15 * math.sin((x * 1.7 + y * 2.3 + f * 2.1))
                r = int((90 + 165 * band) * flicker)
                g = int((210 + 45 * band) * flicker)
                b = 255
                px[x, f * 16 + y] = (min(r, 255), min(g, 255), b, 255)
    return im


def uv(name):
    cx, cy, _ = SWATCH[name]
    return [cx * 4 + 0.5, cy * 4 + 0.5, cx * 4 + 3.5, cy * 4 + 3.5]


# ------------------------------------------------------------------ geometry helpers

def v_add(a, b): return (a[0] + b[0], a[1] + b[1])
def v_sub(a, b): return (a[0] - b[0], a[1] - b[1])
def v_mul(a, s): return (a[0] * s, a[1] * s)
def v_len(a): return math.hypot(a[0], a[1])
def v_norm(a):
    l = v_len(a)
    return (a[0] / l, a[1] / l)


# bow curve (quadratic bezier), mirrored from the sprite into model space (y up)
T = (14.5, 14.5)
C = (2.2, 13.8)
B = (1.5, 1.5)


def bez(t):
    return ((1 - t) ** 2 * T[0] + 2 * (1 - t) * t * C[0] + t * t * B[0],
            (1 - t) ** 2 * T[1] + 2 * (1 - t) * t * C[1] + t * t * B[1])


def tangent(t):
    return v_norm((2 * (1 - t) * (C[0] - T[0]) + 2 * t * (B[0] - C[0]),
                   2 * (1 - t) * (C[1] - T[1]) + 2 * t * (B[1] - C[1])))


def inner_normal(t):
    """Unit normal pointing from the limb toward the string."""
    tx, ty = tangent(t)
    n = (-ty, tx)
    p = bez(t)
    to_mid = v_sub((8, 8), p)
    if n[0] * to_mid[0] + n[1] * to_mid[1] < 0:
        n = (-n[0], -n[1])
    return n


class Model:
    def __init__(self):
        self.elements = []

    def box(self, center, length, width, depth, angle, tex, zc=ZC, glow=0, euler=None):
        """A box centred on `center`, `length` along its own x axis, rotated `angle` degrees about z."""
        cx, cy = center
        el = {
            "from": [r(cx - length / 2), r(cy - width / 2), r(zc - depth / 2)],
            "to": [r(cx + length / 2), r(cy + width / 2), r(zc + depth / 2)],
            "faces": {},
        }
        if euler is not None:
            el["rotation"] = {"origin": [r(cx), r(cy), r(zc)], "x": euler[0], "y": euler[1], "z": euler[2]}
        elif abs(angle) > 1e-3:
            el["rotation"] = {"origin": [r(cx), r(cy), r(zc)], "axis": "z", "angle": r(norm_angle(angle))}
        texref, faceuv = ("#energy", [0, 0, 16, 16]) if tex == "energy" else ("#atlas", uv(tex))
        for f in ("north", "south", "east", "west", "up", "down"):
            el["faces"][f] = {"uv": faceuv, "texture": texref}
        if glow:
            el["light_emission"] = glow
            el["shade"] = False
        el["__tex"] = tex  # stripped before export; used by the preview renderer
        self.elements.append(el)

    def beam(self, a, b, width, depth, tex, zc=ZC, glow=0, overlap=0.0):
        d = v_sub(b, a)
        length = v_len(d) + overlap
        ang = math.degrees(math.atan2(d[1], d[0]))
        self.box(v_mul(v_add(a, b), 0.5), length, width, depth, ang, tex, zc, glow)

    def export(self, display):
        els = []
        for e in self.elements:
            e = dict(e)
            e.pop("__tex")
            els.append(e)
        return {
            "textures": {
                "particle": "stormcaller:item/stormcaller_bow",
                "atlas": "stormcaller:item/stormcaller_bow_3d",
                "energy": "stormcaller:item/stormcaller_energy",
            },
            "elements": els,
            "display": display,
        }


def r(x):
    return round(x, 3)


def norm_angle(a):
    """Bring an angle into (-90, 90]: a box rotated 180 degrees is the same box."""
    while a > 90:
        a -= 180
    while a <= -90:
        a += 180
    return a


# ------------------------------------------------------------------ the bow

def build_bow(pull):
    m = Model()

    # --- limbs: chain of rotated segments, thick in the middle, tapering to the tips
    n = 16
    t0, t1 = 0.03, 0.97
    for i in range(n):
        ta = t0 + (t1 - t0) * i / n
        tb = t0 + (t1 - t0) * (i + 1) / n
        tm = (ta + tb) / 2
        a, b = bez(ta), bez(tb)
        swell = math.sin(math.pi * tm)
        width = 1.15 + 0.55 * swell
        depth = 1.1 + 1.3 * swell
        m.beam(a, b, width, depth, "limb", overlap=0.45)
        # lighter inner edge
        nrm = inner_normal(tm)
        off = v_mul(nrm, width / 2 - 0.2)
        m.beam(v_add(a, off), v_add(b, off), 0.45, depth + 0.12, "limb_hi", overlap=0.45)
        # glowing veins on both faces, away from the grip
        if 0.1 < tm < 0.38 or 0.62 < tm < 0.9:
            m.beam(a, b, 0.32, depth + 0.3, "energy", glow=15, overlap=0.1)

    # --- grip
    tg = 0.5
    g = bez(tg)
    tan = tangent(tg)
    gang = math.degrees(math.atan2(tan[1], tan[0]))
    nin = inner_normal(tg)
    nout = (-nin[0], -nin[1])
    m.box(g, 3.4, 2.4, 3.0, gang, "gold")
    for s in (-1, 1):
        m.box(v_add(g, v_mul(tan, s * 1.95)), 0.7, 2.8, 3.4, gang, "leather")
    # lightning gem set into both faces
    for zs in (-1, 1):
        m.box(g, 1.5, 1.5, 0.5, gang + 45, "energy", zc=ZC + zs * 1.6, glow=15)
        m.box(g, 2.1, 2.1, 0.3, gang + 45, "dark", zc=ZC + zs * 1.45)
    # copper wing fins sweeping off the back of each limb, toward the tips
    # (kept off the grip itself so the arrowhead has a clear path)
    for t, sign in ((0.3, -1), (0.7, 1)):
        p = bez(t)
        out_n = v_mul(inner_normal(t), -1)
        along = v_mul(tangent(t), sign)
        base = v_add(p, v_mul(out_n, 0.6))
        mid = v_add(base, v_add(v_mul(out_n, 1.3), v_mul(along, 0.9)))
        end = v_add(mid, v_add(v_mul(out_n, 0.5), v_mul(along, 1.4)))
        m.beam(base, mid, 0.7, 1.0, "copper", overlap=0.3)
        m.beam(mid, end, 0.5, 0.7, "copperhi", overlap=0.2)

    # --- tips: copper blades, recurve hooks and floating crystals
    for t, sign in ((0.0, -1), (1.0, 1)):
        tip = bez(t)
        out = v_mul(tangent(t), sign)  # pointing away from the bow along the limb
        nin_t = inner_normal(t)
        nout_t = (-nin_t[0], -nin_t[1])
        m.beam(v_sub(tip, v_mul(out, 0.6)), v_add(tip, v_mul(out, 1.9)), 1.0, 2.8, "copperhi")
        m.beam(v_add(tip, v_mul(out, 1.9)), v_add(v_add(tip, v_mul(out, 2.6)), v_mul(nout_t, 0.0)), 0.6, 1.6, "copper")
        hook_base = v_add(tip, v_mul(out, 0.4))
        m.beam(hook_base, v_add(hook_base, v_add(v_mul(nout_t, 1.6), v_mul(out, 0.6))), 0.6, 1.2, "copper")
        m.box(v_add(tip, v_add(v_mul(out, 3.9), v_mul(nout_t, 0.6))), 1.0, 1.0, 1.0, 0, "energy",
              glow=15, euler=[45, 45, 0])

    # --- string (glowing)
    s_top = v_add(bez(0.025), v_mul(inner_normal(0.025), 0.4))
    s_bot = v_add(bez(0.975), v_mul(inner_normal(0.975), 0.4))
    if pull == 0:
        nock = v_mul(v_add(s_top, s_bot), 0.5)
    else:
        nock = (7.5 + 1.3 * pull, 8.5 - 1.3 * pull)
    m.beam(s_top, nock, 0.3, 0.3, "energy", glow=15, overlap=0.15)
    m.beam(nock, s_bot, 0.3, 0.3, "energy", glow=15, overlap=0.15)

    # --- charged arrow
    if pull > 0:
        u = v_norm((-1, 1))
        head = (1.9, 14.1)
        length = v_len(v_sub(head, nock))
        ang = 135
        shaft_end = v_add(nock, v_mul(u, length - 0.6))
        m.beam(nock, shaft_end, 0.45, 0.45, "silver")
        # fletching: one fin in the bow plane, one sticking out of it
        f_c = v_add(nock, v_mul(u, 1.3))
        m.box(f_c, 2.2, 1.5, 0.15, ang, "fletch")
        m.box(f_c, 2.2, 0.15, 1.5, ang, "energy", glow=12)
        # arrowhead: a flattened diamond plus a point
        m.box(head, 1.6, 1.6, 0.5, ang + 45, "head", glow=10)
        m.beam(head, v_add(head, v_mul(u, 1.3)), 0.5, 0.5, "head", glow=10)
        # sparks crackling around the head as the draw tightens
        sparks = [(1.6, 0.9), (-0.8, 1.7), (1.2, -1.1), (-1.5, -0.6), (0.2, 2.2), (2.1, 0.1)]
        for k, (dx, dy) in enumerate(sparks[: (pull - 1) * 3]):
            m.box(v_add(head, (dx, dy)), 0.45, 0.45, 0.45, 0, "energy", glow=15,
                  euler=[45, 30 * k, 45], zc=ZC + (0.8 if k % 2 else -0.8))
    return m


# vanilla bow hand poses + item/generated poses for everything else
DISPLAY = {
    "thirdperson_righthand": {"rotation": [-80, 260, -40], "translation": [-1, -2, 2.5], "scale": [0.9, 0.9, 0.9]},
    "thirdperson_lefthand": {"rotation": [-80, -280, 40], "translation": [-1, -2, 2.5], "scale": [0.9, 0.9, 0.9]},
    "firstperson_righthand": {"rotation": [0, -90, 25], "translation": [1.13, 3.2, 1.13], "scale": [0.68, 0.68, 0.68]},
    "firstperson_lefthand": {"rotation": [0, 90, -25], "translation": [1.13, 3.2, 1.13], "scale": [0.68, 0.68, 0.68]},
    "ground": {"rotation": [0, 0, 0], "translation": [0, 2, 0], "scale": [0.5, 0.5, 0.5]},
    "head": {"rotation": [0, 180, 0], "translation": [0, 13, 7], "scale": [1, 1, 1]},
    "fixed": {"rotation": [0, 180, 0], "scale": [1, 1, 1]},
    "gui": {"rotation": [20, -30, 0], "scale": [0.9, 0.9, 0.9]},
}


# ------------------------------------------------------------------ preview renderer

def rot_axis(p, origin, axis, deg):
    a = math.radians(deg)
    x, y, z = p[0] - origin[0], p[1] - origin[1], p[2] - origin[2]
    c, s = math.cos(a), math.sin(a)
    if axis == "x":
        y, z = y * c - z * s, y * s + z * c
    elif axis == "y":
        x, z = x * c + z * s, -x * s + z * c
    else:
        x, y = x * c - y * s, x * s + y * c
    return (x + origin[0], y + origin[1], z + origin[2])


def render(model, path, yaw=-35, pitch=25, size=512):
    atlas = build_atlas()
    faces = []
    for e in model.elements:
        f, t = e["from"], e["to"]
        corners = {}
        for i, x in enumerate((f[0], t[0])):
            for j, y in enumerate((f[1], t[1])):
                for k, z in enumerate((f[2], t[2])):
                    p = (x, y, z)
                    rot = e.get("rotation")
                    if rot:
                        o = rot["origin"]
                        if "axis" in rot:
                            p = rot_axis(p, o, rot["axis"], rot["angle"])
                        else:
                            p = rot_axis(p, o, "x", rot["x"])
                            p = rot_axis(p, o, "y", rot["y"])
                            p = rot_axis(p, o, "z", rot["z"])
                    corners[(i, j, k)] = p
        quads = [
            [(0, 0, 0), (0, 1, 0), (0, 1, 1), (0, 0, 1)], [(1, 0, 0), (1, 0, 1), (1, 1, 1), (1, 1, 0)],
            [(0, 0, 0), (0, 0, 1), (1, 0, 1), (1, 0, 0)], [(0, 1, 0), (1, 1, 0), (1, 1, 1), (0, 1, 1)],
            [(0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0)], [(0, 0, 1), (0, 1, 1), (1, 1, 1), (1, 0, 1)],
        ]
        tex = e["__tex"]
        if tex == "energy":
            base = (150, 235, 255)
        else:
            cx, cy, _ = SWATCH[tex]
            base = atlas.getpixel((cx * 4 + 1, cy * 4 + 1))[:3]
        for q in quads:
            pts = [corners[c] for c in q]
            pts = [rot_axis(p, (8, 8, 8), "y", yaw) for p in pts]
            pts = [rot_axis(p, (8, 8, 8), "x", pitch) for p in pts]
            ux, uy, uz = (pts[1][i] - pts[0][i] for i in range(3))
            vx, vy, vz = (pts[3][i] - pts[0][i] for i in range(3))
            nx, ny, nz = uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx
            nl = math.sqrt(nx * nx + ny * ny + nz * nz) or 1
            nx, ny, nz = nx / nl, ny / nl, nz / nl
            if tex == "energy" or e.get("light_emission"):
                shade = 1.0
            else:
                shade = 0.55 + 0.45 * max(0.0, nx * -0.3 + ny * 0.8 + nz * 0.5)
            col = tuple(min(255, int(c * shade)) for c in base)
            depth = sum(p[2] for p in pts) / 4
            faces.append((depth, pts, col))
    faces.sort(key=lambda f: f[0])
    img = Image.new("RGBA", (size, size), (34, 36, 44, 255))
    d = ImageDraw.Draw(img)
    sc = size / 22
    for _, pts, col in faces:
        poly = [((p[0] - 8) * sc + size / 2, size / 2 - (p[1] - 8) * sc) for p in pts]
        d.polygon(poly, fill=col + (255,), outline=(0, 0, 0, 90))
    img.save(path)


# ------------------------------------------------------------------ write everything

def main():
    tex_dir = os.path.join(ASSETS, "textures", "item")
    model_dir = os.path.join(ASSETS, "models", "item")
    os.makedirs(tex_dir, exist_ok=True)
    os.makedirs(model_dir, exist_ok=True)

    build_atlas().save(os.path.join(tex_dir, "stormcaller_bow_3d.png"))
    build_energy().save(os.path.join(tex_dir, "stormcaller_energy.png"))
    with open(os.path.join(tex_dir, "stormcaller_energy.png.mcmeta"), "w") as fh:
        json.dump({"animation": {"frametime": 2, "interpolate": True}}, fh, indent=2)

    names = ["stormcaller_bow_3d", "stormcaller_bow_3d_pulling_0",
             "stormcaller_bow_3d_pulling_1", "stormcaller_bow_3d_pulling_2"]
    for pull, name in enumerate(names):
        m = build_bow(pull)
        with open(os.path.join(model_dir, name + ".json"), "w") as fh:
            json.dump(m.export(DISPLAY), fh, indent=1)
        if PREVIEW:
            render(m, os.path.join(PREVIEW, f"{name}.png"))
            render(m, os.path.join(PREVIEW, f"{name}_front.png"), yaw=0, pitch=0)
        print(name, len(m.elements), "elements")


if __name__ == "__main__":
    main()
