"""Choreography for the Spine launch trailer.

The film opens on three intact bars. Each snaps in two as its problem is spoken, giving the
six logo segments, which are tracked by index for the rest of the film:
  pair A = segments 0, 1  -> Questions
  pair B = segments 2, 3  -> Ideas
  pair C = segments 4, 5  -> Impact
The six then stack into a spine of six vertebrae at the centre of a 3D field of dots (the
company: people, questions, ideas). Lines draw out from the spine to every dot, and the camera
follows one story per pair: a question routed to a Champion, an idea that gathers a team,
moves through the real stages, stalls and is flagged, and impact rising as hours saved.
Finally the network folds back into the spine, the vertebrae swing horizontal into the stage
bar, and the approved cut's stage-to-logo fold takes over.

Frames 0..878 are rendered here. Frame 879 onwards is the approved cut itself, and frames
969+ add a re-set tagline and button on its logo plate.
"""
import math
import os

import numpy as np

from engine import (
    W, H, FPS, Camera, SCREEN_CAM, Card, default_seg, draw_segment, draw_text, draw_panel, draw_dot,
    LineLayer, dark_background, solid, coverage_1d, prog, lerp, clamp, rot_matrix, text_width,
    e_io_cubic, e_io_quint, e_out_cubic, e_out_quint, e_out_expo, e_in_cubic, e_lin,
    LIGHT_B, INK, INK_SOFT, INK_LABEL, WHITE, BLUE_ON_DARK, SUB_ON_DARK, BRAND, BUTTON,
)

HANDOFF = 879      # first frame taken from the approved cut (29.30 s)
END_PLATE = 969    # first end-card frame (32.30 s)
TOTAL = 1140       # 38.0 s

SEMI = "InterDisplay-SemiBold.otf"
DISP = "InterDisplay-Regular.otf"
MED = "Inter-Medium.otf"
SEMI_TEXT = "Inter-SemiBold.otf"
REG = "Inter-Regular.otf"

HERE = os.path.dirname(os.path.abspath(__file__))
SCREENS = os.environ.get("SPINE_DESIGN_DIR", os.path.join(HERE, "assets", "screens"))

STAGES = ["Idea", "Approval", "Recruiting", "Building", "Publishing", "Live"]   # product stages (CLAUDE.md)
# Screen geometry of the approved cut's settled stage bar at 29.30 s (measured).
HAND_X = [305.05 + 260 * i for i in range(6)]
HAND_Y, HAND_L, HAND_T = 491.25, 250.5, 13.3

# Opening: three intact bars, offsets (x, y, z) and resting rotation (rx, ry, rz).
BARS_C = np.array([1440.0, 540.0, 0.0])
BARS = [(70, -175, 110, 6, 22, -5), (-10, 0, -80, -4, -18, 4), (-60, 175, 60, 5, 26, -3)]
ROWS_Y = [330.0, 540.0, 750.0]
ROW_X0, ROW_X1 = 1140.0, 1650.0   # a whole problem bar; its halves keep these outer ends
# Snap times: the start of each problem word in the voiceover. Audio cues in audio.py match.
SNAPS = [3.88, 6.00, 7.62]

KEYS = ("x", "y", "z", "L", "T", "rx", "ry", "rz", "rl", "rr", "fill", "outline", "shadow")

# ---------------------------------------------------------------- the world

C = np.array([960.0, 540.0, 0.0])                      # centre of the spine
VERT_DX = [8, -6, 10, -8, 6, -4]                       # a slight organic stagger
VERT = [C + np.array([VERT_DX[k], (k - 2.5) * 62, 0.0]) for k in range(6)]

NODE_PERSON, NODE_QUESTION, NODE_IDEA = 0, 1, 2
COL_PERSON = (222, 228, 242)
COL_LINE = (110, 136, 225)
COL_HERO = (170, 192, 255)


