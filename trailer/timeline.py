"""Spine launch film: "One line".

A bright, typographic film. A single brand-blue line carries the whole story:
  - it falls short of a question, sags as an idea stalls, breaks up as impact goes unproven;
  - it snaps taut: Spine, your AI project manager;
  - it circles a question and carries it to a Champion;
  - it becomes the six real project stages, stalls at Building and spikes into the Pulse
    heartbeat when Spine flags it, then reaches Live;
  - it rises into the hours-saved line;
  - and finally cuts into three pieces that stack into the Spine logo.
All copy and stage names follow the product brief (CLAUDE.md). The figures 6, 16, 30, 42 are the
product's seeded hours saved for July to October, as shown in the Programme screen.

Everything is a function of time t (seconds). Frames 969+ are the end card.
"""
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from engine import (
    W, H, FPS, SCREEN_CAM, default_seg, draw_segment, draw_text, draw_text_scaled, draw_dot, blend,
    solid, prog, lerp, clamp, text_width,
    e_io_cubic, e_io_quint, e_out_cubic, e_out_quint, e_out_expo, e_in_cubic, e_lin,
    LIGHT_B, INK, INK_SOFT, INK_LABEL, BRAND, BUTTON,
)

END_PLATE = 969    # first end-card frame (32.30 s)
HANDOFF = END_PLATE
TOTAL = 1140       # 38.0 s

SEMI = "InterDisplay-SemiBold.otf"
DISP = "InterDisplay-Regular.otf"
MED = "Inter-Medium.otf"
SEMI_TEXT = "Inter-SemiBold.otf"
REG = "Inter-Regular.otf"

HERE = os.path.dirname(os.path.abspath(__file__))
PLATES = os.path.join(HERE, "assets", "plates")

STAGES = ["Idea", "Approval", "Recruiting", "Building", "Publishing", "Live"]   # product stages (CLAUDE.md)
HOURS = [6, 16, 30, 42]
MONTHS = ["July", "August", "September", "October"]

GREY = (205, 209, 219)
GREY_TEXT = (150, 155, 168)
TRACK = (226, 228, 234)
THREAD_W = 12.0

# Each scene lives in its own region of a wide 2D world; the camera travels between them.
REGION = 2600.0


def R(k, x, y):
    return np.array([k * REGION + x, y], float)


# Problem beats stack vertically inside region 1.
B_DY = [0.0, 760.0, 1520.0]

# Logo bars of the approved end card (screen pixels): (x0, x1, centre y).
LOGO = [(736.0, 831.0, 397.5), (708.0, 835.0, 469.5), (700.0, 779.0, 541.5)]
LOGO_T = 40.0
SNAPS = [3.70, 5.95, 8.00]     # the line fails as each issue word lands


# ---------------------------------------------------------------- 2D camera

class Cam2D:
    def __init__(self, cx, cy, zoom):
        self.cx, self.cy, self.zoom = cx, cy, zoom

    def to_screen(self, p):
        p = np.asarray(p, float)
        return (p - np.array([self.cx, self.cy])) * self.zoom + np.array([W / 2, H / 2])


def view(k, x=960.0, y=540.0, zoom=1.0):
    return (k * REGION + x, y, zoom)


RAIL = [
    (0.0, view(0, zoom=1.0)),
    (2.85, view(0, zoom=1.05)),
    (3.25, view(1, zoom=1.0)),
    (5.1, view(1, 990, zoom=1.03)),
    (5.55, view(1, 960, 540 + B_DY[1])),
    (7.15, view(1, 990, 540 + B_DY[1], 1.03)),
    (7.6, view(1, 960, 540 + B_DY[2])),
    (9.25, view(1, 990, 540 + B_DY[2], 1.04)),
    (9.65, view(2, zoom=0.92)),
    (12.1, view(2, zoom=1.0)),
    (12.65, view(3, zoom=1.0)),
    (16.2, view(3, 990, zoom=1.04)),
    (16.75, view(4, zoom=1.0)),
    (22.15, view(4, 1010, zoom=1.03)),
    (22.7, view(5, zoom=1.0)),
    (26.45, view(5, 1000, zoom=1.04)),
    (27.0, view(6, zoom=1.1)),
    (29.4, view(6, zoom=1.0)),
    (29.4001, view(7, zoom=1.0)),     # region 6 and 7 frame the same screen; see final()
    (38.0, view(7, zoom=1.0)),
]


