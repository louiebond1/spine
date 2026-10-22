"""Spine launch film: "Holds it together" (final director's cut, 57.5 s).

One continuous world seen through one camera. Three problems are shown, not told, then the same three
objects are resolved in the same order, and the three resolved bars lift out of the world to become the
Spine logo. See the notes above render_scene() for the whole choreography.
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

FONT_DIR = os.environ.get("SPINE_FONT_DIR", "/usr/share/fonts/opentype/inter")
LIGHT = "InterDisplay-Light.otf"
DREG = "InterDisplay-Regular.otf"
DSEMI = "InterDisplay-SemiBold.otf"
MED = "Inter-Medium.otf"
REG = "Inter-Regular.otf"
SEMI = "Inter-SemiBold.otf"
S = 2   # supersampling for card drawing
BPM = 120
BEAT = 60 / BPM          # 0.5 s; every hit sits on this grid


@lru_cache(None)
def _bg_base():
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.sqrt(((xx - W / 2) / (W * 0.55)) ** 2 + ((yy - H / 2) / (H * 0.62)) ** 2)
    glow = np.exp(-r ** 2 * 1.6)[..., None]
    vig = np.clip(1 - 0.35 * np.clip(r - 0.6, 0, None), 0.55, 1)[..., None]
    return (BG + (GLOW - BG) * glow) * vig


def background(t, n, flash=0.0):
    c = _bg_base().copy()
    pulse = 0.12 * kick_env(t)
    if pulse > 0:
        c += (_bg_base() - BG) * pulse
    rng = np.random.default_rng(n)
    c += (rng.random((H // 2, W // 2, 1), np.float32).repeat(2, 0).repeat(2, 1) - 0.5) * 1.4   # fine grain
    if flash > 0:
        c += (np.array(BLUE_DEEP, np.float32) - c) * flash
    return c


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


def draw_bar(c, x, y, L, T, rz=0.0, alpha=1.0, rl=1.0, rr=1.0, color=None):
    draw_segment(c, SCREEN_CAM, default_seg(x=x, y=y, L=L, T=T, rz=rz, rl=rl, rr=rr,
                                            alpha=alpha, flat=True, color=color))


def glint(c, t, x, y, t0, size=1.0):
    u = t - t0
    if 0 <= u < 0.4:
        draw_dot(c, x, y, 46 * size, (150, 175, 255), 0.5 * math.exp(-u / 0.08), blur=18 * size)
        draw_dot(c, x, y, 7 * size, (255, 255, 255), math.exp(-u / 0.06))


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


# ================================================================ the film
#
# One continuous world, one camera. Every beat shows a starting state, an action and a result, large
# enough to follow on a phone with the sound off. What is shown follows the product brief (CLAUDE.md):
# Champions claim questions; anyone can browse Ideas & Projects and press Join project while a project
# is recruiting; a full team moves it to Building, where Claude drafts a plan whose steps are assigned to
# team members; Pulse flags builds that go quiet, also in the daily Slack digest; people do the work;
# Live projects log hours saved each month.
#
#   Questions go unanswered   Ben's question travels, the route ahead snaps, it is stranded.
#   Ideas lose momentum       Contract Clause Checker reaches Recruiting and waits: Mia and two empty
#                             seats; people pass by; the line reaching out to them snaps.
#   Impact goes unseen        the Hours saved card, large and empty; the line reaching it snaps.
# "Your AI needs a spine."    every loose piece lines up on a spine; "Spine is your AI project manager."
#   Questions                 shown to the Champions; Mia claims it; her answer names her project.
#   Discover                  the name lands on its card among the company's projects; it is picked out.
#   Join                      it grows into frame; Ben, then Priya, press Join project and take a seat;
#                             each seat links to the last; 3 of 3: the team is full.
#   Plan                      Building: each person moves to their own step of the generated plan.
#   Pulse                     Stalled (no activity, the days count up), Detected (Pulse's heartbeat flags
#                             it), Notified (the Slack digest), Action (Mia presses Open), Progress (the
#                             steps tick, it goes Live, 8 hours saved this month).
#   Impact                    those 8 hours travel to the company's chart and complete October: 42.
# The end: one line runs through the answered question, the project, and the 42; they condense into the
# three bars of the Spine mark.
#
# Times are story time; the film opens SHIFT seconds in.

SHIFT = 3.4
TOTAL = 1791                 # 59.7 s
END_PLATE = TOTAL + 1
HANDOFF = END_PLATE
HOURS = [6, 16, 30, 42]
MONTHS = ["Jul", "Aug", "Sep", "Oct"]
MONTH_NAMES = ["July", "August", "September", "October"]
LOGO = [(736.0, 831.0, 397.5), (708.0, 835.0, 469.5), (700.0, 779.0, 541.5)]
LOGO_C = (767.5, 469.5)


def kick_env(t):
    # matches kick_on() in score.py
    if not kick_on(t):
        return 0.0
    return math.exp(-(t % BEAT) / 0.11)


def kick_on(t):
    return (2.0 <= t < 12.0) or (15.5 <= t < 21.0) or (27.5 <= t < 42.0) or (47.5 <= t < 54.2) or (60.0 <= t < 62.2)


# ---------------------------------------------------------------- camera

SNAP1 = 5.5
BX = 1060.0                  # where the question is stranded (world x)
CARD_C = (960.0, 1460.0)     # Contract Clause Checker, the big card (world)

CAM = [  # (time, (centre x, centre y, zoom)) in world pixels; held between equal keys
    (5.5, (1060, 540, 1.0)),
    (9.4, (1060, 540, 1.0)), (10.3, (960, 1460, 1.02)),          # the waiting project, whole card under the line
    (15.3, (960, 1460, 1.02)), (16.2, (3300, 1001, 0.86)),       # the empty chart, whole card in frame
    (26.4, (3300, 1001, 0.86)), (27.3, (1250, 590, 1.0)),        # back to the stranded question
    (32.6, (1250, 590, 1.0)), (33.6, (960, 1460, 0.86)),         # the whole discovery grid, nothing cropped
    (35.15, (960, 1460, 0.86)), (36.3, (960, 1460, 1.05)),
    (50.0, (960, 1460, 1.05)), (50.9, (3300, 1001, 0.86)),       # the hours travel to the chart
    (64.0, (3300, 1001, 0.86)),
]


def bubble_x(t):
    u = max(0.0, SNAP1 - t)
    d = u if u > 0.18 else 0.09 + u * u / 0.36
    return BX - 820 * d


def cam(t):
    if t < SNAP1:
        return bubble_x(t), 540.0, 1.0
    for (ta, a), (tb, b) in zip(CAM, CAM[1:]):
        if ta <= t <= tb:
            p = prog(t, ta, tb, e_io_quint)
            return tuple(lerp(a[k], b[k], p) for k in range(3))
    return CAM[-1][1]


def ws(x, y, t):
    cx, cy, z = cam(t)
    return (x - cx) * z + W / 2, (y - cy) * z + H / 2


def sw(x, y, t):
    cx, cy, z = cam(t)
    return (x - W / 2) / z + cx, (y - H / 2) / z + cy


def wbar(c, t, x, y, L, T, rz=0.0, alpha=1.0, rl=1.0, rr=1.0, color=None):
    sx, sy = ws(x, y, t)
    z = cam(t)[2]
    if -400 < sx < W + 400 and -200 < sy < H + 200:
        draw_bar(c, sx, sy, max(L * z, T * z), max(T * z, 1.2), rz, alpha, rl, rr, color)


def wtext(c, t, text, fname, size, color, x, base, g, align="center"):
    z = cam(t)[2]
    sx, sy = ws(x, base, t)
    w = text_width(text, fname, size) * z
    x0 = sx - (w / 2 if align == "center" else 0 if align == "left" else w)
    soft_word(c, text, fname, size, color, x0, sy, g, 0.0, z)


def wcard(c, t, img, x, y, alpha=1.0, scale=1.0):
    sx, sy = ws(x, y, t)
    place(c, img, sx, sy, cam(t)[2] * scale, alpha)


def avatar_at(c, sx, sy, initials, r, alpha=1.0, fill=(40, 54, 100), ring=0.0, dashed=False):
    """A person, in screen space."""
    if alpha <= 0.01:
        return
    if dashed:
        draw_dot(c, sx, sy, r, DIM, alpha * 0.8, ring=2.2)
        return
    draw_dot(c, sx, sy, r, fill, alpha)
    size = r * 0.66
    soft_word(c, initials, SEMI, size, WHITE, sx - text_width(initials, SEMI, size) / 2, sy + size * 0.36, alpha)
    if ring > 0:
        draw_dot(c, sx, sy, r + 24 * ring, BLUE, 0.6 * (1 - ring) * alpha, ring=2.4)


def wavatar(c, t, x, y, initials, r=30, alpha=1.0, fill=(40, 54, 100), ring=0.0):
    sx, sy = ws(x, y, t)
    z = cam(t)[2]
    if alpha <= 0.01:
        return
    draw_dot(c, sx, sy, r * z, fill, alpha)
    size = r * 0.66
    soft_word(c, initials, SEMI, size, WHITE, sx - text_width(initials, SEMI, size) * z / 2, sy + size * 0.36 * z,
              alpha, 0.0, z)
    if ring > 0:
        draw_dot(c, sx, sy, (r + 22 * ring) * z, BLUE, 0.6 * (1 - ring) * alpha, ring=2.4 * z)


def headline(c, t, text, t_in, t_out, y=190, size=80, color=WHITE, fname=None):
    line_words(c, t, text, fname or LIGHT, size, color, W / 2, y, t_in, t_out, "center")


def world_dim(t, field=False):
    d = prog(t, 21.0, 21.4) * (1 - prog(t, *DISPERSE))
    return 1 - (0.5 if field else 0.75) * d


def glint_w(c, t, x, y, t0):
    sx, sy = ws(x, y, t)
    glint(c, t, sx, sy, t0, 0.8 * cam(t)[2])


# ---------------------------------------------------------------- 1. the question

BY, ROAD_Y, LANE_Y = 440.0, 640.0, 790.0
QSCALE = 1.25
REPLY_Y = 830.0
ASK = "Has anyone automated contract reviews before?"
REPLY_A, REPLY_B = "Yes, I’m starting one: ", "Contract Clause Checker"
CHAMPS = [("JC", "Jamie Chen", 330.0), ("SK", "Sarah Kim", 470.0), ("MT", "Mia Thompson", 610.0)]
CHAMP_X = 1880.0
SHOWN, CHOSEN, DOCK, REPLY_T = 27.6, 28.25, 28.9, 29.3


def bubble_state(t):
    if t >= DOCK:
        return "claimed"
    if t >= 7.6:
        return "Asked 2 days ago"
    if t >= 6.5:
        return "Asked 1 day ago"
    if t >= 5.5:
        return "Asked 4 hours ago"
    if t >= 4.6:
        return "Asked 3 hours ago"
    return "Asked 2 hours ago"


def card_question(t, claimed=None):
    p = Pen(1100, 236)
    p.circle(64, 66, 28, fill=(38, 41, 50))
    p.text(64, 75, "BC", 20, DIM, SEMI, anchor="ms")
    p.text(110, 76, "Ben Carter  ·  Legal", 28, DIM)
    p.text(40, 154, ASK, 46, WHITE, DSEMI)
    st = "claimed" if claimed else bubble_state(t)
    if st == "claimed":
        p.text(40, 210, "Claimed by Mia Thompson", 28, BLUE, MED)
    else:
        p.text(40, 210, st, 28, DIM)
    return p.done()


def card_reply(t, show_name=True):
    p = Pen(1060, 124)
    p.rrect(0, 0, 1059, 123, 14, fill=(34, 44, 78))
    p.circle(58, 62, 28, fill=(38, 41, 50))
    p.text(58, 71, "MT", 20, DIM, SEMI, anchor="ms")
    p.text(108, 76, REPLY_A, 40, WHITE)
    if show_name:
        p.text(108 + text_width(REPLY_A, REG, 40), 76, REPLY_B, 40, BLUE, MED)
    return p.done()


def reply_name_pos():
    return (BX - 50 - 530 * QSCALE + (108 + text_width(REPLY_A, REG, 40)) * QSCALE,
            REPLY_Y + (-62 + 76) * QSCALE)


def draw_question(c, t):
    if not 26.6 <= t < 33.4:
        return
    a = 1 - prog(t, 32.9, 33.4)
    dimw = world_dim(t)
    bx = bubble_x(t)
    wcard(c, t, card_question(t), bx, BY, a * dimw, QSCALE)
    if t < DOCK:
        wbar(c, t, bx - 110, ROAD_Y, 220, 18, alpha=a * dimw, rr=0.0 if t > DOCK - 0.6 else 1.0)
    else:
        wbar(c, t, BX, ROAD_Y, 440, 18, alpha=a * dimw)
        glint_w(c, t, BX, ROAD_Y, DOCK)
    if t >= REPLY_T:
        g = prog(t, REPLY_T, REPLY_T + 0.5, e_out_cubic) * a
        x = lerp(BX + 300, BX - 50, prog(t, REPLY_T, REPLY_T + 0.5, e_out_cubic))
        wcard(c, t, card_reply(t, show_name=not NAME_LIFT <= t < NAME_LAND + 0.4), x, REPLY_Y, g * dimw, QSCALE)


def draw_road(c, t):
    if not 26.6 <= t < 33.4:
        return
    a = world_dim(t) * (1 - prog(t, 32.9, 33.4))
    wbar(c, t, -1800 + (BX - 160 + 1800) / 2, ROAD_Y, BX - 160 + 1800, 4, alpha=a, color=(52, 57, 72))
    if t < 10.5:
        for k in range(-12, 10):
            wbar(c, t, BX - 160 - 140 * k - 70, ROAD_Y + 18, 26, 3, alpha=a * 0.55 * (1 - prog(t, 9.6, 10.2)),
                 color=(52, 57, 72))
    if t < SNAP1:
        x0 = bubble_x(t) + 60
        wbar(c, t, (x0 + 1820) / 2, ROAD_Y, 1820 - x0, 6, alpha=a)
    if t < 10.5:
        la = a * (1 - prog(t, 9.6, 10.2))
        wbar(c, t, 600, LANE_Y, 2600, 3, alpha=la * 0.6, color=(44, 48, 60))
        for k in range(7):
            x = (-700 + 380 * (t - 4.0) + 390 * k) % 2700 - 700
            wbar(c, t, x, LANE_Y, 90, 8, alpha=la * 0.55)


def draw_champions(c, t):
    """The question is shown to the Champions; Mia, who knows, takes it."""
    if not SHOWN <= t < DOCK + 0.5:
        return
    for k, (ini, name, y) in enumerate(CHAMPS):
        mia = ini == "MT"
        g = prog(t, SHOWN + 0.1 * k, SHOWN + 0.1 * k + 0.3, e_out_cubic)
        if not mia:
            g *= 1 - prog(t, CHOSEN, CHOSEN + 0.3)
        d = prog(t, SHOWN, SHOWN + 0.35, e_out_cubic)
        x0 = BX + 687 + 10
        p0, p1 = ws(x0, 470, t), ws(lerp(x0, CHAMP_X - 34, d), lerp(470, y, d), t)
        col = BLUE if (mia and t >= CHOSEN) else (90, 100, 130)
        draw_polyline(c, [p0, p1], 3.0 if mia and t >= CHOSEN else 2.0, col, g * (0.9 if mia else 0.6))
        if mia:
            p = prog(t, CHOSEN + 0.05, DOCK, e_in_cubic)
            ax = lerp(CHAMP_X, BX + 110, p)
            ay = lerp(y, ROAD_Y + 86, p)
            if t >= CHOSEN + 0.05:
                wbar(c, t, lerp(CHAMP_X + 60, BX + 110, p), ROAD_Y, 220, 18, rl=0.0,
                     alpha=prog(t, CHOSEN + 0.05, CHOSEN + 0.2) * (1 - prog(t, DOCK - 0.05, DOCK + 0.05)))
            wavatar(c, t, ax, ay, ini, 32, (1 - prog(t, REPLY_T, REPLY_T + 0.3)),
                    ring=prog(t, CHOSEN, CHOSEN + 0.5) if t < CHOSEN + 0.5 else 0.0)
            wtext(c, t, name, MED, 36, WHITE, ax + 50, ay + 13, g * (1 - prog(t, CHOSEN + 0.1, CHOSEN + 0.4)),
                  "left")
        else:
            wavatar(c, t, CHAMP_X, y, ini, 32, g, fill=(38, 41, 50))
            wtext(c, t, name, MED, 36, DIM, CHAMP_X + 50, y + 13, g, "left")


# ---------------------------------------------------------------- 2. Contract Clause Checker
#
# One large card carries the whole journey. Its state is a function of time: the stage it is in, who is on
# the team, which plan steps are done, and the one line at its foot that says what happens next. The
# people (seats, joiners, plan owners) are drawn over it in world space so they can move.

CARD_W, CARD_H = 1400, 660
CARD_X0, CARD_Y0 = CARD_C[0] - CARD_W / 2, CARD_C[1] - CARD_H / 2
STAGE_TIMES = [  # (time, stage index): Idea, Approval, Recruiting, Building, Publishing, Live
    (0.0, 0), (10.45, 1), (10.85, 2), (38.75, 3), (48.75, 4), (49.25, 5)]
SEATS = [("MT", "Mia Thompson", None), ("BC", "Ben Carter", 37.25), ("PS", "Priya Shah", 38.25)]   # (who, seated)
PRESS = 0.45             # each joiner presses Join project this long before taking their seat
PLAN = [("Test with real contracts", "MT", "testing real contracts", 47.25),
        ("Fix missed clause types", "BC", "fixing missed clause types", 47.75),
        ("Write the user guide", "PS", "writing the user guide", 48.25)]       # (step, owner, phrase, done)
PLAN_IN = 39.0           # the plan appears, generated from the project brief
ROWS = [292, 392, 492]   # plan rows (card baselines)
QUIET = (42.0, 47.25)    # stalled, until Mia ticks her step
FLAG = 44.0              # Pulse detects it
SLACK_IN, SLACK_OPEN, SLACK_FLY = 44.9, 46.4, (46.6, 47.1)
LIVE_T = 49.25
LOGGED = 49.6            # the team logs its hours saved
FIRST = {"MT": "Mia", "BC": "Ben", "PS": "Priya"}
QUIET_C = (156, 162, 178)


def stage_at(t):
    return max(s for ts, s in STAGE_TIMES if t >= ts)


def team_at(t):
    return [ini for ini, _, j in SEATS if j is None or t >= j]


def seat_pos(k):
    """World position of team seat k on the card."""
    return CARD_X0 + 170 + 200 * k, CARD_Y0 + 360


def row_avatar(k):
    return CARD_X0 + 1310, CARD_Y0 + ROWS[k] - 16


def seat_move(k):
    """When person k leaves their seat for their step in the plan."""
    t0 = PLAN_IN + 0.1 * k
    return t0, t0 + 0.5


def card_project(t):
    """Contract Clause Checker as it stands at time t."""
    p = Pen(CARD_W, CARD_H)
    st = stage_at(t)
    p.text(60, 102, REPLY_B, 72, WHITE, DSEMI)
    p.text(60, 156, "Mia Thompson  ·  Legal", 34, DIM)
    # the six stages as dots; only the current one is named
    xs = [990 + 70 * k for k in range(6)]
    p.line([(xs[0], 74), (xs[-1], 74)], (52, 56, 68), 4)
    p.line([(xs[0], 74), (xs[st], 74)], BLUE, 4)
    for k, x in enumerate(xs):
        if k <= st:
            p.circle(x, 74, 12, fill=GREEN if k == 5 else BLUE)
        else:
            p.circle(x, 74, 11, fill=CARD, outline=(70, 75, 92), width=3)
    lab = STAGES[st]
    lx = min(xs[st], CARD_W - 50 - text_width(lab, SEMI, 32) / 2)
    p.text(lx, 136, lab, 32, WHITE, SEMI, anchor="ms")
    p.line([(60, 200), (CARD_W - 60, 200)], CARD_LINE, 2)
    if st == 2:      # recruiting: the count, the button anyone can press, and what it needs next
        team = team_at(t)
        left = 3 - len(team)
        p.text(770, 336, f"{len(team)} of 3 people", 56, WHITE, DSEMI)
        if left:
            pressed = any(j - PRESS <= t < j for _, _, j in SEATS if j)
            _button(p, 770, 380, 1140, 466, "Join project", primary=pressed, size=36)
            p.text(60, 610, f"Next: Recruit {left} more {'person' if left == 1 else 'people'} to begin", 40,
                   BLUE, MED)
    elif st >= 3:    # building and after: the plan, a step for each person
        for k, (step, who, phrase, done_t) in enumerate(PLAN):
            g = prog(t, PLAN_IN + 0.15 * k, PLAN_IN + 0.15 * k + 0.35, e_out_cubic)
            y = ROWS[k]
            done = t >= done_t
            if done:
                p.rrect(60, y - 42, 108, y + 6, 10, fill=BLUE, alpha=g)
                p.line([(71, y - 18), (81, y - 8), (98, y - 30)], (255, 255, 255), 4, alpha=g)
            else:
                p.rrect(60, y - 42, 108, y + 6, 10, outline=(110, 116, 136), width=2, alpha=g)
            p.text(140, y, step, 46, DIM if done else WHITE, alpha=g)
            ga = prog(t, seat_move(k)[1] - 0.04, seat_move(k)[1])
            ax, ay = row_avatar(k)
            p.circle(ax - CARD_X0, ay - CARD_Y0, 36, fill=(40, 54, 100), alpha=ga)
            p.text(ax - CARD_X0, ay - CARD_Y0 + 9, who, 24, WHITE, SEMI, anchor="ms", alpha=ga)
        if st == 3:
            nxt = next(((w, ph) for s_, w, ph, dt in PLAN if t < dt), None)
            if nxt and t >= PLAN_IN + 0.6:
                p.text(60, 612, f"Next: {FIRST[nxt[0]]} is {nxt[1]}", 40, BLUE, MED)
                p.text(CARD_W - 60, 612, "Generated from project brief", 28, DIM, anchor="rs")
        elif st == 5:
            g = prog(t, LOGGED, LOGGED + 0.3)
            p.circle(72, 598, 10, fill=GREEN)
            p.text(96, 612, "Live", 40, WHITE, MED)
            p.text(96 + text_width("Live", MED, 40) + 16, 612, "·  8 hours saved this month", 40, WHITE, MED,
                   alpha=g)
    return p.done()


def card_dim(t):
    waiting = prog(t, 12.2, 12.8) * (1 - prog(t, 33.6, 34.2))
    quiet = prog(t, QUIET[0], QUIET[0] + 0.6) * (1 - prog(t, QUIET[1], QUIET[1] + 0.3))
    slack = prog(t, SLACK_IN, SLACK_IN + 0.4) * (1 - prog(t, *SLACK_FLY))
    hero = prog(t, 36.45, 36.7) * (1 - prog(t, 38.85, 39.15))
    return max(0.0, 1 - 0.72 * max(waiting, quiet) - 0.55 * slack - hero)


def draw_card(c, t):
    if 35.4 <= t < 39.0 or 42.1 <= t < 43.4:
        return
    if not GROW[0] <= t < 51.0 or GRID_T <= t < GROW[0]:
        return
    a = prog(t, 9.9, 10.4) * world_dim(t) * (1 - prog(t, 50.6, 51.0)) * card_dim(t)
    if t < GRID_T:
        wcard(c, t, card_project(t), *CARD_C, a)
    else:            # grows out of its place among the other projects
        g = prog(t, *GROW, e_io_quint)
        x = lerp(GRID_SLOT[0], CARD_C[0], g)
        y = lerp(GRID_SLOT[1], CARD_C[1], g)
        wcard(c, t, card_project(t), x, y, a * prog(t, GROW[0], GROW[0] + 0.5), lerp(SLOT_W / CARD_W, 1.0, g))
    # a tick lands with each step done
    for k, (step, who, phrase, done_t) in enumerate(PLAN):
        glint_w(c, t, CARD_X0 + 84, CARD_Y0 + ROWS[k] - 18, done_t)
    # what the state means, said once, under the card
    y = CARD_Y0 + CARD_H + 92
    g = prog(t, QUIET[1], QUIET[1] + 0.3) * (1 - prog(t, 48.6, 48.9))
    wtext(c, t, "Moving again", MED, 52, BLUE, CARD_C[0], y, a * g)


def grow_scale(t):
    if GROW[0] <= t < GROW[1]:
        return lerp(SLOT_W / CARD_W, 1.0, prog(t, *GROW, e_io_quint))
    return 1.0


def on_card(x, y, t):
    """A point on the card, carried with it while it grows out of the grid."""
    if not GROW[0] <= t < GROW[1]:
        return x, y
    g = prog(t, *GROW, e_io_quint)
    s = grow_scale(t)
    cx, cy = lerp(GRID_SLOT[0], CARD_C[0], g), lerp(GRID_SLOT[1], CARD_C[1], g)
    return cx + (x - CARD_C[0]) * s, cy + (y - CARD_C[1]) * s


def draw_seats(c, t):
    """The team: Mia's seat and the empty ones; the people who join; each moving to their step."""
    if GROW[0] <= t < 39.0:
        return
    if not (GROW[0] + 0.3 <= t < PLAN_IN + 0.8):
        return
    a = prog(t, 10.85, 11.2) * world_dim(t) * card_dim(t)
    if t >= GROW[0]:
        a = prog(t, GROW[0] + 0.3, GROW[0] + 0.6)
    z = cam(t)[2] * grow_scale(t)
    team = team_at(t)
    # each new seat links to the one before it: the team connecting
    for k in (1, 2):
        j = SEATS[k][2]
        if t >= j:
            pl = e_out_cubic(prog(t, j, j + 0.3))
            x0, y0 = ws(*on_card(*seat_pos(k - 1), t), t)
            x1, y1 = ws(*on_card(*seat_pos(k), t), t)
            fade = 1 - prog(t, PLAN_IN - 0.15, PLAN_IN + 0.1)
            draw_polyline(c, [(x0, y0), (lerp(x0, x1, pl), lerp(y0, y1, pl))], 7 * z, BLUE, a * fade)
    for k in range(3):
        sx, sy = seat_pos(k)
        if k < len(team):
            j = SEATS[k][2]
            m0, m1 = seat_move(k)
            q = prog(t, m0, m1, e_io_cubic)
            if q >= 1:
                continue
            tx, ty = row_avatar(k)
            X, Y = ws(*on_card(lerp(sx, tx, q), lerp(sy, ty, q), t), t)
            pop = 1.0 if j is None else e_out_cubic(prog(t, j, j + 0.2))
            avatar_at(c, X, Y, SEATS[k][0], lerp(72, 36, q) * z * (0.85 + 0.15 * pop), a,
                      ring=prog(t, j, j + 0.6) if j and j <= t < j + 0.6 else 0.0)
        elif t < PLAN_IN:
            pulse = 0.5 + 0.5 * math.sin(6 * t) if 12.5 <= t < GRID_T else 1.0
            avatar_at(c, *ws(*on_card(sx, sy, t), t), "", 72 * z, a * (0.5 + 0.5 * pulse), dashed=True)
    # the team is full
    if t >= SEATS[2][2]:
        glint_w(c, t, *seat_pos(2), SEATS[2][2])


