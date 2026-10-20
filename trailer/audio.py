"""Soundtrack: the approved cut's own mix (voiceover + score) plus quiet synthesised landing cues.

  python3 audio.py assets/original_audio.wav out/mix.wav
The cues are deliberately low (about -24 to -34 dBFS peak) so the voiceover stays clear,
and a limiter in mux.sh keeps the final peak below -1.5 dBFS.
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
    (3.88, "snap0", -21, 0.25),     # Questions bar snaps (timeline.SNAPS)
    (6.00, "snap1", -21, 0.25),     # Ideas bar snaps
    (7.62, "snap2", -21, 0.25),     # Impact bar snaps
    (9.54, "land", -27, 0.0),       # six pieces land in one row as the light opens
    (10.26, "tick", -32, 0.0),      # row tightens: connected
    (14.54, "join", -25, 0.0),      # Company rules + Champion join: Answered
    (19.54, "tap", -29, 0.15),      # Ideas pair stalls
    (19.62, "tick", -33, 0.2),      # stall flag surfaces
    (20.40, "tick", -34, 0.2),      # flag folds, work resumes
    (21.21, "land", -28, 0.35),     # pair arrives at Progress
    (24.84, "land", -26, 0.3),      # outside verifier docks against the team frame
    (25.12, "tick_hi", -31, 0.1),   # Reported. becomes Verified.
    (27.0, "tap", -30, 0.1),        # the dark scene closes into the frame
    (34.50, "land", -28, 0.0),      # Book a demo button lands
]
for i in range(6):                  # stage labels, left to right, rising pitch
    CUES.append((27.92 + 0.05 * i, "tick", -34, -0.6 + 0.24 * i))


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


def build(src, dst):
    base = read_wav(src)
    fx = np.zeros_like(base)
    stage = 0
    for t, kind, db, pan in sorted(CUES):
        if kind == "tick" and 27.9 <= t < 28.3:
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
    write_wav(dst, base + fx)
    pk = np.max(np.abs(base + fx))
    print(f"mix peak {20 * np.log10(pk):.2f} dBFS (before limiter)")


if __name__ == "__main__":
    build(sys.argv[1], sys.argv[2])