def camera_at(t):
    t = max(t, 0.0)
    for (ta, a), (tb, b) in zip(RAIL, RAIL[1:]):
        if ta <= t <= tb:
            p = prog(t, ta, tb)
            return Cam2D(*(lerp(x, y, p) for x, y in zip(a, b)))
    return Cam2D(*RAIL[-1][1])


# ---------------------------------------------------------------- polylines

N = 260


def resample(pts, n=N):
    pts = np.asarray(pts, float)
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(pts, axis=0), axis=1))]
    if d[-1] <= 0:
        return np.repeat(pts[:1], n, axis=0)
    s = np.linspace(0, d[-1], n)
    return np.c_[np.interp(s, d, pts[:, 0]), np.interp(s, d, pts[:, 1])]


def line(a, b, n=2):
    return np.linspace(np.asarray(a, float), np.asarray(b, float), n)


def arc(c, r, a0, a1, n=80):
    a = np.linspace(a0, a1, n)
    return np.c_[c[0] + r * np.cos(a), c[1] + r * np.sin(a)]


def chain(*parts):
    return np.vstack(parts)


def sub_path(pts, s0, s1):
    """Portion of a polyline between arc-length fractions s0 and s1."""
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(pts, axis=0), axis=1))]
    if d[-1] <= 0 or s1 <= s0:
        return pts[:0]
    a, b = s0 * d[-1], s1 * d[-1]
    keep = (d > a) & (d < b)
    pa = np.array([np.interp(a, d, pts[:, 0]), np.interp(a, d, pts[:, 1])])
    pb = np.array([np.interp(b, d, pts[:, 0]), np.interp(b, d, pts[:, 1])])
    return np.vstack([pa, pts[keep], pb])


# ---------------------------------------------------------------- the line, scene by scene

def shape_A(t):
    pts = line(R(0, 660, 700), R(0, 1260, 700))
    return dict(pts=pts, s0=0.0, s1=prog(t, 0.35, 1.25), dash=0.0)


def shape_B1(t):
    # races toward the question, stops short, and falls back as it goes unanswered
    end = 1520 - 90 * prog(t, SNAPS[0], SNAPS[0] + 0.5, e_out_cubic)
    pts = line(R(1, 1090, 600), R(1, end, 600))
    return dict(pts=pts, s0=0.0, s1=1.0, dash=0.0)


def shape_B2(t):
    # climbs, then loses momentum and sags
    y0 = B_DY[1]
    sag = prog(t, SNAPS[1], SNAPS[1] + 0.6, e_out_cubic)
    xs = np.linspace(960, 1760, 60)
    climb = np.clip((xs - 960) / 520, 0, 1)
    ys = 760 - 260 * np.sin(climb * math.pi / 2)
    tail = np.clip((xs - 1480) / 280, 0, 1)
    ys = ys + sag * 230 * tail ** 2
    pts = np.c_[xs + 1 * REGION, ys + y0]
    return dict(pts=pts, s0=0.0, s1=1.0, dash=0.0)


def shape_B3(t):
    y0 = B_DY[2]
    pts = line(R(1, 960, 600 + y0), R(1, 1760, 600 + y0))
    return dict(pts=pts, s0=0.0, s1=1.0, dash=prog(t, SNAPS[2], SNAPS[2] + 0.7, e_out_cubic))


def shape_C(t):
    xs = np.linspace(-260, 2180, 120)
    u = (xs + 260) / 2440
    k = max(t - 9.55, 0.0)
    vib = 46 * math.exp(-k / 0.22) * math.sin(2 * math.pi * 7.5 * k) * np.sin(math.pi * u) if t > 9.55 else 0
    pts = np.c_[xs + 2 * REGION, 640 + vib]
    return dict(pts=pts, s0=0.0, s1=1.0, dash=0.0)


Q_C, CH_C, RING = (520.0, 600.0), (1400.0, 600.0), 150.0


def path_D():
    q = np.array(R(3, *Q_C))
    ch = np.array(R(3, *CH_C))
    ring1 = arc(q, RING, math.pi, 4 * math.pi, 120)   # round the question, leaving from its right
    conn = line(q + [RING, 0], ch - [RING, 0], 20)
    ring2 = arc(ch, RING, math.pi, math.pi - 2 * math.pi)
    return chain(ring1, conn, ring2)