PASSERS = ["BC", "PS", "JC", "SK", "LM"]
PASS_Y = CARD_Y0 + CARD_H + 90
LINK_Y = CARD_Y0 + CARD_H + 40


def draw_passers(c, t):
    return
    a = prog(t, 11.2, 11.6) * (1 - prog(t, 15.0, 15.5))
    for k, ini in enumerate(PASSERS):
        x = -300 + 360 * (t - 11.2) + 430 * k
        x = (x + 400) % 2700 - 400
        wavatar(c, t, x, PASS_Y + 10 * math.sin(k * 1.7), ini, 28, a * 0.55, fill=(38, 41, 50))
    # the one line that reaches out to them, and snaps
    if 11.5 <= t < 12.0:
        D = (SNAPS[1][2] - SNAPS[1][1]) * e_out_expo(prog(t, 11.5, 11.85, e_lin))
        wbar(c, t, SNAPS[1][1] + D / 2, LINK_Y, D, 6, alpha=world_dim(t))


# ---------------------------------------------------------------- the bridge, and discovery

NAME_LIFT = 32.6
NAME_LAND = 33.6
GRID_T = 32.6            # the card leaves its own place for the grid of projects
GROW = (35.4, 36.3)      # and grows back out of it
SLOT_W, SLOT_H = 600, 240
GRID_X = [300.0, 960.0, 1620.0]
GRID_Y = [1290.0, 1600.0]
GRID_SLOT = (GRID_X[1], GRID_Y[0])
GRID = [  # the company's ideas and projects (seed data): (row, column, title, line)
    (0, 0, "Client Brief Generator", "Recruiting  ·  3 of 4 people"),
    (0, 1, REPLY_B, "Recruiting  ·  1 of 3 people"),
    (0, 2, "Meeting Summary Bot", "Recruiting  ·  1 of 3 people"),
    (1, 0, "AI Invoice Assistant", "Building"),
    (1, 1, "Supplier Risk Checker", "Waiting for approval"),
    (1, 2, "Claude Onboarding Guide", "Live"),
]
HILITE = 34.4


