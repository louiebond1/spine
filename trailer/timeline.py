"""Spine launch film: "Holds it together" (clarity cut, 54 s).

One continuous world seen through one camera. Every beat has a starting state, an action and a result
you can see. See the notes above render_scene() for the whole choreography.
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
# Every beat has a starting state, an action and a result you can see, large enough for a phone.
#
#   Questions go unanswered   Ben's question travels, the route ahead snaps, it is stranded.
#   Ideas lose momentum       Contract Clause Checker starts as a lone idea; three people join it at
#                             Recruiting; at Building the track snaps, the team drifts away from it,
#                             "12 days inactive".
#   Impact goes unseen        the Hours saved card, large and empty; activity drifts past it and the
#                             one line reaching for it snaps.
# "Your AI needs a spine.": every loose piece lines up on a spine; "Spine is your AI project manager."
#   The question is shown to Champions; Mia claims it and travels to it; her reply comes from her and
#   names her project. The name carries the camera to the project.
#   Pulse: a heartbeat runs along the project's own track and flags it; lines reach the people who
#   drifted away; they come back. The camera pushes in on the next steps; each person takes one; the
#   project moves through them, ticking each, to Publishing.
#   The track carries on into the Hours saved card and becomes its baseline; the hours teams log stack
#   up on it month by month: 6, 16, 30, 42.
# The end: the answered question, the moving project and the 42, each shown large in turn, condense
# into the three bars of the Spine mark.
#
# Times are story time; the film opens SHIFT seconds in.

SHIFT = 3.4
TOTAL = 1626                 # 54.2 s
END_PLATE = TOTAL + 1
HANDOFF = END_PLATE
HOURS = [6, 16, 30, 42]
MONTHS = ["Jul", "Aug", "Sep", "Oct"]
MONTH_NAMES = ["July", "August", "September", "October"]

# The approved logo geometry (end card): bars (x0, x1, centre y), and its centre.
LOGO = [(736.0, 831.0, 397.5), (708.0, 835.0, 469.5), (700.0, 779.0, 541.5)]
LOGO_C = (767.5, 469.5)


def kick_env(t):
    # matches kick_on() in score.py
    if not kick_on(t):
        return 0.0
    return math.exp(-(t % BEAT) / 0.11)


def kick_on(t):
    return (2.0 <= t < 12.0) or (15.5 <= t < 21.0) or (27.5 <= t < 47.5) or (51.4 <= t < 55.8)


# ---------------------------------------------------------------- camera

SNAP1 = 5.5
BX = 1060.0          # where the question is stranded (world x)

CAM = [  # (time, (centre x, centre y, zoom)) in world pixels; held between equal keys
    (5.5, (1060, 540, 1.0)),
    (9.4, (1060, 540, 1.0)), (10.3, (960, 1400, 1.0)),
    (15.3, (960, 1400, 1.0)), (16.2, (3300, 1003, 0.72)),           # the empty chart, close
    (26.4, (3300, 1003, 0.72)), (27.3, (1250, 590, 1.0)),           # back to the stranded question
    (32.6, (1250, 590, 1.0)), (33.6, (960, 1400, 1.0)),             # following the project's name down
    (36.9, (960, 1400, 1.0)), (37.7, (1224, 1350, 2.1)),           # in close on the next steps
    (40.8, (1224, 1350, 2.1)), (42.7, (3300, 1003, 0.72)),         # following the track to the chart
    (60.0, (3300, 1003, 0.72)),
]


def bubble_x(t):
    """Travelling confidently from the first frame; it brakes hard as the route ahead snaps."""
    u = max(0.0, SNAP1 - t)
    d = u if u > 0.18 else 0.09 + u * u / 0.36
    return BX - 820 * d


def cam(t):
    if t < SNAP1:            # riding with the question
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


def wavatar(c, t, x, y, initials, r=30, alpha=1.0, fill=(40, 54, 100), ring=0.0):
    """A person: a round avatar with initials, placed in the world."""
    if alpha <= 0.01:
        return
    sx, sy = ws(x, y, t)
    z = cam(t)[2]
    draw_dot(c, sx, sy, r * z, fill, alpha)
    size = r * 0.66
    soft_word(c, initials, SEMI, size, WHITE, sx - text_width(initials, SEMI, size) * z / 2, sy + size * 0.36 * z,
              alpha, 0.0, z)
    if ring > 0:
        draw_dot(c, sx, sy, (r + 22 * ring) * z, BLUE, 0.6 * (1 - ring) * alpha, ring=2.4 * z)


def headline(c, t, text, t_in, t_out, y=190, size=80, color=WHITE, fname=None):
    line_words(c, t, text, fname or LIGHT, size, color, W / 2, y, t_in, t_out, "center")


def world_dim(t, field=False):
    """The world steps back while 'Your AI needs a spine.' is on screen."""
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
REPLY_A, REPLY_B = "Yes, I’m building one: ", "Contract Clause Checker"
CHAMPS = [("JC", "Jamie Chen", 330.0), ("SK", "Sarah Kim", 470.0), ("MT", "Mia Thompson", 610.0)]
CHAMP_X = 1880.0
SHOWN = 27.6         # the question is shown to Champions
CHOSEN = 28.25       # Mia, who knows, takes it
DOCK = 28.9          # she arrives and claims it
REPLY_T = 29.3


def bubble_state(t):
    if t >= DOCK:
        return "claimed"
    if t >= 8.5:
        return "Asked 3 days ago"
    if t >= 7.25:
        return "Asked 1 day ago"
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
    if not 3.0 <= t < 33.4:
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
    if t >= REPLY_T:      # the reply slides out from where Mia arrived
        g = prog(t, REPLY_T, REPLY_T + 0.5, e_out_cubic) * a
        x = lerp(BX + 300, BX - 50, prog(t, REPLY_T, REPLY_T + 0.5, e_out_cubic))
        wcard(c, t, card_reply(t, show_name=not NAME_LIFT <= t < NAME_LAND), x, REPLY_Y, g * dimw, QSCALE)


def draw_road(c, t):
    """The line the question travels on, the route that snaps, and the lane where life goes on."""
    if not 3.0 <= t < 33.4:
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
        # the line from the question to each of them
        d = prog(t, SHOWN, SHOWN + 0.35, e_out_cubic)
        x0 = BX + 687 + 10
        p0, p1 = ws(x0, 470, t), ws(lerp(x0, CHAMP_X - 34, d), lerp(470, y, d), t)
        col = BLUE if (mia and t >= CHOSEN) else (90, 100, 130)
        draw_polyline(c, [p0, p1], 3.0 if mia and t >= CHOSEN else 2.0, col, g * (0.9 if mia else 0.6))
        if mia:
            # Mia rides the road to the question and claims it
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


# ---------------------------------------------------------------- the bridge: from the answer to the project

NAME_LIFT = 32.6
NAME_LAND = 33.6


def draw_name_bridge(c, t):
    if not NAME_LIFT <= t < NAME_LAND + 0.05:
        return
    p = prog(t, NAME_LIFT, NAME_LAND, e_io_quint)
    x0, b0 = reply_name_pos()
    x1 = max(STOP_X[3], 700.0) - text_width(REPLY_B, DSEMI, LABEL) / 2
    b1 = TRACK_Y - LABEL_DY
    x, base = lerp(x0, x1, p), lerp(b0, b1, p)
    size = lerp(40 * QSCALE, LABEL, p)
    z = cam(t)[2]
    sx, sy = ws(x, base, t)
    col = tuple(int(lerp(BLUE[k], WHITE[k], prog(t, NAME_LAND - 0.3, NAME_LAND))) for k in range(3))
    soft_word(c, REPLY_B, DSEMI if p > 0.5 else MED, LABEL, col, sx, sy, 1.0, 0.0, size / LABEL * z)


# ---------------------------------------------------------------- 2. the project

TRACK_Y = 1400.0
STOP_X = [300 + 264 * k for k in range(6)]
SNAP2_X = 1212.0
LABEL = 60
LABEL_DY = 150           # the name sits above the team
TEAM = ["MT", "JC", "SK"]
JOIN = [10.85, 11.0, 11.15]     # the team joins at Recruiting
PULSE_T = 33.8                  # Pulse's heartbeat runs along the track
FLAG = 34.8                     # it reaches the stalled project
NUDGE = 35.2                    # lines reach the people
BACK = (36.0, 36.6)             # they come back to it
TAKE = (37.4, 37.9)             # each takes one of the next steps
MOVE = (38.8, 40.6)             # it moves through them to Publishing
STEP_X = [1158.0, 1224.0, 1290.0]


def idea_x(t):
    if t < 10.85:
        x = lerp(STOP_X[0], STOP_X[2], prog(t, 10.2, 10.8, e_io_cubic))
    else:
        x = lerp(STOP_X[2], STOP_X[3], prog(t, 11.45, 12.0, e_out_cubic))
    return lerp(x, STOP_X[4], prog(t, *MOVE, e_lin))


def stalled(t):
    """0 = moving, 1 = stalled."""
    return prog(t, 12.1, 12.7) * (1 - prog(t, MOVE[0] - 0.2, MOVE[0]))


def team_pos(k, t):
    """Where each person is: on the project, drifted away from it, back on it, then on their step."""
    ix = idea_x(t)
    on = (ix - 64 + 64 * k, TRACK_Y - 92)
    away = (ix - 330 + 330 * k, TRACK_Y - 250 - 30 * (k == 1))
    drift = prog(t, 12.3, 13.4, e_io_cubic) * (1 - prog(t, *BACK, e_io_cubic))
    x = lerp(on[0], away[0], drift) + 6 * math.sin(1.3 * t + k) * drift
    y = lerp(on[1], away[1], drift) + 5 * math.cos(1.1 * t + 2 * k) * drift
    step = (STEP_X[k], TRACK_Y - 64)
    p = prog(t, TAKE[0] + 0.08 * k, TAKE[1] + 0.08 * k, e_io_cubic)
    return lerp(x, step[0], p), lerp(y, step[1], p)


def draw_track(c, t):
    if not 9.6 <= t < 43.0:
        return
    a = prog(t, 9.7, 10.2) * world_dim(t)
    ix = idea_x(t)
    healed = prog(t, MOVE[0] - 0.4, MOVE[0], e_out_cubic)
    end = SNAP2_X - 120 if t >= 12.0 else STOP_X[-1]
    end = lerp(end, STOP_X[-1], healed)
    wbar(c, t, (STOP_X[0] + end) / 2, TRACK_Y, end - STOP_X[0], 5, alpha=a, color=(52, 57, 72))
    if 10.2 <= t < 12.0:      # the planned route, lit ahead; it snaps at 12.0
        D = (STOP_X[-1] - ix) * e_out_expo(prog(t, 10.2, 10.6, e_lin))
        wbar(c, t, ix + D / 2, TRACK_Y, D, 7, alpha=a * 0.9)
    wbar(c, t, (STOP_X[0] + ix) / 2, TRACK_Y, ix - STOP_X[0], 7, alpha=a)
    cur = 4 if t >= MOVE[1] else 3 if t >= 11.7 else 2 if t >= 10.7 else 1 if t >= 10.45 else 0
    for k, x in enumerate(STOP_X):
        sx, sy = ws(x, TRACK_Y, t)
        z = cam(t)[2]
        if ix >= x - 1:
            draw_dot(c, sx, sy, 14 * z, BLUE, a)
        else:
            draw_dot(c, sx, sy, 14 * z, BG.tolist(), a)
            draw_dot(c, sx, sy, 14 * z, DIM, a, ring=3 * z)
        wtext(c, t, STAGES[k], MED, 40, WHITE if k == cur else DIM, x, TRACK_Y + 76, a)
    # the next steps, each taken by one person, ticked as the project passes
    sa = prog(t, TAKE[0] - 0.4, TAKE[0]) * (1 - prog(t, 41.2, 41.6)) * a
    for k, x in enumerate(STEP_X):
        sx, sy = ws(x, TRACK_Y, t)
        z = cam(t)[2]
        done = ix >= x
        draw_dot(c, sx, sy, 11 * z, BLUE if done else BG.tolist(), sa)
        if not done:
            draw_dot(c, sx, sy, 11 * z, WHITE, sa, ring=2.4 * z)
        else:
            glint(c, t, sx, sy, MOVE[0] + (x - STOP_X[3]) / (STOP_X[4] - STOP_X[3]) * (MOVE[1] - MOVE[0]), 0.5 * z)


def draw_idea(c, t):
    if not 9.9 <= t < 43.0:
        return
    a = prog(t, 9.9, 10.3) * world_dim(t)
    ix = idea_x(t)
    st = stalled(t)
    wbar(c, t, ix, TRACK_Y, 200, 22, alpha=a * (1 - 0.6 * st))
    if not NAME_LIFT <= t < NAME_LAND:
        close = prog(t, 36.9, 37.7, e_io_quint) * (1 - prog(t, 40.8, 41.6, e_io_quint))
        lx = lerp(max(ix, 700.0), 1224.0, close)
        wtext(c, t, REPLY_B, DSEMI, LABEL, WHITE, lx, TRACK_Y - LABEL_DY, a * (1 - 0.5 * st))
    # the stall, said once, large
    g = prog(t, 12.6, 13.0) * (1 - prog(t, MOVE[0], MOVE[0] + 0.3))
    wtext(c, t, "12 days inactive", MED, 48, DIM, STOP_X[3], TRACK_Y + 170, a * g)
    g2 = prog(t, MOVE[1] - 0.2, MOVE[1] + 0.2) * (1 - prog(t, 41.2, 41.6))
    wtext(c, t, "Moving again", MED, 48, BLUE, STOP_X[4], TRACK_Y + 170, a * g2)


def draw_team(c, t):
    if not JOIN[0] - 0.4 <= t < 41.6:
        return
    a = world_dim(t) * (1 - prog(t, 41.2, 41.6))
    for k, ini in enumerate(TEAM):
        j = prog(t, JOIN[k] - 0.4, JOIN[k], e_out_cubic)        # arriving from above to join the idea
        if j <= 0:
            continue
        x, y = team_pos(k, t)
        y = lerp(y - 520, y, j)
        drift = prog(t, 12.3, 13.4) * (1 - prog(t, *BACK))
        ring = 0.0
        if NUDGE + 0.4 <= t < NUDGE + 1.0:
            ring = prog(t, NUDGE + 0.4 + 0.08 * k, NUDGE + 0.9 + 0.08 * k)
        if TAKE[1] <= t < TAKE[1] + 0.6:
            ring = prog(t, TAKE[1] + 0.08 * k, TAKE[1] + 0.5 + 0.08 * k)
        r = lerp(30, 24, prog(t, TAKE[0], TAKE[1]))
        pin = prog(t, TAKE[1] + 0.05 * k, TAKE[1] + 0.3 + 0.05 * k) * (1 - prog(t, 41.2, 41.6))
        if pin > 0:
            p0, p1 = ws(STEP_X[k], y + r, t), ws(STEP_X[k], TRACK_Y - 12, t)
            draw_polyline(c, [p0, (p0[0], lerp(p0[1], p1[1], pin))], 2.4, (120, 150, 255), a * 0.8)
        wavatar(c, t, x, y, ini, r, a * j * (1 - 0.55 * drift), ring=ring)


def draw_pulse(c, t):
    """A heartbeat runs along the project's own track; it stops on the stalled project and flags it,
    then reaches out to the people who drifted away from it."""
    if not PULSE_T <= t < BACK[1] + 0.2:
        return
    ix = idea_x(t)
    head = lerp(STOP_X[0], ix, prog(t, PULSE_T, FLAG, e_io_cubic))
    blip = [(-28, 0), (-16, 8), (-6, -64), (6, 36), (16, -10), (26, 0)]
    if t < FLAG + 0.3:
        a = 1 - prog(t, FLAG, FLAG + 0.3)
        pts = [ws(head + du, TRACK_Y + dv, t) for du, dv in blip]
        draw_polyline(c, pts, 3.6, (150, 175, 255), a)
        sx, sy = ws(head, TRACK_Y, t)
        draw_dot(c, sx, sy, 22, (90, 120, 255), 0.35 * a, blur=10)
    # the flag
    f = prog(t, FLAG, FLAG + 0.5, e_out_cubic)
    if t >= FLAG:
        sx, sy = ws(ix, TRACK_Y, t)
        z = cam(t)[2]
        fade = 1 - prog(t, BACK[1] - 0.2, BACK[1] + 0.2)
        draw_dot(c, sx, sy, (60 + 70 * f) * z, BLUE, 0.6 * (1 - f) + 0.0, ring=3 * z)
        draw_dot(c, sx, sy, 118 * z, BLUE, 0.55 * fade * f, ring=2.4 * z)
        wtext(c, t, "Pulse", SEMI, 40, BLUE, ix + 130, TRACK_Y - 30, fade * f, "left")
    # reaching the people
    if t >= NUDGE:
        for k in range(3):
            d = prog(t, NUDGE + 0.08 * k, NUDGE + 0.4 + 0.08 * k, e_out_cubic)
            x, y = team_pos(k, t)
            fade = 1 - prog(t, BACK[1] - 0.2, BACK[1] + 0.2)
            p0 = ws(ix, TRACK_Y - 24, t)
            p1 = ws(lerp(ix, x, d), lerp(TRACK_Y - 24, y + 30, d), t)
            draw_polyline(c, [p0, p1], 2.6, BLUE, fade * 0.85)


# ---------------------------------------------------------------- 3. the company's activity, and the hours

N_FIELD = 60
N_UNITS = sum(h // 2 for h in HOURS)        # 47: one unit per two hours logged
STACK_IN = 42.9
BASE_Y = TRACK_Y
CHART = (3300.0, BASE_Y - 350)
COL_X = [CHART[0] - 270 + 180 * k for k in range(4)]
TRACK_REACH = 42.4


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


def unit_t0(i):
    """When unit i starts flying in; the months fill one after another."""
    k, j = _units()[i]
    return STACK_IN + 0.55 * k + 0.022 * j


def month_done(k):
    last = max(i for i in range(N_UNITS) if _units()[i][0] == k)
    return unit_t0(last) + 0.55


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
    if i >= N_UNITS:
        return (*st[:5], st[5] * (1 - prog(t, STACK_IN, STACK_IN + 0.6)))
    t0 = unit_t0(i)
    if t < t0:
        return st
    # the hours teams log, stacking on the chart's baseline month by month
    k, j = _units()[i]
    p = prog(t, t0, t0 + 0.55, e_io_cubic)
    slot = (COL_X[k], BASE_Y - 14 - 22 * j, 0.0, 120.0, 12.0)
    w = _loose(i, t0)
    cur = tuple(lerp(w[q], slot[q], p) for q in range(5))
    return (*cur, lerp(base_a, 1.0, p) * (1 - prog(t, 47.3, 47.7)))


def draw_pieces(c, t):
    if t >= 47.7:
        return
    for i in range(N_FIELD + 6):
        x, y, rz, L, T, a = piece_state(i, t)
        if a > 0.01:
            wbar(c, t, x, y, L, T, rz, a)
    if 22.45 <= t < DISPERSE[0] + 0.2:
        sx = lerp(960, 520, prog(t, *SPINE_ASIDE, e_io_cubic))
        d = e_out_expo(prog(t, 22.45, 22.7, e_lin))
        a = 1 - prog(t, DISPERSE[0] - 0.2, DISPERSE[0] + 0.2)
        draw_bar(c, sx, 140 + 400 * d, 800 * d + 1, 4, 90.0, a * 0.9, color=(140, 165, 255))


SNAPS = [(5.5, BX + 60, 1820, ROAD_Y), (12.0, SNAP2_X - 120, STOP_X[-1] + 60, TRACK_Y), (19.9, 2300, 2840, 1050)]


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
    """Activity reaches for the chart, and the line snaps before it arrives."""
    if 19.5 <= t < 19.9:
        D = (2840 - 2300) * e_out_expo(prog(t, 19.5, 19.8, e_lin))
        wbar(c, t, 2300 + D / 2, 1050, D, 6, alpha=world_dim(t))


def draw_track_on(c, t):
    """Once the project is moving again its line carries on, and becomes the chart's baseline."""
    if not MOVE[1] <= t < 47.7:
        return
    head = lerp(STOP_X[-1], CHART[0] + 430, prog(t, 40.9, TRACK_REACH, e_io_cubic))
    wbar(c, t, (STOP_X[-1] + head) / 2, TRACK_Y, head - STOP_X[-1], 7, alpha=1 - prog(t, 47.3, 47.7))
    if t < TRACK_REACH:
        sx, sy = ws(head, TRACK_Y, t)
        draw_dot(c, sx, sy, 6, (220, 228, 255))