def shape_D(t):
    pts = path_D()
    # the line circles the question, carries it across, circles the Champion; then lets go of the question
    return dict(pts=pts, s0=0.62 * prog(t, 14.55, 15.15), s1=prog(t, 12.75, 14.2), dash=0.0)


E_Y = 660.0
E_X = [210.0 + 300.0 * k for k in range(6)]


def stage_progress(t):
    # begins at Approval: the line arrives from the Champion already one stage long
    return 0.2 + 0.4 * prog(t, 17.35, 18.75) + 0.4 * prog(t, 21.0, 21.95)


def shape_E(t):
    x0, x1 = E_X[0], E_X[-1]
    xs = np.linspace(x0, x1, 240)
    ys = np.full_like(xs, E_Y)
    # Pulse: the stalled line spikes into a heartbeat as Spine flags it
    beat = prog(t, 19.75, 20.05, e_out_cubic) * (1 - prog(t, 20.75, 21.05, e_io_cubic))
    if beat > 0:
        bx = E_X[3] - 150
        shape = np.zeros_like(xs)
        knots_x = np.array([-1, 0, 1, 2, 3, 4, 5]) * 26 + bx
        knots_y = np.array([0, 0, -150, 110, -40, 0, 0])
        inside = (xs >= knots_x[0]) & (xs <= knots_x[-1])
        shape[inside] = np.interp(xs[inside], knots_x, knots_y)
        ys = ys + beat * shape
    pts = np.c_[xs + 4 * REGION, ys]
    return dict(pts=pts, s0=0.0, s1=stage_progress(t), dash=0.0)


F_BASE = 860.0
F_X = [360.0 + 400.0 * k for k in range(4)]


def chart_pt(k):
    return R(5, F_X[k], F_BASE - HOURS[k] * 9.6)


def shape_F(t):
    pts = chain(line(R(5, 240, F_BASE - 20), chart_pt(0), 10), *[line(chart_pt(k), chart_pt(k + 1), 30) for k in range(3)])
    return dict(pts=pts, s0=0.0, s1=prog(t, 22.95, 24.4, e_io_cubic), dash=0.0)


def shape_G(t):
    # one clean line, Idea to Live; then it gathers into the centre
    w = lerp(1600, 300, prog(t, 28.55, 29.4, e_io_quint))
    pts = line(R(6, 960 - w / 2, 620), R(6, 960 + w / 2, 620))
    return dict(pts=pts, s0=0.0, s1=prog(t, 27.0, 27.9, e_io_cubic), dash=0.0)


SCENES = [
    (0.0, 2.85, shape_A),
    (3.25, 5.1, shape_B1),
    (5.55, 7.15, shape_B2),
    (7.6, 9.25, shape_B3),
    (9.65, 12.1, shape_C),
    (12.65, 16.2, shape_D),
    (16.75, 22.15, shape_E),
    (22.7, 26.45, shape_F),
    (27.0, 29.4, shape_G),
]


def thread_at(t):
    """The line's shape at time t; between scenes it morphs from one shape to the next."""
    for i, (a, b, fn) in enumerate(SCENES):
        if a <= t <= b:
            th = fn(t)
            # while the line is still drawing itself, its tip glows
            ahead = fn(min(t + 1 / FPS, b))
            th["head"] = clamp((ahead["s1"] - th["s1"]) * 160) if th["s1"] < 1 else 0.0
            return th
        if i + 1 < len(SCENES) and b < t < SCENES[i + 1][0]:
            na, _, nfn = SCENES[i + 1]
            p = prog(t, b, na, e_io_cubic)
            A, B = fn(b), nfn(na)
            pa = resample(sub_path(A["pts"], A["s0"], A["s1"]))
            pb = resample(sub_path(B["pts"], B["s0"], max(B["s1"], 0.05)))
            return dict(pts=pa + (pb - pa) * p, s0=0.0, s1=1.0, dash=lerp(A["dash"], B["dash"], p))
    if t < SCENES[0][0]:
        return None
    return None


# ---------------------------------------------------------------- drawing the line

def draw_thread(c, cam, th, width=THREAD_W, color=BRAND, shadow=True):
    if th is None:
        return
    pts = sub_path(th["pts"], th["s0"], th["s1"])
    if len(pts) < 2:
        return
    scr = np.array([cam.to_screen(p) for p in pts])
    w = width * cam.zoom
    pieces = [scr]
    if th["dash"] > 0:
        pieces = dashes(scr, th["dash"])
    draw_strokes(c, pieces, w, color, shadow)
    if th.get("head", 0) > 0:
        tip = scr[-1]
        draw_dot(c, tip[0], tip[1], w * 1.6, (150, 175, 255), 0.35 * th["head"], blur=w * 0.8)
        draw_dot(c, tip[0], tip[1], w * 0.42, (238, 243, 255), 0.95 * th["head"])