def card_compact(title, line, hi=0.0):
    p = Pen(SLOT_W, SLOT_H)
    if hi > 0:
        p.rrect(1, 1, SLOT_W - 2, SLOT_H - 2, 14, outline=BLUE, width=3, alpha=hi)
    p.text(36, 96, title, 44, WHITE, SEMI)
    p.text(36, 168, line, 34, DIM)
    return p.done()


def draw_grid(c, t):
    return


PROP_S = 0.78
PROP_C = (960.0, 440.0)


def propose_title_xy():
    left = PROP_C[0] - SLOT_W * PROP_S / 2
    top = PROP_C[1] - SLOT_H * PROP_S / 2
    return left + 36 * PROP_S, top + 96 * PROP_S


def draw_name_bridge(c, t):
    """The name lifts out of Mia's answer and lands on the idea she just proposed."""
    if not NAME_LIFT <= t < NAME_LAND + 0.25:
        return
    p = prog(t, NAME_LIFT, NAME_LAND, e_io_quint)
    x0, b0 = reply_name_pos()
    sx0, sy0 = ws(x0, b0, t)
    sx1, sy1 = propose_title_xy()
    end = 44 * PROP_S
    a = 1 - prog(t, NAME_LAND, NAME_LAND + 0.25)
    z = cam(t)[2]
    soft_word(c, REPLY_B, SEMI, 44, WHITE, lerp(sx0, sx1, p), lerp(sy0, sy1, p), a, 0.0,
              lerp(max(0.5, 40 * QSCALE * z / 44), end / 44, p))


