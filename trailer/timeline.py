"""Spine launch film: "Holds it together".

Dark, warm-neutral and quiet: light type that fades in word by word (second line in Spine blue),
specific everyday failures shown with tiny cards, a turn to "Your AI needs a spine.", four lines
that meet in one glowing node, then a first look at real Spine screens (restyled dark) with the
node travelling between them, and the logo.

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


def background(t, n, flash=0.0):
    c = _bg_base().copy()
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


def line_words(c, t, text, fname, size, color, x, base, t_in, t_out, align="left", step=0.11, dur=0.55,
               scale=1.0):
    """A line that appears word by word and leaves as one."""
    words = text.split(" ")
    total = text_width(text, fname, size) * scale
    x0 = x - (total / 2 if align == "center" else total if align == "right" else 0)
    out = prog(t, t_out, t_out + 0.5, e_io_cubic) if t_out is not None else 0.0
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


# ---------------------------------------------------------------- the node

def node(c, x, y, s=1.0, alpha=1.0, rings=0.0, t=0.0):
    draw_dot(c, x, y, 70 * s, (40, 62, 140), 0.35 * alpha, blur=40 * s)            # soft glow
    draw_dot(c, x, y, 26 * s, BLUE, alpha, ring=3.2 * s)
    draw_dot(c, x, y, 12 * s, BLUE, alpha)
    for j in range(3):
        if rings <= 0:
            break
        ph = ((t * 0.9 + j / 3) % 1.0)
        draw_dot(c, x, y, (30 + 120 * ph) * s, BLUE, 0.35 * (1 - ph) * rings * alpha, ring=1.6 * s)


# ---------------------------------------------------------------- the four lines that meet

LINE_LABELS = [("Questions", -1, -1), ("Champions", 1, -1), ("Ideas", -1, 1), ("Leadership", 1, 1)]


def draw_join(c, t):
    if not 13.2 <= t < 16.9:
        return
    g = prog(t, 13.35, 14.6, e_io_cubic)
    out = prog(t, 16.3, 16.8, e_io_cubic)
    cx, cy = W / 2, H / 2 - 20
    im = Image.new("L", (W * 2, H * 2), 0)
    d = ImageDraw.Draw(im)
    for name, sx, sy in LINE_LABELS:
        x0, y0 = cx + sx * 640, cy + sy * 300
        pts = []
        for i in range(61):
            u = i / 60 * g
            # an S-curve from the corner that arrives horizontally at the node
            px = lerp(x0, cx, u)
            py = y0 + (cy - y0) * (3 * u * u - 2 * u ** 3)
            pts.append((px * 2, py * 2))
        d.line(pts, fill=int(200 * (1 - out)), width=4, joint="curve")
        a = prog(t, 13.3, 13.8) * (1 - out)
        tx = x0 + (-20 if sx < 0 else 20)
        soft_word(c, name, MED, 22, DIM, tx - (0 if sx < 0 else text_width(name, MED, 22)), y0 - (18 if sy < 0 else -44), a)
    m = np.asarray(im.resize((W, H), Image.BOX), np.float32) / 255.0
    blend(c, 0, 0, m, (120, 130, 160))
    arrive = prog(t, 14.45, 14.75, e_out_expo)
    if arrive > 0:
        node(c, cx, cy, 0.6 + 0.4 * arrive, arrive * (1 - out), rings=1.0, t=t)


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
                        t0=rng.uniform(3.0, 10.5)))
    return out


def draw_fragments(c, t):
    a_all = prog(t, 3.0, 4.0) * (1 - prog(t, 11.3, 12.4))
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


# ---------------------------------------------------------------- scenes

def pain(c, t, idx, t0, t1, kicker, l1, l2, card_fn):
    """One everyday failure: a small label, two lines, and a small card underneath."""
    if not t0 - 0.1 <= t < t1 + 0.6:
        return
    label(c, t, kicker, W / 2, 360, t0, t1, align="center")
    line_words(c, t, l1, LIGHT, 58, WHITE, W / 2, 452, t0 + 0.1, t1, "center")
    line_words(c, t, l2, LIGHT, 58, BLUE, W / 2, 522, t0 + 0.55, t1, "center")
    g = prog(t, t0 + 0.7, t0 + 1.3, e_out_cubic) * (1 - prog(t, t1, t1 + 0.5))
    place(c, card_fn(t), W / 2, 700 + 18 * (1 - g), 1.0, g)


def render_scene(t):
    n = int(round(t * FPS * 4))
    flash = prog(t, 13.05, 13.15, e_lin) * (1 - prog(t, 13.15, 13.55, e_out_cubic))
    c = background(t, n, flash)
    draw_fragments(c, t)

    # 1. Opening
    line_words(c, t, "Your company has AI.", LIGHT, 66, WHITE, W / 2, 520, 0.5, 3.0, "center")
    line_words(c, t, "So why does so much of it quietly die?", LIGHT, 66, BLUE, W / 2, 600, 1.35, 3.0, "center")

    # 2. Three everyday failures
    pain(c, t, 0, 3.6, 5.6, "01  Questions", "A question about client data.", "Still unanswered.", card_pain_question)
    pain(c, t, 1, 5.9, 7.9, "02  Ideas", "A build that went quiet.", "No activity for 12 days.", card_pain_build)
    pain(c, t, 2, 8.2, 10.2, "03  Impact", "Hours saved?", "Nobody can say.", card_pain_impact)
    line_words(c, t, "Every team. Every week.", LIGHT, 66, WHITE, W / 2, 560, 10.5, 11.6, "center")

    # 3. The turn
    line_words(c, t, "Your AI needs", LIGHT, 72, WHITE, W / 2, 520, 11.85, 12.85, "center")
    line_words(c, t, "a spine.", DREG, 72, BLUE, W / 2, 610, 12.3, 12.85, "center")
    draw_join(c, t)
    line_words(c, t, "Spine holds it together.", LIGHT, 52, WHITE, W / 2, 900, 14.9, 16.3, "center")

    # 4. A first look: real Spine screens, restyled dark; the node travels between them
    CS = 1.1     # card scale on screen
    cx0, cy0 = W / 2 + 110, 585

    def at(card_w, card_h, u, v):
        """Screen position of card pixel (u, v) for a card centred at (cx0, cy0)."""
        return (cx0 + (u - card_w / 2) * CS, cy0 + (v - card_h / 2) * CS)

    looks = [
        (16.8, 19.6, card_pulse, "Quiet until a human is needed.", at(980, 410, 882, 112)),          # Review
        (19.6, 22.4, card_question, "Every question reaches a Champion.", at(860, 330, 168, 196)),   # Claimed
        (22.4, 25.4, card_project, "Every idea gets an owner, a team and a plan.", at(980, 400, 566, 190)),   # Building
        (25.4, 28.4, card_value, "Impact, measured in hours.", at(980, 400, 890, 173)),             # 42 hours
    ]
    for k, (a, b, fn, words, node_at) in enumerate(looks):
        if a - 0.5 <= t < b + 0.6:
            gin = prog(t, a - 0.35, a + 0.25, e_out_cubic)
            gout = prog(t, b - 0.25, b + 0.35, e_in_cubic)
            x = cx0 + 220 * (1 - gin) - 220 * gout
            place(c, fn(t, a), x, cy0, CS, gin * (1 - gout))
            label(c, t, "A first look", 110, 150, a, b - 0.3) if k == 0 else None
            line_words(c, t, words, LIGHT, 44, WHITE, 110, 210, a + 0.15, b - 0.35, "left", dur=0.5)
    # the node: from the join, across each card's key detail, then into the logo
    node_track = [(16.6, (W / 2, H / 2 - 20)), (17.5, looks[0][4]), (19.3, looks[0][4]), (20.0, looks[1][4]),
                  (22.1, looks[1][4]), (22.8, looks[2][4]), (25.1, looks[2][4]), (25.8, looks[3][4]),
                  (28.2, looks[3][4]), (29.2, (W / 2, 480))]
    if 16.6 <= t < 29.2:
        for (ta, pa), (tb, pb) in zip(node_track, node_track[1:]):
            if ta <= t <= tb:
                p = prog(t, ta, tb, e_io_cubic)
                x, y = lerp(pa[0], pb[0], p), lerp(pa[1], pb[1], p)
                resting = tb - ta > 1
                node(c, x, y, 0.38 if resting else 0.5, 1.0, rings=0.6 if resting else 0.0, t=t)
                break
    # a first look, all together
    if 28.3 <= t < 30.2:
        g = prog(t, 28.35, 28.9, e_out_cubic) * (1 - prog(t, 29.6, 30.1))
        for k, (fn, a, (dx, dy)) in enumerate(((card_pulse, 16.8, (-470, -200)), (card_question, 19.6, (470, -210)),
                                               (card_project, 22.4, (-470, 215)), (card_value, 25.4, (470, 215)))):
            place(c, fn(40.0, a), W / 2 + dx * (0.85 + 0.15 * g), H / 2 + dy * (0.85 + 0.15 * g), 0.44, g)

    # 5. The logo
    logo(c, t)
    return c


# ---------------------------------------------------------------- logo and end card

# The approved logo geometry (from the end card): bars (x0, x1, centre y) and the wordmark box.
LOGO = [(736.0, 831.0, 397.5), (708.0, 835.0, 469.5), (700.0, 779.0, 541.5)]


def logo(c, t):
    if t < 29.0:
        return
    # the node splits into the three bars
    for k, (x0, x1, yc) in enumerate(LOGO):
        p = prog(t, 29.2 + 0.12 * k, 30.3 + 0.12 * k, e_io_quint)
        if p <= 0:
            continue
        L = lerp(12, x1 - x0, p)
        T = lerp(12, 40, p)
        x = lerp(W / 2, (x0 + x1) / 2, p)
        y = lerp(480, yc, p)
        draw_segment(c, SCREEN_CAM, default_seg(x=x, y=y, L=L, T=T, flat=T < 14))
    nd = 1 - prog(t, 29.15, 29.5)
    if nd > 0:
        node(c, W / 2, 480, 0.55 * nd, nd)
    g = prog(t, 30.45, 31.1, e_out_cubic)
    soft_word(c, "Spine", DSEMI, 172, WHITE, 886, 527, g)   # the approved wordmark's size and position
    line_words(c, t, "Give your company’s AI a spine.", LIGHT, 46, WHITE, W / 2, 698, 31.7, None, "center")
    bw = lerp(0, 364, prog(t, 33.0, 33.3))
    bh = lerp(10, 80, prog(t, 33.25, 33.5, e_out_quint))
    if bw > 1:
        draw_segment(c, SCREEN_CAM, default_seg(x=959.5, y=841.5, L=max(bw, bh), T=bh, flat=True, color=BLUE_DEEP))
        rv = prog(t, 33.4, 33.85, e_out_quint)
        soft_word(c, "Book a demo  →", MED, 32, (255, 255, 255), 959.5 - text_width("Book a demo  →", MED, 32) / 2,
                  852, rv)


def end_card(t, plate=None):
    return render_scene(t)
