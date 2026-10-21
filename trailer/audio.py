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


KINDS = {"tick": tick, "tick_hi": lambda: tick(3400.0), "land": land, "join": join, "tap": tap,
         "swell": swell, "crack0": lambda: crack(0), "crack1": lambda: crack(1), "crack2": lambda: crack(2),
         "clack": clack, "slam": lambda: clack(True)}

# (time s, kind, peak dBFS, pan -1..1). Times match the hits in timeline.py (IMPACTS).
CUES = [
    (4.15, "swell", -20, 0.0), (4.5, "crack0", -13, -0.1),       # Questions. / Unanswered.
    (6.15, "swell", -20, 0.0), (6.5, "crack1", -13, 0.1),        # Builds. / Gone quiet.
    (8.15, "swell", -20, 0.0), (8.5, "crack2", -13, 0.0),        # Hours saved? / Nobody knows.
    (12.65, "swell", -16, 0.0), (13.0, "slam", -10, 0.0),        # the six pieces slam into the mark
    (20.0, "clack", -16, -0.3),     # underline locks: Every question gets a Champion.
    (23.0, "clack", -16, -0.3),     # An owner. A team. A plan.
    (26.0, "clack", -16, -0.3),     # Impact, in hours.
    (30.0, "slam", -14, -0.3), (30.25, "slam", -14, 0.3), (30.5, "slam", -11, 0.0),   # logo bars lock
    (33.0, "tick", -24, 0.0),       # Book a demo button draws
]
PITCHED = (0.0, 0.0)                # no pitched sequence in this cut


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


def build(score_path, dst, vo_path=None):
    base = read_wav(score_path) * 10 ** (-3 / 20)
    fx = np.zeros_like(base)
    stage = 0
    for t, kind, db, pan in sorted(CUES):
        if kind == "tick" and PITCHED[0] <= t < PITCHED[1]:
            s = tick(2200.0 * (2 ** (stage / 12 * 2)))   # whole-tone steps upward
            stage += 1
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
    write_wav(dst, mix_)
    pk = np.max(np.abs(mix_))
    print(f"mix peak {20 * np.log10(pk):.2f} dBFS (before limiter)")


if __name__ == "__main__":
    build(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
