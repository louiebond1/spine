"""Choreography for the Spine launch trailer (polished cut).

The six logo segments are tracked by index for the whole film:
  pair A = segments 0, 1  -> Answers  -> top bar of the logo
  pair B = segments 2, 3  -> Ideas    -> middle bar of the logo
  pair C = segments 4, 5  -> Impact   -> bottom bar of the logo
Frames 0..878 are rendered here. Frame 879 onwards (the stage-bar-to-logo fold) is the
approved cut itself, and frames 969+ add a re-set tagline and button on its logo plate.
All times are seconds and were chosen against the original soundtrack's measured events.
"""
import math

import numpy as np
from PIL import Image

from engine import (
    W, H, FPS, Camera, SCREEN_CAM, default_seg, draw_segment, draw_text, rect_aa, blend,
    dark_background, solid, coverage_1d, prog, lerp, clamp, rot_matrix,
    e_io_cubic, e_io_quint, e_out_cubic, e_out_quint, e_out_expo, e_in_cubic, e_lin,
    LIGHT_A, LIGHT_B, INK, INK_SOFT, INK_LABEL, WHITE, BLUE_ON_DARK, SUB_ON_DARK, BRAND, BUTTON,
)

HANDOFF = 879      # first frame taken from the approved cut (29.30 s)
END_PLATE = 969    # first end-card frame (32.30 s)
TOTAL = 1140       # 38.0 s

SEMI = "InterDisplay-SemiBold.otf"
DISP = "InterDisplay-Regular.otf"
MED = "Inter-Medium.otf"
SEMI_TEXT = "Inter-SemiBold.otf"
REG = "Inter-Regular.otf"

STAGES = ["Draft", "Approval", "Forming team", "Building", "Launching", "Live"]
# Screen geometry of the approved cut's settled stage bar at 29.30 s (measured).
HAND_X = [305.05 + 260 * i for i in range(6)]
HAND_Y, HAND_L, HAND_T = 491.25, 250.5, 13.3
FINAL_CX = 2200.0

# Opening cluster: offsets (x, y, z) and resting rotation (rx, ry, rz) per segment.
CLUSTER_C = np.array([1440.0, 540.0, 0.0])
CLUSTER = [(-110, -250, 140, 8, 25, -6), (115, -165, -90, -5, -20, 4), (-95, -55, 70, 4, 30, -3),
           (125, 45, -130, -6, -25, 5), (-85, 150, 10, 6, 18, -4), (135, 255, 100, -4, -28, 3)]
ROWS_Y = [330.0, 540.0, 750.0]

# World layout of the three stations after the row splits (pair centres).
SPLIT_B, SPLIT_C = 976.0, 2452.0          # B: 960 -> 1936, C: 1384 -> 3836
B_TRAVEL = 413.0
TRACK_X0, TRACK_X1, TRACK_Y = 1730.0, 2555.0, 622.0
FLAG_X = 2383.0
DARK_EDGE_X = 2860.0
CAM_S4 = (536.0, 485.0)
CAM_S5 = (2124.0, 437.5)
CAM_S6 = (3592.5, 462.5)
BOX = (930.0, 672.0, 1360.0, 880.0)       # project-team frame in Impact (screen)
SEG4_RECT = (1036.0, 748.0, 1324.0, 772.0)  # inside segment 4 on screen in Impact
DARK_END = 27.24
S6_LAND = (1540.0, 760.0)                 # where the outside segment docks (screen)

KEYS = ("x", "y", "z", "L", "T", "rx", "ry", "rz", "rl", "rr", "fill", "outline", "shadow")


def mix(a, b, p):
    out = dict(a)
    for k in KEYS:
        if k in a and k in b:
            out[k] = lerp(a[k], b[k], p)
    return out


def s3_x(i, sp):
    return 960 + (i - 2.5) * sp


# ---------------------------------------------------------------- camera

