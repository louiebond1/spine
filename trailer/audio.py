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


KINDS = {"tick": tick, "tick_hi": lambda: tick(3400.0), "land": land, "join": join, "tap": tap,
         "snap0": lambda: snap(0), "snap1": lambda: snap(1), "snap2": lambda: snap(2)}

# (time s, kind, peak dBFS, pan -1..1). Times match landings in timeline.py.
CUES = [
    (3.70, "snap0", -21, 0.25),     # the line falls short of the question
    (5.95, "snap1", -21, 0.25),     # the idea's line sags
    (8.00, "snap2", -21, 0.25),     # impact's line breaks up
    (9.55, "join", -24, 0.0),       # pulled taut: Spine
    (14.20, "tick_hi", -30, 0.3),   # the line reaches the Champion
    (15.00, "land", -28, 0.3),      # Answered.
    (18.00, "tick", -32, -0.2),     # Recruiting
    (18.75, "tick", -31, 0.0),      # Building
    (19.80, "tap", -26, 0.0),       # Pulse: heartbeat as Spine flags the stall
    (20.12, "tap", -29, 0.0),
    (20.44, "tap", -32, 0.0),
    (21.45, "tick", -32, 0.3),      # Publishing
    (21.95, "land", -28, 0.45),     # Live
    (27.90, "tick_hi", -32, 0.0),   # from idea to live: the line completes
    (34.50, "land", -28, 0.0),      # Book a demo button lands
]
for k in range(4):                  # hours saved: each month's point, rising pitch
    CUES.append((23.10 + 0.42 * k, "tick", -31, -0.5 + 0.33 * k))
PITCHED = (23.0, 24.6)              # cues in this window step up a whole tone each


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