def _make_nodes(n=150, seed=5):
    rng = np.random.default_rng(seed)
    out = []
    while len(out) < n:
        th = rng.uniform(0, 2 * math.pi)
        cphi = rng.uniform(-1, 1)
        sphi = math.sqrt(1 - cphi ** 2)
        r = 560 + 560 * rng.random() ** 0.7
        p = C + np.array([r * sphi * math.cos(th), 0.55 * r * cphi, r * sphi * math.sin(th)])
        u = rng.random()
        kind = NODE_PERSON if u < 0.7 else NODE_QUESTION if u < 0.85 else NODE_IDEA
        k = int(np.clip(round((p[1] - C[1]) / 62 + 2.5), 0, 5))
        out.append(dict(p=p, kind=kind, v=k, phase=rng.uniform(0, 6.3), dist=r))
    order = np.argsort([o["dist"] for o in out])
    for rank, i in enumerate(order):
        out[i]["tc"] = 9.75 + 1.35 * rank / n + 0.08 * math.sin(out[i]["phase"] * 3)
    return out


NODES = _make_nodes()

# Hero story points (world).
Q = C + np.array([430.0, -250.0, -320.0])              # a question
CH = C + np.array([700.0, 70.0, 120.0])                # the Champion who claims it
L5 = C + np.array([-760.0, 260.0, -180.0])             # where the idea's journey plays out
SP = [L5 + np.array([-390.0 + 156 * k, -26 * math.sin(k * 0.9), 0.0]) for k in range(6)]
TEAM = [SP[0] + np.array(o) for o in ((-110, -120, 40), (-30, 140, -30), (100, -130, -60))]
L6 = C + np.array([820.0, 200.0, -380.0])              # where impact is measured
HOURS = [6, 16, 30, 42]                                # total hours saved Jul-Oct (seed data)
MONTHS = ["Jul", "Aug", "Sep", "Oct"]
CHART = [L6 + np.array([-300.0 + 200 * k, 120 - HOURS[k] * 6.0, 0.0]) for k in range(4)]


def mix(a, b, p):
    out = dict(a)
    for k in KEYS:
        if k in a and k in b:
            out[k] = lerp(a[k], b[k], p)
    return out

def bar_state(k, t):
    ox, oy, oz, rx, ry, rz = BARS[k]
    yaw = lerp(-24, 16, clamp(t / 3.4))
    off = rot_matrix(8, yaw, 0) @ np.array([ox, oy, oz], float)
    s = e_out_expo((t - 0.1 * k) / 1.3)
    far = BARS_C + np.array([ox * 2.5, oy * 2.5, 9000.0])
    pos = far + (BARS_C + off - far) * s
    spin = 1 - s
    sign = 1 if k % 2 else -1
    return default_seg(x=pos[0], y=pos[1], z=pos[2], L=360, T=28,
                       rx=rx + 140 * spin * sign, ry=ry + yaw + 80 * spin, rz=rz + 60 * spin * (-sign),
                       alpha=prog(t, 0.0, 0.2, e_lin))


def whole_row(k):
    return default_seg(x=(ROW_X0 + ROW_X1) / 2, y=ROWS_Y[k], L=ROW_X1 - ROW_X0, T=22)


def recoil(u, amp):
    """A sharp kick at the moment of the snap that settles without bouncing."""
    if u < 0:
        return 0.0
    return amp * min(u / 0.04, 1.0) * math.exp(-max(u - 0.04, 0) / 0.11)


def half_state(i, t):
    """One half of a snapped problem bar. The crack opens at the bar's centre."""
    k, side = i // 2, i % 2
    u = t - SNAPS[k]
    g = e_out_expo(u / 0.35) if u > 0 else 0.0
    mid = (ROW_X0 + ROW_X1) / 2
    inner = lerp(mid, mid - 25 if side == 0 else mid + 25, g)
    x0, x1 = (ROW_X0, inner) if side == 0 else (inner, ROW_X1)
    d = default_seg(x=(x0 + x1) / 2, y=ROWS_Y[k], L=x1 - x0, T=22)
    d["rr" if side == 0 else "rl"] = g
    sgn = -1 if side == 0 else 1
    d["rz"] = recoil(u, 2.5 * sgn)
    d["y"] += recoil(u, 3.0 * sgn)
    if i == 1:   # Questions: the answer half drifts away
        p = prog(t, SNAPS[0] + 0.35, SNAPS[0] + 1.0)
        d["x"] += 60 * p
        d["rz"] -= 3 * p
    if i == 3:   # Ideas: the second half loses momentum and droops
        p = prog(t, SNAPS[1] + 0.25, SNAPS[1] + 0.8, e_out_cubic)
        d["rz"] += 7 * p
        d["y"] += 16 * p
        d["x"] -= 6 * p
    if i == 5:   # Impact: the proof half drains to an empty outline
        d["fill"] = 1 - prog(t, SNAPS[2] + 0.3, SNAPS[2] + 0.95)
        d["outline"] = prog(t, SNAPS[2] + 0.2, SNAPS[2] + 0.35, e_lin)
    return d