def dashes(scr, amount):
    """Break a stroke into pieces with gaps that grow (and fade) towards its end."""
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(scr, axis=0), axis=1))]
    L = d[-1]
    out = []
    pos = 0.0
    while pos < L:
        u = pos / max(L, 1)
        dash = lerp(L, 46 - 26 * u, clamp(amount * 1.6)) if amount < 0.62 else 46 - 26 * u
        gap = amount * (10 + 70 * u ** 1.5)
        seg = scr_slice(scr, d, pos, min(pos + dash, L))
        if len(seg) >= 2:
            out.append((seg, 1 - amount * 0.85 * u ** 2))
        pos += dash + gap
    return out


def scr_slice(scr, d, a, b):
    keep = (d > a) & (d < b)
    pa = np.array([np.interp(a, d, scr[:, 0]), np.interp(a, d, scr[:, 1])])
    pb = np.array([np.interp(b, d, scr[:, 0]), np.interp(b, d, scr[:, 1])])
    return np.vstack([pa, scr[keep], pb])


def draw_strokes(c, pieces, w, color, shadow=True):
    S = 2
    pieces = [p if isinstance(p, tuple) else (p, 1.0) for p in pieces]
    allp = np.vstack([p for p, _ in pieces])
    pad = int(w * 3 + 24)
    x0, y0 = np.floor(allp.min(0)).astype(int) - pad
    x1, y1 = np.ceil(allp.max(0)).astype(int) + pad
    x0, y0 = max(x0, -pad), max(y0, -pad)
    x1, y1 = min(x1, W + pad), min(y1, H + pad)
    if x1 <= x0 or y1 <= y0:
        return
    im = Image.new("L", ((x1 - x0) * S, (y1 - y0) * S), 0)
    dr = ImageDraw.Draw(im)
    for p, a in pieces:
        q = [((x - x0) * S, (y - y0) * S) for x, y in p]
        v = int(255 * clamp(a))
        dr.line(q, fill=v, width=max(1, int(round(w * S))), joint="curve")
        r = w * S / 2
        for ex, ey in (q[0], q[-1]):
            dr.ellipse([ex - r, ey - r, ex + r, ey + r], fill=v)
    m = im.resize((x1 - x0, y1 - y0), Image.BOX)
    if shadow:
        sh = m.filter(ImageFilter.GaussianBlur(max(2, w * 0.9)))
        sa = np.asarray(sh, np.float32) / 255.0
        off = int(round(w * 0.5)) + 2
        sa = np.roll(sa, off, axis=0)
        sa[:off] = 0
        blend(c, x0, y0, sa * 0.16, (40, 60, 140))
    blend(c, x0, y0, np.asarray(m, np.float32) / 255.0, color)


# ---------------------------------------------------------------- type in the world

def wtext(c, cam, text, fname, size, color, p, t_in, t_out=None, align="left", d_in=0.6, alpha=1.0):
    """World-anchored type: a mask reveal in, a mask exit out; it moves and scales with the camera.
    Large multi-word lines reveal word by word."""
    words = text.split(" ")
    if size >= 80 and len(words) > 1:
        total = text_width(text, fname, size)
        x0 = p[0] - (total / 2 if align == "center" else total if align == "right" else 0)
        for i, w in enumerate(words):
            pre = text_width(" ".join(words[:i]) + (" " if i else ""), fname, size)
            _wtext_one(c, cam, w, fname, size, color, np.array([x0 + pre, p[1]]), t_in + 0.055 * i,
                       t_out, "left", d_in, alpha)
        return
    _wtext_one(c, cam, text, fname, size, color, p, t_in, t_out, align, d_in, alpha)


