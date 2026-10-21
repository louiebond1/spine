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
# One continuous world, seen through one camera. Three problems are shown, not told:
#   Questions go unanswered   Ben's question is sent along a line, the route ahead snaps, and it is
#                             left stranded while everything else keeps moving past.
#   Ideas lose momentum       Contract Clause Checker travels the six stages, the track ahead snaps
#                             at Building, and it stalls in silence.
#   Impact goes unseen        the Hours saved card, large and empty, then the camera pulls back:
#                             the company's activity drifts about and none of it reaches the chart.
# "Your AI needs a spine.": a spine draws down the frame and every loose piece snaps into line on it,
# then steps aside so "Spine is your AI project manager." can be read.
# The same three objects are then resolved in the same order. Mia, who is building Contract Clause
# Checker, answers Ben's question; the project's name lifts out of her reply and carries the camera
# down to the stalled project, which Pulse catches and the team picks up again. The activity streams
# into the same chart: 42 hours. The camera pulls back to the same wide view, now connected, and the
# three resolved bars (the answered question, the moving project, the hours) lift out of their scenes
# and become the Spine logo.

TOTAL = 1725                 # 57.5 s
END_PLATE = TOTAL + 1
HANDOFF = END_PLATE
HOURS = [6, 16, 30, 42]
MONTHS = ["Jul", "Aug", "Sep", "Oct"]

# The approved logo geometry (end card): bars (x0, x1, centre y), and its centre.
LOGO = [(736.0, 831.0, 397.5), (708.0, 835.0, 469.5), (700.0, 779.0, 541.5)]
LOGO_C = (767.5, 469.5)


def kick_env(t):
    # matches kick_on() in score.py
    if not kick_on(t):
        return 0.0
    return math.exp(-(t % BEAT) / 0.11)


def kick_on(t):
    return (2.0 <= t < 12.0) or (15.5 <= t < 21.0) or (27.5 <= t < 48.5) or (51.5 <= t < 56.0)


# ---------------------------------------------------------------- camera

CAM = [  # (time, (centre x, centre y, zoom)) in world pixels; held between equal keys
    (0.0, (960, 560, 0.60)), (3.7, (960, 560, 0.64)), (4.4, (960, 540, 1.0)),
    (9.4, (960, 540, 1.0)), (10.3, (960, 1400, 1.0)),
    (15.3, (960, 1400, 1.0)), (16.2, (2900, 1120, 0.85)),          # the empty chart, close
    (18.3, (2900, 1120, 0.85)), (19.6, (1400, 900, 0.43)),          # and where it sits
    (26.4, (1400, 900, 0.43)), (27.3, (1060, 560, 1.0)),
    (32.7, (1060, 560, 1.0)), (33.6, (960, 1400, 1.0)),
    (42.9, (960, 1400, 1.0)), (44.0, (2900, 1120, 0.8)),
    (48.9, (2900, 1120, 0.8)), (50.2, (1400, 900, 0.43)),           # the same wide view, now connected
    (60.0, (1400, 900, 0.43)),
]


def cam(t):
    for (ta, a), (tb, b) in zip(CAM, CAM[1:]):
        if ta <= t <= tb:
            p = prog(t, ta, tb, e_io_quint)
            return tuple(lerp(a[k], b[k], p) for k in range(3))
    return CAM[-1][1]


def ws(x, y, t):
    """World to screen."""
    cx, cy, z = cam(t)
    return (x - cx) * z + W / 2, (y - cy) * z + H / 2


def sw(x, y, t):
    """Screen to world."""
    cx, cy, z = cam(t)
    return (x - W / 2) / z + cx, (y - H / 2) / z + cy


def wbar(c, t, x, y, L, T, rz=0.0, alpha=1.0, rl=1.0, rr=1.0, color=None):
    sx, sy = ws(x, y, t)
    z = cam(t)[2]
    if -400 < sx < W + 400 and -200 < sy < H + 200:
        draw_bar(c, sx, sy, max(L * z, T * z), max(T * z, 1.2), rz, alpha, rl, rr, color)


def wtext(c, t, text, fname, size, color, x, base, g, align="center"):
    """Type placed in the world (scales with the camera)."""
    z = cam(t)[2]
    sx, sy = ws(x, base, t)
    w = text_width(text, fname, size) * z
    x0 = sx - (w / 2 if align == "center" else 0 if align == "left" else w)
    soft_word(c, text, fname, size, color, x0, sy, g, 0.0, z)