def problem_segments(t):
    """Three bars until each snaps, then their halves."""
    out = []
    for k in range(3):
        if t < SNAPS[k]:
            out.append(whole_row(k))
        else:
            out += [half_state(2 * k, t), half_state(2 * k + 1, t)]
    return out






# ---------------------------------------------------------------- camera rail

def look(pt, zoom, yaw, pitch, focal=1700.0):
    return (pt[0], pt[1], pt[2], zoom, yaw, pitch, focal)


RAIL = [
    (0.0, look(C, 1.0, 0, 0, 2200)),
    (8.55, look(C, 1.05, -4, 0, 2200)),
    (9.6, look(C, 1.30, -20, 6, 1700)),                      # in close as the spine forms
    (12.1, look(C, 0.80, 26, 10, 1700)),                     # orbit out: the network lights up
    (13.0, look((Q + CH) / 2, 1.45, 40, 6)),                 # dolly to one question
    (16.0, look((Q + CH) / 2, 1.55, 47, 4)),
    (17.0, look(SP[2] + np.array([60.0, -40.0, 0.0]), 1.75, -34, 8)),   # swing round the spine to an idea
    (19.6, look(SP[3] + np.array([40.0, -40.0, 0.0]), 1.85, -30, 6)),   # follow it to Building
    (22.0, look(SP[4] + np.array([0.0, -40.0, 0.0]), 1.85, -26, 6)),
    (22.9, look(L6 + np.array([150.0, -60.0, 0.0]), 1.55, 22, 4)),      # across to impact
    (26.3, look(L6 + np.array([170.0, -60.0, 0.0]), 1.62, 28, 2)),
    (27.35, look(C, 1.0, 0, 0, 2200)),                       # back to the spine, square on
    (29.3, look(C, 1.0, 0, 0, 2200)),
]


def camera_at(t):
    keys = RAIL
    t = max(t, keys[0][0])
    if t >= keys[-1][0]:
        c = keys[-1][1]
    else:
        for (ta, a), (tb, b) in zip(keys, keys[1:]):
            if ta <= t <= tb:
                c = tuple(lerp(x, y, prog(t, ta, tb)) for x, y in zip(a, b))
                break
    return Camera(c[0], c[1], c[3], c[4], c[5], focal=c[6], cz=c[2])


def dof(cam, p):
    """Blur radius in pixels for a world point: sharp at the look-at plane, softer with depth."""
    return min(7.0, abs(float(cam.depth(p)[0])) * 0.0065 * cam.zoom)


# ---------------------------------------------------------------- segments: vertebrae of the spine

def travel(a, b, p, arc=260.0):
    d = mix(a, b, p)
    d["z"] -= arc * math.sin(math.pi * p)
    d["flat"] = b.get("flat", False) if p > 0.5 else a.get("flat", False)
    return d


def vertebra(i):
    v = VERT[i]
    return default_seg(x=v[0], y=v[1], z=v[2], L=190.0, T=22.0)


def stage_target(i):
    return default_seg(x=HAND_X[i], y=HAND_Y, L=HAND_L, T=HAND_T, flat=True)


def segments_at(t):
    if t < 3.5:
        out = []
        for k in range(3):
            a = bar_state(k, t)
            mm = prog(t, 2.72 + 0.07 * k, 3.34 + 0.07 * k)
            out.append(mix(a, whole_row(k), mm) if mm > 0 else a)
        return out
    if t < 8.62:
        return problem_segments(t)
    out = []
    for i in range(6):
        s = half_state(i, min(t, 8.62))
        s = travel(s, vertebra(i), prog(t, 8.62 + 0.05 * i, 9.45 + 0.05 * i, e_io_quint), arc=300)
        if i == 5:
            s["fill"] = prog(t, 8.8, 9.4)
            s["outline"] = 1 - prog(t, 9.2, 9.6, e_lin)
        # 4. The vertebrae swing horizontal into the stage bar.
        s = travel(s, stage_target(i), prog(t, 27.2 + 0.06 * i, 28.1 + 0.03 * i), arc=380)
        s["glow"] = glow(i, t)
        out.append(s)
    return out


