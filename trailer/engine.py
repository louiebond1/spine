"""Drawing primitives for the Spine trailer renderer.

Everything is deterministic: no randomness except a fixed-seed dither pattern.
Frames are float32 RGB numpy arrays (H x W x 3, 0..255) until final quantisation.
"""
import math
import os
from functools import lru_cache

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1920, 1080
FPS = 30
FONT_DIR = os.environ.get("SPINE_FONT_DIR", "/usr/share/fonts/opentype/inter")

# Palette, sampled from the approved cut.
DARK_EDGE = np.array([13, 22, 45], np.float32)
DARK_CENTRE = np.array([15, 26, 55], np.float32)
LIGHT_A = np.array([250, 248, 249], np.float32)   # light scenes in the body of the film
LIGHT_B = np.array([248, 249, 241], np.float32)   # stage bar, fold and end card
INK = (15, 22, 40)
INK_SOFT = (96, 101, 118)
INK_LABEL = (52, 58, 78)
WHITE = (249, 249, 252)
BLUE_ON_DARK = (125, 155, 255)
SUB_ON_DARK = (160, 170, 200)
BRAND = (58, 87, 220)
BUTTON = (58, 89, 218)
SEG_TOP = np.array([123, 156, 252], np.float32)
SEG_BOT = np.array([60, 93, 224], np.float32)
SEG_FLAT = np.array([58, 87, 220], np.float32)
SHADOW = np.array([25, 35, 80], np.float32)


# ---------------------------------------------------------------- easing

def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def lerp(a, b, t):
    return a + (b - a) * t


def e_lin(t):
    return clamp(t)


def e_io_cubic(t):
    t = clamp(t)
    return 4 * t ** 3 if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2


def e_io_quint(t):
    t = clamp(t)
    return 16 * t ** 5 if t < 0.5 else 1 - (-2 * t + 2) ** 5 / 2


def e_out_cubic(t):
    return 1 - (1 - clamp(t)) ** 3


def e_out_quint(t):
    return 1 - (1 - clamp(t)) ** 5


def e_out_expo(t):
    t = clamp(t)
    return 1.0 if t >= 1 else 1 - 2 ** (-10 * t)


def e_in_cubic(t):
    return clamp(t) ** 3


def prog(t, t0, t1, ease=e_io_cubic):
    if t1 <= t0:
        return 1.0 if t >= t1 else 0.0
    return ease((t - t0) / (t1 - t0))


# ---------------------------------------------------------------- camera

def rot_matrix(rx, ry, rz):
    rx, ry, rz = (math.radians(a) for a in (rx, ry, rz))
    cx, sx, cy, sy, cz, sz = math.cos(rx), math.sin(rx), math.cos(ry), math.sin(ry), math.cos(rz), math.sin(rz)
    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Ry @ Rx @ Rz


class Camera:
    """Looks at world point (cx, cy, 0). World units equal screen pixels at zoom 1."""

    def __init__(self, cx=960.0, cy=540.0, zoom=1.0, yaw=0.0, pitch=0.0, focal=2200.0, cz=0.0):
        self.cx, self.cy, self.zoom, self.yaw, self.pitch, self.focal = cx, cy, zoom, yaw, pitch, focal
        self.cz = cz
        self.R = rot_matrix(pitch, yaw, 0)

    def depth(self, pts):
        """Camera-space depth of world points (0 at the look-at plane, positive = further away)."""
        p = np.asarray(pts, np.float64).reshape(-1, 3) - np.array([self.cx, self.cy, self.cz])
        return (p @ self.R.T)[:, 2]

    def project(self, pts):
        p = np.asarray(pts, np.float64) - np.array([self.cx, self.cy, self.cz])
        p = p @ self.R.T
        s = self.focal / np.maximum(self.focal + p[:, 2], 1.0) * self.zoom
        return np.stack([W / 2 + p[:, 0] * s, H / 2 + p[:, 1] * s], 1)

    def to_screen(self, x, y, z=0.0):
        return self.project([[x, y, z]])[0]


SCREEN_CAM = Camera()


# ---------------------------------------------------------------- compositing