def wcard(c, t, img, x, y, alpha=1.0, scale=1.0):
    sx, sy = ws(x, y, t)
    place(c, img, sx, sy, cam(t)[2] * scale, alpha)


def headline(c, t, text, t_in, t_out, y=190, size=80, color=WHITE, fname=None):
    line_words(c, t, text, fname or LIGHT, size, color, W / 2, y, t_in, t_out, "center")


# ---------------------------------------------------------------- the end: everything converges

CONVERGE = 50.4          # the three resolved bars lift out of the world
LANDS = [51.0, 51.2, 51.4]


def world_out(t):
    """The world fades as its three bars leave it for the logo."""
    return 1 - prog(t, CONVERGE, CONVERGE + 0.6)


# ---------------------------------------------------------------- 1. the question

BX0, BX = 700.0, 1060.0          # the question's start and where it is stranded (world x)
BY, ROAD_Y, LANE_Y = 450.0, 640.0, 770.0
DOCK = 28.6                      # someone who knows arrives
REPLY_Y = 805.0
ASK = "Has anyone automated contract reviews before?"
REPLY_A, REPLY_B = "Yes, I’m building one: ", "Contract Clause Checker"


def bubble_x(t):
    return lerp(BX0, BX, prog(t, 4.6, 5.65, e_out_cubic))


def bubble_state(t):
    if t >= DOCK:
        return "claimed"
    if t >= 8.5:
        return "Asked 3 days ago"
    if t >= 7.25:
        return "Asked 1 day ago"
    return "Asked 2 hours ago"


def card_question(t):
    p = Pen(1100, 236)
    p.circle(64, 66, 28, fill=(38, 41, 50))
    p.text(64, 75, "BC", 20, DIM, SEMI, anchor="ms")
    p.text(110, 76, "Ben Carter  ·  Legal", 28, DIM)
    p.text(40, 154, ASK, 46, WHITE, DSEMI)
    st = bubble_state(t)
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
    """World position (left, baseline) of the project name inside Mia's reply."""
    return BX - 50 - 530 + 108 + text_width(REPLY_A, REG, 40), REPLY_Y - 62 + 76


def draw_question(c, t):
    if t < 4.0:
        return
    a = prog(t, 4.05, 4.35) * world_out(t)
    dimw = world_dim(t)
    bx = bubble_x(t)
    wcard(c, t, card_question(t), bx, BY, a * dimw)
    # the question's own segment rides beneath it; at the dock it is joined by the answer's
    if t < DOCK:
        wbar(c, t, bx - 110, ROAD_Y, 220, 18, alpha=a * dimw, rr=0.0 if t > DOCK - 0.6 else 1.0)
    elif t < CONVERGE:
        wbar(c, t, BX, ROAD_Y, 440, 18, alpha=dimw)
        glint_w(c, t, BX, ROAD_Y, DOCK)
    if t >= DOCK + 0.4:      # the answer stays where it was given
        g = prog(t, DOCK + 0.4, DOCK + 0.8, e_out_cubic) * world_out(t)
        wcard(c, t, card_reply(t, show_name=not NAME_LIFT <= t < NAME_LAND), BX - 50, REPLY_Y + 30 * (1 - g), g * dimw)