def glow(i, t):
    """How brightly a vertebra is lit while its story plays."""
    pair = i // 2
    win = [(13.1, 15.4), (19.9, 21.6), (23.2, 25.6)][pair]
    return prog(t, win[0], win[0] + 0.25, e_out_cubic) * (1 - prog(t, win[1], win[1] + 0.5))


# ---------------------------------------------------------------- the network

def network_alpha(t):
    return 1 - prog(t, 26.5, 27.4)


def draw_network(c, t, cam, lines):
    fade = network_alpha(t)
    if fade <= 0:
        return
    pts = np.array([n["p"] for n in NODES])
    wob = np.array([[6 * math.sin(t * 0.7 + n["phase"]), 5 * math.cos(t * 0.6 + n["phase"] * 1.3), 0.0]
                    for n in NODES])
    pts = pts + wob
    scr = cam.project(pts)
    dep = cam.depth(pts)
    retract = prog(t, 26.4, 27.2, e_in_cubic)
    vs = cam.project(np.array(VERT))
    for n, p, s, d in zip(NODES, pts, scr, dep):
        if not (-200 < s[0] < W + 200 and -200 < s[1] < H + 200) or d < -1500:
            continue
        near = clamp(1 - (d + 900) / 2600)            # dimmer when further away
        lit = prog(t, n["tc"], n["tc"] + 0.35, e_out_cubic)
        # connection from its vertebra, drawn outward, retracted at the end
        if lit > 0:
            a = vs[n["v"]]
            e = a + (s - a) * lit * (1 - retract)
            lines.line(a, e, COL_LINE, alpha=(0.16 + 0.22 * near) * fade, width=1.1)
        k = cam.zoom * cam.focal / (cam.focal + d)
        blur = min(6.0, abs(d) * 0.0065 * cam.zoom)
        base_a = (0.16 + 0.70 * lit) * (0.35 + 0.65 * near) * fade
        flash = math.exp(-max(t - n["tc"] - 0.35, 0) / 0.25) * lit
        if n["kind"] == NODE_PERSON:
            draw_dot(c, s[0], s[1], 3.0 * k * (1 + 0.8 * flash), COL_PERSON, base_a, blur)
        elif n["kind"] == NODE_QUESTION:
            draw_dot(c, s[0], s[1], 5.0 * k * (1 + 0.6 * flash), BLUE_ON_DARK, base_a, blur, ring=1.5 * k)
        else:
            draw_dot(c, s[0], s[1], 4.5 * k * (1 + 0.6 * flash), BLUE_ON_DARK, base_a, blur)


def along(points, p):
    """Point at fraction p along a polyline of screen points."""
    seg = np.array([np.linalg.norm(b - a) for a, b in zip(points, points[1:])])
    total = seg.sum()
    if total <= 0:
        return points[0]
    d = p * total
    for a, b, L in zip(points, points[1:], seg):
        if d <= L:
            return a + (b - a) * (d / max(L, 1e-6))
        d -= L
    return points[-1]


def hero_dot(c, cam, p, r, color, alpha=1.0, ring=0.0):
    s = cam.to_screen(*p)
    k = cam.zoom * cam.focal / (cam.focal + float(cam.depth(p)[0]))
    draw_dot(c, s[0], s[1], r * k, color, alpha, dof(cam, p), ring=ring * k)
    return s, k


def label(c, t, cam, p, text, size, color, dy, t_in, t_out=None, alpha=1.0, align="center", fname=MED):
    s = cam.to_screen(*p)
    rv = prog(t, t_in, t_in + 0.45, e_out_quint)
    ex = prog(t, t_out, t_out + 0.3) if t_out is not None else 0.0
    draw_text(c, text, fname, size, color, s[0], s[1] + dy, align=align, reveal=rv, exit=ex, alpha=alpha)

_CARDS = {}


def cards():
    if not _CARDS:
        _CARDS["thread"] = Card(os.path.join(SCREENS, "03-question-thread.png"), (300, 190, 1040, 278),
                                Q + np.array([40.0, -150.0, 0.0]), 470, yaw=-40)
        _CARDS["pulse"] = Card(os.path.join(SCREENS, "09-pulse.png"), (318, 500, 1500, 608),
                               SP[3] + np.array([60.0, -190.0, 0.0]), 560, yaw=30)
    return _CARDS


