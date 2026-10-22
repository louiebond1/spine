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
TOTAL = 1926                 # 64.2 s
END_PLATE = TOTAL + 1
HANDOFF = END_PLATE
HOURS = [6, 16, 30, 42]
MONTHS = ["Jul", "Aug", "Sep", "Oct"]
MONTH_NAMES = ["July", "August", "September", "October"]
LOGO = [(736.0, 831.0, 397.5), (708.0, 835.0, 469.5), (700.0, 779.0, 541.5)]
LOGO_C = (767.5, 469.5)


def kick_env(t):
    # matches kick_on() in score.py; t is film-clock story time (after warp, see below)
    if not kick_on(t):
        return 0.0
    return math.exp(-(t % BEAT) / 0.11)


def kick_on(t):
    return (2.0 <= t < 12.0) or (15.5 <= t < 21.0) or (27.5 <= t < 46.5) or (52.0 <= t < 58.7) or (64.5 <= t < 66.7)


# ---------------------------------------------------------------- time warp
#
# Almost every time in this file is "logic time": the moment as it was first laid out. The film clock
# ("story time" = film time + SHIFT) adds a held scene, the company's list of ideas, after Mia's answer,
# then plays the idea's journey on its card (logic 33.75 to 39.0) more slowly. Everything after that runs
# EXTRA seconds later on the film clock. warp() maps the film clock to logic time; unwarp() goes back, and
# audio.py uses it so every sound stays on its picture. score.py and render.py's BLUR are in film-clock time.

IDEAS_IN = 33.44                 # film clock: the world holds here while the list of ideas is on screen
CARD_SET = 36.3                  # film clock: the new idea has grown into its own card
SLOW = (33.75, 39.0)             # logic time played slower: propose, AI review, approval, joining
SLOW_END = 43.5                  # film clock: where that slower stretch ends
EXTRA = SLOW_END - SLOW[1]       # 4.5 s added to the film
SLOW_K = (SLOW_END - CARD_SET) / (SLOW[1] - SLOW[0])


def warp(tn):
    if tn < IDEAS_IN:
        return tn
    if tn < CARD_SET:
        return IDEAS_IN
    if tn < SLOW_END:
        return SLOW[0] + (tn - CARD_SET) / SLOW_K
    return tn - EXTRA


def unwarp(t):
    if t < IDEAS_IN:
        return t
    if t < SLOW[0]:
        return CARD_SET
    if t < SLOW[1]:
        return CARD_SET + (t - SLOW[0]) * SLOW_K
    return t + EXTRA


# ---------------------------------------------------------------- camera

SNAP1 = 5.5
BX = 1060.0                  # where the question is stranded (world x)
CARD_C = (960.0, 1460.0)     # Contract Clause Checker, the big card (world)

CAM = [  # (time, (centre x, centre y, zoom)) in world pixels; held between equal keys
    (5.5, (1060, 540, 1.0)),
    (9.4, (1060, 540, 1.0)), (10.3, (960, 1460, 1.02)),          # the waiting project, whole card under the line
    (15.3, (960, 1460, 1.02)), (16.2, (3300, 1001, 0.86)),       # the empty chart, whole card in frame
    (26.4, (3300, 1001, 0.86)), (27.3, (1250, 590, 1.0)),        # back to the stranded question
    (32.6, (1250, 590, 1.0)), (33.6, (960, 1460, 1.05)),         # the name carries the camera to its card
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
    if t >= AGES[4]:
        return "Asked 2 days ago"
    if t >= AGES[3]:
        return "Asked 1 day ago"
    if t >= AGES[2]:
        return "Asked 4 hours ago"
    if t >= AGES[1]:
        return "Asked 3 hours ago"
    return "Asked 2 hours ago"


AGES = [4.9, 5.6, 6.3, 7.0, 7.8]       # the question is posted, then ages a step at a time
TYPE = (3.75, 4.55)                    # Ben types it
SEND = 4.65                            # and sends it
COLLAPSE = 13.7                        # the stages after Recruiting break and fall


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
    (0.0, 0), (35.35, 1), (36.4, 2), (38.75, 3), (48.75, 4), (49.25, 5)]
