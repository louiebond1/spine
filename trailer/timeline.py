"""Spine launch film: "Holds it together" (explainer cut, 61 s).

Dark, on a 120 BPM grid. Each everyday failure is underlined in Spine blue, and the underline
snaps in two as its issue lands. The six halves hang at the edges of frame and slam together into
the Spine mark on "a spine.". Then one real Spine screen per shot explains the product (Help Desk,
Ideas & Projects, Pulse, Home, Programme), with underlines locking back together, and the logo's
bars fly in as halves to finish. Every hit shakes and punches the frame.

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

TOTAL = 1830
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
SHOTS = [0.0, 2.0, 4.0, 6.0, 8.0, 10.0, 12.0, 13.0, 17.0, 20.0, 23.0, 26.0, 28.0, 31.0, 34.0, 37.0, 40.0, 43.0, 46.0,
         49.0, 52.0, 55.0, 61.0]
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
    if 13.0 <= t < 14.0 or 55.0 <= t < 56.5 or t >= 59.0 or (12.0 <= t < 13.0 and (t - 12.0) >= 2 * BEAT):
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
        self.d = ImageDraw.Draw(self.im, "RGBA")   # blend, so fading elements never punch holes
        self.d.rounded_rectangle([0, 0, w * S - 1, h * S - 1], 14 * S, fill=CARD + (245,), outline=CARD_LINE + (255,),
                                 width=S)

    def text(self, x, y, s, size, color, fname=REG, anchor="ls", alpha=1.0):
        if alpha <= 0:
            return
        col = tuple(color) + (int(255 * clamp(alpha)),)
        self.d.text((x * S, y * S), s, font=_f(fname, size), fill=col, anchor=anchor)

    def rrect(self, x0, y0, x1, y1, r, fill=None, outline=None, width=1, alpha=1.0):
        if x1 <= x0 or y1 <= y0 or alpha <= 0.004:   # PIL writes zero-alpha ink as-is, punching a hole
            return
        f = tuple(fill) + (int(255 * alpha),) if fill else None
        o = tuple(outline) + (int(255 * alpha),) if outline else None
        self.d.rounded_rectangle([x0 * S, y0 * S, x1 * S, y1 * S], r * S, fill=f, outline=o, width=width * S)

    def circle(self, cx, cy, r, fill=None, outline=None, width=1, alpha=1.0):
        if alpha <= 0.004:
            return
        f = tuple(fill) + (int(255 * alpha),) if fill else None
        o = tuple(outline) + (int(255 * alpha),) if outline else None
        self.d.ellipse([(cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S], fill=f, outline=o, width=width * S)

    def line(self, pts, color, width=1, alpha=1.0):
        if alpha <= 0.004:
            return
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
            ("Best way to anonymise client data?", "Ben Carter asked 2 hours ago and nobody has claimed it", "Claim", False),
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



def _avatar(p, x, y, initials, r=20, size=13, alpha=1.0):
    p.circle(x, y, r, fill=(38, 41, 50), alpha=alpha)
    p.text(x, y + size * 0.42, initials, size, DIM, SEMI, anchor="ms", alpha=alpha)


def _button(p, x0, y0, x1, y1, text, primary=False, alpha=1.0, size=16):
    if primary:
        p.rrect(x0, y0, x1, y1, 10, fill=BLUE_DEEP, alpha=alpha)
        p.text((x0 + x1) / 2, (y0 + y1) / 2 + size * 0.36, text, size, (255, 255, 255), MED, anchor="ms", alpha=alpha)
    else:
        p.rrect(x0, y0, x1, y1, 10, outline=BLUE, width=1, alpha=alpha)
        p.text((x0 + x1) / 2, (y0 + y1) / 2 + size * 0.36, text, size, BLUE, MED, anchor="ms", alpha=alpha)


def _stages(p, t, t0, names, upto, y=190, x0=56, step=170, current=None):
    """The small stepper: fills to stage index `upto` over a second."""
    xs = [x0 + step * k for k in range(len(names))]
    fill_to = lerp(0, upto, prog(t, t0 + 0.4, t0 + 1.4, e_io_cubic))
    p.line([(xs[0], y), (xs[-1], y)], (52, 56, 68), 3)
    p.line([(xs[0], y), (xs[0] + (xs[-1] - xs[0]) * fill_to / (len(names) - 1), y)], BLUE, 3)
    for k, x in enumerate(xs):
        if fill_to >= k - 1e-3:
            p.circle(x, y, 11, fill=BLUE)
        else:
            p.circle(x, y, 10, fill=CARD, outline=(70, 75, 92), width=2)
        cur = k == (upto if current is None else current)
        p.text(x, y + 38, names[k], 14, WHITE if cur else DIM, SEMI if cur else MED, anchor="ms")


def card_ask(t, t0):
    """Help Desk: a question being asked (Sarah Kim's Excel question, from the thread mockup)."""
    p = Pen(900, 330)
    p.tracked(36, 52, "Help Desk  ·  Ask a question", 12, DIM)
    title = "Can Claude analyse multiple Excel files?"
    n = int(len(title) * prog(t, t0 + 0.3, t0 + 1.2, e_lin))
    p.rrect(36, 76, 864, 126, 10, outline=CARD_LINE)
    p.text(56, 109, title[:n], 22, WHITE, MED)
    g = prog(t, t0 + 1.1, t0 + 1.5, e_out_cubic)
    p.text(36, 166, "Sarah Kim  ·  Excel  ·  Just now", 16, DIM, alpha=g)
    p.rrect(36, 190, 700, 290, 12, fill=(32, 36, 48), alpha=g)
    p.text(56, 226, "Can Claude analyse multiple Excel files at once?", 16, WHITE, alpha=g)
    p.text(56, 254, "I have several reports from different regions and want", 16, WHITE, alpha=g)
    p.text(56, 278, "to compare them.", 16, WHITE, alpha=g)
    p.rrect(740, 190, 864, 226, 10, outline=CARD_LINE, alpha=g)
    p.text(802, 214, "Unclaimed", 14, DIM, MED, anchor="ms", alpha=g)
    return p.done()


def card_claim(t, t0):
    p = Pen(860, 260)
    p.tracked(36, 52, "Help Desk  ·  Unclaimed", 12, DIM)
    p.text(36, 112, "Can Claude analyse multiple Excel files?", 27, WHITE, DSEMI)
    p.text(36, 146, "Sarah Kim  ·  Excel  ·  2h ago", 16, DIM)
    claimed = prog(t, t0 + 0.9, t0 + 1.2, e_out_cubic)
    _button(p, 680, 84, 824, 128, "Claim  →", primary=True, alpha=1 - claimed)
    p.rrect(36, 180, 230, 216, 10, outline=CARD_LINE, alpha=1 - claimed)
    p.text(133, 204, "Unclaimed", 15, DIM, MED, anchor="ms", alpha=1 - claimed)
    p.rrect(36, 180, 300, 216, 10, fill=(34, 44, 78), alpha=claimed)
    p.text(168, 204, "Claimed by Alex Morgan", 15, BLUE, MED, anchor="ms", alpha=claimed)
    _avatar(p, 790, 198, "AM", alpha=claimed)
    return p.done()


def card_thread(t, t0):
    """The private chat (03-question-thread.png), shortened."""
    p = Pen(940, 420)
    p.tracked(36, 52, "Help Desk  ·  Private chat", 12, DIM)
    p.text(36, 100, "Can Claude analyse multiple Excel files?", 24, WHITE, DSEMI)
    p.text(36, 132, "Sarah Kim  ·  Excel  ·  Claimed by Alex Morgan", 15, DIM)
    g1 = prog(t, t0 + 0.3, t0 + 0.7, e_out_cubic)
    _avatar(p, 56, 186, "AM", alpha=g1)
    p.text(92, 178, "Alex Morgan", 15, WHITE, SEMI, alpha=g1)
    p.rrect(92, 190, 640, 232, 12, fill=(34, 44, 78), alpha=g1)
    p.text(110, 218, "Yes, you can. Start with one file first.", 16, WHITE, alpha=g1)
    g2 = prog(t, t0 + 0.9, t0 + 1.3, e_out_cubic)
    _avatar(p, 56, 278, "SK", alpha=g2)
    p.text(92, 270, "Sarah Kim", 15, WHITE, SEMI, alpha=g2)
    p.rrect(92, 282, 760, 324, 12, fill=(32, 36, 48), alpha=g2)
    p.text(110, 310, "I’ve attached a sample file. Could you also show how to compare several?", 16, WHITE,
           alpha=g2)
    p.rrect(92, 334, 380, 376, 10, fill=(38, 41, 50), alpha=g2)
    p.rrect(106, 344, 126, 366, 4, fill=(84, 92, 116), alpha=g2)
    p.text(138, 360, "Sales_Data_Sample.xlsx", 15, WHITE, MED, alpha=g2)
    p.text(366, 360, "240 KB", 13, DIM, anchor="rs", alpha=g2)
    g3 = prog(t, t0 + 1.5, t0 + 1.9, e_out_cubic)
    _button(p, 744, 340, 904, 384, "Mark resolved", alpha=g3, size=15)
    return p.done()


def card_leaderboard(t, t0):
    p = Pen(760, 400)
    p.tracked(36, 52, "Leaderboard  ·  This month", 12, DIM)
    p.text(724, 52, "Questions resolved", 13, DIM, MED, anchor="rs")
    rows = [("Jamie Chen", "JC", 18), ("Mia Thompson", "MT", 14), ("Sarah Kim", "SK", 11), ("Louie Morris", "LM", 8),
            ("Alex Morgan", "AM", 6)]
    for k, (name, ini, pts) in enumerate(rows):
        g = prog(t, t0 + 0.2 + 0.12 * k, t0 + 0.6 + 0.12 * k, e_out_cubic)
        y = 104 + k * 62
        if k == 4:
            p.rrect(24, y - 30, 736, y + 30, 10, fill=(30, 38, 64), alpha=g)
        elif k:
            p.line([(36, y - 31), (724, y - 31)], CARD_LINE, 1, alpha=g)
        p.text(48, y + 6, str(k + 1), 17, DIM, MED, anchor="ms", alpha=g)
        _avatar(p, 104, y, ini, alpha=g)
        p.text(140, y + 6, name, 18, WHITE, MED, alpha=g)
        if k == 4:
            p.rrect(262, y - 14, 306, y + 14, 6, fill=(40, 54, 100), alpha=g)
            p.text(284, y + 5, "You", 13, BLUE, SEMI, anchor="ms", alpha=g)
        p.text(690, y + 6, str(pts), 18, WHITE, MED, anchor="ms", alpha=g)
    return p.done()


def card_propose(t, t0):
    """Propose an idea (04-propose-idea.png), shortened."""
    p = Pen(960, 430)
    p.tracked(36, 52, "Ideas & Projects  ·  Propose an idea", 12, DIM)
    p.text(36, 92, "Name your idea", 14, DIM, MED)
    p.rrect(36, 104, 924, 148, 10, outline=CARD_LINE)
    name = "Supplier Risk Checker"
    n = int(len(name) * prog(t, t0 + 0.2, t0 + 0.8, e_lin))
    p.text(54, 133, name[:n], 18, WHITE)
    g = prog(t, t0 + 0.8, t0 + 1.2, e_out_cubic)
    p.text(36, 182, "What problem does it solve?", 14, DIM, MED, alpha=g)
    p.rrect(36, 194, 924, 238, 10, outline=CARD_LINE, alpha=g)
    p.text(54, 223, "We don’t have a simple way to spot risk signals on our existing suppliers.", 16, WHITE, alpha=g)
    g2 = prog(t, t0 + 1.1, t0 + 1.5, e_out_cubic)
    p.text(36, 272, "Who benefits?", 14, DIM, MED, alpha=g2)
    p.rrect(36, 284, 460, 326, 10, outline=CARD_LINE, alpha=g2)
    p.text(54, 311, "Procurement team", 16, WHITE, alpha=g2)
    p.text(500, 272, "How it gets built", 14, DIM, MED, alpha=g2)
    p.rrect(500, 284, 708, 400, 10, fill=(30, 38, 64), outline=BLUE, width=1, alpha=g2)
    p.circle(524, 308, 7, outline=BLUE, width=2, alpha=g2)
    p.circle(524, 308, 3.5, fill=BLUE, alpha=g2)
    p.text(540, 314, "App", 16, WHITE, SEMI, alpha=g2)
    p.text(518, 346, "Leadership approves", 13, DIM, alpha=g2)
    p.text(518, 366, "before recruiting.", 13, DIM, alpha=g2)
    p.rrect(716, 284, 924, 400, 10, outline=CARD_LINE, alpha=g2)
    p.circle(740, 308, 7, outline=DIM, width=2, alpha=g2)
    p.text(756, 314, "Cowork-native", 16, WHITE, SEMI, alpha=g2)
    p.text(734, 346, "Leadership approves", 13, DIM, alpha=g2)
    p.text(734, 366, "after the build.", 13, DIM, alpha=g2)
    return p.done()


def card_review(t, t0):
    """AI review (05-ai-review.png): advisory scores that only the idea's owner sees."""
    p = Pen(960, 440)
    p.tracked(36, 52, "AI review  ·  Supplier Risk Checker", 12, DIM)
    rows = [(8, "Feasibility", "Doable with the tools available and a clear build approach."),
            (7, "Business value", "Solves a real need and could improve supplier due diligence."),
            (7, "Resourcing confidence", "Realistic for the team size and timeframe."),
            (4, "Originality", "Overlaps heavily with Supplier Research Assistant.")]
    for k, (score, name, why) in enumerate(rows):
        g = prog(t, t0 + 0.3 + 0.2 * k, t0 + 0.7 + 0.2 * k, e_out_cubic)
        y = 100 + k * 74
        if k:
            p.line([(36, y - 26), (924, y - 26)], CARD_LINE, 1, alpha=g)
        p.text(40, y + 22, str(score), 36, WHITE, DSEMI, alpha=g)
        p.text(70, y + 22, "/10", 15, DIM, alpha=g)
        p.text(160, y + 6, name, 18, WHITE, SEMI, alpha=g)
        p.text(160, y + 32, why, 15, DIM, alpha=g)
    g = prog(t, t0 + 1.3, t0 + 1.7, e_out_cubic)
    p.text(36, 412, "These scores are advisory. They don’t decide whether your idea is approved.", 14, DIM,
           alpha=g)
    return p.done()


def card_approval(t, t0):
    """Admin approval (06-admin-approval.png), shortened."""
    p = Pen(980, 360)
    p.tracked(36, 52, "Awaiting your approval", 12, DIM)
    p.text(36, 100, "Supplier Research Assistant", 28, WHITE, DSEMI)
    p.text(36, 134, "Louie Morris  ·  Procurement  ·  App", 16, DIM)
    rows = [("Problem", "Sourcing supplier information is slow and manual."), ("Who benefits", "Procurement team"),
            ("Team size", "3 people"), ("Target date", "19 November 2026")]
    for k, (a, b) in enumerate(rows):
        y = 186 + k * 42
        p.line([(36, y - 26), (620, y - 26)], CARD_LINE, 1)
        p.text(36, y, a, 15, DIM)
        p.text(180, y, b, 15, WHITE)
    p.rrect(660, 30, 944, 330, 12, outline=CARD_LINE)
    p.text(684, 76, "Auto-approves in 6h", 21, WHITE, DSEMI)
    p.text(684, 116, "Submitted by Louie Morris", 14, DIM)
    p.text(684, 140, "Auto-approves today at 16:00", 14, DIM)
    pressed = prog(t, t0 + 1.4, t0 + 1.6, e_out_cubic)
    p.rrect(684, 190, 920, 238, 10, fill=BLUE_DEEP)
    p.text(802, 220, "Approve", 17, (255, 255, 255), MED, anchor="ms")
    if pressed > 0:
        p.rrect(684, 190, 920, 238, 10, outline=(255, 255, 255), width=2, alpha=pressed * (1 - prog(t, t0 + 1.8, t0 + 2.2)))
    _button(p, 684, 252, 920, 300, "Return with note", size=16)
    return p.done()


def card_recruit(t, t0):
    p = Pen(980, 330)
    p.tracked(36, 52, "Ideas & Projects  ·  Team", 12, DIM)
    p.text(36, 104, "Client Brief Generator", 30, WHITE, DSEMI)
    p.text(36, 138, "Alex Morgan  ·  Sales  ·  Cowork-native", 16, DIM)
    _stages(p, t, t0, ["Idea", "Recruiting", "Building", "Approval", "Publishing", "Live"], 1)
    for k in range(4):
        g = prog(t, t0 + 0.6 + 0.2 * k, t0 + 0.9 + 0.2 * k, e_out_cubic)
        x = 60 + k * 54
        if k == 0:
            _avatar(p, x, 284, "AM", r=22, alpha=g)
        elif k < 3:
            p.circle(x, 284, 22, fill=(38, 41, 50), alpha=g)
        else:
            p.circle(x, 284, 21, outline=(80, 86, 104), width=2, alpha=g)
    g = prog(t, t0 + 1.4, t0 + 1.8, e_out_cubic)
    p.text(290, 290, "3 of 4 people  ·  Next: Recruit 1 more person to begin", 17, WHITE, MED, alpha=g)
    _button(p, 790, 30, 944, 74, "Join project", alpha=g, size=15)
    return p.done()


LIVE_LAND, LIVE_STEP = 1.0, 0.2     # the first stage piece lands 1.0 s into the shot, then one every 0.2 s


def card_live(t, t0):
    p = Pen(980, 320)
    p.tracked(36, 52, "Ideas & Projects", 12, DIM)
    p.text(36, 104, "Claude Onboarding Guide", 30, WHITE, DSEMI)
    p.text(36, 138, "Priya Shah  ·  People  ·  Cowork-native", 16, DIM)
    # six pieces land one by one as the six stages (see ACTORS)
    names = ["Idea", "Recruiting", "Building", "Approval", "Publishing", "Live"]
    xs = [56 + 170 * k for k in range(6)]
    lands = [t0 + LIVE_LAND + LIVE_STEP * k for k in range(6)]
    done = sum(t >= x for x in lands)
    head = clamp((t - lands[0]) / LIVE_STEP / 5) * 5
    p.line([(xs[0], 190), (xs[-1], 190)], (52, 56, 68), 3)
    if t >= lands[0]:
        p.line([(xs[0], 190), (xs[0] + 170 * head, 190)], BLUE, 3)
    for k, x in enumerate(xs):
        if k < done:
            p.circle(x, 190, 11, fill=BLUE)
        else:
            p.circle(x, 190, 10, fill=CARD, outline=(70, 75, 92), width=2)
        p.text(x, 228, names[k], 14, WHITE if k == 5 else DIM, SEMI if k == 5 else MED, anchor="ms")
    g = prog(t, lands[-1] + 0.15, lands[-1] + 0.5, e_out_cubic)
    p.circle(44, 278, 7, fill=GREEN, alpha=g)
    p.text(60, 284, "Live  ·  14 hours saved this month", 18, WHITE, MED, alpha=g)
    p.text(944, 284, "Published by Alex Morgan", 15, DIM, anchor="rs", alpha=g)
    return p.done()


def card_home(t, t0):
    """Home (01-home.png): what needs you, in order."""
    p = Pen(980, 400)
    p.tracked(36, 52, "Home  ·  Wednesday, 7 October", 12, DIM)
    p.text(36, 104, "3 things need you", 32, WHITE, DSEMI)
    rows = [("Supplier Research Assistant", "Auto-approves in 6h unless you review it", "Review", True),
            ("Can Claude analyse multiple Excel files?", "Sarah Kim is waiting on your reply", "Reply", False),
            ("Knowledge Search Assistant", "Ready for you to publish", "Open", False)]
    for k, (a, b, btn, primary) in enumerate(rows):
        g = prog(t, t0 + 0.3 + 0.2 * k, t0 + 0.7 + 0.2 * k, e_out_cubic)
        y = 172 + k * 82
        if k:
            p.line([(36, y - 40), (944, y - 40)], CARD_LINE, 1, alpha=g)
        p.rrect(36, y - 26, 88, y + 26, 10, fill=(36, 39, 47), alpha=g)
        p.circle(62, y, 9, outline=DIM, width=2, alpha=g)
        p.text(108, y - 4, a, 19, WHITE, MED, alpha=g)
        p.text(108, y + 22, b, 15, DIM, alpha=g)
        _button(p, 820, y - 22, 944, y + 22, btn + "  →", primary=primary, alpha=g)
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
IMPACTS = [(4.5, 1.0), (6.5, 1.0), (8.5, 1.0), (13.0, 2.0), (21.0, 0.45), (28.0, 0.3), (41.0, 0.45), (45.0, 0.35), (46.0, 0.3),
           (53.0, 0.45), (56.0, 0.8), (56.25, 0.8), (56.5, 1.3)]


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
    if t < 55.0:
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
# through the film, slam together into the logo mark on "a spine.", and are repaired one pair per chapter before they form the logo.
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
MARK_AT, MARK_S = (W / 2, 400), 1.7                   # the mark on "a spine." (13 - 16 s)


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
    if t < t0 or t >= 17.1:
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
    mx = MARK_AT[0] - 1700 * prog(t, 16.7, 17.05, e_in_cubic)
    sc = MARK_S * (1 + 0.06 * prog(t, 13.0, 16.7, e_lin))
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
        # held in the mark: one bar per pair, with a glint where the halves met
        mx = MARK_AT[0] - 1700 * prog(t, 16.7, 17.05, e_in_cubic)
        sc = MARK_S * (1 + 0.06 * prog(t, 13.0, 16.7, e_lin))
        if t < 17.1:
            for k, (x0, x1, yc) in enumerate(LOGO):
                cx = mx + ((x0 + x1) / 2 - LOGO_C[0]) * sc
                cy = MARK_AT[1] + (yc - LOGO_C[1]) * sc
                draw_bar(c, cx, cy, (x1 - x0) * sc, 40 * sc)
                # held together, not yet fixed: a hairline crack stays where each pair met
                draw_segment(c, SCREEN_CAM, default_seg(x=cx + 2, y=cy + 3, L=40 * sc + 2, T=2.4, rz=82,
                                                        flat=True, color=(16, 16, 19)))
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


# Each chapter's underline is one of the broken pairs from the opening. It stays cracked until the
# shot that solves its problem: questions on the claim, builds on the plan, hours on the impact.
HEAL = [(17.0, 28.0, 21.0), (28.0, 46.0, 41.0), (46.0, 55.0, 53.0)]     # (chapter start, end, heals at)


def chapter_underline(c, t, x, y, L, a, b):
    gin = prog(t, a + 0.45, a + 0.75, e_out_cubic)
    out = prog(t, b - 0.22, b, e_io_cubic)
    alpha = gin * (1 - out)
    if alpha <= 0:
        return
    heal = next(h for c0, c1, h in HEAL if c0 <= a < c1)
    if t >= heal:
        draw_bar(c, x + L / 2, y, L, 10, alpha=alpha)
        glint(c, t, x + L / 2, y, heal, 0.8)
        sparks(c, t, x + L / 2, y, heal, int(heal * 10), n=8, spread=0.6)
        return
    f = 1 - prog(t, heal - 0.3, heal, e_in_cubic)       # 1 = broken, 0 = fixed
    gap, drop, tilt = 22 * f, 5 * f, 5 * f
    D = e_out_expo(prog(t, a + 0.5, a + 0.85, e_lin))  # wipes in, already broken
    if D <= 0:
        return
    draw_bar(c, x + L / 4 * D - gap / 2, y + drop, L / 2 * D, 10, tilt, alpha, rr=0.0)
    draw_bar(c, x + L / 2 + L / 4 * D + gap / 2, y + drop, L / 2 * D, 10, -tilt, alpha * (D > 0.5), rl=0.0)


# (start, end, card, headline, explanation)
SHOTS_HOW = [
    (17.0, 20.0, card_ask, "Anyone asks an AI question.", "Named or anonymous."),
    (20.0, 23.0, card_claim, "A colleague claims it.", "Someone your company has chosen to answer AI questions."),
    (23.0, 26.0, card_thread, "They sort it out in a private chat.", "Files and all, until it\u2019s resolved."),
    (26.0, 28.0, card_leaderboard, "The best helpers top the Leaderboard.", "One point for every question they resolve."),
    (28.0, 31.0, card_propose, "Anyone proposes an idea.", "The problem, who benefits, and how it gets built."),
    (31.0, 34.0, card_review, "AI reviews it.", "Advisory scores. Only the idea\u2019s owner sees them."),
    (34.0, 37.0, card_approval, "Leadership approves.", "Or it auto-approves when time runs out."),
    (37.0, 40.0, card_recruit, "A team joins.", "Colleagues sign up until the team is full."),
    (40.0, 43.0, card_project, "AI writes the build plan.", "Steps, owners and due dates, from the project brief."),
    (43.0, 46.0, card_live, "Published, then Live.", "A publishing specialist takes it Live."),
    (46.0, 49.0, card_pulse, "Pulse spots anything going quiet.",
     "Approvals near timeout, unclaimed questions, stalled builds. Daily in Slack."),
    (49.0, 52.0, card_home, "Everyone sees what needs them first.", "Spine stays quiet until a human is needed."),
    (52.0, 55.0, card_value, "Leaders see the impact.", "What went Live, and the hours it saved."),
]
SECTIONS = [("01  Help Desk", 17.0, 28.0), ("02  Ideas & Projects", 28.0, 46.0), ("03  Pulse", 46.0, 49.0),
            ("04  Home", 49.0, 52.0), ("05  Programme", 52.0, 55.0)]
LOGO_T = 56.0     # the first logo bar locks here


# ---------------------------------------------------------------- the piece does the work
#
# In every explainer shot a piece peels off the headline's underline, dives into the screen and
# becomes the thing the line describes (the claim, the reply, the approval, the plan, the chart).
# Keys are (time after shot start, target, alpha). Targets: "peel" (the underline's end),
# ("c", u0, v0, u1, v1) a rectangle in card pixels, ("d", u, v, size) a dot-sized piece in card
# pixels, or ("s", x, y, L, T) screen pixels. The card's own timing is shifted by CARD_OFF so its
# content builds the moment the piece lands.

CARD_DIM = {card_ask: (900, 330), card_claim: (860, 260), card_thread: (940, 420), card_leaderboard: (760, 400),
            card_propose: (960, 430), card_review: (960, 440), card_approval: (980, 360),
            card_recruit: (980, 330), card_project: (980, 400), card_live: (980, 320), card_pulse: (980, 410),
            card_home: (980, 400), card_value: (980, 400)}
CARD_OFF = {card_ask: 1.0, card_claim: 0.55, card_thread: 0.95, card_leaderboard: 0.0, card_propose: 1.05,
            card_review: 0.9, card_approval: -0.1, card_recruit: 0.7, card_project: -0.25, card_live: 0.0,
            card_pulse: 1.2, card_home: 1.2, card_value: 1.0}


def _land(r, rect, hold=0.25):
    """Arrive on rect at r, then dissolve into it."""
    return [(r, rect, 1.0), (r + hold, rect, 0.0)]


def _scan(rs, rects):
    keys = [(r, rc, 1.0) for r, rc in zip(rs, rects)]
    return keys + [(rs[-1] + 0.25, rects[-1], 0.0)]


_HOME_ROWS = [("c", 30, 172 + k * 82 - 36, 950, 172 + k * 82 + 36) for k in range(3)]
_REVIEW_ROWS = [("c", 30, 100 + k * 74 - 26, 930, 100 + k * 74 + 44) for k in range(4)]
_PLAN_ROWS = [("c", 30, 322 + k * 42 - 22, 780, 322 + k * 42 + 12) for k in range(2)]
_VALUE_PTS = [("d", 90 + 30 + (920 - 90 - 60) * k / 3, 320 - 210 * HOURS[k] / 60, 18) for k in range(4)]

ACTORS = {
    card_ask: [[(0.9, "peel", 1.0)] + _land(1.25, ("c", 36, 76, 864, 126))],
    card_claim: [[(1.1, "peel", 1.0)] + _land(1.45, ("c", 36, 180, 300, 216))],
    card_thread: [[(0.9, "peel", 1.0)] + _land(1.25, ("c", 92, 190, 640, 232))],
    # the piece splits into five bars, each as long as that person's points
    card_leaderboard: [[(0.75, "peel", 1.0), (1.05 + 0.07 * k, ("c", 130, 104 + 62 * k - 22,
                                                               130 + 540 * pts / 18, 104 + 62 * k + 22), 1.0),
                        (1.8, ("c", 130, 104 + 62 * k - 22, 130 + 540 * pts / 18, 104 + 62 * k + 22), 1.0),
                        (2.0, ("c", 130, 104 + 62 * k - 22, 130 + 540 * pts / 18, 104 + 62 * k + 22), 0.0)]
                       for k, pts in enumerate((18, 14, 11, 8, 6))],
    card_propose: [[(0.9, "peel", 1.0)] + _land(1.2, ("c", 36, 104, 924, 148))],
    card_review: [[(0.9, "peel", 1.0)] + _scan([1.2, 1.4, 1.6, 1.8], _REVIEW_ROWS)],
    card_approval: [[(0.9, "peel", 1.0)] + _land(1.25, ("c", 684, 190, 920, 238))],
    card_recruit: [[(0.9, "peel", 1.0)] + _land(1.25, ("c", 38, 262, 234, 306))],
    card_project: [[(1.1, "peel", 1.0)] + _scan([1.45, 1.6], _PLAN_ROWS)],
    # six pieces shoot out of the underline one after another and become the six stages
    card_live: [[(LIVE_LAND - 0.3 + LIVE_STEP * k, "peel", 1.0),
                 (LIVE_LAND + LIVE_STEP * k, ("c", 45 + 170 * k, 179, 67 + 170 * k, 201), 1.0),
                 (LIVE_LAND + LIVE_STEP * k + 0.12, ("c", 45 + 170 * k, 179, 67 + 170 * k, 201), 0.0)]
                for k in range(6)],
    # the piece drops to the foot of the card and becomes a flat line that beats (draw_heartbeat)
    card_pulse: [[(0.9, "peel", 1.0), (1.15, ("c", 36, 376, 60, 380), 1.0), (1.3, ("c", 36, 376, 60, 380), 0.0)]],
    card_value: [[(1.1, "peel", 1.0)] + [(1.4 + 0.4667 * k, p, 1.0) for k, p in enumerate(_VALUE_PTS)]
                 + [(3.0, _VALUE_PTS[-1], 0.0)]],
    # Home: the piece splits into the logo's three bars, which become the three things that need you
    card_home: [[(0.9, "peel", 1.0), (1.25, ("c", 40 + (LOGO[k][0] - 700) * 1.2, 196 + 46 * k - 12,
                                              40 + (LOGO[k][1] - 700) * 1.2, 196 + 46 * k + 12), 1.0)] + _land(1.5 + 0.2 * k, _HOME_ROWS[k])
                for k in range(3)],
}


def _rect_of(target, shot_x, cy, dims, scale, peel):
    """(x, y, L, T) on screen for a key target."""
    if target == "peel":
        return peel
    cw, ch = dims
    to_x = lambda u: shot_x + (u - cw / 2) * scale
    to_y = lambda v: cy + (v - ch / 2) * scale
    if target[0] == "c":
        _, u0, v0, u1, v1 = target
        return ((to_x(u0) + to_x(u1)) / 2, (to_y(v0) + to_y(v1)) / 2, (u1 - u0) * scale, (v1 - v0) * scale)
    if target[0] == "d":
        _, u, v, s_ = target
        return to_x(u), to_y(v), s_ * scale, s_ * scale
    return target[1:]


def draw_actor(c, t, a, keys, shot_x, cy, dims, scale, peel):
    if not keys or t < a + keys[0][0] or t > a + keys[-1][0]:
        return
    for (r0, g0, a0), (r1, g1, a1) in zip(keys, keys[1:]):
        if a + r0 <= t <= a + r1:
            p = prog(t, a + r0, a + r1, e_io_cubic)
            A = _rect_of(g0, shot_x, cy, dims, scale, peel)
            B = _rect_of(g1, shot_x, cy, dims, scale, peel)
            x, y, L, T = (lerp(A[j], B[j], p) for j in range(4))
            alpha = lerp(a0, a1, p) * lerp(1.0, 0.38, clamp((T - 12) / 18))   # thick = a see-through highlight
            r = min(1.0, 10 / max(T / 2, 1e-3))      # rounded like the UI's 10 px corners once it is large
            draw_bar(c, x, y, max(L, T), T, alpha=alpha, rl=r, rr=r)
            break
    for r, g, al in keys[1:]:
        if al > 0:
            X = _rect_of(g, shot_x, cy, dims, scale, peel)
            glint(c, t, X[0], X[1], a + r, 0.7)


# ---------------------------------------------------------------- Pulse: a heartbeat across the card

BEATS = [0.25, 0.47, 0.69]          # where along the line each beat sits (matches the rows' reveal times)


def draw_polyline(c, pts, width, color, alpha=1.0):
    if alpha <= 0.004 or len(pts) < 2:
        return
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    x0, y0 = int(min(xs) - width - 4), int(min(ys) - width - 4)
    x1, y1 = int(max(xs) + width + 4), int(max(ys) + width + 4)
    k = 4
    im = Image.new("L", ((x1 - x0) * k, (y1 - y0) * k), 0)
    ImageDraw.Draw(im).line([((x - x0) * k, (y - y0) * k) for x, y in pts], fill=255, width=int(width * k),
                            joint="curve")
    m = np.asarray(im.resize((x1 - x0, y1 - y0), Image.BOX), np.float32) / 255.0
    blend(c, x0, y0, m * alpha, color)


def draw_heartbeat(c, t, a, shot_x, cy, dims, scale):
    t0, dur = a + 1.2, 1.0
    if t < t0:
        return
    alpha = 1 - prog(t, a + 2.5, a + 2.8)
    cw, ch = dims
    X = lambda u: shot_x + (u - cw / 2) * scale
    Y = lambda v: cy + (v - ch / 2) * scale
    u0, u1, v = 36, 944, 378
    head = u0 + (u1 - u0) * clamp((t - t0) / dur)
    blip = [(-24, 0), (-16, 4), (-8, -34), (0, 22), (8, -6), (16, 0)]
    pts = [(u0, v)]
    for f in BEATS:
        bx = u0 + (u1 - u0) * f
        for du, dv in blip:
            if bx + du <= head:
                pts.append((bx + du, v + dv))
    pts.append((head, v))
    draw_polyline(c, [(X(u), Y(vv)) for u, vv in pts], 3.0, (120, 150, 255), alpha)
    if t < t0 + dur:
        draw_dot(c, X(head), Y(v), 5, (210, 222, 255), alpha)
        draw_dot(c, X(head), Y(v), 22, (90, 120, 255), 0.4 * alpha, blur=10)
    for f in BEATS:
        glint(c, t, X(u0 + (u1 - u0) * f), Y(v - 34), t0 + dur * f, 0.6)


# ---------------------------------------------------------------- chapter wipes: the logo, blown up

WIPES = [28.0, 46.0]


def draw_wipe(c, t):
    for tw in WIPES:
        if not tw - 0.4 <= t <= tw + 0.4:
            continue
        p = prog(t, tw - 0.4, tw + 0.4, e_io_cubic)
        for k, (x0, x1, yc) in enumerate(LOGO):
            off = ((x0 + x1) / 2 - LOGO_C[0]) * 6           # the logo's stagger, scaled up
            x = lerp(-1400, W + 1400, p) + off
            draw_bar(c, x, 180 + 360 * k, 2400, 340, rl=0.25, rr=0.25)


def render_scene(t):
    n = int(round(t * FPS * 4))
    flash = prog(t, 12.97, 13.0, e_lin) * (1 - prog(t, 13.0, 13.45, e_out_cubic)) + snap_flash(t)
    c = background(t, n, min(flash, 1.0))
    draw_fragments(c, t)

    # 1. Opening
    line_words(c, t, "Your company has AI.", LIGHT, 96, WHITE, W / 2, 560, 0.25, 1.78, "center")
    line_words(c, t, "So why do your AI ideas", LIGHT, 96, WHITE, W / 2, 500, 2.0, 3.78, "center")
    line_words(c, t, "quietly die?", DREG, 96, BLUE, W / 2, 610, 2.75, 3.78, "center")

    # 2. Three everyday failures: each underline snaps as its issue lands
    for t0, kicker, l1, l2, fn in PAINS:
        pain(c, t, t0, kicker, l1, l2, fn)
    line_words(c, t, "Every team.", LIGHT, 96, WHITE, W / 2, 570, 10.0, 10.9, "center")
    line_words(c, t, "Every week.", LIGHT, 96, WHITE, W / 2, 570, 11.0, 11.9, "center")

    # 3. The turn: the six pieces slam together into the mark on the downbeat at 13.0
    line_words(c, t, "Your AI needs", LIGHT, 104, WHITE, W / 2, 500, 12.0, 12.9, "center")
    line_words(c, t, "a spine.", DREG, 104, BLUE, W / 2, 620, 12.5, 12.9, "center")
    draw_pieces(c, t)
    line_words(c, t, "Spine is your AI project manager.", LIGHT, 72, WHITE, W / 2, 740, 14.0, 16.55, "center")
    line_words(c, t, "It makes sure good AI ideas and questions never quietly die.", REG, 34, DIM, W / 2, 812,
               14.75, 16.55, "center", step=0.0, dur=0.45)

    # 4. How it works: real Spine screens, restyled dark, one idea per shot
    CS = 1.1
    cx0, cy0 = W / 2 + 110, 650
    for k, (a, b, fn, title, sub) in enumerate(SHOTS_HOW):
        if a - 0.3 <= t < b + 0.3:
            gin = prog(t, a - 0.2, a + 0.25, e_out_cubic)
            gout = prog(t, b - 0.2, b + 0.05, e_in_cubic)
            x = cx0 + 240 * (1 - gin) - 240 * gout
            place(c, fn(t, a + CARD_OFF[fn]), x, cy0, CS, gin * (1 - gout))
            line_words(c, t, title, LIGHT, 66, WHITE, 110, 215, a + BEAT / 2, b - 0.22, "left")
            tw = text_width(title, LIGHT, 66)
            chapter_underline(c, t, 112, 252, tw, a, b)
            for keys in ACTORS[fn]:
                draw_actor(c, t, a, keys, x, cy0, CARD_DIM[fn], CS, (112 + tw - 50, 252, 100, 10))
            if fn is card_pulse:
                draw_heartbeat(c, t, a, x, cy0, CARD_DIM[fn], CS)
            line_words(c, t, sub, REG, 30, DIM, 112, 318, a + 0.75, b - 0.22, "left", step=0.0, dur=0.4)
    for name, a, b in SECTIONS:
        label(c, t, name, 110, 132, a, b - 0.2, size=19)
    draw_wipe(c, t)

    # 5. The logo
    logo(c, t)
    return post(c, t)


# ---------------------------------------------------------------- logo and end card

def logo(c, t):
    if t < LOGO_T - 0.6:
        return
    # the three repaired bars fly in whole and lock into the logo on the beat
    for k, (x0, x1, yc) in enumerate(LOGO):
        land = LOGO_T + BEAT / 2 * k
        L = x1 - x0
        if t >= land:
            draw_bar(c, (x0 + x1) / 2, yc, L, 40)
            glint(c, t, (x0 + x1) / 2, yc, land, 1.2)
            sparks(c, t, (x0 + x1) / 2, yc, land, 70 + k, n=10, spread=0.8)
            continue
        p = prog(t, land - 0.5, land, e_in_cubic)
        if p <= 0:
            continue
        side = -1 if k != 1 else 1          # the repaired bars, whole now, fly in from alternate sides
        draw_bar(c, lerp((x0 + x1) / 2 + side * (W / 2 + 300), (x0 + x1) / 2, p), yc, L, 40)
    w0 = LOGO_T + 0.5
    g = prog(t, w0, w0 + 0.5, e_out_cubic)
    soft_word(c, "Spine", DSEMI, 172, WHITE, 886, 527, g)   # the approved wordmark's size and position
    line_words(c, t, "Give your company’s AI a spine.", LIGHT, 46, WHITE, W / 2, 698, w0 + 1.0, None, "center")
    bw = lerp(0, 364, prog(t, w0 + 2.0, w0 + 2.3))
    bh = lerp(10, 80, prog(t, w0 + 2.25, w0 + 2.5, e_out_quint))
    if bw > 1:
        draw_segment(c, SCREEN_CAM, default_seg(x=959.5, y=841.5, L=max(bw, bh), T=bh, flat=True, color=BLUE_DEEP))
        rv = prog(t, w0 + 2.5, w0 + 2.9, e_out_quint)
        soft_word(c, "Book a demo  →", MED, 32, (255, 255, 255), 959.5 - text_width("Book a demo  →", MED, 32) / 2,
                  852, rv)


def end_card(t, plate=None):
    return render_scene(t)