def hours_shown(t):
    """The month most recently filled, and its hours."""
    k = max([m for m in range(4) if t >= month_done(m)], default=-1)
    return k


def card_chart(t):
    p = Pen(860, 900)
    p.text(44, 70, "Hours saved, logged by teams", 38, DIM, MED)
    k = hours_shown(t)
    if k >= 0:
        g = prog(t, month_done(k), month_done(k) + 0.25, e_out_cubic)
        big = 170 + 20 * (k == 3)
        p.text(40, 250, str(HOURS[k]), big, BLUE, DSEMI, alpha=g)
        p.text(52 + text_width(str(HOURS[k]), DSEMI, big), 188, "hours saved", 50, WHITE, MED, alpha=g)
        p.text(52 + text_width(str(HOURS[k]), DSEMI, big), 246, "in " + MONTH_NAMES[k], 50, DIM, alpha=g)
    return p.done()


def draw_chart(c, t):
    if not 15.6 <= t < 47.7:
        return
    a = prog(t, 15.7, 16.2) * world_dim(t) * (1 - prog(t, 47.3, 47.7))
    wcard(c, t, card_chart(t), CHART[0], CHART[1], a)
    sx0, sy = ws(CHART[0] - 360, BASE_Y + 6, t)
    sx1, _ = ws(CHART[0] + 360, BASE_Y + 6, t)
    z = cam(t)[2]
    if t < TRACK_REACH:
        x = sx0
        while x < sx1:
            draw_bar(c, x + 7 * z, sy, 12 * z, 3 * z, alpha=a * 0.8, color=(70, 75, 92))
            x += 24 * z
        g = prog(t, 16.3, 16.7) * (1 - prog(t, 21.0, 21.4))
        wtext(c, t, "No data yet", MED, 84, DIM, CHART[0], BASE_Y - 230, a * g)
    for k in range(4):
        lit = t >= month_done(k)
        wtext(c, t, MONTHS[k], MED, 40, WHITE if lit and hours_shown(t) == k else DIM, COL_X[k], BASE_Y + 70, a)


