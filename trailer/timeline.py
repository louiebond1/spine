"""Spine launch film: "Holds it together" (six pieces cut).

Dark, on a 120 BPM grid. Each everyday failure is underlined in Spine blue, and the underline
snaps in two as its issue lands. The six halves hang at the edges of frame, slam together into
the Spine mark on "a spine.", lock back together under each real Spine screen, and finally fly
in pair by pair to form the logo. Every hit shakes and punches the frame.

Product content (names, rows, stages, figures) is taken from the final mockups in /design and the
seed data in CLAUDE.md. Everything is a function of time t in seconds.
"""
import math
import os
from functools import lru_cache

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from engine import (
    W, H, FPS, SCREEN_CAM, default_seg, draw_segment, draw_dot, blend, rect_aa, text_mask, font,
    text_width, prog, lerp, clamp, _shift,
    e_io_cubic, e_io_quint, e_out_cubic, e_out_quint, e_out_expo, e_in_cubic, e_lin,
)

TOTAL = 1140
END_PLATE = TOTAL + 1      # no plate: every frame is rendered
HANDOFF = END_PLATE

FONT_DIR = os.environ.get("SPINE_FONT_DIR", "/usr/share/fonts/opentype/inter")
LIGHT = "InterDisplay-Light.otf"
DREG = "InterDisplay-Regular.otf"
DSEMI = "InterDisplay-SemiBold.otf"
MED = "Inter-Medium.otf"
REG = "Inter-Regular.otf"
SEMI = "Inter-SemiBold.otf"

# Palette (dark). Spine blue is lifted for use on near-black.
BG = np.array([16, 16, 19], np.float32)
GLOW = np.array([31, 33, 42], np.float32)
WHITE = (236, 238, 243)
DIM = (120, 126, 142)
FAINT = (64, 69, 84)
BLUE = (110, 146, 255)
BLUE_DEEP = (58, 87, 220)
CARD = (27, 29, 35)
CARD_LINE = (44, 47, 57)
GREEN = (74, 196, 120)

STAGES = ["Idea", "Approval", "Recruiting", "Building", "Publishing", "Live"]

BPM = 120
BEAT = 60 / BPM          # 0.5 s; every cut, word and move sits on this grid
# Shot starts (each shot gets its own gentle push-in).
SHOTS = [0.0, 2.0, 4.0, 6.0, 8.0, 10.0, 12.0, 13.0, 16.0, 19.0, 22.0, 25.0, 28.0, 29.0, 38.0]
KICK_FROM = 0.0          # the kick starts on the first frame
HOURS = [6, 16, 30, 42]
MONTHS = ["Jul", "Aug", "Sep", "Oct"]


# ---------------------------------------------------------------- background

@lru_cache(None)
def _bg_base():
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.sqrt(((xx - W / 2) / (W * 0.55)) ** 2 + ((yy - H / 2) / (H * 0.62)) ** 2)
    glow = np.exp(-r ** 2 * 1.6)[..., None]
    vig = np.clip(1 - 0.35 * np.clip(r - 0.6, 0, None), 0.55, 1)[..., None]
    return (BG + (GLOW - BG) * glow) * vig


def kick_env(t):
    # matches kick_on() in score.py
    if 13.0 <= t < 14.0 or 29.0 <= t < 30.5 or t >= 36.0 or (12.0 <= t < 13.0 and (t - 12.0) >= 2 * BEAT):
        return 0.0
    return math.exp(-((t - KICK_FROM) % BEAT) / 0.11)


