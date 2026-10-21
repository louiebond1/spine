"""Soundtrack mix.

  python3 audio.py out/score.wav out/mix.wav [assets/vo/voiceover.wav]
Score (score.py) + quiet synthesised landing cues + the voiceover, with the music ducked
under the voice. The cues stay low (about -21 to -32 dBFS peak) so the voice stays clear,
and a limiter in build.sh keeps the final peak below -1.5 dBFS.
"""
import subprocess
import sys
import wave

import numpy as np

SR = 48000


def env(n, attack, tau):
    t = np.arange(n) / SR
    return np.minimum(t / attack, 1.0) * np.exp(-np.maximum(t - attack, 0) / tau)


def tick(freq=2600.0, dur=0.09):
    n = int(SR * dur)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * freq * t) * env(n, 0.0015, 0.016)
    rng = np.random.default_rng(int(freq))
    click = np.diff(np.r_[0, rng.standard_normal(n)]) * env(n, 0.0003, 0.002) * 0.25
    return tone + click


def thud(f0=150.0, f1=95.0, dur=0.22, tau=0.07):
    n = int(SR * dur)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.03)
    phase = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(phase) * env(n, 0.002, tau)


def land():
    a = thud()
    b = tick(1500.0, 0.06) * 0.5
    a[: len(b)] += b
    return a


def join():
    a = thud(170.0, 105.0, 0.26, 0.09)
    b = tick(1900.0, 0.08) * 0.7
    a[: len(b)] += b
    return a


def tap():
    return thud(220.0, 160.0, 0.14, 0.04)


def snap(seed=0):
    """A bar breaking: a dry crack (filtered noise burst) with a bright click and a small knock."""
    n = int(SR * 0.16)
    rng = np.random.default_rng(100 + seed)
    noise = rng.standard_normal(n)
    crack = np.diff(np.r_[0, noise]) * env(n, 0.0004, 0.012)
    t = np.arange(n) / SR
    click = np.sin(2 * np.pi * 3100 * t) * env(n, 0.0005, 0.006) * 0.6
    knock = thud(260.0, 140.0, 0.16, 0.03)[:n] * 0.5
    return crack + click + knock


def boom(f0=90.0, f1=42.0, dur=0.6, tau=0.22):
    """A sub drop under a hit."""
    return thud(f0, f1, dur, tau)


def swell(dur=0.35, seed=7):
    """Reversed-noise suck into a hit: rises and stops dead at the end."""
    n = int(SR * dur)
    rng = np.random.default_rng(seed)
    x = np.diff(np.r_[0, rng.standard_normal(n)])
    x = np.convolve(x, np.ones(6) / 6, "same")
    return x * (np.arange(n) / n) ** 3


def crack(seed=0):
    """A bar snapping: a hard broadband crack, a bright splinter and a sub boom."""
    n = int(SR * 0.6)
    t = np.arange(n) / SR
    rng = np.random.default_rng(200 + seed)
    noise = np.diff(np.r_[0, rng.standard_normal(n)])
    x = noise * env(n, 0.0003, 0.02) * 0.9
    x += rng.standard_normal(n) * env(n, 0.0005, 0.045) * 0.35
    x += np.sin(2 * np.pi * 2300 * t) * env(n, 0.0004, 0.008) * 0.5
    x += boom()[:n] * 0.9
    return x


def clack(big=False):
    """Two halves locking together: a double click, a knock and a short metallic ring."""
    n = int(SR * (0.7 if big else 0.4))
    t = np.arange(n) / SR
    x = np.zeros(n)
    for d, g in ((0.0, 1.0), (0.009, 0.7)):
        k = tick(3000.0, 0.05) * g
        i = int(d * SR)
        x[i:i + len(k)] += k
    k = thud(200.0, 120.0, 0.25, 0.05) * 0.8
    x[:len(k)] += k
    x += np.sin(2 * np.pi * 1760 * t) * env(n, 0.0005, 0.09) * 0.18
    if big:
        k = boom(80.0, 38.0, 0.7, 0.3)[:n] * 1.1
        x[:len(k)] += k
    return x


def beep(freq=1320.0, dur=0.16):
    """A soft monitor beep for each heartbeat in Pulse."""
    n = int(SR * dur)
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * freq * t) + 0.2 * np.sin(2 * np.pi * 2 * freq * t)) * env(n, 0.003, 0.05)