def card_alpha(t, t0, t1):
    return prog(t, t0, t0 + 0.4, e_out_cubic) * (1 - prog(t, t1, t1 + 0.35))


def draw_question_story(c, t, cam, lines):
    """A question routes through the spine to a Champion; the answer comes back."""
    if not 12.0 <= t < 17.2:
        return
    fade = 1 - prog(t, 16.4, 16.9)
    va, vb = VERT[0], VERT[1]
    route = [Q, (va + vb) / 2, CH]
    scr = [cam.to_screen(*p) for p in route]
    go = prog(t, 13.2, 14.0, e_io_cubic)
    back = prog(t, 14.3, 15.0, e_io_cubic)
    if go > 0:
        tip = along(scr, go)
        pts = [scr[0]] + [s for s, f in zip(scr[1:], (0.5, 1.0)) if go >= f] + [tip]
        for a, b in zip(pts, pts[1:]):
            lines.line(a, b, COL_HERO, alpha=0.9 * fade, width=2.0)
        if go < 1:
            draw_dot(c, tip[0], tip[1], 5, (235, 240, 255), fade)
    if 0 < back < 1:
        tip = along(scr[::-1], back)
        draw_dot(c, tip[0], tip[1], 6, (235, 240, 255), fade)
    answered = prog(t, 15.0, 15.25, e_out_cubic)
    s, k = hero_dot(c, cam, Q, 11, BLUE_ON_DARK, fade, ring=0 if answered > 0.5 else 2.4)
    if answered > 0:
        draw_dot(c, s[0], s[1], (11 + 30 * answered) * k, BLUE_ON_DARK, 0.5 * (1 - answered) * fade, ring=2 * k)
    s2, k2 = hero_dot(c, cam, CH, 30, (238, 241, 247), fade * prog(t, 12.6, 13.0, e_out_cubic))
    draw_text(c, "AM", SEMI_TEXT, max(8, int(round(20 * k2))), (40, 48, 70), s2[0], s2[1] + 7 * k2,
              align="center", alpha=fade * prog(t, 12.7, 13.1))
    label(c, t, cam, CH, "Champion", 26, SUB_ON_DARK, 54 * k2, 13.9, 16.3, alpha=fade)
    card = cards()["thread"]
    draw_panel(c, cam, card, alpha=card_alpha(t, 13.05, 16.2), shadow=0.5)


def draw_idea_story(c, t, cam, lines):
    """An idea gathers an owner and a team, moves through the stages, stalls, is flagged, finishes."""
    if not 16.2 <= t < 23.2:
        return
    fade = 1 - prog(t, 22.5, 23.0)
    on = prog(t, 16.5, 17.0)
    scr = [cam.to_screen(*p) for p in SP]
    # the stage path, drawn left to right
    path = prog(t, 16.6, 17.4, e_io_cubic)
    tip = along(scr, path)
    pts = [scr[0]] + [s for k, s in enumerate(scr[1:], 1) if path >= k / 5] + [tip]
    for a, b in zip(pts, pts[1:]):
        lines.line(a, b, (90, 110, 175), alpha=0.8 * fade, width=1.6)
    for k, p in enumerate(SP):
        if path >= k / 5 - 1e-6:
            hero_dot(c, cam, p, 6, (120, 140, 200), fade * on, ring=1.6)
            label(c, t, cam, p, STAGES[k], 24, SUB_ON_DARK, 44, 16.7 + 0.12 * k, 22.4, alpha=fade)
    # owner and team connect to the idea
    for j, p in enumerate(TEAM):
        tj = 17.5 + 0.25 * j
        g = prog(t, tj, tj + 0.35, e_out_cubic)
        if g > 0:
            a, b = cam.to_screen(*p), scr[0]
            lines.line(a, a + (b - a) * g, COL_HERO, alpha=0.8 * fade * (1 - prog(t, 18.6, 19.0)), width=1.6)
            hero_dot(c, cam, p, 7 if j == 0 else 5, COL_PERSON, fade * prog(t, tj - 0.2, tj))
    if t >= 17.4:
        label(c, t, cam, TEAM[0], "Owner", 24, SUB_ON_DARK, -26, 17.6, 19.0, alpha=fade)
    # the idea travels: Idea -> Building, stalls, flagged, then on to Live
    move = 0.6 * prog(t, 18.6, 19.9, e_io_cubic) + 0.4 * prog(t, 21.3, 22.1, e_io_cubic)
    ip = along([np.array(p, float) for p in SP], move)
    s, k = hero_dot(c, cam, ip, 12, BLUE_ON_DARK, fade * prog(t, 16.9, 17.3))
    # Pulse: rings from the stalled build, and the spine's Ideas vertebrae reach out to it
    for j in range(3):
        rt = 20.15 + 0.35 * j
        g = prog(t, rt, rt + 0.9, e_out_cubic)
        if 0 < g < 1 and t < 21.4:
            draw_dot(c, s[0], s[1], (14 + 60 * g) * k, BLUE_ON_DARK, 0.7 * (1 - g) * fade, ring=2.0 * k)
    flag = prog(t, 20.4, 20.8, e_io_cubic) * (1 - prog(t, 21.5, 21.9))
    if flag > 0:
        a = cam.to_screen(*((VERT[2] + VERT[3]) / 2))
        lines.line(a, a + (s - a) * flag, COL_HERO, alpha=0.9 * fade, width=2.0)
    draw_panel(c, cam, cards()["pulse"], alpha=card_alpha(t, 20.55, 21.7), shadow=0.5)