def draw_propose(c, t):
    """Anyone can propose an idea. The new one lands in the company's list."""
    if not 33.45 <= t < 35.2:
        return
    a = prog(t, 33.45, 33.75, e_out_cubic) * (1 - prog(t, 34.9, 35.2))
    spots = ((0, 0), (0, 1), (0, 2), (1, 0), (1, 1), (1, 2))
    by_slot = {(r, col): (title, line) for r, col, title, line in GRID}
    for i, (r, col) in enumerate(spots):
        title, line = by_slot[(r, col)]
        x = 400 + col * 560
        y = 440 + r * 280
        hi = 1.0 if title == REPLY_B else 0.0
        shown = title if title != REPLY_B or t >= NAME_LAND else ""
        place(c, card_compact(shown, line, hi), x, y, PROP_S, a * (1 if hi else 0.75))


def draw_approval(c, t):
    """The idea is approved. A check lands on it. No invented scores."""
    if not 35.05 <= t < 36.5:
        return
    a = prog(t, 35.05, 35.3, e_out_cubic) * (1 - prog(t, 36.25, 36.5))
    _say(c, "Contract Clause Checker", DSEMI, 56, WHITE, 300, a)
    _say(c, "AI review", MED, 40, BLUE, 380, a * prog(t, 35.2, 35.45))
    ring = prog(t, 35.35, 35.7, e_out_cubic)
    if ring > 0.02:
        draw_dot(c, 960, 560, 78, (18, 22, 34), a, ring=10 * ring)
    ck = prog(t, 35.55, 36.0, e_out_cubic)
    if ck > 0.02:
        a1, b1, c1 = (900, 570), (945, 630), (1045, 500)
        u = min(1.0, ck / 0.45)
        draw_polyline(c, [a1, (lerp(a1[0], b1[0], u), lerp(a1[1], b1[1], u))], 16, BLUE, a)
        if ck > 0.45:
            v = (ck - 0.45) / 0.55
            draw_polyline(c, [b1, (lerp(b1[0], c1[0], v), lerp(b1[1], c1[1], v))], 16, BLUE, a)
    _say(c, "Approved", DSEMI, 108, WHITE, 780, a * prog(t, 35.85, 36.15, e_out_cubic))


# ---------------------------------------------------------------- joining

def join_button():
    return CARD_X0 + 955, CARD_Y0 + 423