def draw_road(c, t):
    """The line the question travels on, the route that snaps, and the lane where life goes on."""
    if t < 4.0:
        return
    a = prog(t, 4.0, 4.4) * world_out(t) * world_dim(t)
    wbar(c, t, -600 + (BX - 160 + 600) / 2, ROAD_Y, BX - 160 + 600, 4, alpha=a, color=(52, 57, 72))
    # the route ahead, drawn as the question is sent; it snaps at 5.5
    if 4.6 <= t < 5.5:
        D = (1820 - (BX + 60)) * e_out_expo(prog(t, 4.6, 5.0, e_lin))
        wbar(c, t, BX + 60 + D / 2, ROAD_Y, D, 6, alpha=a)
    # the lane below, where everything else keeps moving
    if t < 10.5:
        la = a * (1 - prog(t, 9.6, 10.2))
        wbar(c, t, 600, LANE_Y, 2600, 3, alpha=la * 0.6, color=(44, 48, 60))
        for k in range(7):
            x = (-700 + 380 * (t - 4.0) + 390 * k) % 2700 - 700
            wbar(c, t, x, LANE_Y, 90, 8, alpha=la * 0.55)
    # someone who knows: a route draws in from the right and Mia arrives on it
    if DOCK - 1.1 <= t < DOCK + 0.1:
        D = 1000 * e_out_expo(prog(t, DOCK - 1.1, DOCK - 0.7, e_lin))
        wbar(c, t, BX + 1220 - D / 2, ROAD_Y, D, 6, alpha=1 - prog(t, DOCK - 0.05, DOCK + 0.1))
        p = prog(t, DOCK - 0.7, DOCK, e_in_cubic)
        ax = lerp(BX + 1300, BX + 110, p)
        wbar(c, t, ax, ROAD_Y, 220, 18, rl=0.0)
        sx, sy = ws(ax - 60, ROAD_Y + 80, t)
        draw_dot(c, sx, sy, 30, (38, 41, 50))
        soft_word(c, "MT", SEMI, 20, DIM, sx - text_width("MT", SEMI, 20) / 2, sy + 7, 1.0)
        soft_word(c, "Mia Thompson", MED, 34, WHITE, sx + 46, sy + 12, prog(t, DOCK - 0.7, DOCK - 0.4))


# ---------------------------------------------------------------- the bridge: from the answer to the project

NAME_LIFT = 32.6          # the project name lifts out of Mia's reply...
NAME_LAND = 33.6          # ...and lands as the label on the stalled project


def draw_name_bridge(c, t):
    if not NAME_LIFT <= t < NAME_LAND + 0.05:
        return
    p = prog(t, NAME_LIFT, NAME_LAND, e_io_quint)
    x0, b0 = reply_name_pos()
    x1 = STOP_X[3] - text_width(REPLY_B, DSEMI, 44) / 2
    b1 = TRACK_Y - 64
    x, base = lerp(x0, x1, p), lerp(b0, b1, p)
    size = lerp(40, 44, p)
    z = cam(t)[2]
    sx, sy = ws(x, base, t)
    col = tuple(int(lerp(BLUE[k], WHITE[k], prog(t, NAME_LAND - 0.3, NAME_LAND))) for k in range(3))
    soft_word(c, REPLY_B, DSEMI if p > 0.5 else MED, 44, col, sx, sy, 1.0, 0.0, size / 44 * z)


# ---------------------------------------------------------------- 2. the idea

TRACK_Y = 1400.0
STOP_X = [300 + 264 * k for k in range(6)]
SNAP2_X = 1212.0
PULSE_T = 33.8          # Pulse's heartbeat starts across
TEAM_DOCK = 36.9
PLAN_T, PLAN_TICK = 38.9, 40.6
MOVE = (41.8, 42.6)     # the project moves on to Publishing


def idea_x(t):
    x = lerp(STOP_X[0], STOP_X[3], prog(t, 10.2, 12.0, e_out_cubic))
    return lerp(x, STOP_X[4], prog(t, *MOVE, e_io_cubic))


def idea_alive(t):
    """1 = moving, lower = stalled and dimmed."""
    return 1 - 0.55 * prog(t, 12.1, 12.8) * (1 - prog(t, PULSE_T + 0.7, PULSE_T + 1.1))


def draw_track(c, t):
    if t < 9.6:
        return
    a = prog(t, 9.7, 10.2) * world_out(t) * world_dim(t)
    ix = idea_x(t)
    healed = prog(t, MOVE[0] - 0.3, MOVE[0], e_out_cubic)        # the route ahead redraws when it moves again
    end = SNAP2_X - 120 if t >= 12.0 else STOP_X[-1]
    end = lerp(end, STOP_X[-1], healed)
    wbar(c, t, (STOP_X[0] + end) / 2, TRACK_Y, end - STOP_X[0], 4, alpha=a, color=(52, 57, 72))
    if 10.2 <= t < 12.0:      # the planned route, lit ahead of the idea; it snaps at 12.0
        D = (STOP_X[-1] - ix) * e_out_expo(prog(t, 10.2, 10.6, e_lin))
        wbar(c, t, ix + D / 2, TRACK_Y, D, 6, alpha=a * 0.9)
    wbar(c, t, (STOP_X[0] + ix) / 2, TRACK_Y, ix - STOP_X[0], 6, alpha=a)
    cur = 4 if t >= MOVE[1] - 0.4 else 3 if t >= 11.4 else 2 if t >= 11.0 else 1 if t >= 10.6 else 0
    for k, x in enumerate(STOP_X):
        sx, sy = ws(x, TRACK_Y, t)
        z = cam(t)[2]
        passed = ix >= x - 1
        if passed:
            draw_dot(c, sx, sy, 12 * z, BLUE, a)
        else:
            draw_dot(c, sx, sy, 12 * z, BG.tolist(), a)
            draw_dot(c, sx, sy, 12 * z, DIM, a, ring=2.6 * z)
        wtext(c, t, STAGES[k], MED, 34, WHITE if k == cur else DIM, x, TRACK_Y + 70, a)