def blend(canvas, x0, y0, alpha, color):
    """Composite a float alpha map (h x w) of colour (scalar rgb or h x w x 3) at x0, y0."""
    h, w = alpha.shape
    X0, Y0 = max(x0, 0), max(y0, 0)
    X1, Y1 = min(x0 + w, W), min(y0 + h, H)
    if X1 <= X0 or Y1 <= Y0:
        return
    a = alpha[Y0 - y0:Y1 - y0, X0 - x0:X1 - x0, None]
    col = np.asarray(color, np.float32)
    if col.ndim == 3:
        col = col[Y0 - y0:Y1 - y0, X0 - x0:X1 - x0]
    region = canvas[Y0:Y1, X0:X1]
    region += (col - region) * a


def rect_aa(canvas, x0, y0, x1, y1, color, alpha=1.0):
    """Axis-aligned rectangle with exact fractional edge coverage."""
    if x1 <= x0 or y1 <= y0 or alpha <= 0:
        return
    ix0, iy0 = int(math.floor(x0)), int(math.floor(y0))
    ix1, iy1 = int(math.ceil(x1)), int(math.ceil(y1))
    xs = np.arange(ix0, ix1, dtype=np.float32)
    ys = np.arange(iy0, iy1, dtype=np.float32)
    cx = np.clip(np.minimum(xs + 1, x1) - np.maximum(xs, x0), 0, 1)
    cy = np.clip(np.minimum(ys + 1, y1) - np.maximum(ys, y0), 0, 1)
    blend(canvas, ix0, iy0, (cy[:, None] * cx[None, :]) * alpha, color)


# ---------------------------------------------------------------- segments

def outline_local(L, T, rl=1.0, rr=1.0, n=14):
    """Rounded bar outline in local coords. rl / rr are end roundness (1 = full capsule end)."""
    h = T / 2
    rl = clamp(rl) * h
    rr = clamp(rr) * h
    pts = []

    def corner(cx, cy, r, a0, a1):
        if r < 1e-3:
            pts.append((cx, cy))
            return
        for k in range(n + 1):
            a = math.radians(lerp(a0, a1, k / n))
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))

    corner(L / 2 - rr, -h + rr, rr, -90, 0)
    corner(L / 2 - rr, h - rr, rr, 0, 90)
    corner(-L / 2 + rl, h - rl, rl, 90, 180)
    corner(-L / 2 + rl, -h + rl, rl, 180, 270)
    return np.array(pts)


def default_seg(**kw):
    s = dict(x=0.0, y=0.0, z=0.0, L=200.0, T=20.0, rx=0.0, ry=0.0, rz=0.0, rl=1.0, rr=1.0,
             fill=1.0, outline=0.0, alpha=1.0, shadow=0.0, flat=False, color=None)
    s.update(kw)
    return s


SS = 4  # supersampling factor for polygon edges


