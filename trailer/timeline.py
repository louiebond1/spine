"""Choreography for the Spine launch trailer.

The film opens on three intact bars. Each snaps in two as its problem is spoken, giving the
six logo segments, which are tracked by index for the rest of the film:
  pair A = segments 0, 1  -> Questions -> top bar of the logo
  pair B = segments 2, 3  -> Ideas     -> middle bar of the logo
  pair C = segments 4, 5  -> Impact    -> bottom bar of the logo
The segments then travel through a world of real Spine screens (the final mockups in
/design), landing on the parts of each screen that do the work, and finally line up under
the real stage stepper before handing over to the approved cut's stage-to-logo fold.

Frames 0..878 are rendered here. Frame 879 onwards is the approved cut itself, and frames
969+ add a re-set tagline and button on its logo plate.
"""
import math
import os

import numpy as np

from engine import (
    W, H, FPS, Camera, SCREEN_CAM, Panel, default_seg, draw_segment, draw_text, draw_panel,
    draw_text_scaled, draw_backlight,
    dark_background, solid, prog, lerp, clamp, rot_matrix,
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

DESIGN = os.environ.get("SPINE_DESIGN_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "screens"))

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


def mix(a, b, p):
    out = dict(a)
    for k in KEYS:
        if k in a and k in b:
            out[k] = lerp(a[k], b[k], p)
    return out


# ---------------------------------------------------------------- the screens

_PANELS = {}


def panels():
    if not _PANELS:
        def P(name, centre, yaw, pitch):
            return Panel(os.path.join(DESIGN, name), centre, yaw=yaw, pitch=pitch)
        _PANELS.update(
            # Headline on the left -> the screen's left edge recedes (positive yaw), and vice versa.
            home=P("01-home.png", (1240.0, 560.0, 260.0), 20, 5),
            thread=P("03-question-thread.png", (4300.0, 560.0, 200.0), -20, 4),
            pipe=P("07-pipeline.png", (7400.0, 560.0, 200.0), 18, 6),
            pulse=P("09-pulse.png", (10500.0, 560.0, 200.0), -18, 4),
            prog=P("10-programme.png", (13600.0, 560.0, 200.0), 18, 6),
            ws=P("08-project-workspace.png", (16700.0, 560.0, 0.0), 0, 0),
        )
    return _PANELS


# Where the segments land on each screen, in mockup pixels: (u0, u1, v) per half.
LAND = {
    # Home "needs you" rows: Questions pair on the question row, Ideas on the approval row,
    # Impact on the project that is ready to publish.
    "home": {0: (350, 906, 502), 1: (918, 1475, 502), 2: (350, 906, 386), 3: (918, 1475, 386),
             4: (350, 906, 617), 5: (918, 1475, 617)},
    "thread": {0: (318, 660, 288), 1: (672, 1015, 288)},
    "pulse": {2: (439, 655, 600), 3: (667, 882, 600)},
    "prog": {4: (335, 632, 975), 5: (644, 940, 975)},
}
PIPE_COLS = [318, 580, 822, 1063, 1297]      # Approval, Recruiting, Building, Publishing, Live
PIPE_V = 364
STEP_U = [330, 426, 525, 624, 725, 822]      # stepper labels Idea .. Live
STEP_V = 372


def on_panel(name, u0, u1, v, T=10.0, rl=1.0, rr=1.0):
    p = panels()[name]
    c = p.world((u0 + u1) / 2, v, lift=1.0)
    return default_seg(x=c[0], y=c[1], z=c[2], L=(u1 - u0) * p.scale, T=T, rr=rr, rl=rl, flat=True,
                       **p.seg_rot())


def land(name, i, **kw):
    u0, u1, v = LAND[name][i]
    return on_panel(name, u0, u1, v, **kw)
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

def aim(pt, sx, sy, zoom, yaw=0.0, focal=1600.0):
    """Camera that shows world point pt at screen (sx, sy)."""
    cx, cy = pt[0], pt[1]
    for _ in range(4):
        p = Camera(cx, cy, zoom, yaw, focal=focal).to_screen(*pt)
        k = zoom * focal / (focal + pt[2])
        cx += (p[0] - sx) / k
        cy += (p[1] - sy) / k
    return (cx, cy, zoom, yaw, focal)


def shot(name, u, v, sx, sy, zoom, yaw=0.0):
    return aim(panels()[name].world(u, v), sx, sy, zoom, yaw)


_RAIL = None


def rail():
    """(time, camera) keys; the camera eases between consecutive keys and holds on equal ones."""
    global _RAIL
    if _RAIL is None:
        _RAIL = [
            (0.0, (960.0, 540.0, 1.0, 0.0, 2200.0)),
            (8.6, (960.0, 540.0, 1.05, 0.0, 2200.0)),
            (10.4, shot("home", 768, 512, 1340, 560, 0.74, 0.0)),
            (11.9, shot("home", 768, 512, 1290, 555, 0.82, -3.5)),
            (12.5, shot("thread", 768, 512, 600, 560, 0.74, 0.0)),
            (16.1, shot("thread", 768, 512, 650, 555, 0.82, 3.5)),
            (16.7, shot("pipe", 768, 512, 1340, 560, 0.74, 0.0)),
            (18.9, shot("pipe", 768, 512, 1290, 555, 0.82, -3.5)),
            (19.5, shot("pulse", 768, 512, 600, 560, 0.74, 0.0)),
            (22.0, shot("pulse", 768, 512, 650, 555, 0.82, 3.5)),
            (22.6, shot("prog", 768, 512, 1340, 560, 0.74, 0.0)),
            (26.5, shot("prog", 768, 512, 1290, 555, 0.82, -3.5)),
            (27.3, shot("ws", 576, 345, 960, 520, 1.05, 0.0)),
            (28.05, shot("ws", 576, 345, 960, 510, 1.25, 0.0)),
            (29.05, shot("ws", 576, 345, 960, 500, 2.70, 0.0)),
        ]
    return _RAIL


def camera_at(t):
    keys = rail()
    if t <= keys[0][0]:
        c = keys[0][1]
    elif t >= keys[-1][0]:
        c = keys[-1][1]
    else:
        for (ta, a), (tb, b) in zip(keys, keys[1:]):
            if ta <= t <= tb:
                p = prog(t, ta, tb)
                c = tuple(lerp(x, y, p) for x, y in zip(a, b))
                # A whip between screens tilts the camera through the move.
                if tb - ta < 0.9:
                    c = (c[0], c[1], c[2] * (1 - 0.12 * math.sin(math.pi * p)), c[3] + 7 * math.sin(math.pi * p), c[4])
                break
    return Camera(c[0], c[1], c[2], c[3], focal=c[4])


# ---------------------------------------------------------------- segment journeys

def travel(a, b, p, arc=260.0):
    """Move a segment state a -> b, lifting it towards the viewer mid-flight."""
    d = mix(a, b, p)
    d["z"] -= arc * math.sin(math.pi * p)
    d["flat"] = b.get("flat", False) if p > 0.5 else a.get("flat", False)
    return d


def pipe_state(i, t):
    """Ideas pair walking the pipeline headers, stopping at Building."""
    col = PIPE_COLS[0]
    for k, (t0, t1) in enumerate(((16.95, 17.45), (17.75, 18.25))):
        col = lerp(col, PIPE_COLS[k + 1], prog(t, t0, t1, e_io_quint))
    u0 = col + (0 if i == 2 else 104)
    return on_panel("pipe", u0, u0 + 96, PIPE_V)


def step_target(i):
    return on_panel("ws", STEP_U[i] - 36, STEP_U[i] + 36, STEP_V, T=6.0)


def segment_world(i, t):
    pair = i // 2
    if t < 8.62:
        return None
    # 1. Out of the problem rows and onto the Home screen's "needs you" rows.
    m = prog(t, 8.70 + 0.04 * i, 10.20 + 0.04 * i)
    s = travel(half_state(i, 8.62), land("home", i), m, arc=380)
    if i == 5:
        s["fill"] = max(1 - prog(t, SNAPS[2] + 0.3, SNAPS[2] + 0.95), prog(t, 8.9, 9.6))
        s["outline"] = 1 - prog(t, 9.4, 9.8, e_lin)
    # 2. Each pair goes on to its own screen.
    if pair == 0:
        J = prog(t, 13.65, 14.05, e_io_quint)
        th = land("thread", i, rr=(1 - J) if i == 0 else 1.0, rl=(1 - J) if i == 1 else 1.0)
        th["x"] += (6.0 if i == 0 else -6.0) * J
        s = travel(s, th, prog(t, 11.95 + 0.04 * i, 12.55 + 0.04 * i), arc=420)
    elif pair == 1:
        s = travel(s, pipe_state(i, t), prog(t, 16.15 + 0.04 * (i - 2), 16.75 + 0.04 * (i - 2)), arc=420)
        s = travel(s, land("pulse", i), prog(t, 18.95 + 0.04 * (i - 2), 19.55 + 0.04 * (i - 2)), arc=420)
    else:
        s = travel(s, land("prog", i), prog(t, 22.05 + 0.04 * (i - 4), 22.65 + 0.04 * (i - 4)), arc=420)
    # 3. Everyone converges on the real stage stepper, left to right.
    if t >= 26.4:
        if pair == 0:
            s["rl"], s["rr"] = 1.0, 1.0
        s = travel(s, step_target(i), prog(t, 26.5 + 0.12 * i, 27.55 + 0.12 * i), arc=520)
    return s


def segments_at(t, cam):
    """Six segment states, each tagged with the camera it should be drawn with."""
    if t < 3.5:
        out = []
        for k in range(3):
            a = bar_state(k, t)
            mm = prog(t, 2.72 + 0.07 * k, 3.34 + 0.07 * k)
            out.append(mix(a, whole_row(k), mm) if mm > 0 else a)
        return [(s, cam) for s in out]
    if t < 8.62:
        return [(s, cam) for s in problem_segments(t)]
    segs = [segment_world(i, t) for i in range(6)]
    # 4. Handoff: lift the six off the screen into the approved cut's stage bar.
    F = [prog(t, 28.35 + 0.03 * i, 29.12) for i in range(6)]
    out = []
    for i, s in enumerate(segs):
        if F[i] <= 0:
            out.append((s, cam))
            continue
        c = cam.to_screen(s["x"], s["y"], s["z"])
        k = cam.zoom * cam.focal / (cam.focal + s["z"])
        scr = default_seg(x=c[0], y=c[1], L=s["L"] * k, T=s["T"] * k, flat=True)
        tgt = default_seg(x=HAND_X[i], y=HAND_Y, L=HAND_L, T=HAND_T, flat=True)
        out.append((mix(scr, tgt, F[i]), SCREEN_CAM))
    return out


# ---------------------------------------------------------------- scene

LIGHT_AT = 28.35        # the workspace screen fills the frame; the world behind turns light
PANEL_FADE = (28.45, 28.95)


def visible_panels(t):
    out = [("home", 8.9, 12.7), ("thread", 11.9, 16.8), ("pipe", 16.1, 19.6), ("pulse", 18.9, 22.7),
           ("prog", 22.0, 27.0), ("ws", 26.3, 29.3)]
    return [n for n, a, b in out if a <= t < b]


def panel_alpha(name, t):
    if name == "home":
        return prog(t, 8.9, 9.7, e_out_cubic)
    if name == "ws":
        return 1 - prog(t, *PANEL_FADE, e_io_cubic)
    return 1.0


def render_scene(t):
    cam = camera_at(t)
    c = (solid(LIGHT_B) if t >= LIGHT_AT else dark_background().copy()).astype(np.float32)
    for name in visible_panels(t):
        p = panels()[name]
        sweep = -600 + 3600 * ((t * 0.35) % 1.0)
        if t < LIGHT_AT:
            bc = cam.to_screen(*p.world(p.w / 2, p.h / 2))
            draw_backlight(c, bc[0], bc[1], 0.55 * panel_alpha(name, t))
        draw_panel(c, cam, p, alpha=panel_alpha(name, t), shadow=0.0 if t >= LIGHT_AT else 0.6,
                   sheen=(sweep, 0.05))
    # The stall flag on Pulse: rises beside the stalled build as Spine flags it.
    fl = 64 * prog(t, 20.55, 20.85, e_out_quint)
    if fl > 0.5 and t < 22.7:
        p = panels()["pulse"]
        cw = p.world(326, 586 - fl / 2, lift=1.0)
        draw_segment(c, cam, default_seg(x=cw[0], y=cw[1], z=cw[2], L=fl, T=6, rz=-90, flat=True,
                                         color=BRAND, **p.seg_rot()))
    for s, scam in sorted(segments_at(t, cam), key=lambda sc: -sc[0]["z"]):
        draw_segment(c, scam, s)
    draw_texts(c, t, cam)
    return c


# ---------------------------------------------------------------- text helpers

HEAD_KEYS = [10.4, 12.5, 16.7, 19.5, 22.6]     # rail keys whose framing places each headline
_ANCHORS = {}


def head_anchor(key, sx, sy):
    """World point (on the z=0 plane) that the camera at rail time `key` shows at (sx, sy)."""
    k = (key, sx, sy)
    if k not in _ANCHORS:
        cam = camera_at(key)
        x, y = cam.cx + (sx - W / 2) / cam.zoom, cam.cy + (sy - H / 2) / cam.zoom
        for _ in range(6):
            p = cam.to_screen(x, y, 0.0)
            x += (sx - p[0]) / cam.zoom
            y += (sy - p[1]) / cam.zoom
        e = cam.to_screen(x + 100, y, 0.0)
        _ANCHORS[k] = ((x, y, 0.0), (e[0] - sx) / 100)
    return _ANCHORS[k]

def T(canvas, t, text, fname, size, color, x, base, t_in, t_out=None, align="left", d_in=0.58, d_out=0.32):
    rv = prog(t, t_in, t_in + d_in, e_out_quint)
    ex = prog(t, t_out, t_out + d_out, e_io_cubic) if t_out is not None else 0.0
    draw_text(canvas, text, fname, size, color, x, base, align=align, reveal=rv, exit=ex)


def text_w(s, f, size):
    from engine import text_width
    return text_width(s, f, size)


def draw_texts(c, t, cam):
    # 1. Your company has AI.
    if t < 3.2:
        T(c, t, "Your company", SEMI, 112, WHITE, 150, 419, 0.42, 2.66)
        T(c, t, "has AI.", SEMI, 112, WHITE, 150, 549, 0.62, 2.72)
    # 2. Each issue word lands with its bar's snap.
    if 3.0 <= t < 9.2:
        rows = [("Questions.", "Unanswered.", 3.20, SNAPS[0] - 0.08), ("Ideas.", "Stalled.", 5.29, SNAPS[1] - 0.08),
                ("Impact.", "Unproven.", 6.77, SNAPS[2] - 0.08)]
        for r, (w1, w2, ta, tb) in enumerate(rows):
            base = ROWS_Y[r] + 27
            out = 8.55 + 0.06 * r
            T(c, t, w1, SEMI, 74, WHITE, 150, base, ta, out)
            T(c, t, w2, DISP, 74, BLUE_ON_DARK, 150 + text_w(w1 + " ", SEMI, 74), base, tb, out)
    # 3-6. Headlines sit in the open space beside each screen.
    heads = [
        (9.75, 11.75, 110, 400, ["Your AI", "project", "manager."], None),
        (12.6, 15.95, 1300, 450, ["Questions go", "to Champions."], ["Answered in private.", "Reused when asked again."]),
        (16.85, 18.75, 110, 360, ["Every idea gets", "an owner", "and a team."], ["AI review. Approval.", "Build plan."]),
        (19.65, 21.85, 1300, 400, ["When work", "goes quiet,", "Spine flags it."], None),
        (22.75, 26.35, 110, 450, ["Impact you", "can measure."], ["Hours saved, logged", "every month."]),
    ]
    for (t0, t1, x, base, lines, sub), key in zip(heads, HEAD_KEYS):
        if t0 - 0.1 <= t < t1 + 0.9:
            items = [(line, SEMI, 76, WHITE, base + k * 88, t0 + 0.12 * k) for k, line in enumerate(lines)]
            items += [(line, REG, 38, SUB_ON_DARK, base + len(lines) * 88 + 8 + k * 50, t0 + 0.4 + 0.06 * k)
                      for k, line in enumerate(sub or [])]
            for text, fn, size, col, b, tin in items:
                # The type is anchored in the world beside its screen, so it moves with the camera.
                anchor, ref = head_anchor(key, x, b)
                sx, sy = cam.to_screen(*anchor)
                ex = cam.to_screen(anchor[0] + 100, anchor[1], anchor[2])
                scale = (ex[0] - sx) / 100 / ref
                rv = prog(t, tin, tin + 0.58, e_out_quint)
                draw_text_scaled(c, text, fn, size, col, sx, sy, scale=scale, reveal=rv)
    # 7. Stage names: the screen's own labels resolve into crisp type as the screen dissolves.
    if 28.3 <= t < 29.3:
        segs = segments_at(t, cam)
        a = prog(t, *PANEL_FADE, e_io_cubic)
        for i, name in enumerate(STAGES):
            s, scam = segs[i]
            sx, sy = scam.to_screen(s["x"], s["y"], s["z"])
            ex = prog(t, 28.98 + 0.02 * i, 29.2 + 0.02 * i * 0.3, e_io_cubic)
            draw_text(c, name, MED, 34, INK_LABEL, sx, sy - 26, align="center", reveal=1.0, exit=ex, alpha=a)


# ---------------------------------------------------------------- end card

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