def camera_at(t):
    cx, cy, z, yaw = 960.0, 540.0, 1.0, 0.0
    if t >= 9.54:
        z = 1 + 0.03 * prog(t, 9.54, 11.68, e_lin)
    if t >= 11.68:
        P = prog(t, 11.68, 12.32)
        cx, cy, z = lerp(960, CAM_S4[0], P), lerp(540, CAM_S4[1], P), lerp(1.03, 2.0, P)
        yaw = 9 * math.sin(math.pi * P)
    if t >= 12.32:
        cx, cy, z, yaw = CAM_S4[0], CAM_S4[1], 2.0 + 0.04 * prog(t, 12.32, 16.18, e_lin), 0.0
    if t >= 16.18:
        P = prog(t, 16.18, 16.76)
        cx, cy, z = lerp(CAM_S4[0], CAM_S5[0], P), lerp(CAM_S4[1], CAM_S5[1], P), lerp(2.04, 1.6, P)
        yaw = -7 * math.sin(math.pi * P)
    if t >= 16.76:
        cx, cy, z, yaw = CAM_S5[0], CAM_S5[1], 1.6 + 0.025 * prog(t, 16.76, 21.95, e_lin), 0.0
    if t >= 21.95:
        P = prog(t, 21.95, 22.62)
        cx, cy, z = lerp(CAM_S5[0], CAM_S6[0], P), lerp(CAM_S5[1], CAM_S6[1], P), lerp(1.625, 1.6, P)
        yaw = -6 * math.sin(math.pi * P)
    if t >= 22.62:
        cx, cy, z, yaw = CAM_S6[0], CAM_S6[1], 1.6, 0.0
    if t >= 27.2:
        K = prog(t, 27.2, 28.05)
        cx, cy, z = lerp(CAM_S6[0], FINAL_CX, K), lerp(CAM_S6[1], 540, K), lerp(1.6, 1.025, K)
        yaw = 5 * math.sin(math.pi * K)
    if t >= 28.05:
        cx, cy, z, yaw = FINAL_CX, 540.0, lerp(1.025, 1.0, prog(t, 28.05, 29.1)), 0.0
    return Camera(cx, cy, z, yaw)


def screen_to_world(cam_xy, zoom, sx, sy):
    return cam_xy[0] + (sx - W / 2) / zoom, cam_xy[1] + (sy - H / 2) / zoom


# ---------------------------------------------------------------- segment states

def cluster_state(i, t):
    ox, oy, oz, rx, ry, rz = CLUSTER[i]
    yaw = lerp(-24, 16, clamp(t / 3.4))
    G = rot_matrix(8, yaw, 0)
    off = G @ np.array([ox, oy, oz], float)
    s = e_out_expo((t - 0.06 * i) / 1.25)
    far = CLUSTER_C + np.array([ox * 2.5, oy * 2.5, 9000.0])
    pos = far + (CLUSTER_C + off - far) * s
    spin = 1 - s
    sign = 1 if i % 2 else -1
    return default_seg(x=pos[0], y=pos[1], z=pos[2], L=180, T=26,
                       rx=rx + 140 * spin * sign, ry=ry + yaw + 80 * spin, rz=rz + 60 * spin * (-sign),
                       alpha=prog(t, 0.0, 0.2, e_lin))