def draw_impact_story(c, t, cam, lines):
    """Live work reports hours saved; the points rise and connect into the line."""
    if not 22.2 <= t < 27.2:
        return
    fade = 1 - prog(t, 26.4, 27.0)
    scr = [cam.to_screen(*p) for p in CHART]
    base = [cam.to_screen(*(p * np.array([1, 0, 1]) + np.array([0, L6[1] + 120, 0]))) for p in CHART]
    for k in range(4):
        tk = 23.0 + 0.35 * k
        g = prog(t, tk, tk + 0.45, e_out_quint)
        if g <= 0:
            continue
        pos = base[k] + (scr[k] - base[k]) * g
        if k > 0:
            j = prog(t, tk + 0.2, tk + 0.5, e_io_cubic)
            if j > 0:
                a = scr[k - 1]
                lines.line(a, a + (pos - a) * j, COL_HERO, alpha=0.95 * fade, width=2.4)
        draw_dot(c, pos[0], pos[1], 7, BLUE_ON_DARK if k < 3 else (235, 240, 255), fade)
        draw_text(c, str(HOURS[k]), SEMI_TEXT, 28 if k < 3 else 40, WHITE, pos[0], pos[1] - 22,
                  align="center", reveal=g, alpha=fade)
        draw_text(c, MONTHS[k], MED, 24, SUB_ON_DARK, base[k][0], base[k][1] + 40, align="center",
                  reveal=prog(t, 22.7 + 0.1 * k, 23.1 + 0.1 * k, e_out_quint), alpha=fade)
    # the Impact vertebrae feed the line
    if 23.2 <= t < 26.4:
        a = cam.to_screen(*((VERT[4] + VERT[5]) / 2))
        g = prog(t, 23.2, 23.6, e_out_cubic) * (1 - prog(t, 25.8, 26.3))
        lines.line(a, a + (scr[0] - a) * g, COL_HERO, alpha=0.6 * fade, width=1.6)


# ---------------------------------------------------------------- scene

LIGHT_OPEN = (27.95, 28.5)


def background_at(t):
    if t < LIGHT_OPEN[0]:
        return dark_background().copy()
    if t >= LIGHT_OPEN[1]:
        return solid(LIGHT_B)
    o = prog(t, *LIGHT_OPEN)
    yc = HAND_Y
    top, bot = yc - o * (yc + 2), yc + o * (H - yc + 2)
    cov = coverage_1d(H, top, bot)[:, None, None]
    return dark_background() * (1 - cov) + LIGHT_B * cov