CARD_IN = 33.45          # the card appears as the name arrives
CONTINUE = 34.35         # Mia presses Continue to AI review
REVIEW = (34.45, 35.1)   # the AI review reads the idea
SUBMIT = 35.2            # Mia presses Submit for approval
APPROVE = 35.75          # Alex, an admin, presses Approve
PROBLEM = "Contract reviews are slow and manual"
CRITERIA = ["Feasibility", "Business value", "Resourcing confidence", "Originality"]
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
    if not NAME_LIFT <= t < NAME_LAND:      # until then the name is still flying in
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
    if st == 0 and t < REVIEW[0]:      # proposing: the idea is written down
        n = int(len(PROBLEM) * prog(t, 33.8, 34.15))
        p.text(60, 270, "Problem", 30, DIM, MED, alpha=prog(t, 33.7, 33.9))
        p.text(60, 330, PROBLEM[:n], 46, WHITE)
        p.text(60, 418, "Who benefits", 30, DIM, MED, alpha=prog(t, 33.9, 34.1))
        p.text(60, 478, "Legal team"[:int(10 * prog(t, 34.1, 34.25))], 46, WHITE)
        _button(p, 840, 552, 1340, 636, "Continue to AI review", primary=True, size=36,
                alpha=prog(t, 34.1, 34.25))
    elif st == 0:    # the AI review reads it: four criteria, advisory, seen only by its owner
        p.text(60, 262, "AI review", 30, BLUE, SEMI)
        for k, name in enumerate(CRITERIA):
            x, y = 60 + 660 * (k % 2), 350 + 110 * (k // 2)
            lit = prog(t, REVIEW[0] + 0.12 + 0.13 * k, REVIEW[0] + 0.3 + 0.13 * k)
            p.circle(x + 12, y - 15, 9, fill=BLUE, alpha=lit)
            p.text(x + 40, y, name, 44, WHITE if lit > 0.5 else DIM)
        p.text(60, 612, "Advisory. Only Mia sees the scores.", 34, DIM, alpha=prog(t, REVIEW[1] - 0.1, REVIEW[1] + 0.1))
        _button(p, 900, 552, 1340, 636, "Submit for approval", primary=True, size=36,
                alpha=prog(t, REVIEW[1] - 0.05, REVIEW[1] + 0.1))
    elif st == 1:    # approval: a person in leadership decides
        done = prog(t, APPROVE, APPROVE + 0.3, e_out_cubic)
        p.text(60, 612, "Next: Waiting for leadership approval", 40, BLUE, MED, alpha=1 - done)
        _button(p, 760, 300, 1100, 390, "Approve", primary=True, size=40, alpha=1 - done)
        if done > 0:
            ck = prog(t, APPROVE, APPROVE + 0.3)
            a1, b1, c1 = (72, 350), (136, 414), (250, 270)
            u = min(1.0, ck / 0.4)
            p.line([a1, (lerp(a1[0], b1[0], u), lerp(a1[1], b1[1], u))], BLUE, 18)
            if ck > 0.4:
                v = (ck - 0.4) / 0.6
                p.line([b1, (lerp(b1[0], c1[0], v), lerp(b1[1], c1[1], v))], BLUE, 18)
            p.text(300, 384, "Approved", 96, WHITE, DSEMI, alpha=done)
            p.text(304, 456, "by Alex Morgan", 40, DIM, alpha=done)
    elif st == 2:      # recruiting: the count, the button anyone can press, and what it needs next
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
            g = prog(t, seat_move(k)[1] - 0.1, seat_move(k)[1] + 0.25, e_out_cubic)   # written once its owner lands
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
    quiet = prog(t, QUIET[0], QUIET[0] + 0.6) * (1 - prog(t, QUIET[1], QUIET[1] + 0.3))
    slack = prog(t, SLACK_IN, SLACK_IN + 0.4) * (1 - prog(t, *SLACK_FLY))
    return max(0.0, 1 - 0.72 * quiet - 0.55 * slack)


def draw_card(c, t):
    if not CARD_IN <= t < 51.0 or 42.1 <= t < 43.4:
        return
    a = prog(t, CARD_IN, CARD_IN + 0.3) * world_dim(t) * (1 - prog(t, 50.6, 51.0)) * card_dim(t)
    wcard(c, t, card_project(t), *CARD_C, a)
    # a light on each stage dot as the card moves on, and on each press
    for ts, k in STAGE_TIMES[1:4]:
        glint_w(c, t, CARD_X0 + 990 + 70 * k, CARD_Y0 + 74, ts)
    glint_w(c, t, CARD_X0 + 1090, CARD_Y0 + 594, CONTINUE)
    glint_w(c, t, CARD_X0 + 1120, CARD_Y0 + 594, SUBMIT)
    # a tick lands with each step done
    for k, (step, who, phrase, done_t) in enumerate(PLAN):
        glint_w(c, t, CARD_X0 + 84, CARD_Y0 + ROWS[k] - 18, done_t)
    # what the state means, said once, under the card
    y = CARD_Y0 + CARD_H + 92
    g = prog(t, QUIET[1], QUIET[1] + 0.3) * (1 - prog(t, 48.6, 48.9))
    wtext(c, t, "Moving again", MED, 52, BLUE, CARD_C[0], y, a * g)


def draw_approver(c, t):
    """Alex Morgan, an admin, arrives and presses Approve. The AI review never approves anything."""
    if not 35.35 <= t < APPROVE + 0.5:
        return
    bx, by = ws(CARD_X0 + 930, CARD_Y0 + 345, t)
    z = cam(t)[2]
    p1 = prog(t, 35.35, APPROVE - 0.12, e_out_cubic)
    p2 = prog(t, APPROVE - 0.12, APPROVE, e_io_cubic)
    X = lerp(lerp(W + 120, bx + 330 * z, p1), bx + 220 * z, p2)
    Y = lerp(lerp(by + 260 * z, by + 40 * z, p1), by + 30 * z, p2)
    g = prog(t, 35.35, 35.5) * (1 - prog(t, APPROVE + 0.3, APPROVE + 0.5))
    avatar_at(c, X, Y, "AM", 64 * z, g, ring=prog(t, APPROVE, APPROVE + 0.4) if t >= APPROVE else 0.0)
    soft_word(c, "Alex Morgan", MED, 44, WHITE, X - text_width("Alex Morgan", MED, 44) * z / 2, Y + 118 * z,
              g * (1 - prog(t, APPROVE - 0.05, APPROVE + 0.1)), 0.0, z)
    glint(c, t, bx, by, APPROVE, 0.9)


def draw_seats(c, t):
    """The team: Mia's seat and the empty ones; the people who join; each moving to their step."""
    if not STAGE_TIMES[2][0] <= t < PLAN_IN + 0.8:
        return
    a = prog(t, STAGE_TIMES[2][0], STAGE_TIMES[2][0] + 0.2)
    z = cam(t)[2]
    team = team_at(t)
    # each new seat links to the one before it: the team connecting
    for k in (1, 2):
        j = SEATS[k][2]
        if t >= j:
            pl = e_out_cubic(prog(t, j, j + 0.3))
            x0, y0 = ws(*seat_pos(k - 1), t)
            x1, y1 = ws(*seat_pos(k), t)
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
            X, Y = ws(lerp(sx, tx, q), lerp(sy, ty, q), t)
            pop = 1.0 if j is None else e_out_cubic(prog(t, j, j + 0.2))
            avatar_at(c, X, Y, SEATS[k][0], lerp(72, 36, q) * z * (0.85 + 0.15 * pop), a,
                      ring=prog(t, j, j + 0.6) if j and j <= t < j + 0.6 else 0.0)
            first = FIRST[SEATS[k][0]]
            na = a * pop * (1 - prog(t, m0, m0 + 0.15))
            soft_word(c, first, MED, 34, WHITE, X - text_width(first, MED, 34) * z / 2, Y + 118 * z, na, 0.0, z)
        elif t < PLAN_IN:
            avatar_at(c, *ws(sx, sy, t), "", 72 * z, a, dashed=True)
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


# ---------------------------------------------------------------- the bridge

NAME_LIFT = 32.6
NAME_LAND = 33.6


IDEAS = [  # the company's ideas and projects (seed data), and the new one: (title, line)
    ("Client Brief Generator", "Recruiting  ·  3 of 4 people"),
    ("Meeting Summary Bot", "Recruiting  ·  1 of 3 people"),
    ("AI Invoice Assistant", "Building"),
    ("Supplier Risk Checker", "Waiting for approval"),
    ("Claude Onboarding Guide", "Live"),
    (REPLY_B, "Idea  ·  Mia Thompson"),
]
IDEA_W, IDEA_H, IDEA_S = 600, 240, 0.92
IDEA_XY = [(360.0 + 600 * (i % 3), 430.0 + 290 * (i // 3)) for i in range(6)]
GROW = (35.6, CARD_SET)          # film clock: the new idea grows out of the list into its card


def idea_card(title, line, hi=0.0, empty=False):
    p = Pen(IDEA_W, IDEA_H)
    if empty:
        p.rrect(1, 1, IDEA_W - 2, IDEA_H - 2, 14, fill=(20, 21, 26), outline=(70, 75, 92), width=2)
        return p.done()
    if hi > 0:
        p.rrect(1, 1, IDEA_W - 2, IDEA_H - 2, 14, outline=BLUE, width=3, alpha=hi)
    p.text(36, 96, title, 44, WHITE, SEMI)
    p.text(36, 168, line, 34, BLUE if title == REPLY_B else DIM)
    return p.done()


def idea_title_xy():
    x, y = IDEA_XY[5]
    return x - IDEA_W * IDEA_S / 2 + 36 * IDEA_S, y - IDEA_H * IDEA_S / 2 + 96 * IDEA_S


def draw_ideas(c, tn):
    """Ideas & Projects: every idea in one place. Mia's lands as the newest, then grows into its own card."""
    if not 32.9 <= tn < CARD_SET:
        return
    out = prog(tn, GROW[0], GROW[0] + 0.35)
    look = prog(tn, 34.4, 34.8)          # the others step back once hers is in
    for i, (title, line) in enumerate(IDEAS[:5]):
        a = prog(tn, 32.95 + 0.08 * i, 33.3 + 0.08 * i, e_out_cubic) * (1 - 0.4 * look) * (1 - out)
        x, y = IDEA_XY[i]
        place(c, idea_card(title, line), x, y + 24 * (1 - a), IDEA_S, a)
    x, y = IDEA_XY[5]
    a = prog(tn, 33.35, 33.6, e_out_cubic)
    g = prog(tn, *GROW, e_io_quint)
    if tn < NAME_LAND:
        place(c, idea_card("", "", empty=True), x, y, IDEA_S, a)
        return
    cx, cy = ws(*CARD_C, SLOW[0])
    s0, s1 = IDEA_S * IDEA_W / CARD_W, cam(SLOW[0])[2]
    X, Y, s = lerp(x, cx, g), lerp(y, cy, g), lerp(s0, s1, g)
    hi = prog(tn, NAME_LAND, NAME_LAND + 0.3)
    place(c, idea_card(REPLY_B, IDEAS[5][1], hi), X, Y, s * CARD_W / IDEA_W, 1 - prog(tn, GROW[0], GROW[0] + 0.4))
    if g > 0:
        place(c, card_project(SLOW[0]), X, Y, s, prog(tn, GROW[0] + 0.1, GROW[0] + 0.5))
    glint(c, tn, *idea_title_xy(), NAME_LAND, 0.9)


def draw_name_bridge(c, tn):
    """The name lifts out of Mia's answer and lands as the newest idea in the list."""
    if not NAME_LIFT <= tn < NAME_LAND:
        return
    p = prog(tn, NAME_LIFT, NAME_LAND, e_io_quint)
    t = warp(tn)
    sx0, sy0 = ws(*reply_name_pos(), t)
    sx1, sy1 = idea_title_xy()
    size = lerp(40 * QSCALE * cam(t)[2], 44 * IDEA_S, p)
    soft_word(c, REPLY_B, SEMI, 44, BLUE if p < 0.7 else WHITE, lerp(sx0, sx1, p), lerp(sy0, sy1, p), 1.0, 0.0,
              size / 44)


# ---------------------------------------------------------------- joining

def join_button():
    return CARD_X0 + 955, CARD_Y0 + 423


@lru_cache(None)
def _pointer_mask(size):
    """A mouse pointer, tip at (0, 0), as an alpha mask (fill, outline)."""
    k = 4
    pts = [(0, 0), (0, 23), (6, 18), (10, 27), (14, 25), (10, 17), (17, 17)]
    w, h = int(20 * size) + 6, int(30 * size) + 6
    def mask(grow):
        im = Image.new("L", (w * k, h * k), 0)
        ImageDraw.Draw(im).polygon([((x * size + 3) * k, (y * size + 3) * k) for x, y in pts], fill=255,
                                   outline=255, width=int(grow * k))
        return np.asarray(im.resize((w, h), Image.BOX), np.float32) / 255.0
    return mask(4), mask(0)


def draw_pointer(c, x, y, size, alpha):
    if alpha <= 0.01:
        return
    edge, fill = _pointer_mask(round(size, 1))
    blend(c, int(x - 3), int(y - 3), edge * alpha, (16, 16, 19))
    blend(c, int(x - 3), int(y - 3), fill * alpha, (255, 255, 255))


def draw_joiners(c, t):
    """Ben, then Priya: each one arrives, clicks Join project themselves, and takes a seat. Nobody approves it."""
    for k in (1, 2):
        ini, name, j = SEATS[k]
        t0, tp = j - 0.8, j - PRESS
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
        # their own pointer goes to the button and clicks it
        sbx, sby = ws(bx, by, t)
        reach = prog(t, tp - 0.32, tp - 0.04, e_io_cubic)
        px, py = lerp(X - 40 * z, sbx + 20 * z, reach), lerp(Y - 50 * z, sby + 6 * z, reach)
        click = 1 - 0.18 * math.sin(math.pi * prog(t, tp - 0.04, tp + 0.1))
        draw_pointer(c, px, py, 2.4 * z * click, g * (1 - prog(t, tp + 0.12, tp + 0.25)))
        if tp <= t < tp + 0.45:      # the click ripples out of the button
            u = prog(t, tp, tp + 0.45, e_out_cubic)
            draw_dot(c, sbx, sby, (40 + 140 * u) * z, BLUE, 0.7 * (1 - u), ring=3)
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

RAIL = 54.2                       # the ending starts (logic time)
FIX = [  # each problem from the opening, and what Spine turns it into: (problem, fix, key word)
    ("Questions go unanswered.", "Questions get ", "answered."),
    ("Ideas lose momentum.", "Ideas keep ", "moving."),
    ("Impact goes unseen.", "Impact is ", "seen."),
]
FIX_Y = [400.0, 560.0, 720.0]     # baselines of the three lines
FLIPS = [55.25, 56.25, 57.25]     # each problem turns into its fix (a quarter beat off the kick)
GATHER = 57.9                     # the words leave; the three bars head for the mark
LANDS = [59.15, 59.35, 59.55]     # each bar takes its place in the mark
LABELS = ["Questions", "Ideas", "Impact"]
WORDMARK = 59.8
FIX_SIZE = 80


def logo_slot(k):
    x0, x1, yc = LOGO[k]
    return (x0 + x1) / 2, yc, x1 - x0, 40.0


def draw_end(c, t):
    """The opening's three problems come back. Each turns into its fix and gains a bar; the three bars
    become the Spine mark."""
    if t < RAIL:
        return
    for k, (problem, lead, key) in enumerate(FIX):
        y = FIX_Y[k]
        flip = FLIPS[k]
        leave = prog(t, GATHER, GATHER + 0.35)
        # the problem, as the opening said it
        g = prog(t, RAIL + 0.3 + 0.18 * k, RAIL + 0.7 + 0.18 * k, e_out_cubic)
        out = prog(t, flip - 0.1, flip + 0.2)
        if out < 1:
            w = text_width(problem, LIGHT, FIX_SIZE)
            soft_word(c, problem, LIGHT, FIX_SIZE, DIM, W / 2 - w / 2, y, g, out)
        # its fix
        f = prog(t, flip, flip + 0.3, e_out_cubic)
        if f > 0 and leave < 1:
            wl = text_width(lead, LIGHT, FIX_SIZE)
            wk = text_width(key, DREG, FIX_SIZE)
            x0 = W / 2 - (wl + wk) / 2
            soft_word(c, lead, LIGHT, FIX_SIZE, WHITE, x0, y, f, leave)
            soft_word(c, key, DREG, FIX_SIZE, BLUE, x0 + wl, y, f, leave)
        # its bar: drawn under the fix, then carried into the mark
        if t >= flip:
            wfix = text_width(lead, LIGHT, FIX_SIZE) + text_width(key, DREG, FIX_SIZE)
            grow = prog(t, flip, flip + 0.35, e_out_cubic)
            cx, cy, L, T = logo_slot(k)
            q = prog(t, GATHER + 0.15 * k, LANDS[k], e_io_quint)
            bx = lerp(W / 2, cx, q)
            by = lerp(y + 34, cy, q)
            draw_bar(c, bx, by, max(lerp(wfix * grow, L, q), 8), lerp(8, T, q))
            glint(c, t, W / 2 + wfix / 2, y + 34, flip, 0.8)
        if t >= LANDS[k]:
            cx, cy, L, T = logo_slot(k)
            glint(c, t, cx, cy, LANDS[k], 0.8)
            la = prog(t, LANDS[k] - 0.1, LANDS[k] + 0.3) * (1 - prog(t, 61.0, 61.4))
            soft_word(c, LABELS[k], MED, 40, DIM, LOGO[k][0] - 40 - text_width(LABELS[k], MED, 40), cy + 14, la)
    for k in range(3):
        ts = WORDMARK + 0.12 * k
        u = prog(t, ts, ts + 0.5, e_io_cubic)
        if 0 < u < 1:
            x0, x1, yc = LOGO[k]
            draw_dot(c, lerp(x0, x1, u), yc, 34, (190, 205, 255), 0.35 * math.sin(math.pi * u), blur=16)


# ---------------------------------------------------------------- shake and punch (only on real hits)

IMPACTS = [(COLLAPSE, 0.35), (19.9, 0.16), (22.5, 0.2), (23.0, 0.9), (DOCK, 0.3), (SEATS[1][2], 0.25),
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

def _say(c, text, fname, size, color, y, g):
    if g <= 0.01:
        return
    soft_word(c, text, fname, size, color, W / 2 - text_width(text, fname, size) / 2, y, g)


def _fall(t, t0, seed):
    """Where a falling piece is (dx, dy, spin in degrees, alpha) u seconds after it lets go."""
    u = max(0.0, t - t0)
    rng = np.random.default_rng(seed)
    vx, vy, spin = rng.uniform(-90, 90), rng.uniform(-260, -120), rng.uniform(-220, 220)
    return vx * u, vy * u + 0.5 * 3000 * u * u, spin * u, 1 - prog(u, 0.45, 0.9)


def draw_collapse(c, t, xs, a):
    """It reaches Building and gets no further. The track after it cracks, breaks in two and falls away."""
    if not 10.0 <= t < COLLAPSE + 1.4:
        return
    # the crack: a flash runs along the unreached track
    flash = prog(t, COLLAPSE - 0.08, COLLAPSE) * (1 - prog(t, COLLAPSE, COLLAPSE + 0.25))
    if flash > 0:
        draw_bar(c, (xs[3] + xs[5]) / 2, 620, xs[5] - xs[3], 6, alpha=a * flash, color=(190, 205, 255))
        glint(c, t, xs[4], 620, COLLAPSE, 1.3)
    if t < COLLAPSE:
        return
    k = 0
    for i in (3, 4):                 # each unreached connector snaps in the middle; the halves tumble
        for h in (0, 1):
            dx, dy, rz, fa = _fall(t, COLLAPSE + 0.05 * k, 40 + k)
            x = xs[i] + 35 + 70 * h
            draw_bar(c, x + dx, 620 + dy, 70, 8, rz=rz, alpha=a * 0.85 * fa, color=(150, 156, 172))
            k += 1
    for i in (4, 5):                 # the stages that were never reached fall with them
        dx, dy, rz, fa = _fall(t, COLLAPSE + 0.08 + 0.07 * (i - 4), 60 + i)
        draw_dot(c, xs[i] + dx, 620 + dy, 22, (150, 156, 172), a * fa, ring=4)
        name = STAGES[i]
        soft_word(c, name, MED, 28, DIM, xs[i] + dx * 1.2 - text_width(name, MED, 28) / 2, 690 + dy * 1.1, a * fa)
    for j in range(8):               # and a few bright splinters from where it broke
        dx, dy, rz, fa = _fall(t, COLLAPSE, 90 + j)
        x = xs[4] + (j - 3.5) * 22
        draw_bar(c, x + dx * 2.6, 620 + dy * 0.8, 22, 5, rz=rz * 2, alpha=a * fa, color=(190, 205, 255))


def draw_prelude(c, t):
    """The three problems, in the same still language as the ending. One object. No roads,
    no passing people, no field of bars. Hands off before the question becomes the idea."""
    if t >= 26.7:
        return

    # 1. Ben types his question and sends it; then it waits, a step at a time.
    if t < 10.1:
        a = 1 - prog(t, 9.45, 10.05)
        box = e_out_cubic(prog(t, 3.4, 3.75))
        bw, bh = lerp(260, 1240, box), lerp(110, 360, box)
        sent = prog(t, SEND, SEND + 0.3, e_out_cubic)
        cy = 515 - 30 * sent
        img = Pen(int(bw), int(bh))
        typing = prog(t, 3.5, 3.7) * (1 - sent)
        img.rrect(1, 1, int(bw) - 2, int(bh) - 2, 14, outline=BLUE, width=2, alpha=typing)
        place(c, img.done(), 960, cy, 1.0, a)
        x0, top = 960 - bw / 2, cy - bh / 2
        g = prog(t, 3.65, 3.85) * a
        avatar_at(c, x0 + 64, top + 62, "BC", 28, g, fill=(38, 41, 50))
        soft_word(c, "Ben Carter", MED, 34, DIM, x0 + 108, top + 74, g)
        lines = ("Has anyone automated", "contract reviews before?")
        n = int(round((len(lines[0]) + 1 + len(lines[1])) * prog(t, *TYPE)))
        shown = (lines[0][:n], lines[1][:max(0, n - len(lines[0]) - 1)])
        for k, part in enumerate(shown):
            if part:
                soft_word(c, part, DSEMI, 64, WHITE, x0 + 40, top + 180 + 88 * k, a)
        if t < SEND:     # the cursor, blinking until he sends
            k = 1 if n > len(lines[0]) else 0
            cx = x0 + 40 + text_width(shown[k], DSEMI, 64) + 8
            blink = 1.0 if TYPE[0] <= t < TYPE[1] else (1.0 if (t * 2.6) % 1 < 0.6 else 0.0)
            draw_bar(c, cx, top + 158 + 88 * k, 62, 4, rz=90.0, alpha=a * box * blink, color=(150, 175, 255))
            ga = prog(t, TYPE[0] + 0.2, TYPE[0] + 0.4)
            img = Pen(200, 80)
            _button(img, 0, 0, 199, 79, "Send", primary=t >= TYPE[1], size=38)
            place(c, img.done(), x0 + bw - 140, top + bh - 70, 1.0, a * ga, shadow=False)
        glint(c, t, x0 + bw - 140, top + bh - 70, SEND, 1.0)
        # the wait: each age slides in over the last, and stays white
        for i, m in enumerate(AGES):
            nxt = AGES[i + 1] if i + 1 < len(AGES) else 99.0
            if t < m or t >= nxt + 0.1:
                continue
            age = bubble_state(m)
            gi = prog(t, m + 0.08, m + 0.32, e_out_cubic)
            out = prog(t, nxt, nxt + 0.1)
            soft_word(c, age, LIGHT, 72, WHITE, W / 2 - text_width(age, LIGHT, 72) / 2, 800 + 26 * (1 - gi),
                      gi * a, out)

    # 2. the stages run Idea to Building, and it gets no further. The rest breaks and falls.
    if 9.55 <= t < 15.7:
        a = prog(t, 9.55, 10.0, e_out_cubic) * (1 - prog(t, 15.15, 15.65))
        _say(c, "Contract Clause Checker", DSEMI, 56, WHITE, 390, a * prog(t, 9.6, 9.95))
        xs = [W / 2 + (i - 2.5) * 280 for i in range(6)]       # centred on the frame
        lights = (10.25, 11.15, 12.05, 12.95)                   # Idea, Approval, Recruiting, Building
        for i, name in enumerate(STAGES):
            x = xs[i]
            if i < 5 and (i < 3 or t < COLLAPSE):
                grow = prog(t, 10.05 + i * 0.7, 10.55 + i * 0.7, e_out_cubic)
                shake = 0.0 if i < 3 else 3 * prog(t, COLLAPSE - 0.45, COLLAPSE) * math.sin(70 * t + i)
                draw_bar(c, x + 70 * grow, 620 + shake, 140 * grow, 6, alpha=a * (0.9 if i < 3 else 0.55),
                         color=BLUE if i < 3 else (110, 116, 136))
            if i < 4:
                p = prog(t, lights[i], lights[i] + 0.26, e_out_cubic)
                if p > 0:
                    draw_dot(c, x, 620, 20 * (0.7 + 0.3 * p), BLUE, a * p)
            elif t < COLLAPSE:
                draw_dot(c, x, 620, 20, (16, 16, 19), a * prog(t, 10.3, 10.7), ring=3)
            if i < 4 or t < COLLAPSE:
                soft_word(c, name, MED, 28, WHITE if i < 4 else DIM, x - text_width(name, MED, 28) / 2, 690,
                          a * prog(t, 10.15 + i * 0.15, 10.45 + i * 0.15))
        draw_collapse(c, t, xs, a)
        miss = math.sin(math.pi * clamp(prog(t, 13.05, 13.6)))
        if miss > 0.02:
            draw_dot(c, xs[4], 620, 20, BLUE, a * miss * 0.9)     # it tries for Publishing, and fails
        _say(c, "Stopped halfway", LIGHT, 68, WHITE, 860, a * prog(t, COLLAPSE + 0.55, COLLAPSE + 0.9, e_out_cubic))

    # 3. the months arrive one by one, and none of them gets a number.
    if 15.45 <= t < 21.15:
        a = prog(t, 15.45, 15.95, e_out_cubic) * (1 - prog(t, 20.7, 21.15))
        _say(c, "Hours saved", MED, 40, WHITE, 430, a * prog(t, 15.6, 15.95))
        labels = ("Jul", "Aug", "Sep", "Oct")
        for i, lab in enumerate(labels):
            p = prog(t, 16.15 + i * 0.7, 16.5 + i * 0.7, e_out_cubic)
            if p <= 0:
                continue
            x = W / 2 + (i - 1.5) * 220                          # centred on the frame
            draw_bar(c, x, 800 + 16 * (1 - p), 90, 6, alpha=a * 0.55 * p, color=(70, 75, 92))
            soft_word(c, lab, MED, 32, DIM, x - text_width(lab, MED, 32) / 2, 860, a * p)
        _say(c, "No data yet", LIGHT, 108, DIM, 620, a * prog(t, 19.05, 19.45, e_out_cubic))

    # 4. the three problems come back broken, a spine runs through them, they are mended and become the mark.
    if 21.05 <= t < 26.7:
        draw_turn(c, t, 1 - prog(t, 26.15, 26.65))


TURN_ROWS = [  # what is left of each problem: (label, row y)
    ("Questions", 420.0),            # the question, then fading dots: nobody answered
    ("Ideas", 600.0),                # the stage track, snapped and declining
    ("Impact", 780.0),               # the empty months, disconnected
]
TURN_X0, TURN_X1 = 200.0, 840.0      # the broken rows span this; the lines bend into the mark after it
TURN_T = 18.0                        # thickness of each line before it becomes the mark
TURN_MS = 1.5                        # the mark is drawn larger here than in the ending: it is the moment
TURN_LABEL = 44
TURN_Y = 600.0
TURN_GREY = (150, 156, 172)
TURN_BLUE = (82, 122, 255)           # electric blue while the lines sweep; they settle to the mark's own blue
MARK_BLUE = (58, 87, 220)            # engine SEG_FLAT: the colour every bar of the mark is drawn in
REPAIRED = 22.5                      # the three fronts reach the end of their rows together, on the slam
SWEEP = (21.35, 1.6)                 # the fronts enter at this time and accelerate (u ** 1.6) to REPAIRED
FOLD = 0.5                           # s: the lines decelerate into the mark after REPAIRED, landing on the beat
TAIL = (22.45, 23.0)                 # the far ends whip in from off screen as the lines fold into the mark
LOCK = REPAIRED + FOLD               # 23.0: the mark locks, with the hit and the music's turn to major


def _turn_x():
    """Mark centre x that puts the mark and its labels centred together in the frame."""
    left = min((x0 - LOGO_C[0]) * TURN_MS - 36 - text_width(TURN_ROWS[k][0], MED, TURN_LABEL)
               for k, (x0, x1, yc) in enumerate(LOGO))
    right = max((x1 - LOGO_C[0]) * TURN_MS for x0, x1, yc in LOGO)
    return W / 2 - (left + right) / 2


TURN_X = _turn_x()


def turn_slot(k):
    """Bar k of the mark on screen: left, right, centre y, thickness."""
    x0, x1, yc = LOGO[k]
    return ((x0 - LOGO_C[0]) * TURN_MS + TURN_X, (x1 - LOGO_C[0]) * TURN_MS + TURN_X,
            (yc - LOGO_C[1]) * TURN_MS + TURN_Y, 40.0 * TURN_MS)


BEND = (TURN_X1, min(turn_slot(k)[0] for k in range(3)) - 6)   # where each line bends from its row to its bar


def _mix(a, b, p):
    return tuple(int(round(lerp(a[k], b[k], p))) for k in range(3))


def turn_head(k, t):
    """The leading end of line k: one shared front across the rows, then it eases into its bar's right end."""
    if t <= REPAIRED:
        u = clamp((t - SWEEP[0]) / (REPAIRED - SWEEP[0]))
        return lerp(-80.0, TURN_X1, u ** SWEEP[1])
    u = clamp((t - REPAIRED) / FOLD)
    return lerp(TURN_X1, turn_slot(k)[1], 1 - (1 - u) ** 2)      # same speed as the sweep at the hand-off


def turn_path_y(k, x):
    """Line k's path: along its row, then a smooth bend down or up to its bar of the mark."""
    y0, y1 = TURN_ROWS[k][1], turn_slot(k)[2]
    u = clamp((x - BEND[0]) / (BEND[1] - BEND[0]))
    return lerp(y0, y1, u * u * (3 - 2 * u))


def _clip_bar(c, xa, xb, y, h, col, alpha):
    """A horizontal piece of a broken row, drawn only ahead of the front (x > h)."""
    xa = max(xa, h)
    if xb - xa > 1:
        draw_bar(c, (xa + xb) / 2, y, xb - xa, TURN_T, alpha=alpha, color=col)


def draw_turn(c, t, a):
    """Three electric-blue lines sweep in from the left together, repairing the three problems as they pass:
    the unanswered question becomes continuous, the declining track straightens, the empty months join.
    The lines keep going, bend into place and become the three bars of the Spine mark."""
    settle = e_io_cubic(prog(t, REPAIRED + 0.1, REPAIRED + FOLD))
    q = e_io_cubic(prog(t, REPAIRED + 0.05, REPAIRED + FOLD))
    T = lerp(TURN_T, 40.0 * TURN_MS, settle)
    u = t - LOCK
    spring = 0.07 * math.exp(-u / 0.09) * math.cos(2 * math.pi * 5.5 * u) if u >= 0 else 0.0   # it lands and settles
    T *= 1 + spring
    col = _mix(TURN_BLUE, MARK_BLUE, settle)
    xm = (TURN_X0 + TURN_X1) / 2
    for k, (label, y) in enumerate(TURN_ROWS):
        ra = a * prog(t, 21.05, 21.4, e_out_cubic)
        if ra <= 0.01:
            continue
        h = turn_head(k, t)
        sl, sr, sy, _ = turn_slot(k)

        # what is still broken, ahead of the front
        if h < TURN_X1:
            g = TURN_GREY
            if k == 0:                                # the question, then dots that fade: nobody answered
                _clip_bar(c, TURN_X0, xm - 16, y, h, g, ra)
                for j in range(7):
                    dx = xm + 34 + 52 * j
                    if dx > h + 8:
                        draw_dot(c, dx, y, 7, g, ra * (0.85 - 0.11 * j))
            elif k == 1:                              # snapped at the middle; the far half declines
                _clip_bar(c, TURN_X0, xm - 6, y, h, g, ra)
                th = math.radians(10.0)
                px, half = xm + 6, (TURN_X1 - TURN_X0) / 2 - 6
                u0 = clamp((h - px) / (half * math.cos(th)))
                if u0 < 1:
                    seg = half * (1 - u0)
                    mid = u0 + (1 - u0) / 2
                    draw_bar(c, px + half * mid * math.cos(th), y + half * mid * math.sin(th), seg, TURN_T,
                             rz=10.0, alpha=ra, color=g)
            else:                                     # four months, disconnected
                n, seg = 4, 130.0
                space = (TURN_X1 - TURN_X0 - n * seg) / (n - 1)
                for j in range(n):
                    left = TURN_X0 + j * (seg + space)
                    _clip_bar(c, left, left + seg, y, h, g, ra)

        # the line: from off screen left (or its whipping tail) to its front, along its path
        if h > -T:
            if t >= LOCK:
                draw_bar(c, (sl + sr) / 2, sy, (sr - sl) * (1 + spring * 0.6), T, alpha=a, color=col)   # the mark
            else:
                tail = lerp(-T - 40, sl, e_io_cubic(prog(t, *TAIL)))
                tail = min(tail, h - 1)
                xs = np.linspace(max(tail, -T - 40), h, max(2, int((h - tail) / 6) + 2))
                pts = [(float(x), turn_path_y(k, x)) for x in xs]
                draw_polyline(c, pts, T, col, a)
                for px_, py_ in (pts[0], pts[-1]):    # round ends, like the mark's bars
                    draw_dot(c, px_, py_, T / 2, col, a)

        # the label sits above its row, then moves beside its bar in the mark
        lw = text_width(label, MED, TURN_LABEL)
        lab_x = lerp(TURN_X0, sl - 36 - lw, q)
        lab_y = lerp(y - 34, sy + 15, q)
        soft_word(c, label, MED, TURN_LABEL, _mix(TURN_GREY, DIM, q), lab_x, lab_y, ra)


def render_scene(t_film):
    tn = t_film + SHIFT              # the film clock
    t = warp(tn)                     # logic time, which nearly everything below is written in
    n = int(round(tn * FPS * 4))
    flash = 0.1 * prog(t, 22.97, 23.0, e_lin) * (1 - prog(t, 23.0, 23.4, e_out_cubic))
    c = background(tn, n, flash)
    end_fade = prog(t, 62.3, 63.1)

    draw_chart(c, t)
    draw_pieces(c, t)
    draw_road(c, t)
    draw_link(c, t)
    draw_card(c, t)
    draw_seats(c, t)
    draw_passers(c, t)
    draw_pulse(c, t)
    draw_joiners(c, t)
    draw_question(c, t)
    draw_champions(c, t)
    draw_ideas(c, tn)
    draw_name_bridge(c, tn)
    draw_chip(c, t)
    draw_slack(c, t)
    draw_approver(c, t)
    draw_prelude(c, t)

    line_words(c, t, "Questions go unanswered.", LIGHT, 84, WHITE, W / 2, 168, AGES[0] + 0.15, 9.2, "center",
               step=0.045, dur=0.16)
    headline(c, t, "Ideas lose momentum.", 10.3, 15.15, y=168, size=72)
    headline(c, t, "Impact goes unseen.", 16.2, 20.7, y=168, size=80)
    line_words(c, t, "Your AI needs", LIGHT, 84, WHITE, W / 2, 200, 21.15, 26.1, "center")
    line_words(c, t, "a spine.", DREG, 84, BLUE, W / 2, 290, 21.45, 26.1, "center")
    line_words(c, t, "Spine is your AI project manager.", LIGHT, 48, WHITE, W / 2, 900, 23.15, 26.1, "center")
    headline(c, t, "Every question finds someone who knows.", 27.5, 32.4, y=150, size=64)
    quick = dict(step=0.05, dur=0.2)
    line_words(c, tn, "Anyone can propose an idea.", LIGHT, 64, WHITE, W / 2, 150, 33.8, unwarp(34.3), "center")
    line_words(c, t, "AI reviews the idea.", LIGHT, 64, WHITE, W / 2, 150, 34.5, 35.2, "center", **quick)
    line_words(c, t, "Leadership approves it.", LIGHT, 64, WHITE, W / 2, 150, 35.4, 36.25, "center", **quick)
    line_words(c, t, "Anyone can join a project.", LIGHT, 64, WHITE, W / 2, 150, 36.5, 37.75, "center")
    line_words(c, t, "Teams form around good ideas.", LIGHT, 64, WHITE, W / 2, 150, 37.85, 38.8, "center", step=0.06)
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