def draw_idea(c, t):
    if t < 9.9:
        return
    a = prog(t, 9.9, 10.3) * world_dim(t)
    ix = idea_x(t)
    alive = idea_alive(t)
    joined = t >= TEAM_DOCK
    if t < CONVERGE:
        if not joined:
            wbar(c, t, ix, TRACK_Y, 200, 18, alpha=a * alive, rl=0.0 if t > TEAM_DOCK - 0.5 else 1.0)
        else:
            wbar(c, t, ix - 100, TRACK_Y, 400, 18, alpha=a)
            glint_w(c, t, ix - 100, TRACK_Y, TEAM_DOCK)
    # the label: hidden while the name is travelling down from Mia's reply
    if not NAME_LIFT <= t < NAME_LAND:
        la = a * (0.45 + 0.55 * alive if not joined else 1.0) * world_out(t)
        wtext(c, t, REPLY_B, DSEMI, 44, WHITE, ix - (100 if joined else 0), TRACK_Y - 64, la)
    g = prog(t, 12.6, 13.1) * (1 - prog(t, TEAM_DOCK - 0.3, TEAM_DOCK + 0.1))
    wtext(c, t, "No activity for 12 days", REG, 34, DIM, STOP_X[3], TRACK_Y + 150, a * g)


TEAM = ["MT", "JC", "SK"]


def draw_team(c, t):
    """The people Spine nudges: they arrive on the second segment and lock onto the project."""
    if not TEAM_DOCK - 1.9 <= t < CONVERGE + 0.6:
        return
    p = prog(t, TEAM_DOCK - 0.7, TEAM_DOCK, e_in_cubic)
    x = lerp(-400, idea_x(t) - 200, p)
    if t < TEAM_DOCK:
        wbar(c, t, x, TRACK_Y, 200, 18, rr=0.0)
    for k, ini in enumerate(TEAM):
        ax = x - 60 + 60 * k
        sx, sy = ws(ax, TRACK_Y - 140, t)
        z = cam(t)[2]
        g = prog(t, TEAM_DOCK - 0.7, TEAM_DOCK - 0.4) * world_out(t)
        draw_dot(c, sx, sy, 24 * z, (40, 54, 100), g)
        soft_word(c, ini, SEMI, 17, WHITE, sx - text_width(ini, SEMI, 17) * z / 2, sy + 6 * z, g, 0.0, z)
        ping = prog(t, TEAM_DOCK + 0.1 + 0.1 * k, TEAM_DOCK + 0.7 + 0.1 * k, e_out_cubic)
        if 0 < ping < 1:
            draw_dot(c, sx, sy, (24 + 26 * ping) * z, BLUE, 0.5 * (1 - ping) * g, ring=2 * z)


PLAN = [("Test with real contracts", "MT", "9 Oct"), ("Fix missed clause types", "JC", "13 Oct"),
        ("Write the user guide", "SK", "15 Oct"), ("Prepare for publishing", "MT", "16 Oct")]