def draw_segment(canvas, cam, s):
    if s["alpha"] <= 0.002 or s["L"] <= 0.5 or s["T"] <= 0.2:
        return
    R = rot_matrix(s["rx"], s["ry"], s["rz"])
    c = np.array([s["x"], s["y"], s["z"]])
    loc = outline_local(s["L"], s["T"], s["rl"], s["rr"])
    pts3 = np.c_[loc, np.zeros(len(loc))] @ R.T + c
    ref = np.array([[0, 0, 0], [s["L"] / 2, 0, 0], [0, s["T"] / 2, 0]]) @ R.T + c
    p2 = cam.project(pts3)
    r2 = cam.project(ref)
    c2, a2, b2 = r2[0], r2[1] - r2[0], r2[2] - r2[0]

    pad = 3
    sh_r = 0
    if s["shadow"] > 0:
        sh_r = int(max(6, 0.55 * np.linalg.norm(b2) * 2 + 6))
        pad += sh_r * 2 + 8
    x0 = int(math.floor(p2[:, 0].min())) - pad
    y0 = int(math.floor(p2[:, 1].min())) - pad
    x1 = int(math.ceil(p2[:, 0].max())) + pad
    y1 = int(math.ceil(p2[:, 1].max())) + pad
    if x1 < 0 or y1 < 0 or x0 > W or y0 > H:
        return
    w, h = x1 - x0, y1 - y0
    if w * h > W * H * 2:
        return

    im = Image.new("L", (w * SS, h * SS), 0)
    poly = [((px - x0) * SS, (py - y0) * SS) for px, py in p2]
    ImageDraw.Draw(im).polygon(poly, fill=255)
    mask_img = im.resize((w, h), Image.BOX)
    mask = np.asarray(mask_img, np.float32) / 255.0

    yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32) + 0.5
    dx, dy = xx - c2[0], yy - c2[1]

    alpha = mask
    if s["fill"] < 1.0 or s["outline"] > 0:
        na = float(a2 @ a2) or 1e-6
        u = (dx * a2[0] + dy * a2[1]) / na  # -1 .. 1 along the bar
        edge = -1 + 2 * clamp(s["fill"])
        length_px = math.sqrt(na)
        fillm = np.clip((edge - u) * length_px + 0.5, 0, 1)
        alpha = mask * fillm
        if s["outline"] > 0:
            oim = Image.new("L", (w * SS, h * SS), 0)
            ImageDraw.Draw(oim).line(poly + [poly[0]], fill=255, width=int(2.6 * SS), joint="curve")
            om = np.asarray(oim.resize((w, h), Image.BOX), np.float32) / 255.0
            alpha = np.maximum(alpha, om * s["outline"])

    if s["shadow"] > 0:
        sm = mask_img.filter(ImageFilter.GaussianBlur(sh_r))
        sm = np.asarray(sm, np.float32) / 255.0
        off = int(round(np.linalg.norm(b2) * 0.9 + 4))
        sm = np.roll(sm, off, axis=0)
        sm[:off] = 0
        blend(canvas, x0, y0, sm * 0.13 * s["shadow"] * s["alpha"], SHADOW)

    if s["color"] is not None:
        col = np.asarray(s["color"], np.float32)
    else:
        nb = float(b2 @ b2) or 1e-6
        v = (dx * b2[0] + dy * b2[1]) / nb
        t = np.clip((v + 1) / 2, 0, 1)[..., None]
        grad = SEG_TOP + (SEG_BOT - SEG_TOP) * t
        k = 0.0 if s["flat"] else clamp((2 * math.sqrt(nb) - 12) / 18)
        col = SEG_FLAT + (grad - SEG_FLAT) * k
    blend(canvas, x0, y0, alpha * s["alpha"], col)


# ---------------------------------------------------------------- text

@lru_cache(None)
def font(name, size):
    return ImageFont.truetype(os.path.join(FONT_DIR, name), size)


@lru_cache(maxsize=1024)
def text_mask(text, fname, size):
    f = font(fname, size)
    asc, desc = f.getmetrics()
    w = int(math.ceil(f.getlength(text))) + 12
    h = asc + desc + 12
    im = Image.new("L", (w, h), 0)
    ImageDraw.Draw(im).text((6, 6), text, font=f, fill=255)
    return np.asarray(im, np.float32) / 255.0, asc + 6, 6, f.getlength(text)


def text_width(text, fname, size):
    return font(fname, size).getlength(text)


def _shift(m, fx, fy):
    """Sub-pixel shift (0 <= fx, fy < 1) by bilinear interpolation, growing the array by one pixel."""
    p = np.pad(m, ((1, 1), (1, 1)))
    a = p[1:, 1:] * (1 - fx) * (1 - fy) + p[1:, :-1] * fx * (1 - fy) + p[:-1, 1:] * (1 - fx) * fy + p[:-1, :-1] * fx * fy
    return a