def _wtext_one(c, cam, text, fname, size, color, p, t_in, t_out, align, d_in, alpha):
    s = cam.to_screen(p)
    tw = text_width(text, fname, size) * cam.zoom
    x = s[0] - (tw / 2 if align == "center" else tw if align == "right" else 0)
    T_ = wtext.t
    rv = prog(T_, t_in, t_in + d_in, e_out_quint)
    ex = prog(T_, t_out, t_out + 0.35, e_io_cubic) if t_out is not None else 0.0
    if rv <= 0 or ex >= 1:
        return
    if abs(cam.zoom - 1) < 1e-3:
        draw_text(c, text, fname, size, color, x, s[1], reveal=rv, exit=ex, alpha=alpha)
    else:
        draw_text_scaled(c, text, fname, size, color, x, s[1], scale=cam.zoom, reveal=rv * (1 - ex),
                         alpha=alpha)


wtext.t = 0.0


def avatar(c, cam, p, r, initials, t_in, alpha=1.0, ring=False):
    g = prog(wtext.t, t_in, t_in + 0.45, e_out_quint) * alpha
    if g <= 0:
        return
    s = cam.to_screen(p)
    rr = r * cam.zoom * (0.6 + 0.4 * g)
    draw_dot(c, s[0], s[1], rr, (238, 240, 245), g)
    size = max(8, int(round(r * 0.72)))
    draw_text_scaled(c, initials, SEMI_TEXT, size, (60, 68, 92), s[0] - text_width(initials, SEMI_TEXT, size) * cam.zoom / 2,
                     s[1] + size * 0.36 * cam.zoom, scale=cam.zoom, alpha=g)


# ---------------------------------------------------------------- scenes: everything but the line