# ---------------------------------------------------------------- the end: knowledge, action, impact become the mark

ENDS = [47.5, 48.8, 50.1]       # each object is shown large, then condenses into its bar
LANDS = [48.8, 50.1, 51.4]
CONDENSE = 0.45
LABELS = ["Questions", "Ideas", "Impact"]


def logo_slot(k):
    x0, x1, yc = LOGO[k]
    return (x0 + x1) / 2, yc, x1 - x0, 40.0


def draw_end(c, t):
    if t < ENDS[0]:
        return
    for k in range(3):
        t0, land = ENDS[k], LANDS[k]
        cx, cy, L, T = logo_slot(k)
        q = prog(t, land - CONDENSE, land, e_io_quint)        # 0 = the object, 1 = its bar in the mark
        g = prog(t, t0, t0 + 0.25, e_out_cubic) * (1 - prog(t, land - CONDENSE, land - CONDENSE * 0.4))
        if t < land and g > 0:       # the object, large; it fades as its bar pulls away
            if k == 0:
                place(c, card_question(t, claimed=True), 960, 600, 1.05, g)
            elif k == 1:
                lab = REPLY_B
                soft_word(c, lab, DSEMI, 76, WHITE, 960 - text_width(lab, DSEMI, 76) / 2, 600, g)
                for qq, ini in enumerate(TEAM):
                    draw_dot(c, 960 - 70 + 70 * qq, 760, 28, (40, 54, 100), g)
                    soft_word(c, ini, SEMI, 19, WHITE, 960 - 70 + 70 * qq - text_width(ini, SEMI, 19) / 2, 767, g)
            else:
                w42 = text_width("42", DSEMI, 240)
                soft_word(c, "42", DSEMI, 240, BLUE, 960 - w42 / 2 - 170, 700, g)
                soft_word(c, "hours saved", MED, 60, WHITE, 960 + w42 / 2 - 140, 620, g)
                soft_word(c, "in October", REG, 60, DIM, 960 + w42 / 2 - 140, 692, g)
        if t >= t0 and t < land:     # its bar: under the object, then flying to the mark
            src = [(960, 760, 1100, 18), (960, 690, 420, 26), (960, 760, 700, 18)][k]
            appear = prog(t, t0 + 0.1, t0 + 0.4, e_out_cubic)
            x, y = lerp(src[0], cx, q), lerp(src[1], cy, q)
            Lb, Tb = lerp(src[2] * (appear if k != 1 else 1), L, q), lerp(src[3], T, q)
            draw_bar(c, x, y, max(Lb, Tb), Tb, alpha=(appear if k != 1 else prog(t, t0, t0 + 0.25)))
        if t >= land:
            draw_bar(c, cx, cy, L, T)
            glint(c, t, cx, cy, land, 0.8)
            la = prog(t, land - 0.1, land + 0.3) * (1 - prog(t, 53.1, 53.5))
            soft_word(c, LABELS[k], MED, 40, DIM, LOGO[k][0] - 40 - text_width(LABELS[k], MED, 40), cy + 14, la)
    for k in range(3):      # light passes once along the finished mark
        ts = 51.65 + 0.12 * k
        u = prog(t, ts, ts + 0.5, e_io_cubic)
        if 0 < u < 1:
            x0, x1, yc = LOGO[k]
            draw_dot(c, lerp(x0, x1, u), yc, 34, (190, 205, 255), 0.35 * math.sin(math.pi * u), blur=16)