def problem_state(i, t):
    x = 1255.0 if i % 2 == 0 else 1535.0
    d = default_seg(x=x, y=ROWS_Y[i // 2], L=230, T=22)
    if i == 1:   # Questions: the answer half reaches, never connects, and drifts off
        d["x"] += -40 * prog(t, 3.85, 4.25) + 100 * prog(t, 4.25, 4.8, e_out_cubic)
        d["rz"] = -3 * prog(t, 4.25, 4.8, e_out_cubic)
    if i == 3:   # Ideas: the second half loses momentum and droops
        p = prog(t, 5.9, 6.45, e_out_cubic)
        d["rz"], d["y"], d["x"] = 7 * p, d["y"] + 16 * p, d["x"] - 6 * p
    if i == 5:   # Impact: the proof half drains to an empty outline
        d["fill"] = 1 - prog(t, 7.5, 8.2)
        d["outline"] = prog(t, 7.42, 7.6, e_lin)
    return d


def row_state(i, t, sp):
    return default_seg(x=s3_x(i, sp), y=600.0, L=200, T=20)


def station_states(t):
    """Segments from the row split onward, in world space. Returns a list of 6 dicts (or merged A)."""
    sp = 212.0
    psplit = prog(t, 11.66, 12.32)
    segs = []
    for i in range(6):
        d = row_state(i, t, sp)
        if i in (2, 3):
            d["x"] += SPLIT_B * psplit
        if i in (4, 5):
            d["x"] += SPLIT_C * psplit
        segs.append(d)
    # Answers: Company rules + Champion slide together and become one bar.
    J = prog(t, 14.05, 14.54, e_io_quint)
    segs[0]["x"] += 6.5 * J
    segs[1]["x"] -= 6.5 * J
    segs[0]["rr"] = 1 - J
    segs[1]["rl"] = 1 - J
    # Ideas: the pair travels the track, stalls, is surfaced, then completes.
    tr = 0.55 * prog(t, 18.43, 19.54) + 0.45 * prog(t, 20.37, 21.21)
    segs[2]["x"] += B_TRAVEL * tr
    segs[3]["x"] += B_TRAVEL * tr
    # Impact: the verifying half leaves the team and returns from outside.
    s5 = segs[5]
    if t >= 21.95:
        p = prog(t, 21.95, 22.45, e_in_cubic)
        s5["y"] = lerp(600, -500, p)
        s5["rz"] = -30 * p
    if t >= 24.0:
        pe = prog(t, 24.0, 24.84, e_io_cubic)
        # Crosses behind the headline, then descends outside the team frame's right edge.
        P0, P1, P2 = np.array([-280.0, 110.0]), np.array([1700.0, 200.0]), np.array(S6_LAND)
        sp_ = (1 - pe) ** 2 * P0 + 2 * (1 - pe) * pe * P1 + pe ** 2 * P2
        s5["x"], s5["y"] = screen_to_world(CAM_S6, 1.6, sp_[0], sp_[1])
        s5["rz"] = lerp(-26, 0, pe)
        s5["ry"] = lerp(60, 0, pe)
    return segs


def final_target(i):
    return default_seg(x=HAND_X[i] - W / 2 + FINAL_CX, y=HAND_Y, L=HAND_L, T=HAND_T, flat=True)


def segments_at(t):
    if t < 3.4:
        out = []
        for i in range(6):
            m = prog(t, 2.72 + 0.035 * i, 3.34 + 0.035 * i)
            a = cluster_state(i, t)
            out.append(mix(a, problem_state(i, t), m) if m > 0 else a)
            out[-1]["alpha"] = a["alpha"] if m <= 0 else 1.0
        return out
    if t < 9.54 + 1e-6:
        out = []
        for i in range(6):
            m = prog(t, 8.62 + 0.03 * i, 9.39 + 0.03 * i, e_io_quint)
            a = problem_state(i, t)
            b = row_state(i, t, 240)
            d = mix(a, b, m)
            if i == 5:
                d["fill"] = prog(t, 8.75, 9.3)
                d["outline"] = 1 - prog(t, 9.0, 9.35, e_lin)
            out.append(d)
        return out
    if t < 11.66:
        sp = lerp(240, 212, prog(t, 10.0, 10.26))
        return [row_state(i, t, sp) for i in range(6)]
    segs = station_states(t)
    J = prog(t, 14.05, 14.54, e_io_quint)
    merged = J >= 1.0
    F = [prog(t, 27.2 + 0.03 * i, 28.05) for i in range(6)]
    if t >= 27.2:
        out = []
        for i in range(6):
            d = segs[i]
            if i in (0, 1):
                d["rl"], d["rr"] = (1.0, 0.0) if i == 0 else (0.0, 1.0)
            out.append(mix(d, final_target(i), F[i]) if F[i] > 0 else d)
            out[-1]["flat"] = F[i] > 0.6
        return out
    if merged:
        a = default_seg(x=(segs[0]["x"] + segs[1]["x"]) / 2, y=600.0, L=399.0, T=20.0)
        return [a] + segs[2:]
    return segs


# ---------------------------------------------------------------- background

def background_at(t, cam):
    if t < 9.50:
        return dark_background().copy()
    if t < 10.05:
        open_ = prog(t, 9.50, 10.05)
        yc = cam.to_screen(960, 600)[1]
        top, bot = yc - open_ * (yc + 2), yc + open_ * (H - yc + 2)
        cov = coverage_1d(H, top, bot)[:, None, None]
        return dark_background() * (1 - cov) + LIGHT_A * cov
    if t < 21.95:
        return solid(LIGHT_A)
    if t < 22.62:
        ex = cam.to_screen(DARK_EDGE_X, 600)[0]
        cov = coverage_1d(W, ex, W + 10)[None, :, None]
        return solid(LIGHT_A) * (1 - cov) + dark_background() * cov
    if t < 26.5:
        return dark_background().copy()
    rect = dark_rect(t)
    if rect is None:
        return solid(LIGHT_B)
    x0, y0, x1, y1 = rect
    cov = coverage_1d(H, y0, y1)[:, None, None] * coverage_1d(W, x0, x1)[None, :, None]
    return solid(LIGHT_B) * (1 - cov) + dark_background() * cov


def dark_rect(t):
    """The Impact scene's darkness contracts into the project-team frame, then closes."""
    if t >= DARK_END:
        return None
    Q = prog(t, 26.5, 27.0)
    R = prog(t, 27.0, DARK_END)
    full = (-40.0, -40.0, W + 40.0, H + 40.0)
    rect = (lerp(f, b, Q) for f, b in zip(full, BOX))
    return tuple(lerp(a, b, R) for a, b in zip(rect, SEG4_RECT))


# ---------------------------------------------------------------- text helper

def T(canvas, t, text, fname, size, color, x, base, t_in, t_out=None, align="left", d_in=0.58, d_out=0.32):
    rv = prog(t, t_in, t_in + d_in, e_out_quint)
    ex = prog(t, t_out, t_out + d_out, e_io_cubic) if t_out is not None else 0.0
    draw_text(canvas, text, fname, size, color, x, base, align=align, reveal=rv, exit=ex)


def seg_screen(cam, s):
    p = cam.to_screen(s["x"], s["y"], s["z"])
    return p, s["T"] * cam.zoom


# ---------------------------------------------------------------- scene

def render_scene(t):
    cam = camera_at(t)
    c = background_at(t, cam).astype(np.float32)
    segs = segments_at(t)
    light = 9.5 <= t < 22.3
    sh = prog(t, 9.5, 10.0, e_lin) if light else 0.0

    # Ideas track and stall flag, behind the segments.
    if 17.5 <= t < 27.1:
        xe = lerp(TRACK_X0, TRACK_X1, prog(t, 17.6, 18.2))
        xs = lerp(TRACK_X0, TRACK_X1, prog(t, 26.6, 27.1))
        if xe > xs + 0.5:
            a = cam.to_screen(xs, TRACK_Y)
            b = cam.to_screen(xe, TRACK_Y)
            rect_aa(c, a[0], a[1] - 1.25, b[0], b[1] + 1.25, (206, 210, 222))
        fl = 36 * prog(t, 19.54, 19.87, e_out_quint) * (1 - prog(t, 26.6, 27.0))
        if fl > 0.5:
            ang = lerp(-90, 0, prog(t, 20.30, 20.55))
            cxw = FLAG_X + math.cos(math.radians(ang)) * fl / 2
            cyw = TRACK_Y + math.sin(math.radians(ang)) * fl / 2
            draw_segment(c, cam, default_seg(x=cxw, y=cyw, L=fl, T=6, rz=ang, flat=True, color=BRAND))

    for s in sorted(segs, key=lambda s: -s["z"]):
        if light and s["shadow"] == 0:
            s["shadow"] = sh
        draw_segment(c, cam, s)

    # Brackets: the project team's frame in Impact.
    if 23.3 <= t < DARK_END:
        draw_brackets(c, t)

    draw_texts(c, t, cam, segs)
    return c


def draw_brackets(c, t):
    col = (100, 130, 250)
    rect = dark_rect(t) if t >= 27.0 else None
    corners = []
    starts = [(-420, -320), (420, -320), (420, 320), (-420, 320)]
    box_c = [(BOX[0], BOX[1]), (BOX[2], BOX[1]), (BOX[2], BOX[3]), (BOX[0], BOX[3])]
    for k in range(4):
        pe = prog(t, 23.40 + 0.05 * k, 24.05 + 0.05 * k, e_out_quint)
        if rect is not None:
            x0, y0, x1, y1 = rect
            box_c_k = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)][k]
            corners.append((box_c_k[0], box_c_k[1], 1.0 - prog(t, 27.0, DARK_END, e_lin)))
        else:
            corners.append((box_c[k][0] + starts[k][0] * (1 - pe), box_c[k][1] + starts[k][1] * (1 - pe), pe))
    if rect is not None:
        arm = min(54.0, (rect[3] - rect[1]) / 2, (rect[2] - rect[0]) / 2)
    else:
        arm = 54.0
    sw = 4.0
    for k, (x, y, a) in enumerate(corners):
        if a <= 0:
            continue
        sx = 1 if k in (0, 3) else -1
        sy = 1 if k in (0, 1) else -1
        hx0, hx1 = sorted((x, x + sx * arm))
        vy0, vy1 = sorted((y, y + sy * arm))
        ox = 0 if sx > 0 else -sw
        oy = 0 if sy > 0 else -sw
        rect_aa(c, hx0, y + oy, hx1, y + oy + sw, col, min(1, a * 1.5))
        rect_aa(c, x + ox, vy0, x + ox + sw, vy1, col, min(1, a * 1.5))