def draw_scene_layers(c, t, cam):
    wtext.t = t
    # A. Your company has AI.
    wtext(c, cam, "Your company", SEMI, 150, INK, R(0, 960, 470), 0.45, 2.7, "center")
    wtext(c, cam, "has AI.", SEMI, 150, INK, R(0, 960, 620), 0.7, 2.75, "center")
    # B. The problems.
    beats = [("Questions.", "Unanswered.", 3.15), ("Ideas.", "Stalled.", 5.5), ("Impact.", "Unproven.", 7.55)]
    for k, (w1, w2, t0) in enumerate(beats):
        y = B_DY[k]
        out = [4.8, 6.85, 8.95][k]
        wtext(c, cam, w1, SEMI, 132, INK, R(1, 160, 540 + y), t0, out)
        wtext(c, cam, w2, SEMI, 132, BRAND, R(1, 160, 690 + y), SNAPS[k] - 0.08, out)
    # the question the line never reaches
    wtext(c, cam, "?", SEMI, 360, GREY, R(1, 1690, 720), 3.3, 4.8, "center")
    # C. Spine.
    wtext(c, cam, "Spine is your", SEMI, 96, GREY_TEXT, R(2, 960, 400), 9.8, 11.95, "center")
    wtext(c, cam, "AI project manager.", SEMI, 140, INK, R(2, 960, 560), 10.05, 11.98, "center")
    # D. Questions go to Champions.
    wtext(c, cam, "Questions go to Champions.", SEMI, 84, INK, R(3, 160, 200), 12.75, 16.05)
    wtext(c, cam, "Answered in private. Reused when asked again.", REG, 40, INK_SOFT, R(3, 160, 268), 13.15, 16.1)
    qa = 1 - prog(t, 14.6, 15.0)
    wtext(c, cam, "?", SEMI, 190, INK, R(3, Q_C[0], Q_C[1] + 68), 12.7, 16.0, "center", alpha=qa)
    avatar(c, cam, R(3, *CH_C), 104, "AM", 13.6)
    wtext(c, cam, "Champion", MED, 40, INK_SOFT, R(3, CH_C[0], CH_C[1] + 214), 13.9, 16.05, "center")
    wtext(c, cam, "Answered.", SEMI, 56, BRAND, R(3, CH_C[0], CH_C[1] - 196), 15.0, 16.05, "center")
    # E. Stages, owner and team, Pulse.
    if 16.3 <= t < 22.8:
        tr = 1.0 * prog(t, 16.8, 17.3)
        leave = 1 - prog(t, 21.85, 22.15)
        for k in range(5):
            a, b = cam.to_screen(R(4, E_X[k], E_Y)), cam.to_screen(R(4, E_X[k + 1], E_Y))
            if tr > 0:
                draw_strokes(c, [(np.array([a, a + (b - a) * clamp(tr * 5 - k)]), leave)], 4 * cam.zoom, TRACK, False)
        prog_x = E_X[0] + (E_X[-1] - E_X[0]) * stage_progress(t)
        for k, name in enumerate(STAGES):
            p = cam.to_screen(R(4, E_X[k], E_Y))
            reached = prog_x >= E_X[k] - 1
            g = prog(t, 16.9 + 0.08 * k, 17.3 + 0.08 * k, e_out_quint)
            if reached:
                draw_dot(c, p[0], p[1], 15 * cam.zoom * g, BRAND, leave)
            else:
                draw_dot(c, p[0], p[1], 15 * cam.zoom * g, (250, 250, 252), leave)
                draw_dot(c, p[0], p[1], 15 * cam.zoom * g, GREY, leave, ring=3 * cam.zoom)
            cur = (k == 3 and 18.6 < t < 21.0) or (k == 5 and t > 21.9)
            wtext(c, cam, name, SEMI_TEXT if cur else MED, 38, INK if cur else INK_SOFT,
                  R(4, E_X[k], E_Y + 78), 16.95 + 0.08 * k, 21.8, "center")
        # Pulse rings from the stalled build
        bp = cam.to_screen(R(4, E_X[3], E_Y))
        for j in range(3):
            rt = 19.8 + 0.32 * j
            g = prog(t, rt, rt + 0.9, e_out_cubic)
            if 0 < g < 1:
                draw_dot(c, bp[0], bp[1], (18 + 90 * g) * cam.zoom, BRAND, 0.55 * (1 - g), ring=3 * cam.zoom)
        # owner and team (the AI Invoice Assistant's team in the product's demo data)
        for j, (ini, dx, dy) in enumerate((("JC", 10, -130), ("MT", 120, -200), ("SK", 230, -130))):
            fade = 1 - prog(t, 22.0, 22.3)
            avatar(c, cam, R(4, E_X[0] + dx, E_Y + dy), 48, ini, 17.55 + 0.15 * j, alpha=fade)
        wtext(c, cam, "Owner and team", MED, 36, INK_SOFT, R(4, E_X[0] + 120, E_Y - 270), 17.9, 19.45, "center")
    wtext(c, cam, "Every idea gets an owner and a team.", SEMI, 84, INK, R(4, 160, 200), 17.0, 19.45)
    wtext(c, cam, "AI review. Approval. Build plan.", REG, 40, INK_SOFT, R(4, 160, 268), 17.4, 19.5)
    wtext(c, cam, "When work goes quiet, Spine flags it.", SEMI, 84, INK, R(4, 160, 200), 19.7, 21.8)
    # F. Impact you can measure.
    wtext(c, cam, "Impact you can measure.", SEMI, 84, INK, R(5, 160, 200), 22.75, 26.3)
    wtext(c, cam, "Hours saved, logged every month.", REG, 40, INK_SOFT, R(5, 160, 268), 23.15, 26.35)
    if 22.5 <= t < 26.9:
        base_a = cam.to_screen(R(5, 240, F_BASE + 40))
        base_b = cam.to_screen(R(5, 1700, F_BASE + 40))
        g = prog(t, 22.8, 23.4, e_io_cubic) * (1 - prog(t, 26.3, 26.7))
        if g > 0:
            draw_strokes(c, [(np.array([base_a, base_a + (base_b - base_a) * g]), 1.0)], 3 * cam.zoom, TRACK, False)
        for k in range(4):
            tk = 23.1 + 0.42 * k
            gk = prog(t, tk, tk + 0.4, e_out_quint) * (1 - prog(t, 26.3, 26.6))
            if gk <= 0:
                continue
            p = cam.to_screen(chart_pt(k))
            draw_dot(c, p[0], p[1], 14 * cam.zoom * gk, BRAND, 1.0)
            draw_dot(c, p[0], p[1], 6 * cam.zoom * gk, (250, 251, 255), 1.0)
            big = k == 3
            wtext(c, cam, str(HOURS[k]) + (" hours" if big else ""), SEMI, 64 if big else 48, INK,
                  chart_pt(k) + np.array([0, -46.0]), tk, 26.3, "center")
            wtext(c, cam, MONTHS[k], MED, 34, INK_SOFT, R(5, F_X[k], F_BASE + 100), 22.9 + 0.1 * k, 26.35, "center")
    # G. From idea to live.
    wtext(c, cam, "From idea to live.", SEMI, 140, INK, R(6, 960, 520), 27.05, 28.5, "center")
    wtext(c, cam, "Idea", MED, 40, INK_SOFT, R(6, 170, 700), 27.3, 28.45)
    wtext(c, cam, "Live", SEMI_TEXT, 40, BRAND, R(6, 1750, 700), 27.75, 28.45, "right")