def draw_plan(c, t):
    if not PLAN_T - 0.1 <= t < MOVE[1] + 0.5:
        return
    fade = 1 - prog(t, MOVE[1] + 0.1, MOVE[1] + 0.5)
    for k, (step, who, d) in enumerate(PLAN):
        y = 1585 + 62 * k
        g = prog(t, PLAN_T + 0.12 * k, PLAN_T + 0.12 * k + 0.35, e_out_cubic) * fade
        if g <= 0:
            continue
        done = prog(t, PLAN_TICK + 0.3 * k, PLAN_TICK + 0.3 * k + 0.12)
        sx, sy = ws(470, y, t)
        z = cam(t)[2]
        draw_dot(c, sx, sy - 12 * z, 14 * z, BLUE, g * done)
        draw_dot(c, sx, sy - 12 * z, 14 * z, DIM, g * (1 - done), ring=2.2 * z)
        wtext(c, t, step, REG, 38, WHITE if done < 1 else DIM, 510, y, g, "left")
        sx2, sy2 = ws(1240, y - 12, t)
        draw_dot(c, sx2, sy2, 22 * z, (38, 41, 50), g)
        soft_word(c, who, SEMI, 16, DIM, sx2 - text_width(who, SEMI, 16) * z / 2, sy2 + 6 * z, g, 0.0, z)
        wtext(c, t, d, REG, 34, DIM, 1290, y, g, "left")


def draw_heartbeat(c, t):
    """Pulse: a line runs across above the stalled project and beats when it reaches it."""
    if not PULSE_T <= t < MOVE[1] + 0.5:
        return
    alpha = (1 - prog(t, MOVE[1], MOVE[1] + 0.4)) * prog(t, PULSE_T, PULSE_T + 0.2)
    y = TRACK_Y - 220
    x0, x1 = 160, 1760
    head = lerp(x0, x1, prog(t, PULSE_T + 0.1, PULSE_T + 1.4, e_lin))
    bx = STOP_X[3]
    blip = [(-30, 0), (-18, 6), (-8, -60), (4, 34), (14, -10), (24, 0)]
    pts = [(x0, y)]
    for du, dv in blip:
        if bx + du <= head:
            pts.append((bx + du, y + dv))
    pts.append((head, y))
    z = cam(t)[2]
    draw_polyline(c, [ws(px, py, t) for px, py in pts], 3.0 * z, (120, 150, 255), alpha)
    if t < PULSE_T + 1.4:
        sx, sy = ws(head, y, t)
        draw_dot(c, sx, sy, 5 * z, (220, 228, 255), alpha)
    hit = pulse_hit()
    g = prog(t, hit, hit + 0.3) * alpha
    wtext(c, t, "Pulse", SEMI, 36, BLUE, bx + 60, y - 30, g, "left")


def pulse_hit():
    return PULSE_T + 0.1 + 1.3 * (STOP_X[3] - 160) / (1760 - 160)


# ---------------------------------------------------------------- 3. the company's activity