def draw_joiners(c, t):
    """Ben, then Priya, arrive, press Join project and take a seat."""
    if GROW[0] <= t < 39.0:
        return
    for k in (1, 2):
        ini, name, j = SEATS[k]
        t0, tp = j - 1.0, j - PRESS
        if not t0 <= t < j:
            continue
        bx, by = join_button()
        start = (CARD_C[0] + 1150, by + (-170 if k == 1 else 190))
        stop = (CARD_X0 + 1270, by + 10)
        p1 = prog(t, t0, tp - 0.05, e_out_cubic)
        p2 = prog(t, tp + 0.08, j, e_io_cubic)
        x = lerp(lerp(start[0], stop[0], p1), seat_pos(k)[0], p2)
        y = lerp(lerp(start[1], stop[1], p1), seat_pos(k)[1], p2)
        z = cam(t)[2]
        g = prog(t, t0, t0 + 0.2)
        X, Y = ws(x, y, t)
        avatar_at(c, X, Y, ini, lerp(64, 72, p2) * z, g, ring=prog(t, tp, tp + 0.4) if tp <= t < tp + 0.4 else 0.0)
        ng = g * (1 - prog(t, tp + 0.05, tp + 0.2))
        soft_word(c, name, MED, 44, WHITE, X - text_width(name, MED, 44) * z / 2, Y + 118 * z, ng, 0.0, z)
        glint_w(c, t, bx, by, tp)


# ---------------------------------------------------------------- Pulse, and Slack

def draw_pulse(c, t):
    """A heartbeat runs along the foot of the quiet project and flags it."""
    if not 43.3 <= t < SLACK_FLY[1]:
        return
    y = CARD_Y0 + CARD_H + 30
    x0, x1 = CARD_X0, CARD_X0 + CARD_W
    head = lerp(x0 + 40, x1 - 60, prog(t, 43.35, FLAG, e_io_cubic))
    a = 1 - prog(t, FLAG + 0.25, FLAG + 0.6)
    blip = [(-40, 0), (-24, 12), (-9, -92), (9, 52), (24, -14), (38, 0)]
    pts = [ws(x0, y, t), ws(head - 40, y, t)] + [ws(head + du, y + dv, t) for du, dv in blip]
    draw_polyline(c, pts, 5.0, (150, 175, 255), a)
    if t >= FLAG:     # flagged: a ring round the card, and what Pulse found
        f = prog(t, FLAG, FLAG + 0.4, e_out_cubic) * (1 - prog(t, SLACK_IN, SLACK_IN + 0.35))
        fade = 1 - prog(t, SLACK_FLY[0], SLACK_FLY[1])
        sx0, sy0 = ws(x0 - 16, CARD_Y0 - 16, t)
        sx1, sy1 = ws(x1 + 16, CARD_Y0 + CARD_H + 16, t)
        for (ax, ay), (bx_, by_) in (((sx0, sy0), (sx1, sy0)), ((sx1, sy0), (sx1, sy1)), ((sx1, sy1), (sx0, sy1)),
                                     ((sx0, sy1), (sx0, sy0))):
            draw_polyline(c, [(ax, ay), (bx_, by_)], 4.0, BLUE, 0.9 * f * fade)
        g = f * (1 - prog(t, SLACK_IN, SLACK_IN + 0.3))
        wtext(c, t, "Pulse  ·  Build going quiet", MED, 52, BLUE, CARD_C[0], CARD_Y0 + CARD_H + 92, g)


SLACK_W, SLACK_H = 1000, 420
SLACK_XY = (960.0, 600.0)


def card_slack(t):
    p = Pen(SLACK_W, SLACK_H)
    p.rrect(0, 0, SLACK_W - 1, SLACK_H - 1, 18, fill=(30, 32, 40))
    p.rrect(36, 36, 100, 100, 12, fill=BLUE_DEEP)
    p.text(68, 81, "S", 38, (255, 255, 255), DSEMI, anchor="ms")
    p.text(124, 64, "Slack", 34, WHITE, SEMI)
    p.text(124, 100, "#ai-projects  ·  Spine daily digest", 28, DIM)
    p.text(36, 188, "Build going quiet", 38, DIM, MED)
    p.text(36, 262, REPLY_B, 62, WHITE, DSEMI)
    _button(p, 36, 304, 256, 382, "Open", primary=t >= SLACK_OPEN, size=36)
    return p.done()


def open_button_screen():
    return SLACK_XY[0] - SLACK_W / 2 + 146, SLACK_XY[1] - SLACK_H / 2 + 343


def draw_slack(c, t):
    """The same flag arrives in the team's Slack; Mia opens it and it takes her back to her step."""
    if not SLACK_IN <= t < SLACK_FLY[1]:
        return
    p_in = prog(t, SLACK_IN, SLACK_IN + 0.45, e_out_cubic)
    q = prog(t, *SLACK_FLY, e_in_cubic)
    tx, ty = ws(CARD_X0 + 84, CARD_Y0 + ROWS[0] - 18, t)
    x = lerp(lerp(W + SLACK_W / 2 + 60, SLACK_XY[0], p_in), tx, q)
    y = lerp(SLACK_XY[1], ty, q)
    place(c, card_slack(t), x, y, lerp(1.28, 0.05, q), 1 - prog(t, SLACK_FLY[1] - 0.12, SLACK_FLY[1]))
    # Mia arrives and presses Open
    if 45.6 <= t < SLACK_FLY[0] + 0.15:
        bx, by = open_button_screen()
        a1 = prog(t, 45.6, 46.15, e_out_cubic)
        a2 = prog(t, SLACK_OPEN - 0.12, SLACK_OPEN, e_io_cubic)
        X = lerp(lerp(W + 100, bx + 190, a1), bx + 120, a2)
        Y = lerp(lerp(900, by + 40, a1), by + 26, a2)
        g = prog(t, 45.6, 45.8) * (1 - prog(t, SLACK_FLY[0], SLACK_FLY[0] + 0.15))
        avatar_at(c, X, Y, "MT", 64, g, ring=prog(t, SLACK_OPEN, SLACK_OPEN + 0.4) if t >= SLACK_OPEN else 0.0)
        soft_word(c, "Mia Thompson", MED, 44, WHITE, X + 86, Y + 16, g * (1 - prog(t, SLACK_OPEN - 0.1, SLACK_OPEN)))
        glint(c, t, bx, by, SLACK_OPEN, 0.8)


def draw_stall(c, t):
    """The build has stopped. Said on its own, before Pulse arrives."""
    if not 42.1 <= t < 43.45:
        return
    n = 1 + int(11 * prog(t, 42.3, 43.05))
    g = prog(t, 42.1, 42.35, e_out_cubic) * (1 - prog(t, 43.2, 43.45))
    _say(c, "Stalled.", DSEMI, 120, WHITE, 470, g)
    _say(c, f"No activity for {n} day{'s' if n > 1 else ''}", LIGHT, 56, DIM, 620, g * prog(t, 42.3, 42.5))


# ---------------------------------------------------------------- 3. the company's activity, and the hours