KINDS = {"tick": tick, "tick_hi": lambda: tick(3400.0), "land": land, "join": join, "tap": tap,
         "swell": swell, "crack0": lambda: crack(0), "crack1": lambda: crack(1), "crack2": lambda: crack(2),
         "clack": clack, "slam": lambda: clack(True), "beep": beep}

# (time s, kind, peak dBFS, pan -1..1). Times match the hits in timeline.py (IMPACTS).
CUES = [
    (5.15, "swell", -22, 0.2), (5.5, "crack0", -12, 0.3),         # the route ahead snaps; the music cuts out
    (10.45, "tick", -28, -0.3), (10.85, "tick", -28, -0.1),       # the idea reaches Approval, then Recruiting
    (11.65, "swell", -22, 0.3), (12.0, "crack1", -14, 0.3),       # the line to the passers-by snaps
    (19.55, "swell", -24, 0.4), (19.9, "crack2", -16, 0.5),       # the line to the chart snaps
    (22.15, "swell", -16, 0.0), (22.5, "slam", -10, 0.0),         # everything lines up on the spine
] + [(27.6 + 0.1 * k, "tick", -30, 0.3 + 0.2 * k) for k in range(3)] + [   # the question reaches the Champions
    (28.25, "tick_hi", -25, 0.5),                                 # Mia takes it
    (28.9, "clack", -15, 0.1), (29.3, "tap", -24, -0.1),          # she claims it; her answer
    (32.6, "tick_hi", -28, 0.0), (33.6, "tap", -22, -0.2),        # the project's name lifts out and lands on the board
    (35.3, "swell", -26, 0.0),                                    # the card grows into the frame
    (36.38, "tap", -22, 0.4), (36.75, "clack", -16, 0.2),         # Ben presses Join project; takes his seat
    (37.08, "tap", -22, 0.4), (37.45, "clack", -21, 0.3),         # Priya (softer: it lands just before a kick)
    (38.0, "land", -18, 0.0),                                     # the team is full: Building
] + [(38.4 + 0.15 * k, "tick", -30, 0.2 * k) for k in range(3)] + [   # the plan, a step for each of them
    (41.8, "beep", -19, -0.2),                                    # Pulse flags it
    (42.3, "tickf2400", -24, 0.5), (42.42, "tickf3200", -24, 0.5),   # the digest arrives in Slack
    (43.1, "tap", -22, 0.4),                                      # Open
    (43.7, "clack", -16, -0.2), (44.4, "clack", -17, 0.0),        # Mia, then Ben, tick their steps
    (45.85, "clack", -17, 0.2), (46.15, "tick", -26, 0.2), (46.6, "land", -17, 0.2),   # Priya; Publishing; Live
    (47.0, "tick_hi", -26, -0.2),                                 # the team logs its hours
] + [(48.4, 'tickf1400', -34, -0.4), (48.412, 'tickf1433', -34, -0.38), (48.424, 'tickf1466', -34, -0.36), (48.58, 'tickf1500', -34, -0.34), (48.592, 'tickf1536', -34, -0.32), (48.604, 'tickf1571', -34, -0.3), (48.616, 'tickf1608', -34, -0.28), (48.628, 'tickf1646', -34, -0.26), (48.64, 'tickf1684', -34, -0.24), (48.652, 'tickf1724', -34, -0.22), (48.664, 'tickf1764', -34, -0.2), (48.76, 'tickf1805', -34, -0.18), (48.772, 'tickf1847', -34, -0.16), (48.784, 'tickf1890', -34, -0.14), (48.796, 'tickf1935', -34, -0.12), (48.808, 'tickf1980', -34, -0.1), (48.82, 'tickf2026', -34, -0.08), (48.832, 'tickf2074', -34, -0.06), (48.844, 'tickf2122', -34, -0.04), (48.856, 'tickf2172', -34, -0.02), (48.868, 'tickf2222', -34, 0.0), (48.88, 'tickf2274', -34, 0.02), (48.892, 'tickf2327', -34, 0.04), (48.904, 'tickf2382', -34, 0.06), (48.916, 'tickf2438', -34, 0.08), (48.928, 'tickf2495', -34, 0.1), (48.94, 'tickf2553', -34, 0.12), (48.952, 'tickf2612', -34, 0.14), (48.964, 'tickf2674', -34, 0.16), (48.976, 'tickf2736', -34, 0.18), (48.988, 'tickf2800', -34, 0.2), (49.0, 'tickf2865', -34, 0.22), (49.012, 'tickf2932', -34, 0.24), (49.024, 'tickf3001', -34, 0.26), (49.036, 'tickf3071', -34, 0.28), (49.048, 'tickf3143', -34, 0.3), (49.06, 'tickf3216', -34, 0.32), (49.072, 'tickf3292', -34, 0.34), (49.084, 'tickf3368', -34, 0.36), (49.096, 'tickf3447', -34, 0.38), (49.108, 'tickf3528', -34, 0.4), (49.12, 'tickf3610', -34, 0.42), (49.132, 'tickf3695', -34, 0.44)] + [                                                        # the months stack up
    (49.4, "clack", -15, 0.4),                                    # the project's hours land on October
    (51.0, "swell", -26, 0.0),
    (56.55, "slam", -10, 0.0),                                    # the mark locks: the logo
]
PITCHED = (0.0, 0.0)                # no pitched tick sequence in this cut