# ---------------------------------------------------------------- final: the line becomes the logo

def pieces_at(t):
    """Three pieces cut from the gathered line, each stacking into a bar of the logo."""
    out = []
    cx, w = 960.0, 300.0
    cuts = [(cx - w / 2 + k * (w / 3) + (3 if k else 0), cx - w / 2 + (k + 1) * (w / 3) - (3 if k < 2 else 0))
            for k in range(3)]
    for k in range(3):
        a, b = cuts[k]
        p = prog(t, 29.45 + 0.15 * k, 30.55 + 0.15 * k, e_io_quint)
        x0, x1, yc = LOGO[k]
        L = lerp(b - a, x1 - x0, p)
        x = lerp((a + b) / 2, (x0 + x1) / 2, p)
        y = lerp(620.0, yc, p) - 80 * math.sin(math.pi * p)
        T = lerp(THREAD_W, LOGO_T, prog(t, 30.25 + 0.15 * k, 30.75 + 0.15 * k, e_out_cubic))
        rz = 14 * math.sin(math.pi * p) * (-1 if k % 2 else 1)
        out.append(default_seg(x=x, y=y, L=L, T=T, rz=rz, flat=T < 14))
    return out


_plate = None


def plate():
    global _plate
    if _plate is None:
        _plate = np.asarray(Image.open(os.path.join(PLATES, "f0969.png")).convert("RGB")).astype(np.float32)
    return _plate


WORD_BOX = (870, 380, 1345, 575)    # the wordmark on the end-card plate


def render_final(c, t):
    for s in pieces_at(t):
        draw_segment(c, SCREEN_CAM, s)
    # The wordmark rises in beside the mark, taken from the approved end card itself.
    rv = prog(t, 30.95, 31.6, e_out_quint)
    if rv > 0:
        x0, y0, x1, y1 = WORD_BOX
        reg = plate()[y0:y1, x0:x1]
        dy = int(round((1 - rv) * (y1 - y0) * 0.6))
        dst = c[y0:y1, x0:x1]
        a = np.zeros((y1 - y0, x1 - x0, 1), np.float32)
        a[: (y1 - y0) - dy] = 1.0
        src = np.zeros_like(reg)
        src[: (y1 - y0) - dy] = reg[dy:]
        src[(y1 - y0) - dy:] = LIGHT_B
        dst[:] = dst * (1 - a) + src * a
    # Settle exactly onto the end-card plate.
    k = prog(t, 31.75, 32.2, e_io_cubic)
    if k > 0:
        c[:] = c * (1 - k) + plate() * k


# ---------------------------------------------------------------- frame

def render_scene(t):
    cam = camera_at(t)
    c = solid(LIGHT_B).astype(np.float32)
    if t < 29.4:
        draw_scene_layers(c, t, cam)
        draw_thread(c, cam, thread_at(t))
    else:
        render_final(c, t)
    return c


# ---------------------------------------------------------------- end card

text_w = text_width


def end_card(t, plate):
    c = plate.astype(np.float32).copy()
    words = "Give your company’s AI a spine.".split(" ")
    size = TAG_SIZE
    total = text_w(" ".join(words), DISP, size)
    x = 959.5 - total / 2
    for k, w in enumerate(words):
        t0 = 32.45 + 0.05 * k
        rv = prog(t, t0, t0 + 0.5, e_out_quint)
        draw_text(c, w, DISP, size, INK, x, TAG_BASE, reveal=rv, clip_extra=2)
        x += text_w(w + " ", DISP, size)
    # Button: a bar draws out from the centre, opens into the button, then the label rises.
    bw = lerp(0, 364, prog(t, 34.02, 34.32))
    bh = lerp(12, 80, prog(t, 34.26, 34.52, e_out_quint))
    if bw > 1:
        draw_segment(c, SCREEN_CAM, default_seg(x=959.5, y=841.5, L=max(bw, bh), T=bh, flat=True, color=BUTTON))
        rv = prog(t, 34.40, 34.80, e_out_quint)
        if rv > 0:
            draw_text(c, "Book a demo", DISP, 32, (255, 255, 255), 846, 849, reveal=rv)
            draw_text(c, "\u2192", MED, 31, (255, 255, 255), 1050, 848, reveal=prog(t, 34.46, 34.86, e_out_quint))
    return c


# Measured from the approved end card.
TAG_SIZE = 46
TAG_BASE = 698