def draw_text(canvas, text, fname, size, color, x, baseline, align="left", reveal=1.0, exit=0.0,
              alpha=1.0, clip_extra=0):
    """Text whose line box acts as a mask: reveal slides it up into place, exit slides it up and away."""
    if reveal <= 0 or exit >= 1 or alpha <= 0:
        return
    m, bo, lo, adv = text_mask(text, fname, size)
    if align == "center":
        left = x - adv / 2
    elif align == "right":
        left = x - adv
    else:
        left = x
    asc, desc = font(fname, size).getmetrics()
    box_top = baseline - asc - 4 - clip_extra
    box_bot = baseline + desc + 4 + clip_extra
    travel = (box_bot - box_top)
    dy = (1 - reveal) * travel - exit * travel
    ox = left - lo
    oy = baseline - bo + dy
    ix, iy = int(math.floor(ox)), int(math.floor(oy))
    fx, fy = ox - ix, oy - iy
    mm = _shift(m, fx, fy) if (fx > 1e-3 or fy > 1e-3) else np.pad(m, ((0, 1), (0, 1)))
    # clip to the line box
    rows = np.arange(iy, iy + mm.shape[0], dtype=np.float32)
    clipv = np.clip(np.minimum(rows + 1, box_bot) - np.maximum(rows, box_top), 0, 1)
    blend(canvas, ix, iy, mm * clipv[:, None] * alpha, color)


# ---------------------------------------------------------------- backgrounds

@lru_cache(None)
def dark_background():
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2) / math.sqrt(2)
    t = np.clip(r, 0, 1)[..., None] ** 1.2
    return DARK_CENTRE + (DARK_EDGE - DARK_CENTRE) * t


@lru_cache(None)
def dither():
    rng = np.random.default_rng(7)
    return (rng.random((H, W, 1), np.float32) - 0.5) * 0.9


def solid(color):
    return np.broadcast_to(np.asarray(color, np.float32), (H, W, 3)).copy()


def coverage_1d(n, a, b):
    """Per-pixel coverage of interval [a, b] along an axis of length n."""
    i = np.arange(n, dtype=np.float32)
    return np.clip(np.minimum(i + 1, b) - np.maximum(i, a), 0, 1)


def quantise(canvas):
    # The dither stays below half a level, so flat integer colours survive exactly.
    return np.clip(np.rint(canvas + dither()), 0, 255).astype(np.uint8)


# ---------------------------------------------------------------- screen panels

PANEL_PAD = 6
PANEL_RADIUS = 18