N_FIELD = 60
N_UNITS = sum(h // 2 for h in HOURS)        # 47: one unit per two hours logged
CCC_UNITS = 4                               # Contract Clause Checker's 8 hours, the top of October
HOURS_IN = 50.95                            # the camera has arrived: the months stack up
CHIP_LAND = 52.25                           # the project's hours land on October
BASE_Y = 1400.0
CHART = (3300.0, BASE_Y - 350)
COL_X = [CHART[0] - 270 + 180 * k for k in range(4)]


@lru_cache(None)
def _field():
    rng = np.random.default_rng(11)
    out = []
    for i in range(N_FIELD):
        out.append(dict(hx=rng.uniform(-650, 3900), hy=rng.uniform(-250, 2350), ax=rng.uniform(40, 120),
                        ay=rng.uniform(30, 90), w1=rng.uniform(0.18, 0.45), w2=rng.uniform(0.15, 0.4),
                        p1=rng.uniform(0, 6.3), p2=rng.uniform(0, 6.3), rz=rng.uniform(-60, 60),
                        L=rng.uniform(50, 130)))
    return out


def wander(i, t):
    f = _field()[i]
    x = f["hx"] + f["ax"] * math.sin(f["w1"] * t + f["p1"])
    y = f["hy"] + f["ay"] * math.sin(f["w2"] * t + f["p2"])
    return x, y, f["rz"] + 30 * math.sin(0.27 * t + f["p2"]), f["L"]


@lru_cache(None)
def _units():
    slots = []
    for k, h in enumerate(HOURS):
        for j in range(h // 2):
            slots.append((k, j))
    return slots


def is_ccc(i):
    k, j = _units()[i]
    return k == 3 and j >= HOURS[3] // 2 - CCC_UNITS


def unit_t0(i):
    """When unit i starts flying in; the months fill one after another (the project's hours come later)."""
    k, j = _units()[i]
    return HOURS_IN + 0.18 * k + 0.012 * j


def month_done(k):
    last = max(i for i in range(N_UNITS) if _units()[i][0] == k and not is_ccc(i))
    return unit_t0(last) + 0.45


def _loose(i, t):
    if i < N_FIELD:
        x, y, rz, L = wander(i, t)
        return x, y, rz, L, 12.0
    return debris(i - N_FIELD, t)


@lru_cache(None)
def _spine_rows():
    t = 22.2
    order = sorted(range(N_FIELD + 6), key=lambda i: ws(*_loose(i, t)[:2], t)[1])
    return {i: r for r, i in enumerate(order)}


SPINE_ASIDE = (23.2, 23.8)
DISPERSE = (26.4, 27.2)


def spine_target(i, t):
    r = _spine_rows()[i]
    n = N_FIELD + 6
    sy = 150 + 780 * r / (n - 1)
    sx = lerp(960, 520, prog(t, *SPINE_ASIDE, e_io_cubic))
    Ls = 60 + 70 * math.sin(math.pi * (r + 0.5) / n) + 18 * ((i * 37) % 7) / 7
    x, y = sw(sx, sy, t)
    z = cam(t)[2]
    return x, y, 0.0, Ls / z, 9 / z


def field_alpha(t):
    z = cam(t)[2]
    a = lerp(0.55, 0.16, clamp((z - 0.45) / 0.5))
    return max(a, 0.5 * prog(t, 15.4, 16.2) * (1 - prog(t, 26.4, 27.2)))


def piece_state(i, t):
    base_a = field_alpha(t)
    if t < 22.2:
        x, y, rz, L, T = _loose(i, t)
        a = base_a if i < N_FIELD else debris_alpha(i - N_FIELD, t)
        return x, y, rz, L, T, a * world_dim(t, field=True)
    frozen = _loose(i, 22.2)
    if t < 22.5:
        return (*frozen, base_a)
    tgt = spine_target(i, t)
    if t < DISPERSE[0]:
        p = e_out_expo(prog(t, 22.5, 22.85, e_lin))
        return (*(lerp(frozen[k], tgt[k], p) for k in range(5)), lerp(base_a, 0.95, p))
    p = prog(t, *DISPERSE, e_io_cubic)
    if i >= N_FIELD:
        return (*tgt, 0.95 * (1 - p))
    w = _loose(i, t)
    st = (*(lerp(tgt[k], w[k], p) for k in range(5)), lerp(0.95, base_a, p))
    if i >= N_UNITS or is_ccc(i):
        return (*st[:5], st[5] * (1 - prog(t, HOURS_IN, HOURS_IN + 0.5)))
    t0 = unit_t0(i)
    if t < t0:
        return st
    k, j = _units()[i]
    p = prog(t, t0, t0 + 0.45, e_io_cubic)
    slot = (COL_X[k], BASE_Y - 14 - 22 * j, 0.0, 120.0, 12.0)
    w = _loose(i, t0)
    cur = tuple(lerp(w[q], slot[q], p) for q in range(5))
    return (*cur, lerp(base_a, 1.0, p) * (1 - prog(t, 54.0, 54.4)))


def draw_pieces(c, t):
    if t < HOURS_IN or t >= 54.4:
        return
    assembling = 22.15 <= t < DISPERSE[0]
    for i in range(N_FIELD + 6):
        # Ambient dashes are noise. Pieces only exist while they lock into the spine,
        # or later as the hours on the chart.
        if i < N_FIELD and not assembling:
            if t < HOURS_IN or i >= N_UNITS or is_ccc(i) or t < unit_t0(i) - 0.02:
                continue
        x, y, rz, L, T, a = piece_state(i, t)
        if a > 0.01:
            wbar(c, t, x, y, L, T, rz, a)
    if 22.45 <= t < DISPERSE[0] + 0.2:
        sx = lerp(960, 520, prog(t, *SPINE_ASIDE, e_io_cubic))
        d = e_out_expo(prog(t, 22.45, 22.7, e_lin))
        a = 1 - prog(t, DISPERSE[0] - 0.2, DISPERSE[0] + 0.2)
        draw_bar(c, sx, 140 + 400 * d, 800 * d + 1, 4, 90.0, a * 0.9, color=(140, 165, 255))


SNAPS = [(5.5, BX + 60, 1820, ROAD_Y), (12.0, 1180, 1660, LINK_Y),
         (19.9, 2300, 2840, 1050)]


def debris(j, t):
    ts, xa, xb, y = SNAPS[j // 2]
    s = -1 if j % 2 == 0 else 1
    L = (xb - xa) / 2
    cx = xa + L / 2 if s < 0 else xb - L / 2
    u = max(0.0, t - ts)
    sp = 1 - math.exp(-u / 0.09) * math.cos(2 * math.pi * 3.0 * u)
    return cx + s * 40 * sp + s * 6 * u, y + 28 * sp + 5 * u, -s * 9 * sp, L, 6.0


def debris_alpha(j, t):
    ts = SNAPS[j // 2][0]
    return 0.0 if t < ts else lerp(1.0, 0.55, prog(t, ts + 0.6, ts + 1.6))


def draw_link(c, t):
    return


def hours_shown(t):
    """The only total on the chart is 42, and only once October is complete.
    Earlier months stay as bars. Showing 6, 16 or 30 over a bar that is already
    taller is a lie, and 34 (October before this project's 8) is never shown."""
    if t >= OCT_DONE:
        return 3, HOURS[3]
    return -1, 0


OCT_FILL = HOURS_IN + 0.54             # the first October unit leaves
OCT_DONE = CHIP_LAND + 0.15            # the lighter 8 has landed: the total may say 42


def card_chart(t):
    p = Pen(860, 900)
    p.text(44, 70, "Hours saved, logged by teams" if t < 30 else "Hours saved across all projects", 38, DIM, MED)
    k, h = hours_shown(t)
    if k >= 0:
        g = prog(t, OCT_DONE if k == 3 else month_done(k), (OCT_DONE if k == 3 else month_done(k)) + 0.2, e_out_cubic)
        big = 190 if k == 3 else 170
        col = BLUE
        p.text(40, 250, str(h), big, col, DSEMI, alpha=g)
        p.text(52 + text_width(str(h), DSEMI, big), 188, "hours saved", 50, WHITE, MED, alpha=g)
        p.text(52 + text_width(str(h), DSEMI, big), 246, "in " + MONTH_NAMES[k], 50, DIM, alpha=g)
    return p.done()


def draw_chart(c, t):
    if not 49.9 <= t < 54.4:
        return
    a = prog(t, 15.7, 16.2) * world_dim(t) * (1 - prog(t, 21.6, 22.2) * (1 - prog(t, 50.0, 50.5))) \
        * (1 - prog(t, 54.0, 54.4))
    wcard(c, t, card_chart(t), CHART[0], CHART[1], a)
    sx0, sy = ws(CHART[0] - 360, BASE_Y + 6, t)
    sx1, _ = ws(CHART[0] + 360, BASE_Y + 6, t)
    z = cam(t)[2]
    if t < HOURS_IN:
        x = sx0
        while x < sx1:
            draw_bar(c, x + 7 * z, sy, 12 * z, 3 * z, alpha=a * 0.8, color=(70, 75, 92))
            x += 24 * z
        g = prog(t, 16.3, 16.7) * (1 - prog(t, 21.0, 21.4))
        wtext(c, t, "No data yet", MED, 84, DIM, CHART[0], BASE_Y - 230, a * g)
    else:
        wbar(c, t, CHART[0], BASE_Y + 4, 760, 4, alpha=a, color=(70, 75, 92))
    for k in range(4):
        hot = (k == 3 and t >= OCT_DONE) or (k < 3 and month_done(k) <= t < OCT_FILL)
        wtext(c, t, MONTHS[k], MED, 40, WHITE if hot else DIM, COL_X[k], BASE_Y + 70, a)
    # the project's own hours, landing on October in a lighter blue, with its name
    if t >= 50.0:
        for u in range(CCC_UNITS):
            j = HOURS[3] // 2 - CCC_UNITS + u
            land = CHIP_LAND + 0.05 * u
            p = prog(t, land - 0.5, land, e_io_cubic)
            src = (COL_X[3], BASE_Y - 14 - 22 * 20)     # where the chip arrives
            sxw = lerp(src[0], COL_X[3], p)
            syw = lerp(src[1], BASE_Y - 14 - 22 * j, p)
            if t >= CHIP_LAND - 0.5 + 0.05 * u:
                wbar(c, t, sxw, syw, 120, 12, alpha=(1 - prog(t, 54.0, 54.4)), color=(150, 175, 255))


def draw_chip(c, t):
    """'+8 hours' lifts off the project's Live line and travels to October on the company's chart."""
    t0, t1 = LOGGED + 0.4, CHIP_LAND - 0.45
    if not t0 <= t < t1:
        return
    p = prog(t, t0, t1, e_io_cubic)
    a0 = ws(CARD_X0 + 560, CARD_Y0 + 598, t0)
    a1 = ws(COL_X[3], BASE_Y - 14 - 22 * 20, t1)
    lift = math.sin(math.pi * p) * 120
    x, y = lerp(a0[0], a1[0], p), lerp(a0[1], a1[1], p) - lift
    draw_bar(c, x, y, lerp(320, 86, p), lerp(68, 9, p), color=(150, 175, 255))
    s = "+8 hours"
    soft_word(c, s, SEMI, 40, (18, 22, 40), x - text_width(s, SEMI, 40) / 2, y + 14,
              1 - prog(t, lerp(t0, t1, 0.55), lerp(t0, t1, 0.7)))


# ---------------------------------------------------------------- the end: one line through all three

RAIL = 54.2                       # the recap starts
RAIL_POS = [0.0, 1600.0, 3200.0]  # the three objects, laid out along one line (rail pixels)
RAIL_STOPS = [(54.2, 0.0), (55.1, 0.0), (55.9, 1600.0), (56.6, 1600.0), (57.4, 3200.0)]
PULL = (57.9, 58.6)               # pull back to see all three on the line
LANDS = [59.15, 59.35, 59.55]     # each condenses into its bar in the mark
LABELS = ["Questions", "Ideas", "Impact"]
RAIL_DY = 262                     # the line runs under the objects
WORDMARK = 59.8


def rail_cam(t):
    x = RAIL_STOPS[0][1]
    for (ta, a), (tb, b) in zip(RAIL_STOPS, RAIL_STOPS[1:]):
        if t >= ta:
            x = lerp(a, b, prog(t, ta, tb, e_io_quint))
    return x


def rail_xy(k, t):
    """Screen centre and scale of rail object k: full size while the camera travels; small, side by side,
    once it pulls back."""
    near = (960 + RAIL_POS[k] - rail_cam(t), 540.0, 1.0)
    far = (960 + (RAIL_POS[k] - 1600) * 0.36, 600.0, 0.36)
    p = prog(t, *PULL, e_io_quint)
    return tuple(lerp(near[q], far[q], p) for q in range(3))


def logo_slot(k):
    x0, x1, yc = LOGO[k]
    return (x0 + x1) / 2, yc, x1 - x0, 40.0


def draw_end(c, t):
    if t < RAIL:
        return
    g0 = prog(t, RAIL, RAIL + 0.35, e_out_cubic)
    # the line that runs through all three
    line_a = g0 * (1 - prog(t, LANDS[0] - 0.45, LANDS[0] - 0.2))
    if line_a > 0:
        x0, y0, s0 = rail_xy(0, t)
        x2, y2, s2 = rail_xy(2, t)
        reach = lerp(x0, x2, prog(t, RAIL + 0.7, RAIL_STOPS[-1][0], e_io_cubic))
        draw_bar(c, (x0 + reach) / 2, y0 + RAIL_DY * s0, reach - x0, 6, alpha=line_a, color=(110, 140, 240))
    for k in range(3):
        x, y, s = rail_xy(k, t)
        cx, cy, L, T = logo_slot(k)
        land = LANDS[k]
        q = prog(t, PULL[0], land, e_io_quint)
        g = g0 * (1 - prog(t, PULL[0], PULL[0] + 0.35))
        if g > 0 and -800 < x < W + 800:
            if k == 0:
                place(c, card_question(t, claimed=True), x, y, 1.05 * s, g)
            elif k == 1:
                place(c, card_project(LOGGED + 0.5), x, y, 0.7 * s, g)
            else:
                w42 = text_width("42", DSEMI, 240)
                soft_word(c, "42", DSEMI, 240, BLUE, x - w42 / 2 - 170 * s, y + 120 * s, g, 0.0, s)
                soft_word(c, "hours saved", MED, 60, WHITE, x + (w42 / 2 - 140) * s, y + 40 * s, g, 0.0, s)
                soft_word(c, "in October", REG, 60, DIM, x + (w42 / 2 - 140) * s, y + 112 * s, g, 0.0, s)
        if t >= PULL[0]:      # the object condenses into its bar and takes its place in the mark
            src = (x, y + RAIL_DY * s, [1100, 980, 700][k] * s, 18)
            bx = lerp(src[0], cx, q)
            by = lerp(src[1], cy, q)
            draw_bar(c, bx, by, max(lerp(src[2], L, q), 18), lerp(src[3], T, q))
        if t >= land:
            glint(c, t, cx, cy, land, 0.8)
            la = prog(t, land - 0.1, land + 0.3) * (1 - prog(t, 61.0, 61.4))
            soft_word(c, LABELS[k], MED, 40, DIM, LOGO[k][0] - 40 - text_width(LABELS[k], MED, 40), cy + 14, la)
    for k in range(3):
        ts = WORDMARK + 0.12 * k
        u = prog(t, ts, ts + 0.5, e_io_cubic)
        if 0 < u < 1:
            x0, x1, yc = LOGO[k]
            draw_dot(c, lerp(x0, x1, u), yc, 34, (190, 205, 255), 0.35 * math.sin(math.pi * u), blur=16)


# ---------------------------------------------------------------- shake and punch (only on real hits)

IMPACTS = [(5.5, 0.18), (12.0, 0.12), (19.9, 0.16), (22.5, 1.1), (DOCK, 0.3), (SEATS[1][2], 0.25),
           (SEATS[2][2], 0.25), (FLAG, 0.25), (PLAN[0][3], 0.2), (LANDS[-1], 0.9)]


def post(c, t):
    sx, sy, punch, split = impact_state(t)
    z = 1 + punch
    z = max(z, 1 + 2 * max(abs(sx) / W, abs(sy) / H) + 0.002) if (sx or sy) else z
    if z > 1.0005:
        im = Image.fromarray(np.clip(c, 0, 255).astype(np.uint8))
        w, h = W / z, H / z
        x0, y0 = (W - w) / 2 - sx, (H - h) / 2 - sy
        im = im.transform((W, H), Image.EXTENT, (x0, y0, x0 + w, y0 + h), Image.BICUBIC)
        c = np.asarray(im, np.float32).copy()
    d = int(round(split * 0.6))
    if d >= 1:
        c[:, d:, 0] = c[:, :-d, 0].copy()
        c[:, :-d, 2] = c[:, d:, 2].copy()
    return c


# ---------------------------------------------------------------- the film

def draw_team_hero(c, t):
    """The idea is chosen. A line reaches an empty seat, then the person locks into it.
    Joining is that lock. There is no separate button and no approval step."""
    if not 36.45 <= t < 39.0:
        return
    a = prog(t, 36.45, 36.65, e_out_cubic) * (1 - prog(t, 38.85, 39.0))
    _say(c, "Contract Clause Checker", DSEMI, 56, WHITE, 250, a)
    _say(c, "Recruiting", MED, 32, BLUE, 320, a)
    slots = (480.0, 960.0, 1440.0)
    y = 560.0
    r = 96.0
    people = (("MT", "Mia"), ("BC", "Ben"), ("PS", "Priya"))
    joins = (None, 37.25, 38.25)
    for k, (ini, short) in enumerate(people):
        j = joins[k]
        if j is None or t >= j:
            pop = 1.0 if j is None else e_out_cubic(prog(t, j, j + 0.2))
            avatar_at(c, slots[k], y, ini, r * (0.9 + 0.1 * pop), a,
                      ring=1.0 if j and t < j + 0.35 else 0.0)
            soft_word(c, short, MED, 36, WHITE, slots[k] - text_width(short, MED, 36) / 2, y + 140, a)
        else:
            avatar_at(c, slots[k], y, "", r, a * 0.85, dashed=True)
            arrive = j - 0.7
            if t >= arrive:
                p = prog(t, arrive, j, e_io_cubic)
                side = 2100 if k == 2 else -180
                X = lerp(side, slots[k], p)
                avatar_at(c, X, y, ini, r * 0.92, a)
                # the choice is the line. It reaches the seat first, then the person rides it in.
                reach = min(1.0, p * 1.35)
                draw_polyline(c, [(X, y), (lerp(X, slots[k], reach), y)], 8, BLUE, a * (1 - max(0, p - 0.85) / 0.15))
                if p < 0.55:
                    lab = "Join"
                    soft_word(c, lab, SEMI, 36, BLUE, slots[k] - text_width(lab, SEMI, 36) / 2, y + 8, a * (1 - p / 0.55))
    n = 1 + int(t >= 37.25) + int(t >= 38.25)
    _say(c, f"{n} of 3", DSEMI, 64, WHITE, 860, a)


def _say(c, text, fname, size, color, y, g):
    if g <= 0.01:
        return
    soft_word(c, text, fname, size, color, W / 2 - text_width(text, fname, size) / 2, y, g)


def draw_prelude(c, t):
    """The three problems, in the same still language as the ending. One object. No roads,
    no passing people, no field of bars. Hands off before the question becomes the idea."""
    if t >= 26.7:
        return

    def mark(cx, cy, p, a):
        """Three lines, one for each problem, pull in and become the logo."""
        starts = ((960.0, 440.0, 980.0), (960.0, 580.0, 1180.0), (960.0, 720.0, 820.0))
        names = ("Questions", "Ideas", "Impact")
        for i, (x0, x1, yc) in enumerate(LOGO):
            L = x1 - x0
            mx = (x0 + x1) / 2 - LOGO_C[0]
            my = yc - LOGO_C[1]
            sx, sy, sL = starts[i]
            x = lerp(sx, cx + mx, p)
            y = lerp(sy, cy + my, p)
            length = lerp(sL, L, p)
            draw_bar(c, x, y, max(length, 8), lerp(10, 36, p), alpha=a)
            if p < 0.72:
                lab = names[i]
                soft_word(c, lab, MED, 32, DIM, x - text_width(lab, MED, 32) / 2, y - 42, a * (1 - p / 0.72))

    # 1. the question ages in steps, so the wait is visible.
    if t < 10.1:
        a = prog(t, 3.25, 3.55, e_out_cubic) * (1 - prog(t, 9.45, 10.05))
        _say(c, "Has anyone automated", DSEMI, 64, WHITE, 430, a * prog(t, 3.3, 3.6))
        _say(c, "contract reviews before?", DSEMI, 64, WHITE, 520, a * prog(t, 3.5, 3.85))
        _say(c, "Ben Carter", MED, 36, DIM, 610, a * prog(t, 3.7, 4.0))
        age = bubble_state(t)
        fresh = 0.0
        for m in (4.6, 5.5, 6.5, 7.6):
            fresh = max(fresh, 1 - prog(t, m, m + 0.2))
        _say(c, age, LIGHT, 72, WHITE if fresh > 0.2 else DIM, 760, a * prog(t, 3.7, 4.05))

    # 2. the stages run Idea to Live, then stop at Building. Not one long Building bar.
    if 9.55 <= t < 15.7:
        a = prog(t, 9.55, 10.0, e_out_cubic) * (1 - prog(t, 15.15, 15.65))
        _say(c, "Contract Clause Checker", DSEMI, 56, WHITE, 390, a * prog(t, 9.6, 9.95))
        xs = [200 + i * 280 for i in range(6)]
        lights = (10.25, 11.15, 12.05)
        for i, name in enumerate(STAGES):
            x = xs[i]
            if i < 5:
                grow = prog(t, 10.05 + i * 0.7, 10.55 + i * 0.7, e_out_cubic)
                reached = i < 3
                draw_bar(c, x + 70 * grow, 620, 140 * grow, 4, alpha=a * (0.9 if reached else 0.3),
                         color=BLUE if i < 2 else (70, 75, 92))
            if i < 3:
                p = prog(t, lights[i], lights[i] + 0.26, e_out_cubic)
                if p > 0:
                    draw_dot(c, x, 620, 20 * (0.7 + 0.3 * p), BLUE, a * p)
            else:
                draw_dot(c, x, 620, 20, (16, 16, 19), a * prog(t, 10.3, 10.7), ring=3)
            soft_word(c, name, MED, 28, WHITE if i < 3 else DIM, x - text_width(name, MED, 28) / 2, 690,
                      a * prog(t, 10.15 + i * 0.15, 10.45 + i * 0.15))
        miss = math.sin(math.pi * clamp(prog(t, 13.05, 13.6)))
        if miss > 0.02:
            draw_dot(c, xs[3], 620, 20, BLUE, a * miss * 0.9)
        _say(c, "Stopped halfway", LIGHT, 68, WHITE, 860, a * prog(t, 13.4, 13.75, e_out_cubic))

    # 3. the months arrive one by one, and none of them gets a number.
    if 15.45 <= t < 21.15:
        a = prog(t, 15.45, 15.95, e_out_cubic) * (1 - prog(t, 20.7, 21.15))
        _say(c, "Hours saved", MED, 40, WHITE, 430, a * prog(t, 15.6, 15.95))
        labels = ("Jul", "Aug", "Sep", "Oct")
        for i, lab in enumerate(labels):
            p = prog(t, 16.15 + i * 0.7, 16.5 + i * 0.7, e_out_cubic)
            if p <= 0:
                continue
            x = 560 + 220 * i
            draw_bar(c, x, 800 + 16 * (1 - p), 90, 6, alpha=a * 0.55 * p, color=(70, 75, 92))
            soft_word(c, lab, MED, 32, DIM, x - text_width(lab, MED, 32) / 2, 860, a * p)
        _say(c, "No data yet", LIGHT, 108, DIM, 620, a * prog(t, 19.05, 19.45, e_out_cubic))

    # 4. the three problem lines pull together into the mark.
    if 21.05 <= t < 26.7:
        a = prog(t, 21.05, 21.3) * (1 - prog(t, 26.15, 26.65))
        p = e_io_quint(prog(t, 21.85, 22.55))
        mark(960, 540, p, a)


def render_scene(t_film):
    t = t_film + SHIFT
    n = int(round(t * FPS * 4))
    flash = 0.28 * prog(t, 22.47, 22.5, e_lin) * (1 - prog(t, 22.5, 22.9, e_out_cubic))
    c = background(t, n, flash)
    end_fade = prog(t, 62.3, 63.1)

    draw_chart(c, t)
    draw_pieces(c, t)
    draw_road(c, t)
    draw_link(c, t)
    draw_grid(c, t)
    draw_card(c, t)
    draw_seats(c, t)
    draw_passers(c, t)
    draw_pulse(c, t)
    draw_joiners(c, t)
    draw_question(c, t)
    draw_champions(c, t)
    draw_name_bridge(c, t)
    draw_chip(c, t)
    draw_slack(c, t)
    draw_team_hero(c, t)
    draw_propose(c, t)
    draw_approval(c, t)
    draw_prelude(c, t)

    line_words(c, t, "Questions go unanswered.", LIGHT, 84, WHITE, W / 2, 168, 3.42, 9.2, "center",
               step=0.045, dur=0.16)
    headline(c, t, "Ideas lose momentum.", 10.3, 15.15, y=168, size=72)
    headline(c, t, "Impact goes unseen.", 16.2, 20.7, y=168, size=80)
    line_words(c, t, "Your AI needs", LIGHT, 84, WHITE, W / 2, 200, 21.15, 26.1, "center")
    line_words(c, t, "a spine.", DREG, 84, BLUE, W / 2, 290, 21.45, 26.1, "center")
    line_words(c, t, "Spine is your AI project manager.", LIGHT, 48, WHITE, W / 2, 900, 23.15, 26.1, "center")
    headline(c, t, "Every question finds someone who knows.", 27.5, 32.4, y=150, size=64)
    headline(c, t, "Anyone can propose an idea.", 33.7, 35.0, y=160, size=60)
    headline(c, t, "AI reviews the idea.", 35.2, 36.35, y=170, size=72)
    headline(c, t, "Teams form around good ideas.", 36.55, 38.8, y=150, size=56)
    headline(c, t, "AI drafts the plan. The team owns it.", 39.1, 41.8, y=160, size=68)
    draw_stall(c, t)
    headline(c, t, "Pulse spots work going quiet.", 43.45, 44.75, y=118, size=60)
    headline(c, t, "The team gets a nudge.", 44.95, 46.5, y=150, size=72)
    headline(c, t, "People pick it back up.", 46.65, 49.5, y=160, size=72)
    headline(c, t, "Impact everyone can see.", 50.9, 53.9, y=140, size=72)
    line_words(c, t, "Illustrative data", REG, 28, DIM, W - 56, H - 44, 50.9, 53.9, "right", step=0.0, dur=0.3)

    draw_end(c, t)
    g = prog(t, WORDMARK, WORDMARK + 0.5, e_out_cubic)
    soft_word(c, "Spine", DSEMI, 172, WHITE, 886, 527, g)   # the approved wordmark's size and position
    line_words(c, t, "Give your company’s AI a spine.", LIGHT, 56, WHITE, W / 2, 712, WORDMARK + 1.0, None,
               "center")
    c = post(c, t)
    if end_fade > 0:
        c = c + (_bg_base() - c) * end_fade
    return c


def end_card(t, plate=None):
    return render_scene(t)