def draw_texts(c, t, cam, segs):
    # 1. Your company has AI.
    if t < 3.2:
        T(c, t, "Your company", SEMI, 112, WHITE, 150, 419, 0.42, 2.66)
        T(c, t, "has AI.", SEMI, 112, WHITE, 150, 549, 0.62, 2.72)
    # 2. Questions / Ideas / Impact.
    if 3.0 <= t < 9.2:
        rows = [("Questions.", "Unanswered.", 3.20, 3.74), ("Ideas.", "Stalled.", 5.29, 5.82),
                ("Impact.", "Unproven.", 6.77, 7.44)]
        for r, (w1, w2, ta, tb) in enumerate(rows):
            base = ROWS_Y[r] + 27
            out = 8.55 + 0.06 * r
            T(c, t, w1, SEMI, 74, WHITE, 150, base, ta, out)
            x2 = 150 + text_w(w1 + " ", SEMI, 74)
            T(c, t, w2, DISP, 74, BLUE_ON_DARK, x2, base, tb, out)
    # 3. Bring it together.
    if 9.5 <= t < 12.1:
        T(c, t, "Bring it together.", SEMI, 120, INK, 960, 430, 9.80, 11.62, align="center")
        T(c, t, "AI adoption, connected.", REG, 46, INK_SOFT, 960, 712, 10.30, 11.66, align="center")
    # 4. Answers.
    if 12.2 <= t < 16.9:
        T(c, t, "Answers grounded", SEMI, 96, INK, 150, 248, 12.32, 16.15)
        T(c, t, "in your company’s rules.", SEMI, 96, INK, 150, 360, 12.60, 16.20)
        T(c, t, "Human Champions. Shared answers.", REG, 46, INK_SOFT, 150, 446, 13.05, 16.22)
        if t < 14.7:
            for i, (lab, tin) in enumerate((("Company rules", 13.43), ("Champion", 13.71))):
                (sx, sy), th = seg_screen(cam, segs[i])
                T(c, t, lab, MED, 40, INK, sx, sy + th / 2 + 60, tin, 14.28, align="center", d_in=0.45)
        if t >= 14.5:
            (sx, sy), th = seg_screen(cam, segs[0])
            T(c, t, "Answered.", SEMI, 50, BRAND, sx, sy + th / 2 + 62, 14.56, 16.15, align="center", d_in=0.5)
    # 5. Ideas.
    if 16.9 <= t < 22.7:
        T(c, t, "Ideas, backed", SEMI, 96, INK, 150, 248, 17.04, 21.92)
        T(c, t, "by people and ownership.", SEMI, 96, INK, 150, 360, 17.32, 21.96)
        T(c, t, "Clear owners. Stalls surfaced.", REG, 46, INK_SOFT, 150, 446, 17.88, 21.98)
        ib = 1 if len(segs) == 5 else 2
        for k, (lab, tin) in enumerate((("People", 18.15), ("Ownership", 18.29))):
            (sx, sy), th = seg_screen(cam, segs[ib + k])
            T(c, t, lab, MED, 40, INK, sx, sy - th / 2 - 24, tin, 21.90, align="center", d_in=0.45)
        ex, ey = cam.to_screen(TRACK_X1, TRACK_Y)
        g = prog(t, 21.21, 21.5, e_lin)
        col = tuple(lerp(a, b, g) for a, b in zip(INK_SOFT, BRAND))
        T(c, t, "Progress", MED, 40, col, ex, ey + 52, 18.2, 21.94, align="right", d_in=0.45)
    # 6. Impact.
    if 22.6 <= t < 27.0:
        T(c, t, "Impact you", SEMI, 110, WHITE, 150, 262, 23.14, 26.50)
        T(c, t, "can prove.", SEMI, 110, WHITE, 150, 390, 23.58, 26.55)
        T(c, t, "Verified outside the project team.", REG, 46, SUB_ON_DARK, 150, 474, 24.16, 26.58)
        ia = 3 if len(segs) == 5 else 4
        (sx, sy), th = seg_screen(cam, segs[ia])
        T(c, t, "Reported.", MED, 42, SUB_ON_DARK, sx, sy + th / 2 + 58, 23.85, 25.10, align="center", d_in=0.45)
        T(c, t, "Verified.", SEMI, 46, BLUE_ON_DARK, sx, sy + th / 2 + 58, 25.18, 26.50, align="center", d_in=0.45)
    # 7. Stages.
    if 27.9 <= t < 29.3:
        for i, name in enumerate(STAGES):
            (sx, sy), th = seg_screen(cam, segs[i])
            fn, col = (SEMI_TEXT, BRAND) if name == "Live" else (MED, INK_LABEL)
            T(c, t, name, fn, 36, col, sx, sy + 54, 27.92 + 0.05 * i, 28.92 + 0.02 * i,
              align="center", d_in=0.4, d_out=0.22)


def text_w(s, f, size):
    from engine import text_width
    return text_width(s, f, size)


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