def render_scene(t):
    cam = camera_at(t)
    c = background_at(t).astype(np.float32)
    lines = LineLayer()
    if t >= 8.0:
        draw_network(c, t, cam, lines)
    elif t >= 0:
        # Before Spine: the same people, faint and unconnected.
        for n in NODES:
            s = cam.project([n["p"]])[0]
            d = float(cam.depth(n["p"])[0])
            draw_dot(c, s[0], s[1], 2.4, COL_PERSON, 0.10 * prog(t, 0.3, 1.5), min(5, abs(d) * 0.004))
    draw_question_story(c, t, cam, lines)
    draw_idea_story(c, t, cam, lines)
    draw_impact_story(c, t, cam, lines)
    lines.composite(c)
    segs = segments_at(t)
    for s in sorted(segs, key=lambda s: -float(cam.depth([s["x"], s["y"], s["z"]])[0])):
        g = s.pop("glow", 0.0)
        if g > 0:
            p = cam.to_screen(s["x"], s["y"], s["z"])
            draw_dot(c, p[0], p[1], 70 * cam.zoom, (60, 90, 200), 0.25 * g, 30)
            s["color"] = tuple(lerp(a, b, g) for a, b in zip((80, 110, 235), (175, 198, 255)))
        draw_segment(c, cam, s)
    draw_texts(c, t, cam, segs)
    return c


# ---------------------------------------------------------------- text

def T(canvas, t, text, fname, size, color, x, base, t_in, t_out=None, align="left", d_in=0.58, d_out=0.32):
    rv = prog(t, t_in, t_in + d_in, e_out_quint)
    ex = prog(t, t_out, t_out + d_out, e_io_cubic) if t_out is not None else 0.0
    draw_text(canvas, text, fname, size, color, x, base, align=align, reveal=rv, exit=ex)


def draw_texts(c, t, cam, segs):
    if t < 3.2:
        T(c, t, "Your company", SEMI, 112, WHITE, 150, 419, 0.42, 2.66)
        T(c, t, "has AI.", SEMI, 112, WHITE, 150, 549, 0.62, 2.72)
    if 3.0 <= t < 9.2:
        rows = [("Questions.", "Unanswered.", 3.20, SNAPS[0] - 0.08), ("Ideas.", "Stalled.", 5.29, SNAPS[1] - 0.08),
                ("Impact.", "Unproven.", 6.77, SNAPS[2] - 0.08)]
        for r, (w1, w2, ta, tb) in enumerate(rows):
            base = ROWS_Y[r] + 27
            out = 8.55 + 0.06 * r
            T(c, t, w1, SEMI, 74, WHITE, 150, base, ta, out)
            T(c, t, w2, DISP, 74, BLUE_ON_DARK, 150 + text_width(w1 + " ", SEMI, 74), base, tb, out)
    heads = [
        # (in, out, x, baseline, align, lines, sub lines)
        (9.9, 11.9, 960, 900, "center", ["Your AI project manager."], []),
        (13.0, 15.9, 120, 860, "left", ["Questions go", "to Champions."], ["Answered in private.", "Reused when asked again."]),
        (17.1, 19.3, 120, 820, "left", ["Every idea gets", "an owner and a team."], ["AI review. Approval. Build plan."]),
        (19.7, 21.9, 120, 820, "left", ["When work goes quiet,", "Spine flags it."], []),
        (22.95, 26.2, 1800, 190, "right", ["Impact you", "can measure."], ["Hours saved, logged every month."]),
    ]
    for t0, t1, x, base, align, lines_, sub in heads:
        if t0 - 0.1 <= t < t1 + 0.4:
            for k, line in enumerate(lines_):
                T(c, t, line, SEMI, 64, WHITE, x, base + k * 74, t0 + 0.1 * k, t1 + 0.03 * k, align=align)
            for k, line in enumerate(sub):
                T(c, t, line, REG, 32, SUB_ON_DARK, x, base + len(lines_) * 74 + 4 + k * 42,
                  t0 + 0.35 + 0.06 * k, t1 + 0.06, align=align)
    # Stage names under the bar, once the light has opened.
    if 28.2 <= t < 29.3:
        for i, name in enumerate(STAGES):
            s = segs[i]
            fn, col = (SEMI_TEXT, BRAND) if name == "Live" else (MED, INK_LABEL)
            T(c, t, name, fn, 36, col, s["x"], s["y"] + 54, 28.3 + 0.05 * i, 28.92 + 0.02 * i,
              align="center", d_in=0.4, d_out=0.22)


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