def background(t, n, flash=0.0):
    c = _bg_base().copy()
    pulse = 0.22 * kick_env(t)
    if pulse > 0:
        c += (_bg_base() - BG) * pulse
    rng = np.random.default_rng(n)
    c += (rng.random((H // 2, W // 2, 1), np.float32).repeat(2, 0).repeat(2, 1) - 0.5) * 1.4   # fine grain
    if flash > 0:
        c += (np.array(BLUE_DEEP, np.float32) - c) * flash
    return c


# ---------------------------------------------------------------- type

@lru_cache(maxsize=2048)
def _blurred(text, fname, size, r10):
    m, bo, lo, adv = text_mask(text, fname, size)
    if r10 <= 0:
        return m, bo, lo, adv
    pad = int(r10 / 10 * 3) + 2
    im = Image.fromarray((np.pad(m, pad) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r10 / 10))
    return np.asarray(im, np.float32) / 255.0, bo + pad, lo + pad, adv


def soft_word(c, text, fname, size, color, x, base, g, out=0.0, scale=1.0):
    """A word that resolves from a soft blur as it fades and rises in (g: 0..1), and dissolves out."""
    a = g * (1 - out)
    if a <= 0.003:
        return
    blur = 7.0 * (1 - g) + 6.0 * out
    m, bo, lo, adv = _blurred(text, fname, size, int(round(blur * 10)))
    if abs(scale - 1) > 1e-3:
        im = Image.fromarray((m * 255).astype(np.uint8))
        im = im.resize((max(1, int(m.shape[1] * scale)), max(1, int(m.shape[0] * scale))), Image.LANCZOS)
        m = np.asarray(im, np.float32) / 255.0
        bo, lo = bo * scale, lo * scale
    dy = 14 * (1 - g) - 10 * out
    ox, oy = x - lo, base - bo + dy
    ix, iy = int(math.floor(ox)), int(math.floor(oy))
    blend(c, ix, iy, _shift(m, ox - ix, oy - iy) * a, color)


def line_words(c, t, text, fname, size, color, x, base, t_in, t_out, align="left", step=BEAT / 4, dur=0.32,
               scale=1.0):
    """A line that appears word by word and leaves as one."""
    words = text.split(" ")
    total = text_width(text, fname, size) * scale
    x0 = x - (total / 2 if align == "center" else total if align == "right" else 0)
    out = prog(t, t_out, t_out + 0.22, e_io_cubic) if t_out is not None else 0.0
    for i, w in enumerate(words):
        pre = text_width(" ".join(words[:i]) + (" " if i else ""), fname, size) * scale
        g = prog(t, t_in + step * i, t_in + step * i + dur, e_out_cubic)
        soft_word(c, w, fname, size, color, x0 + pre, base, g, out, scale)


def label(c, t, text, x, base, t_in, t_out, color=BLUE, size=17, align="left"):
    """Small uppercase section label with wide tracking."""
    spaced = "  ".join(" ".join(text.upper()).split("   "))
    line_words(c, t, spaced, SEMI, size, color, x, base, t_in, t_out, align, step=0.0, dur=0.5)


# ---------------------------------------------------------------- cards (real Spine details, dark-styled)

S = 2   # supersampling for card drawing


def _f(name, size):
    return ImageFont.truetype(os.path.join(FONT_DIR, name), int(round(size * S)))


class Pen:
    """Draws a card at 2x into an RGBA image, in card pixel units."""

    def __init__(self, w, h):
        self.w, self.h = w, h
        self.im = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.im)
        self.d.rounded_rectangle([0, 0, w * S - 1, h * S - 1], 14 * S, fill=CARD + (245,), outline=CARD_LINE + (255,),
                                 width=S)

    def text(self, x, y, s, size, color, fname=REG, anchor="ls", alpha=1.0):
        if alpha <= 0:
            return
        col = tuple(color) + (int(255 * clamp(alpha)),)
        self.d.text((x * S, y * S), s, font=_f(fname, size), fill=col, anchor=anchor)

    def rrect(self, x0, y0, x1, y1, r, fill=None, outline=None, width=1, alpha=1.0):
        if x1 <= x0 or y1 <= y0:
            return
        f = tuple(fill) + (int(255 * alpha),) if fill else None
        o = tuple(outline) + (int(255 * alpha),) if outline else None
        self.d.rounded_rectangle([x0 * S, y0 * S, x1 * S, y1 * S], r * S, fill=f, outline=o, width=width * S)

    def circle(self, cx, cy, r, fill=None, outline=None, width=1, alpha=1.0):
        f = tuple(fill) + (int(255 * alpha),) if fill else None
        o = tuple(outline) + (int(255 * alpha),) if outline else None
        self.d.ellipse([(cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S], fill=f, outline=o, width=width * S)

    def line(self, pts, color, width=1, alpha=1.0):
        self.d.line([(x * S, y * S) for x, y in pts], fill=tuple(color) + (int(255 * alpha),), width=int(width * S),
                    joint="curve")

    def tracked(self, x, y, s, size=12, color=DIM, alpha=1.0):
        self.text(x, y, " ".join(s.upper()), size, color, SEMI, alpha=alpha)

    def done(self):
        return self.im


def place(c, card_img, cx, cy, scale=1.0, alpha=1.0, shadow=True):
    """Composite a card (2x RGBA) centred at (cx, cy) on screen."""
    if alpha <= 0.003 or scale <= 0.02:
        return
    w, h = card_img.size
    tw, th = max(1, int(round(w / S * scale))), max(1, int(round(h / S * scale)))
    im = card_img.resize((tw, th), Image.LANCZOS)
    arr = np.asarray(im, np.float32)
    x0, y0 = cx - tw / 2, cy - th / 2
    ix, iy = int(math.floor(x0)), int(math.floor(y0))
    if shadow:
        a = arr[..., 3] / 255.0
        sm = Image.fromarray((a * 255).astype(np.uint8)).resize((max(1, tw // 6), max(1, th // 6)))
        sm = sm.filter(ImageFilter.GaussianBlur(4)).resize((tw, th), Image.BILINEAR)
        sa = np.asarray(sm, np.float32) / 255.0
        blend(c, ix, iy + int(14 * scale), sa * 0.55 * alpha, (4, 5, 8))
    blend(c, ix, iy, arr[..., 3] / 255.0 * alpha, arr[..., :3])


def card_pain_question(t):
    p = Pen(620, 150)
    p.circle(48, 75, 22, fill=(38, 41, 50))
    p.text(48, 81, "BC", 14, DIM, SEMI, anchor="ms")
    p.text(88, 64, "Best way to anonymise client data?", 20, WHITE, MED)
    p.text(88, 94, "Ben Carter  ·  Security  ·  2h 5m ago", 15, DIM)
    p.rrect(480, 56, 592, 92, 9, outline=CARD_LINE)
    p.text(536, 80, "Unclaimed", 14, DIM, MED, anchor="ms")
    return p.done()


def card_pain_build(t):
    p = Pen(620, 150)
    p.text(32, 60, "Contract Clause Checker", 20, WHITE, MED)
    p.text(32, 88, "Mia Thompson  ·  Legal  ·  App", 15, DIM)
    p.rrect(32, 108, 440, 116, 4, fill=(44, 47, 57))
    p.rrect(32, 108, 32 + 408 * 3 / 7, 116, 4, fill=(84, 92, 116))
    p.text(458, 117, "3 of 7 steps", 15, DIM)
    p.text(588, 60, "Building", 14, DIM, MED, anchor="rs")
    return p.done()


def card_pain_impact(t):
    p = Pen(620, 190)
    p.tracked(32, 44, "Hours saved", 12, DIM)
    for k in range(4):
        x = 60 + k * 140
        p.rrect(x, 80, x + 56, 150, 6, outline=(70, 75, 92), width=1)
        p.text(x + 28, 124, "?", 26, (90, 96, 114), DSEMI, anchor="ms")
        p.text(x + 28, 176, MONTHS[k], 13, DIM, MED, anchor="ms")
    return p.done()


def card_pulse(t, t0):
    p = Pen(980, 410)
    p.tracked(36, 52, "Pulse  ·  Worth your attention today", 12, DIM)
    rows = [("Supplier Research Assistant", "Approval auto-approves in 6 hours unless someone reviews it", "Review", True),
            ("Best way to anonymise client data?", "Ben Carter asked 2 hours ago and no Champion has claimed it", "Claim", False),
            ("Contract Clause Checker", "Mia Thompson's build has had no activity for 12 days", "Open", False)]
    for k, (a, b, btn, primary) in enumerate(rows):
        g = prog(t, t0 + 0.25 + 0.22 * k, t0 + 0.75 + 0.22 * k, e_out_cubic)
        y = 112 + k * 98
        if k:
            p.line([(36, y - 40), (944, y - 40)], CARD_LINE, 1, alpha=g)
        p.rrect(36, y - 26, 88, y + 26, 10, fill=(36, 39, 47), alpha=g)
        p.circle(62, y, 9, outline=DIM, width=2, alpha=g)
        p.text(108, y - 4, a, 19, WHITE, MED, alpha=g)
        p.text(108, y + 24, b, 15, DIM, alpha=g)
        if primary:
            p.rrect(820, y - 22, 944, y + 22, 10, fill=BLUE_DEEP, alpha=g)
            p.text(882, y + 6, btn + "  →", 16, (255, 255, 255), MED, anchor="ms", alpha=g)
        else:
            p.rrect(820, y - 22, 944, y + 22, 10, outline=BLUE, width=1, alpha=g)
            p.text(882, y + 6, btn + "  →", 16, BLUE, MED, anchor="ms", alpha=g)
    return p.done()


def card_question(t, t0):
    p = Pen(860, 330)
    p.tracked(36, 52, "Help Desk  ·  In progress", 12, DIM)
    p.text(36, 112, "Can Claude analyse multiple Excel files?", 27, WHITE, DSEMI)
    claimed = prog(t, t0 + 0.9, t0 + 1.3, e_out_cubic)
    p.text(36, 146, "Sarah Kim  ·  Excel  ·  2 replies", 16, DIM)
    # status changes from Unclaimed to Claimed by Alex Morgan
    p.rrect(36, 178, 230, 214, 10, outline=CARD_LINE, alpha=1 - claimed)
    p.text(133, 202, "Unclaimed", 15, DIM, MED, anchor="ms", alpha=1 - claimed)
    p.rrect(36, 178, 300, 214, 10, fill=(34, 44, 78), alpha=claimed)
    p.text(168, 202, "Claimed by Alex Morgan", 15, BLUE, MED, anchor="ms", alpha=claimed)
    p.circle(56, 270, 20, fill=(38, 41, 50))
    p.text(56, 276, "AM", 13, DIM, SEMI, anchor="ms")
    g = prog(t, t0 + 1.4, t0 + 1.9, e_out_cubic)
    p.rrect(92, 246, 640, 294, 12, fill=(32, 36, 48), alpha=g)
    p.text(112, 276, "Yes, you can. Start with one file first.", 16, WHITE, alpha=g)
    return p.done()


def card_project(t, t0):
    p = Pen(980, 400)
    p.tracked(36, 52, "Ideas & Projects", 12, DIM)
    p.text(36, 104, "AI Invoice Assistant", 30, WHITE, DSEMI)
    p.text(36, 138, "Jamie Chen  ·  Finance  ·  App  ·  Target 19 November", 16, DIM)
    xs = [56 + 170 * k for k in range(6)]
    fill_to = lerp(0, 3, prog(t, t0 + 0.4, t0 + 1.6, e_io_cubic))
    p.line([(xs[0], 190), (xs[-1], 190)], (52, 56, 68), 3)
    p.line([(xs[0], 190), (xs[0] + (xs[3] - xs[0]) * fill_to / 3, 190)], BLUE, 3)
    for k, x in enumerate(xs):
        on = fill_to >= k - 1e-3
        if on:
            p.circle(x, 190, 11, fill=BLUE)
        else:
            p.circle(x, 190, 10, fill=CARD, outline=(70, 75, 92), width=2)
        p.text(x, 228, STAGES[k], 14, WHITE if k == 3 else DIM, SEMI if k == 3 else MED, anchor="ms",
               alpha=1.0)
    g = prog(t, t0 + 1.4, t0 + 1.9, e_out_cubic)
    p.text(36, 280, "Next: Jamie is testing supplier cases", 17, WHITE, MED, alpha=g)
    steps = [("Test against real supplier cases", "JC", "9 Oct"), ("Fix edge cases from testing", "MT", "14 Oct")]
    for k, (s_, who, d) in enumerate(steps):
        y = 322 + k * 42
        gk = prog(t, t0 + 1.7 + 0.15 * k, t0 + 2.2 + 0.15 * k, e_out_cubic)
        p.rrect(36, y - 14, 54, y + 4, 4, outline=(80, 86, 104), width=1, alpha=gk)
        p.text(70, y + 1, s_, 16, WHITE, alpha=gk)
        p.circle(700, y - 5, 14, fill=(38, 41, 50), alpha=gk)
        p.text(700, y, who, 11, DIM, SEMI, anchor="ms", alpha=gk)
        p.text(740, y + 1, d, 15, DIM, alpha=gk)
    p.text(944, 52, "Generated from project brief", 13, DIM, anchor="rs", alpha=g)
    return p.done()


def card_value(t, t0):
    p = Pen(980, 400)
    p.tracked(36, 52, "Programme  ·  Value over time", 12, DIM)
    p.rrect(760, 30, 944, 66, 10, outline=BLUE, width=1)
    p.text(852, 54, "Hours saved", 14, BLUE, MED, anchor="ms")
    x0, x1, y0, y1 = 90, 920, 320, 110
    for v in (0, 20, 40, 60):
        y = y0 - (y0 - y1) * v / 60
        p.line([(x0, y), (x1, y)], (40, 43, 52), 1)
        p.text(x0 - 16, y + 5, str(v), 13, DIM, anchor="rs")
    pts = [(x0 + 30 + (x1 - x0 - 60) * k / 3, y0 - (y0 - y1) * HOURS[k] / 60) for k in range(4)]
    g = prog(t, t0 + 0.4, t0 + 1.8, e_io_cubic)
    if g > 0:
        n = 60
        seg = []
        for i in range(n + 1):
            u = i / n * 3 * g
            k = min(int(u), 2)
            f = u - k
            seg.append((lerp(pts[k][0], pts[k + 1][0], f), lerp(pts[k][1], pts[k + 1][1], f)))
        p.line(seg, BLUE, 3)
    for k, (x, y) in enumerate(pts):
        a = prog(t, t0 + 0.4 + 0.45 * k, t0 + 0.7 + 0.45 * k, e_out_cubic)
        p.circle(x, y, 6, fill=BLUE, alpha=a)
        p.text(x, 352, MONTHS[k], 14, DIM, MED, anchor="ms")
        if k == 3:
            p.text(x, y - 18, "42", 18, BLUE, SEMI, anchor="ms", alpha=a)
    g2 = prog(t, t0 + 1.9, t0 + 2.4, e_out_cubic)
    p.text(36, 386, "October: 42 hours  (Claude Onboarding Guide 14  ·  Expense Review Assistant 28)", 15, DIM, alpha=g2)
    return p.done()


# ---------------------------------------------------------------- background fragments (the noise of the problem)

FRAGS = ["Has anyone tried Claude for this?", "Who owns this now?", "Is this approved yet?",
         "Any update on the invoice bot?", "How many hours did it save?", "Can someone check this before Friday?",
         "Still waiting on a reply", "Which version is current?"]


@lru_cache(None)
def _frag_layout():
    rng = np.random.default_rng(3)
    out = []
    for i in range(22):
        out.append(dict(x=rng.uniform(60, W - 360), y=rng.uniform(80, H - 80), text=FRAGS[i % len(FRAGS)],
                        box=rng.random() < 0.45, w=rng.uniform(90, 220), drift=rng.uniform(-14, 14),
                        t0=4.0 + BEAT * rng.integers(0, 14)))
    return out


def draw_fragments(c, t):
    a_all = prog(t, 4.0, 4.5) * (1 - prog(t, 11.75, 12.0))
    if a_all <= 0:
        return
    for f in _frag_layout():
        a = a_all * prog(t, f["t0"], f["t0"] + 1.2) * 0.55
        if a <= 0:
            continue
        x = f["x"] + f["drift"] * (t - 3)
        if f["box"]:
            x0, y0 = x, f["y"]
            col = (54, 60, 82)
            for (xa, ya, xb, yb) in ((x0, y0, x0 + f["w"], y0 + 1.2), (x0, y0 + 26, x0 + f["w"], y0 + 27.2),
                                     (x0, y0, x0 + 1.2, y0 + 27.2), (x0 + f["w"] - 1.2, y0, x0 + f["w"], y0 + 27.2)):
                rect_aa(c, xa, ya, xb, yb, col, a)
        else:
            soft_word(c, f["text"], REG, 18, (70, 76, 94), x, f["y"], a)




# ---------------------------------------------------------------- impacts (shake, punch, colour split)

# (time, strength): every snap, the slam at 13.0, each fusion, and each logo bar landing.
IMPACTS = [(4.5, 1.0), (6.5, 1.0), (8.5, 1.0), (13.0, 2.0), (20.0, 0.45), (23.0, 0.45), (26.0, 0.45),
           (30.0, 0.8), (30.25, 0.8), (30.5, 1.3)]


def impact_state(t):
    sx = sy = punch = split = 0.0
    for ti, a in IMPACTS:
        u = t - ti
        if 0 <= u < 0.7:
            d = math.exp(-u / 0.1)
            sx += a * 13 * d * math.sin(2 * math.pi * 17 * u + 1.3 + ti)
            sy += a * 9 * d * math.cos(2 * math.pi * 21 * u + ti * 3)
            punch += 0.035 * a * math.exp(-u / 0.13)
            split += 5 * a * math.exp(-u / 0.07)
    return sx, sy, punch, split


def snap_flash(t):
    f = 0.0
    for ti, a in IMPACTS:
        u = t - ti
        if 0 <= u < 0.4 and ti != 13.0:
            f += 0.16 * min(a, 1.0) * math.exp(-u / 0.06)
    return f


def post(c, t):
    """Shot push-in, impact punch and shake in one transform, then a brief colour split on hits."""
    z = 1.0
    if t < 29.0:
        k = max(i for i, a in enumerate(SHOTS[:-1]) if a <= t)
        z = 1 + 0.03 * (t - SHOTS[k]) / (SHOTS[k + 1] - SHOTS[k])
    sx, sy, punch, split = impact_state(t)
    z *= 1 + punch
    z = max(z, 1 + 2 * max(abs(sx) / W, abs(sy) / H) + 0.002) if (sx or sy) else z
    if z > 1.0005:
        im = Image.fromarray(np.clip(c, 0, 255).astype(np.uint8))
        w, h = W / z, H / z
        x0, y0 = (W - w) / 2 - sx, (H - h) / 2 - sy
        im = im.transform((W, H), Image.EXTENT, (x0, y0, x0 + w, y0 + h), Image.BICUBIC)
        c = np.asarray(im, np.float32).copy()
    d = int(round(split))
    if d >= 1:
        c[:, d:, 0] = c[:, :-d, 0].copy()
        c[:, :-d, 2] = c[:, d:, 2].copy()
    return c


# ---------------------------------------------------------------- the six pieces

# Three underlines, one under each problem, snap in two on the issue word. The six halves drift
# through the film, slam together into the logo mark on "a spine.", and fuse again into the logo.
PAINS = [(4.0, "01  Questions", "Questions.", "Unanswered.", card_pain_question),
         (6.0, "02  Ideas", "Builds.", "Gone quiet.", card_pain_build),
         (8.0, "03  Impact", "Hours saved?", "Nobody knows.", card_pain_impact)]
PAIN_SIZE = 104
UL_Y, UL_T = 448, 14
ANG = [12, -14, 10, -12, 15, -10]                    # tilt of each half after its snap: the inner ends drop (degrees)
DEBRIS = [(250, 300), (1670, 250), (300, 800), (1620, 840), (170, 560), (1750, 560)]
RING = [(560, 250), (1360, 250), (470, 790), (1450, 790), (300, 520), (1620, 520)]

# The approved logo geometry (from the end card): bars (x0, x1, centre y).
LOGO = [(736.0, 831.0, 397.5), (708.0, 835.0, 469.5), (700.0, 779.0, 541.5)]
LOGO_C = (767.5, 469.5)
MARK_AT, MARK_S = (W / 2, 450), 1.7                   # the mark on "a spine." (13 - 16 s)


def half_slot(i, scale, cx, cy):
    """Centre, length and thickness of half i of the logo bar i // 2, for the mark at (cx, cy)."""
    x0, x1, yc = LOGO[i // 2]
    mid = (x0 + x1) / 2
    hx = (x0 + mid) / 2 if i % 2 == 0 else (mid + x1) / 2
    return cx + (hx - LOGO_C[0]) * scale, cy + (yc - LOGO_C[1]) * scale, (x1 - x0) / 2 * scale, 40 * scale


def bar_len(k):
    return text_width(PAINS[k][2], LIGHT, PAIN_SIZE) + 40


def snapped(i, t):
    """Position of half i from its snap until it leaves the problem scene."""
    k, s = i // 2, (-1 if i % 2 == 0 else 1)
    L = bar_len(k)
    u = max(0.0, t - PAINS[k][0] - 0.5)
    sep = 1 - math.exp(-u / 0.09) * math.cos(2 * math.pi * 3.2 * u)      # a damped spring: kick, overshoot, settle
    x = W / 2 + s * (L / 4 + 60 * sep)
    y = UL_Y + 12 * sep
    return x, y, L / 2, UL_T, 0.75 * ANG[i] * sep


def drifting(i, t):
    x, y = DEBRIS[i]
    x += 10 * math.sin(0.7 * t + i)
    y += 8 * math.sin(0.9 * t + 2 * i)
    rz = ANG[i] * 1.6 + 3 * math.sin(0.5 * t + i) + 2.5 * kick_env(t) * (-1) ** i
    return x, y, 120.0, 12.0, rz


def piece(i, t):
    """(x, y, L, T, rz, alpha, inner_flat) for half i, or None when it isn't on screen."""
    k = i // 2
    t0 = PAINS[k][0]
    if t < t0 or t >= 16.1:
        return None
    if t < t0 + 0.5:                                   # the underline wipes in under the first line
        L = bar_len(k)
        D = L * e_out_expo(prog(t, t0 + 0.05, t0 + 0.4, e_lin))
        if i % 2 == 0:
            ln = min(D, L / 2)
            return W / 2 - L / 2 + ln / 2, UL_Y, ln, UL_T, 0.0, 1.0, D >= L / 2
        ln = max(0.0, D - L / 2)
        return W / 2 + ln / 2, UL_Y, ln, UL_T, 0.0, 1.0, True
    if t < t0 + 1.75:
        x, y, L, T, rz = snapped(i, t)
        return x, y, L, T, rz, 1.0, True
    a = snapped(i, t0 + 1.75)
    if t < 11.75:                                      # out to the edges, where they hang
        p = prog(t, t0 + 1.75, t0 + 2.3, e_io_cubic)
        b = drifting(i, t)
        x, y, L, T, rz = (lerp(a[j], b[j], p) for j in range(5))
        return x, y, L, T, rz, lerp(1.0, 0.75, p), True
    if t < 12.85:                                      # pulled in around "Your AI needs a spine.", trembling
        p = prog(t, 11.75, 12.4, e_io_cubic)
        b = drifting(i, t)
        tense = prog(t, 12.0, 12.85, e_in_cubic)
        x = lerp(b[0], RING[i][0], p) + 5 * tense * math.sin(53 * t + i)
        y = lerp(b[1], RING[i][1], p) + 4 * tense * math.cos(47 * t + 2 * i)
        rz = lerp(b[4], ANG[i] * 0.6, p) + 7 * tense * math.sin(41 * t + i)
        return x, y, lerp(b[2], 150, p), lerp(b[3], 16, p), rz, lerp(0.75, 1.0, p), True
    mx = MARK_AT[0] - 1700 * prog(t, 15.7, 16.05, e_in_cubic)
    sc = MARK_S * (1 + 0.06 * prog(t, 13.0, 15.75, e_lin))
    sx_, sy_, sL, sT = half_slot(i, sc, mx, MARK_AT[1])
    if t < 13.0:                                       # the slam: accelerating into the slot
        p = prog(t, 12.85, 13.0, e_in_cubic)
        x, y = lerp(RING[i][0], sx_, p), lerp(RING[i][1], sy_, p)
        return x, y, lerp(150, sL, p), lerp(16, sT, p), lerp(ANG[i] * 0.6, 0, p), 1.0, True
    return sx_, sy_, sL, sT, 0.0, 1.0, True


def draw_bar(c, x, y, L, T, rz=0.0, alpha=1.0, rl=1.0, rr=1.0, color=None):
    draw_segment(c, SCREEN_CAM, default_seg(x=x, y=y, L=L, T=T, rz=rz, rl=rl, rr=rr,
                                            alpha=alpha, flat=True, color=color))


def sparks(c, t, x0, y0, t0, seed, n=12, spread=1.0):
    u = t - t0
    if not 0 <= u < 0.55:
        return
    rng = np.random.default_rng(seed)
    for _ in range(n):
        a = rng.uniform(-math.pi, math.pi)
        v = rng.uniform(380, 950) * spread
        life = rng.uniform(0.3, 0.55)
        if u > life:
            continue
        x = x0 + math.cos(a) * v * u
        y = y0 + math.sin(a) * v * u + 900 * u * u
        draw_dot(c, x, y, rng.uniform(1.6, 3.2), (200, 214, 255), 1 - u / life)


def glint(c, t, x, y, t0, size=1.0):
    u = t - t0
    if 0 <= u < 0.4:
        draw_dot(c, x, y, 46 * size, (150, 175, 255), 0.5 * math.exp(-u / 0.08), blur=18 * size)
        draw_dot(c, x, y, 7 * size, (255, 255, 255), math.exp(-u / 0.06))


def draw_pieces(c, t):
    if t >= 13.0:
        # fused: one whole bar per pair, with a glint where the halves met
        mx = MARK_AT[0] - 1700 * prog(t, 15.7, 16.05, e_in_cubic)
        sc = MARK_S * (1 + 0.06 * prog(t, 13.0, 15.75, e_lin))
        if t < 16.1:
            for k, (x0, x1, yc) in enumerate(LOGO):
                cx = mx + ((x0 + x1) / 2 - LOGO_C[0]) * sc
                cy = MARK_AT[1] + (yc - LOGO_C[1]) * sc
                draw_bar(c, cx, cy, (x1 - x0) * sc, 40 * sc)
                glint(c, t, cx, cy, 13.0, 1.6)
            u = t - 13.0
            if u < 0.6:   # shockwave
                draw_dot(c, MARK_AT[0], MARK_AT[1], 120 + 1500 * e_out_cubic(u / 0.6), (120, 150, 255),
                         0.5 * (1 - u / 0.6), ring=6)
        return
    for i in range(6):
        s = piece(i, t)
        if s is None:
            continue
        x, y, L, T, rz, a, flat = s
        left = i % 2 == 0
        draw_bar(c, x, y, L, T, rz, a, rl=1.0 if left else (0.0 if flat else 1.0),
                 rr=(0.0 if flat else 1.0) if left else 1.0)
    for k, (t0, *_r) in enumerate(PAINS):
        sparks(c, t, W / 2, UL_Y, t0 + 0.5, 40 + k)
        glint(c, t, W / 2, UL_Y, t0 + 0.5)


# ---------------------------------------------------------------- type that slams in on a hit

def slam_line(c, t, text, fname, size, color, cx, base, t_hit, t_out):
    if t < t_hit - 0.05:
        return
    s = 1 + 0.38 * (1 - e_out_expo(prog(t, t_hit - 0.05, t_hit + 0.22, e_lin)))
    g = prog(t, t_hit - 0.05, t_hit + 0.02, e_lin)
    out = prog(t, t_out, t_out + 0.22, e_io_cubic) if t_out is not None else 0.0
    total = text_width(text, fname, size) * s
    soft_word(c, text, fname, size, color, cx - total / 2, base + 30 * (s - 1), g, out, s)


# ---------------------------------------------------------------- scenes

def pain(c, t, t0, kicker, l1, l2, card_fn):
    """One everyday failure: a label, the subject with its underline, the issue slamming in, a card."""
    t1 = t0 + 1.78
    if not t0 - 0.1 <= t < t1 + 0.6:
        return
    label(c, t, kicker, W / 2, 290, t0, t1, align="center", size=19)
    line_words(c, t, l1, LIGHT, PAIN_SIZE, WHITE, W / 2, 410, t0, t1, "center")
    slam_line(c, t, l2, DREG, PAIN_SIZE, BLUE, W / 2, 604, t0 + 0.5, t1)
    g = prog(t, t0 + 0.5, t0 + 0.8, e_out_cubic) * (1 - prog(t, t1, t1 + 0.22))
    place(c, card_fn(t), W / 2, 795 + 18 * (1 - g), 1.05, g)


def fuse_underline(c, t, x, y, L, a, b, fuse):
    """A healed underline: two halves slide in and lock together on `fuse` (or wipe in when fuse is None)."""
    gin = prog(t, a + 0.45, a + 0.75, e_out_cubic)
    out = prog(t, b - 0.22, b, e_io_cubic)
    alpha = gin * (1 - out)
    if alpha <= 0:
        return
    if fuse is None:
        D = L * e_out_expo(prog(t, a + 0.5, a + 0.85, e_lin))
        draw_bar(c, x + D / 2, y, D, 10, alpha=alpha)
        return
    if t >= fuse:
        draw_bar(c, x + L / 2, y, L, 10, alpha=alpha)
        glint(c, t, x + L / 2, y, fuse, 0.8)
        sparks(c, t, x + L / 2, y, fuse, int(fuse * 10), n=8, spread=0.6)
        return
    gap = 160 * (1 - prog(t, a + 0.5, fuse, e_in_cubic))
    draw_bar(c, x + L / 4 - gap / 2, y, L / 2, 10, alpha=alpha, rr=0.0)
    draw_bar(c, x + 3 * L / 4 + gap / 2, y, L / 2, 10, alpha=alpha, rl=0.0)


def render_scene(t):
    n = int(round(t * FPS * 4))
    flash = prog(t, 12.97, 13.0, e_lin) * (1 - prog(t, 13.0, 13.45, e_out_cubic)) + snap_flash(t)
    c = background(t, n, min(flash, 1.0))
    draw_fragments(c, t)

    # 1. Opening (two bars)
    line_words(c, t, "Your company has AI.", LIGHT, 96, WHITE, W / 2, 560, 0.25, 1.78, "center")
    line_words(c, t, "So why does it", LIGHT, 96, WHITE, W / 2, 500, 2.0, 3.78, "center")
    line_words(c, t, "quietly die?", DREG, 96, BLUE, W / 2, 610, 2.5, 3.78, "center")

    # 2. Three everyday failures: each underline snaps as its issue lands
    for t0, kicker, l1, l2, fn in PAINS:
        pain(c, t, t0, kicker, l1, l2, fn)
    line_words(c, t, "Every team.", LIGHT, 96, WHITE, W / 2, 570, 10.0, 10.9, "center")
    line_words(c, t, "Every week.", LIGHT, 96, WHITE, W / 2, 570, 11.0, 11.9, "center")

    # 3. The turn: the six pieces slam together into the mark on the downbeat at 13.0
    line_words(c, t, "Your AI needs", LIGHT, 104, WHITE, W / 2, 500, 12.0, 12.9, "center")
    line_words(c, t, "a spine.", DREG, 104, BLUE, W / 2, 620, 12.5, 12.9, "center")
    draw_pieces(c, t)
    line_words(c, t, "Spine holds it together.", LIGHT, 72, WHITE, W / 2, 820, 14.0, 15.6, "center")

    # 4. A first look: real Spine screens, restyled dark; each line's underline locks back together
    CS = 1.1
    cx0, cy0 = W / 2 + 110, 640
    looks = [
        (16.0, 19.0, card_pulse, "Quiet until you’re needed.", None),
        (19.0, 22.0, card_question, "Every question gets a Champion.", 20.0),
        (22.0, 25.0, card_project, "An owner. A team. A plan.", 23.0),
        (25.0, 28.0, card_value, "Impact, in hours.", 26.0),
    ]
    for k, (a, b, fn, words, fuse) in enumerate(looks):
        if a - 0.3 <= t < b + 0.3:
            gin = prog(t, a - 0.2, a + 0.25, e_out_cubic)
            gout = prog(t, b - 0.2, b + 0.05, e_in_cubic)
            x = cx0 + 240 * (1 - gin) - 240 * gout
            place(c, fn(t, a), x, cy0, CS, gin * (1 - gout))
            if k == 0:
                label(c, t, "A first look", 110, 140, a, b - 0.2, size=19)
            line_words(c, t, words, LIGHT, 66, WHITE, 110, 215, a + BEAT / 2, b - 0.22, "left")
            fuse_underline(c, t, 112, 252, text_width(words, LIGHT, 66), a, b, fuse)
    # a first look, all together (two beats)
    if 28.0 <= t < 29.3:
        g = prog(t, 28.0, 28.35, e_out_cubic) * (1 - prog(t, 28.8, 29.05))
        for k, (fn, a, (dx, dy)) in enumerate(((card_pulse, 16.0, (-470, -200)), (card_question, 19.0, (470, -210)),
                                               (card_project, 22.0, (-470, 215)), (card_value, 25.0, (470, 215)))):
            place(c, fn(40.0, a), W / 2 + dx * (0.85 + 0.15 * g), H / 2 + dy * (0.85 + 0.15 * g), 0.44, g)

    # 5. The logo
    logo(c, t)
    return post(c, t)


# ---------------------------------------------------------------- logo and end card

def logo(c, t):
    if t < 29.4:
        return
    # each bar's two halves fly in from either side and lock together on the beat
    for k, (x0, x1, yc) in enumerate(LOGO):
        land = 30.0 + BEAT / 2 * k
        L = x1 - x0
        if t >= land:
            draw_bar(c, (x0 + x1) / 2, yc, L, 40)
            glint(c, t, (x0 + x1) / 2, yc, land, 1.2)
            sparks(c, t, (x0 + x1) / 2, yc, land, 70 + k, n=10, spread=0.8)
            continue
        p = prog(t, land - 0.5, land, e_in_cubic)
        if p <= 0:
            continue
        lx = lerp(-200, x0 + L / 4, p)
        rx = lerp(W + 200, x1 - L / 4, p)
        draw_bar(c, lx, yc, L / 2, 40, rr=0.0)
        draw_bar(c, rx, yc, L / 2, 40, rl=0.0)
    g = prog(t, 30.5, 31.0, e_out_cubic)
    soft_word(c, "Spine", DSEMI, 172, WHITE, 886, 527, g)   # the approved wordmark's size and position
    line_words(c, t, "Give your company’s AI a spine.", LIGHT, 46, WHITE, W / 2, 698, 31.5, None, "center")
    bw = lerp(0, 364, prog(t, 33.0, 33.3))
    bh = lerp(10, 80, prog(t, 33.25, 33.5, e_out_quint))
    if bw > 1:
        draw_segment(c, SCREEN_CAM, default_seg(x=959.5, y=841.5, L=max(bw, bh), T=bh, flat=True, color=BLUE_DEEP))
        rv = prog(t, 33.5, 33.9, e_out_quint)
        soft_word(c, "Book a demo  →", MED, 32, (255, 255, 255), 959.5 - text_width("Book a demo  →", MED, 32) / 2,
                  852, rv)


def end_card(t, plate=None):
    return render_scene(t)