class Panel:
    """A product screen (mockup PNG) placed in the world as a flat, lit 3D surface.

    Panel-local coordinates are mockup pixels (u, v); the screen's centre sits at
    world `centre`, rotated by (pitch, yaw) and scaled by `scale` world units per pixel.
    """

    def __init__(self, path, centre, yaw=0.0, pitch=0.0, scale=1.0):
        im = Image.open(path).convert("RGB")
        self.w, self.h = im.size
        mask = Image.new("L", im.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, self.w - 1, self.h - 1], PANEL_RADIUS, fill=255)
        rgba = im.convert("RGBA")
        rgba.putalpha(mask)
        padded = Image.new("RGBA", (self.w + 2 * PANEL_PAD, self.h + 2 * PANEL_PAD), (0, 0, 0, 0))
        padded.paste(rgba, (PANEL_PAD, PANEL_PAD))
        # Mip levels so a small, distant panel is not aliased.
        self.mips = [padded]
        while self.mips[-1].size[0] > 300:
            m = self.mips[-1]
            self.mips.append(m.resize((m.size[0] // 2, m.size[1] // 2), Image.LANCZOS))
        self.centre = np.array(centre, float)
        self.yaw, self.pitch, self.scale = yaw, pitch, scale
        self.R = rot_matrix(pitch, yaw, 0)

    def world(self, u, v, lift=0.0):
        """World position of mockup pixel (u, v); lift moves it towards the viewer."""
        local = np.array([(u - self.w / 2) * self.scale, (v - self.h / 2) * self.scale, -lift])
        return self.R @ local + self.centre

    def seg_rot(self):
        return dict(rx=self.pitch, ry=self.yaw)


def _perspective_coeffs(dst, src):
    """PIL PERSPECTIVE coefficients mapping output points dst -> input points src."""
    A, b = [], []
    for (x, y), (u, v) in zip(dst, src):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.append(u)
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y]); b.append(v)
    return np.linalg.solve(np.array(A, float), np.array(b, float))


def draw_panel(canvas, cam, panel, alpha=1.0, shadow=0.55, sheen=None):
    if alpha <= 0.003:
        return
    P = PANEL_PAD
    corners_uv = [(-P, -P), (panel.w + P, -P), (panel.w + P, panel.h + P), (-P, panel.h + P)]
    world = np.array([panel.world(u, v) for u, v in corners_uv])
    sc = cam.project(world)
    x0, y0 = np.floor(sc.min(0)).astype(int) - 2
    x1, y1 = np.ceil(sc.max(0)).astype(int) + 2
    X0, Y0, X1, Y1 = max(x0, 0), max(y0, 0), min(x1, W), min(y1, H)
    if X1 <= X0 or Y1 <= Y0:
        return
    # Choose a mip level from the on-screen size of the panel.
    screen_w = max(np.linalg.norm(sc[1] - sc[0]), np.linalg.norm(sc[2] - sc[3]))
    ratio = screen_w / (panel.w + 2 * P)
    lvl = 0
    while lvl + 1 < len(panel.mips) and ratio < 0.6 / (2 ** lvl):
        lvl += 1
    src = panel.mips[lvl]
    f = 1 / (2 ** lvl)
    src_pts = [(0, 0), (src.size[0], 0), (src.size[0], src.size[1]), (0, src.size[1])]
    dst_pts = [(px - X0, py - Y0) for px, py in sc]
    coeffs = _perspective_coeffs(dst_pts, src_pts)
    out = src.transform((X1 - X0, Y1 - Y0), Image.PERSPECTIVE, tuple(coeffs), Image.BICUBIC)
    arr = np.asarray(out, np.float32)
    a = arr[..., 3] / 255.0 * alpha
    if shadow > 0:
        small = Image.fromarray((a * 255).astype(np.uint8)).resize(
            (max(1, (X1 - X0) // 8), max(1, (Y1 - Y0) // 8)), Image.BILINEAR)
        small = small.filter(ImageFilter.GaussianBlur(4))
        sh = np.asarray(small.resize((X1 - X0, Y1 - Y0), Image.BILINEAR), np.float32) / 255.0
        off = max(2, int((Y1 - Y0) * 0.03))
        sh = np.roll(sh, off, axis=0)
        sh[:off] = 0
        blend(canvas, X0, Y0, sh * shadow * alpha, (2, 5, 14))
    rgb = arr[..., :3]
    if sheen is not None:
        # A soft diagonal band of light travelling across the glass.
        pos, strength = sheen
        yy, xx = np.mgrid[Y0:Y1, X0:X1].astype(np.float32)
        d = (xx * 0.8 + yy * 0.6) - pos
        rgb = rgb + (255 - rgb) * (np.exp(-(d / 180.0) ** 2) * strength)[..., None]
    blend(canvas, X0, Y0, a, rgb)


def draw_text_scaled(canvas, text, fname, size, color, x, baseline, scale=1.0, reveal=1.0, alpha=1.0):
    """Text drawn at `size` then scaled (for type that lives in the 3D world). Mask reveal as draw_text."""
    if scale <= 0.05 or reveal <= 0 or alpha <= 0:
        return
    if abs(scale - 1.0) < 1e-3:
        draw_text(canvas, text, fname, size, color, x, baseline, reveal=reveal, alpha=alpha)
        return
    m, bo, lo, adv = text_mask(text, fname, size)
    asc, desc = font(fname, size).getmetrics()
    box_top, box_bot = bo - asc - 4, bo + desc + 4          # line box inside the mask
    travel = box_bot - box_top
    dy = (1 - reveal) * travel
    rows = np.arange(m.shape[0], dtype=np.float32) - dy
    src = np.zeros_like(m)
    ok = (rows >= 0) & (rows < m.shape[0] - 1)
    r0 = np.clip(np.floor(rows).astype(int), 0, m.shape[0] - 1)
    fr = (rows - np.floor(rows))[:, None]
    r1 = np.clip(r0 + 1, 0, m.shape[0] - 1)
    src[ok] = (m[r0] * (1 - fr) + m[r1] * fr)[ok]
    rr = np.arange(m.shape[0])
    src *= ((rr >= box_top) & (rr < box_bot)).astype(np.float32)[:, None]
    w2, h2 = max(1, int(round(m.shape[1] * scale))), max(1, int(round(m.shape[0] * scale)))
    im = Image.fromarray((src * 255).astype(np.uint8)).resize((w2, h2), Image.LANCZOS)
    mm = np.asarray(im, np.float32) / 255.0
    ox, oy = x - lo * scale, baseline - bo * scale
    ix, iy = int(math.floor(ox)), int(math.floor(oy))
    mm = _shift(mm, ox - ix, oy - iy)
    blend(canvas, ix, iy, mm * alpha, color)


@lru_cache(None)
def glow_sprite(radius=900):
    yy, xx = np.mgrid[-radius:radius, -radius:radius].astype(np.float32)
    r = np.sqrt(xx ** 2 + (yy * 1.6) ** 2) / radius
    return np.clip(1 - r, 0, 1) ** 2.2


def draw_backlight(canvas, cx, cy, strength, color=(40, 62, 125)):
    g = glow_sprite()
    rad = g.shape[0] // 2
    blend(canvas, int(cx) - rad, int(cy) - rad, g * strength, color)


# ---------------------------------------------------------------- network: dots and connections

@lru_cache(maxsize=256)
def _dot_sprite(r10, b10):
    """Disc of radius r with a soft edge of width b (both in tenths of a pixel), as an alpha map."""
    r, b = r10 / 10.0, max(b10 / 10.0, 0.6)
    ext = int(math.ceil(r + 3 * b)) + 1
    yy, xx = np.mgrid[-ext:ext + 1, -ext:ext + 1].astype(np.float32)
    d = np.sqrt(xx ** 2 + yy ** 2)
    return np.clip(0.5 - (d - r) / (2 * b), 0, 1)


def draw_dot(canvas, x, y, r, color, alpha=1.0, blur=0.0, ring=0.0):
    """Dot at sub-pixel precision; blur softens it (depth of field); ring > 0 draws an outline of that width."""
    if alpha <= 0.004 or r <= 0.05:
        return
    r10, b10 = int(round(r * 10)), int(round((0.6 + blur) * 10))
    spr = _dot_sprite(r10, b10)
    if ring > 0:
        inner = _dot_sprite(max(1, int(round((r - ring) * 10))), b10)
        pad = (spr.shape[0] - inner.shape[0]) // 2
        spr = spr.copy()
        spr[pad:pad + inner.shape[0], pad:pad + inner.shape[1]] -= inner
        spr = np.clip(spr, 0, 1)
    ext = spr.shape[0] // 2
    ix, iy = int(math.floor(x)), int(math.floor(y))
    m = _shift(spr, x - ix, y - iy)
    blend(canvas, ix - ext, iy - ext, m * alpha, color)


class LineLayer:
    """Anti-aliased lines drawn at 2x and composited in one pass per colour."""

    def __init__(self, scale=2):
        self.s = scale
        self.layers = {}

    def line(self, a, b, color, alpha=1.0, width=1.4):
        if alpha <= 0.004:
            return
        key = tuple(int(c) for c in color)
        if key not in self.layers:
            self.layers[key] = Image.new("L", (W * self.s, H * self.s), 0)
        d = ImageDraw.Draw(self.layers[key])
        s = self.s
        d.line([(a[0] * s, a[1] * s), (b[0] * s, b[1] * s)], fill=int(255 * clamp(alpha)),
               width=max(1, int(round(width * s))))

    def composite(self, canvas):
        for col, im in self.layers.items():
            m = np.asarray(im.resize((W, H), Image.BOX), np.float32) / 255.0
            if m.max() > 0:
                blend(canvas, 0, 0, m, col)


class Card(Panel):
    """A cropped region of a real screen, floating in the world as a small lit card."""

    def __init__(self, path, box, centre, width, yaw=0.0, pitch=0.0):
        full = Image.open(path).convert("RGB").crop(box)
        tmp = os.path.join("/tmp", f"spine_card_{abs(hash((path, box)))}.png")
        full.save(tmp)
        super().__init__(tmp, centre, yaw=yaw, pitch=pitch, scale=width / full.size[0])