def read_wav(path):
    with wave.open(path) as w:
        assert w.getframerate() == SR and w.getnchannels() == 2 and w.getsampwidth() == 2
        return np.frombuffer(w.readframes(w.getnframes()), np.int16).reshape(-1, 2).astype(np.float64) / 32768


def write_wav(path, x):
    y = np.clip(np.round(x * 32767), -32768, 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(y.tobytes())


def duck_curve(vo, depth_db=-7.0, attack=0.06, release=0.35):
    """Gain curve that lowers the music while the voice speaks."""
    lvl = np.abs(vo).max(axis=1)
    hop = 480
    n = len(lvl) // hop + 1
    env = np.array([lvl[i * hop:(i + 1) * hop].max(initial=0.0) for i in range(n)])
    active = env > 10 ** (-40 / 20)
    g = np.ones(n)
    a_up, a_dn = np.exp(-hop / SR / release), np.exp(-hop / SR / attack)
    target = 10 ** (depth_db / 20)
    cur = 1.0
    for i in range(n):
        goal = target if active[i] else 1.0
        k = a_dn if goal < cur else a_up
        cur = goal + (cur - goal) * k
        g[i] = cur
    return np.repeat(g, hop)[:len(vo)][:, None]


FILM_START = 3.4      # the film opens 3.4 s into the story (timeline.SHIFT); the mix is cut to match


def build(score_path, dst, vo_path=None):
    base = read_wav(score_path) * 10 ** (-3 / 20)
    fx = np.zeros_like(base)
    stage = 0
    for t, kind, db, pan in sorted(CUES):
        if kind == "tick" and PITCHED[0] <= t < PITCHED[1]:
            s = tick(2200.0 * (2 ** (stage / 12 * 2)))   # whole-tone steps upward
            stage += 1
        elif kind.startswith("tickf"):
            s = tick(float(kind[5:]), 0.06)
        else:
            s = KINDS[kind]()
        s = s / np.max(np.abs(s)) * 10 ** (db / 20)
        i = int(round(t * SR))
        n = min(len(s), len(fx) - i)
        gl, gr = np.sqrt((1 - pan) / 2), np.sqrt((1 + pan) / 2)
        fx[i:i + n, 0] += s[:n] * gl * np.sqrt(2)
        fx[i:i + n, 1] += s[:n] * gr * np.sqrt(2)
    mix_ = base + fx
    if vo_path:
        vo = read_wav(vo_path)[:len(mix_)]
        vo = np.pad(vo, ((0, len(mix_) - len(vo)), (0, 0)))
        mix_ = mix_ * duck_curve(vo) + vo
    mix_ = mix_[int(FILM_START * SR):].copy()
    mix_[:int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))[:, None]
    write_wav(dst, mix_)
    pk = np.max(np.abs(mix_))
    print(f"mix peak {20 * np.log10(pk):.2f} dBFS (before limiter)")


if __name__ == "__main__":
    build(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