N_FIELD = 60
N_UNITS = sum(h // 2 for h in HOURS)        # 47: one unit per two hours saved
STACK_IN = 44.1                              # the activity streams into the chart
NUMBER_T = 46.2                              # 42 hours saved in October
FOLD = (48.4, 48.95)                         # the chart closes into one bar


@lru_cache(None)
def _field():
    rng = np.random.default_rng(11)
    out = []
    for i in range(N_FIELD):
        out.append(dict(hx=rng.uniform(-650, 3300), hy=rng.uniform(-250, 2350), ax=rng.uniform(40, 120),
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
def _spine_rows():
    """At the turn every loose piece takes a row on the spine, in the order it hangs in frame."""
    t = 22.2
    order = sorted(range(N_FIELD + 6), key=lambda i: _loose(i, t)[1])
    return {i: r for r, i in enumerate(order)}


CHART = (2900.0, 1120.0)
COL_X = [CHART[0] - 270 + 180 * k for k in range(4)]
BASE_Y = CHART[1] + 260


@lru_cache(None)
def _units():
    """Which column slot each of the first 47 pieces fills."""
    slots = []
    for k, h in enumerate(HOURS):
        for j in range(h // 2):
            slots.append((k, j))
    return slots


def _loose(i, t):
    """Where loose piece i is before the turn: the wandering activity, or one of the six snapped halves."""
    if i < N_FIELD:
        x, y, rz, L = wander(i, t)
        return x, y, rz, L, 12.0
    return debris(i - N_FIELD, t)


SPINE_ASIDE = (23.2, 23.8)       # the spine steps aside so the line beside it can be read
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
    # around the empty chart the drifting activity is the point of the shot
    return max(a, 0.5 * prog(t, 15.4, 16.2) * (1 - prog(t, 19.6, 20.4)))


def piece_state(i, t):
    """(x, y, rz, L, T, alpha) in world space."""
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
    # back out into the world (the snapped halves are not needed again)
    p = prog(t, *DISPERSE, e_io_cubic)
    if i >= N_FIELD:
        return (*tgt, 0.95 * (1 - p))
    w = _loose(i, t)
    st = (*(lerp(tgt[k], w[k], p) for k in range(5)), lerp(0.95, base_a, p))
    if t < STACK_IN or i >= N_UNITS:
        if i >= N_UNITS and t >= STACK_IN:
            return (*st[:5], st[5] * (1 - prog(t, STACK_IN, STACK_IN + 0.6)))
        return st
    # the activity streams into the chart, one unit per two hours saved
    k, j = _units()[i]
    t0 = STACK_IN + 0.03 * i
    p = prog(t, t0, t0 + 0.65, e_io_cubic)
    slot = (COL_X[k], BASE_Y - 14 - 22 * j, 0.0, 120.0, 12.0)
    w = _loose(i, min(t, t0))
    cur = tuple(lerp(w[q], slot[q], p) for q in range(5))
    a = lerp(base_a, 1.0, p)
    if t < FOLD[0]:
        return (*cur, a)
    q1 = prog(t, FOLD[0], FOLD[0] + 0.3, e_in_cubic)       # every column drops to the base line
    q2 = prog(t, FOLD[0] + 0.25, FOLD[1], e_io_cubic)      # and they slide together into one bar
    tx = CHART[0] - 220 + 440 * (i + 0.5) / N_UNITS
    y = lerp(cur[1], BASE_Y + 20, q1)
    x = lerp(cur[0], tx, q2)
    L = lerp(lerp(cur[3], 120, q1), 440 / N_UNITS + 2, q2)
    return (x, y, 0.0, L, lerp(12.0, 18.0, q2), 1.0)


def draw_pieces(c, t):
    if t < FOLD[1]:
        for i in range(N_FIELD + 6):
            x, y, rz, L, T, a = piece_state(i, t)
            if a > 0.01:
                wbar(c, t, x, y, L, T, rz, a)
    elif t < CONVERGE:          # the hours, now one bar under the chart
        wbar(c, t, CHART[0], BASE_Y + 20, 440, 18)
        glint_w(c, t, CHART[0], BASE_Y + 20, FOLD[1])
    if 22.45 <= t < DISPERSE[0] + 0.2:      # the spine itself
        sx = lerp(960, 520, prog(t, *SPINE_ASIDE, e_io_cubic))
        d = e_out_expo(prog(t, 22.45, 22.7, e_lin))
        a = 1 - prog(t, DISPERSE[0] - 0.2, DISPERSE[0] + 0.2)
        draw_bar(c, sx, 140 + 400 * d, 800 * d + 1, 4, 90.0, a * 0.9, color=(140, 165, 255))


# the three snapped routes: (time, left end, right end, y), each breaks into two halves
SNAPS = [(5.5, BX + 60, 1820, ROAD_Y), (12.0, SNAP2_X - 120, STOP_X[-1] + 60, TRACK_Y), (19.9, 2000, 2440, 1150)]


def debris(j, t):
    ts, xa, xb, y = SNAPS[j // 2]
    s = -1 if j % 2 == 0 else 1
    L = (xb - xa) / 2
    cx = xa + L / 2 if s < 0 else xb - L / 2
    u = max(0.0, t - ts)
    sp = 1 - math.exp(-u / 0.09) * math.cos(2 * math.pi * 3.0 * u)
    x = cx + s * 40 * sp + s * 6 * u
    yy = y + 28 * sp + 5 * u
    rz = -s * 9 * sp
    return x, yy, rz, L, 6.0


def debris_alpha(j, t):
    ts = SNAPS[j // 2][0]
    return 0.0 if t < ts else lerp(1.0, 0.55, prog(t, ts + 0.6, ts + 1.6))


def draw_link(c, t):
    """Impact: a line reaches from the activity towards the chart and snaps before it arrives."""
    if 19.5 <= t < 19.9:
        D = (2440 - 2000) * e_out_expo(prog(t, 19.5, 19.8, e_lin))
        wbar(c, t, 2000 + D / 2, 1150, D, 6, alpha=world_dim(t))


def card_chart(t):
    p = Pen(860, 660)
    g = prog(t, NUMBER_T, NUMBER_T + 0.4)
    p.text(40, 84, "Hours saved", 40, WHITE, DSEMI, alpha=1 - g)
    p.text(40, 96, "42", 72, BLUE, DSEMI, alpha=g)
    p.text(40 + text_width("42", DSEMI, 72) + 18, 92, "hours saved in October", 40, WHITE, alpha=g)
    return p.done()


def draw_chart(c, t):
    if t < 15.6:
        return
    a = prog(t, 15.7, 16.2) * world_out(t) * world_dim(t)
    wcard(c, t, card_chart(t), CHART[0], CHART[1], a)
    sx0, sy = ws(CHART[0] - 360, BASE_Y + 6, t)
    sx1, _ = ws(CHART[0] + 360, BASE_Y + 6, t)
    z = cam(t)[2]
    if t < STACK_IN:           # nothing has arrived: a flat dashed line at zero
        x = sx0
        while x < sx1:
            draw_bar(c, x + 7 * z, sy, 12 * z, 3 * z, alpha=a * 0.8, color=(70, 75, 92))
            x += 24 * z
        g = prog(t, 16.3, 16.7) * (1 - prog(t, 18.3, 18.8))
        wtext(c, t, "No data yet", MED, 52, DIM, CHART[0], CHART[1] + 40, a * g)
    for k in range(4):
        wtext(c, t, MONTHS[k], MED, 36, DIM, COL_X[k], BASE_Y + 64, a)


# ---------------------------------------------------------------- dimming, glints

def world_dim(t, field=False):
    """The world steps back while 'Your AI needs a spine.' is on screen."""
    d = prog(t, 21.0, 21.4) * (1 - prog(t, *DISPERSE))
    return 1 - (0.5 if field else 0.75) * d


def glint_w(c, t, x, y, t0):
    sx, sy = ws(x, y, t)
    glint(c, t, sx, sy, t0, 0.8 * cam(t)[2])


# ---------------------------------------------------------------- the payoff: three resolved bars become the logo

# where each resolved bar sits in the world: the answered question, the moving project, the hours
BARS = [(BX, ROAD_Y, 440.0), (STOP_X[4] - 100, TRACK_Y, 400.0), (CHART[0], BASE_Y + 20, 440.0)]
LABELS = ["Questions", "Ideas", "Impact"]


def draw_connections(c, t):
    """In the wide view the three resolved bars are joined up, where before the line to the chart snapped."""
    if not 49.5 <= t < CONVERGE + 0.4:
        return
    a = 1 - prog(t, CONVERGE, CONVERGE + 0.3)
    pts = [ws(BX + 220, ROAD_Y, t), ws(BX + 220, TRACK_Y - 250, t), ws(STOP_X[4] - 100, TRACK_Y - 250, t),
           ws(STOP_X[4] - 100, TRACK_Y - 9, t)]
    pts2 = [ws(STOP_X[4] + 100, TRACK_Y, t), ws(CHART[0] - 220, TRACK_Y, t), ws(CHART[0] - 220, BASE_Y + 20, t)]
    for k, path in enumerate((pts, pts2)):
        d = prog(t, 49.6 + 0.25 * k, 50.1 + 0.25 * k, e_io_cubic)
        if d <= 0:
            continue
        # draw the path up to fraction d of its length
        seg = [math.dist(path[q], path[q + 1]) for q in range(len(path) - 1)]
        left = sum(seg) * d
        out = [path[0]]
        for q, L in enumerate(seg):
            if left <= 0:
                break
            f = min(1.0, left / L)
            out.append((lerp(path[q][0], path[q + 1][0], f), lerp(path[q][1], path[q + 1][1], f)))
            left -= L
        draw_polyline(c, out, 2.4, (110, 140, 240), a * 0.9)


def draw_logo(c, t):
    """The three bars lift out of the world and lock into the Spine mark, one per beat."""
    if t < CONVERGE:
        return
    for k, (wx, wy, wl) in enumerate(BARS):
        land = LANDS[k]
        p = prog(t, CONVERGE + 0.1 * k, land, e_io_quint)
        sx, sy = ws(wx, wy, CONVERGE)
        z = cam(CONVERGE)[2]
        x0, x1, yc = LOGO[k]
        x, y = lerp(sx, (x0 + x1) / 2, p), lerp(sy, yc, p)
        L, T = lerp(wl * z, x1 - x0, p), lerp(18 * z, 40, p)
        draw_bar(c, x, y, L, T)
        if t >= land:
            glint(c, t, (x0 + x1) / 2, yc, land, 0.8)
        # each bar briefly says what it was
        la = prog(t, land - 0.3, land + 0.1) * (1 - prog(t, 52.6, 53.0))
        if la > 0:
            soft_word(c, LABELS[k], MED, 40, DIM, x0 - 40 - text_width(LABELS[k], MED, 40), yc + 14, la)
    # light passes once along the finished mark
    for k in range(3):
        ts = 51.75 + 0.12 * k
        u = prog(t, ts, ts + 0.5, e_io_cubic)
        if 0 < u < 1:
            x0, x1, yc = LOGO[k]
            draw_dot(c, lerp(x0, x1, u), yc, 34, (190, 205, 255), 0.35 * math.sin(math.pi * u), blur=16)


# ---------------------------------------------------------------- shake and punch (only on real hits)

IMPACTS = [(5.5, 0.45), (12.0, 0.45), (19.9, 0.3), (22.5, 1.4), (DOCK, 0.3), (TEAM_DOCK, 0.3), (LANDS[-1], 0.9)]


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

def render_scene(t):
    n = int(round(t * FPS * 4))
    flash = 0.28 * prog(t, 22.47, 22.5, e_lin) * (1 - prog(t, 22.5, 22.9, e_out_cubic))
    c = background(t, n, flash)
    end_fade = prog(t, 56.7, 57.5)

    # the world (the chart sits under the pieces that fill it)
    draw_chart(c, t)
    draw_pieces(c, t)
    draw_road(c, t)
    draw_link(c, t)
    draw_track(c, t)
    draw_idea(c, t)
    draw_team(c, t)
    draw_plan(c, t)
    draw_heartbeat(c, t)
    draw_question(c, t)
    draw_name_bridge(c, t)
    draw_connections(c, t)

    # the words: one line at a time, large
    line_words(c, t, "Your company has AI.", LIGHT, 96, WHITE, W / 2, 560, 0.25, 1.78, "center")
    line_words(c, t, "So why do your AI ideas", LIGHT, 96, WHITE, W / 2, 500, 2.0, 3.6, "center")
    line_words(c, t, "quietly die?", DREG, 96, BLUE, W / 2, 610, 2.75, 3.6, "center")
    headline(c, t, "Questions go unanswered.", 6.0, 9.2)
    headline(c, t, "Ideas lose momentum.", 12.6, 15.1)
    headline(c, t, "Impact goes unseen.", 16.4, 20.8)
    line_words(c, t, "Your AI needs", LIGHT, 104, WHITE, W / 2, 500, 21.0, 22.4, "center")
    line_words(c, t, "a spine.", DREG, 104, BLUE, W / 2, 620, 21.5, 22.4, "center")
    line_words(c, t, "Spine is your", LIGHT, 92, WHITE, 720, 500, 23.5, 26.25, "left")
    line_words(c, t, "AI project manager.", DREG, 92, BLUE, 720, 616, 23.85, 26.25, "left")
    headline(c, t, "Every question finds someone who knows.", 27.5, 32.4, size=76)
    headline(c, t, "Spine notices when work goes quiet.", PULSE_T, 36.0, size=76)
    headline(c, t, "And nudges the right people.", 36.2, 38.6, size=76)
    headline(c, t, "Every step has an owner.", 38.8, MOVE[1], size=76)
    headline(c, t, "Impact everyone can see.", 44.2, 48.3, size=76)

    # the end
    draw_logo(c, t)
    w0 = 51.6
    g = prog(t, w0, w0 + 0.5, e_out_cubic)
    soft_word(c, "Spine", DSEMI, 172, WHITE, 886, 527, g)   # the approved wordmark's size and position
    line_words(c, t, "Give your company’s AI a spine.", LIGHT, 56, WHITE, W / 2, 712, 52.6, None, "center")
    c = post(c, t)
    if end_fade > 0:
        c = c + (_bg_base() - c) * end_fade
    return c


def end_card(t, plate=None):
    return render_scene(t)