# ---------------------------------------------------------------- shake and punch (only on real hits)

IMPACTS = [(5.5, 0.45), (12.0, 0.45), (19.9, 0.3), (22.5, 1.4), (DOCK, 0.3), (FLAG, 0.25), (LANDS[-1], 0.9)]


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

def render_scene(t_film):
    t = t_film + SHIFT
    n = int(round(t * FPS * 4))
    flash = 0.28 * prog(t, 22.47, 22.5, e_lin) * (1 - prog(t, 22.5, 22.9, e_out_cubic))
    c = background(t, n, flash)
    end_fade = prog(t, 56.8, 57.6)

    draw_chart(c, t)
    draw_pieces(c, t)
    draw_road(c, t)
    draw_link(c, t)
    draw_track(c, t)
    draw_track_on(c, t)
    draw_idea(c, t)
    draw_team(c, t)
    draw_pulse(c, t)
    draw_question(c, t)
    draw_champions(c, t)
    draw_name_bridge(c, t)

    headline(c, t, "Questions go unanswered.", 6.0, 9.2)
    headline(c, t, "Ideas lose momentum.", 12.6, 15.1)
    headline(c, t, "Impact goes unseen.", 16.4, 20.8)
    line_words(c, t, "Your AI needs", LIGHT, 104, WHITE, W / 2, 500, 21.0, 22.4, "center")
    line_words(c, t, "a spine.", DREG, 104, BLUE, W / 2, 620, 21.5, 22.4, "center")
    line_words(c, t, "Spine is your", LIGHT, 92, WHITE, 720, 500, 23.5, 26.25, "left")
    line_words(c, t, "AI project manager.", DREG, 92, BLUE, 720, 616, 23.85, 26.25, "left")
    headline(c, t, "Every question finds someone who knows.", 27.5, 32.4, size=76)
    headline(c, t, "Pulse spots work going quiet.", PULSE_T, 35.9, size=76)
    headline(c, t, "And nudges the right people.", 36.1, 38.3, size=76)
    headline(c, t, "Work starts moving again.", 38.5, 40.9, size=76)
    headline(c, t, "Impact everyone can see.", 43.0, 47.3, size=76)
    line_words(c, t, "Illustrative data", REG, 24, DIM, W - 60, H - 48, 42.9, 47.3, "right", step=0.0, dur=0.4)
    headline(c, t, "Knowledge becomes action.", 47.6, 50.0, size=76)
    headline(c, t, "Action becomes impact.", 50.1, 51.3, size=76)

    draw_end(c, t)
    w0 = 51.8
    g = prog(t, w0, w0 + 0.5, e_out_cubic)
    soft_word(c, "Spine", DSEMI, 172, WHITE, 886, 527, g)   # the approved wordmark's size and position
    line_words(c, t, "Give your company’s AI a spine.", LIGHT, 56, WHITE, W / 2, 712, 52.8, None, "center")
    c = post(c, t)
    if end_fade > 0:
        c = c + (_bg_base() - c) * end_fade
    return c


def end_card(t, plate=None):
    return render_scene(t)
