"""Original score for the Spine trailer, synthesised deterministically (no samples).

  python3 score.py out/score.wav
Structure (seconds):
  0.0 - 9.5   problem: low D minor drone
  9.55        the line pulls taut: a plucked low string and the lift to D major, 108 BPM
  9.5 - 28.5  pad + plucked arpeggio + soft kick and hats; an air whoosh on each camera move
  28.55-29.45 drop out with a reverse swell as the line gathers
  30.55-30.85 three rising tones as the pieces land as the logo's bars
  30.95       wordmark: full chord, sub and a bell; the tail carries the end card
"""
import sys
import wave

import numpy as np

SR = 48000
DUR = 38.0
N = int(SR * DUR)
BEAT = 60 / 108
LIFT = 13.12                         # the blue flash: "Your AI needs a spine."
FOLD_TONES = [30.30, 30.42, 30.54]   # the node splits into the logo's three bars
LOGO = 30.50                         # wordmark resolves
DROP = 28.4                          # all four screens together, then into the logo
WHIPS = [(16.45, 17.0, -1), (19.3, 19.85, -1), (22.1, 22.65, -1), (25.1, 25.65, -1)]

rng = np.random.default_rng(11)
t_all = np.arange(N) / SR


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def lowpass(x, cutoff):
    """One-pole low-pass; cutoff may be a scalar or per-sample array."""
    a = np.exp(-2 * np.pi * np.asarray(cutoff, float) / SR) * np.ones_like(x)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a[i]) * x[i] + a[i] * acc
        y[i] = acc
    return y


def lp_fast(x, cutoff):
    """Fixed-cutoff one-pole low-pass via FFT filtering (much faster for long signals)."""
    f = np.fft.rfftfreq(len(x), 1 / SR)
    H = 1 / np.sqrt(1 + (f / cutoff) ** 2)
    return np.fft.irfft(np.fft.rfft(x) * H, len(x))


def hp_fast(x, cutoff):
    f = np.fft.rfftfreq(len(x), 1 / SR)
    H = (f / cutoff) / np.sqrt(1 + (f / cutoff) ** 2)
    return np.fft.irfft(np.fft.rfft(x) * H, len(x))


def env_adsr(n, a, d, s, r, hold):
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-4), np.where(t < a + d, 1 - (1 - s) * (t - a) / max(d, 1e-4), s))
    rel = np.clip((t - hold) / max(r, 1e-4), 0, 1)
    return e * (1 - rel)


def saw(f, t, detune=0.0):
    out = np.zeros_like(t)
    for d in (-detune, 0.0, detune):
        ph = (f * (1 + d) * t + rng.random()) % 1.0
        out += 2 * ph - 1
    return out / 3


def add(buf, start, sig, gain=1.0, pan=0.0):
    i = int(round(start * SR))
    if i >= N:
        return
    n = min(len(sig), N - i)
    gl, gr = np.sqrt((1 - pan) / 2) * np.sqrt(2), np.sqrt((1 + pan) / 2) * np.sqrt(2)
    buf[i:i + n, 0] += sig[:n] * gain * gl
    buf[i:i + n, 1] += sig[:n] * gain * gr


def pad(buf, start, dur, notes, gain, cutoff=1800, attack=0.6, release=1.2):
    n = int((dur + release) * SR)
    t = np.arange(n) / SR
    sig = sum(saw(hz(m), t, 0.004) for m in notes) / len(notes)
    sig = lp_fast(sig, cutoff) * env_adsr(n, attack, 0.5, 0.85, release, dur)
    add(buf, start, sig, gain, -0.25)
    add(buf, start + 0.013, sig, gain, 0.25)


def pluck(f, dur=0.45, bright=3200):
    n = int(dur * SR)
    t = np.arange(n) / SR
    tri = 2 * np.abs(2 * ((f * t) % 1) - 1) - 1
    sig = (tri + 0.3 * np.sin(2 * np.pi * 2 * f * t)) * np.exp(-t / 0.16)
    return lp_fast(sig, bright)


def kick():
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    f = 48 + 90 * np.exp(-t / 0.035)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.13)


def hat():
    n = int(0.06 * SR)
    t = np.arange(n) / SR
    return hp_fast(rng.standard_normal(n), 7000) * np.exp(-t / 0.012)


def sub(f, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * f * t) * env_adsr(n, 0.02, 0.2, 0.8, 0.15, dur - 0.15)


def whoosh(dur, direction):
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    shape = np.sin(np.pi * t / dur) ** 2
    cut = 400 + 5200 * shape
    y = lowpass(noise, cut) - lowpass(noise, cut * 0.25)
    return y * shape, np.linspace(-0.7 * direction, 0.7 * direction, n)


def bell(f, dur=3.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / (d)) for r, a, d in
            ((1, 1.0, 1.4), (2.0, 0.35, 0.8), (3.01, 0.18, 0.5), (4.2, 0.08, 0.3)))
    return s


def reverb(x, seconds=1.8, mix=0.22):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    out = np.zeros_like(x)
    for ch in range(2):
        ir = rng.standard_normal(n) * np.exp(-t / (seconds / 6.9))
        ir = lp_fast(ir, 6000)
        ir /= np.sqrt((ir ** 2).sum())
        L = len(x) + n
        y = np.fft.irfft(np.fft.rfft(x[:, ch], L) * np.fft.rfft(ir, L), L)[:len(x)]
        out[:, ch] = x[:, ch] * (1 - mix) + y * mix
    return out


def build():
    buf = np.zeros((N, 2))
    # --- problem: D minor drone, heartbeat from the first snap
    pad(buf, 0.0, LIFT - 0.3, [38, 45, 50, 53], 0.16, cutoff=700, attack=2.5, release=0.8)
    # a low pulse under the everyday failures
    t = 3.6
    while t < LIFT - 1.3:
        add(buf, t, sub(hz(38), 0.24), 0.32)
        add(buf, t + BEAT / 2, sub(hz(38), 0.16), 0.16)
        t += BEAT * 2
    # the flash: a hit
    add(buf, LIFT, kick(), 0.5)
    add(buf, LIFT, sub(hz(33), 1.4) * np.exp(-np.arange(int(1.4 * SR)) / SR / 0.5), 0.5)
    add(buf, LIFT, lp_fast(rng.standard_normal(int(1.2 * SR)), 5000) * np.exp(-np.arange(int(1.2 * SR)) / SR / 0.35), 0.10)
    # reverse swell into the lift
    n = int(1.25 * SR)
    sw = lp_fast(rng.standard_normal(n), 2500) * np.linspace(0, 1, n) ** 3
    add(buf, LIFT - 1.25, sw, 0.16)
    tt = np.arange(n) / SR
    add(buf, LIFT - 1.25, np.sin(2 * np.pi * np.cumsum(120 + 500 * (tt / 1.25) ** 2) / SR) * (tt / 1.25) ** 2, 0.06)
    # --- lift: D major, vi IV I V per bar
    prog = [([47, 50, 54, 59], 35), ([43, 50, 55, 59], 31), ([50, 54, 57, 62], 38), ([45, 49, 52, 57], 33)]
    bar = 4 * BEAT
    b = 0
    t = LIFT
    while t < DROP - 0.05:
        notes, root = prog[b % 4]
        dur = min(bar, DROP - t)
        pad(buf, t, dur, notes, 0.13, cutoff=2200, attack=0.25, release=0.6)
        add(buf, t, sub(hz(root), dur), 0.22)
        arp = notes + [notes[1] + 12]
        for k in range(8):
            tk = t + k * BEAT / 2
            if tk >= DROP - 0.05:
                break
            add(buf, tk, pluck(hz(arp[k % len(arp)] + 12)), 0.10 + 0.03 * (k % 2 == 0), 0.35 * (1 if k % 2 else -1))
        if t >= 16.75:
            for k in range(4):
                tk = t + k * BEAT
                if tk < DROP - 0.05:
                    if k % 2 == 0:
                        add(buf, tk, kick(), 0.32)
                    add(buf, tk + BEAT / 2, hat(), 0.05, 0.2)
        t += bar
        b += 1
    for a, z, d in WHIPS:
        s, pan_curve = whoosh(z - a, d)
        i = int(a * SR)
        n = min(len(s), N - i)
        buf[i:i + n, 0] += s[:n] * 0.10 * np.sqrt(1 - pan_curve[:n])
        buf[i:i + n, 1] += s[:n] * 0.10 * np.sqrt(1 + pan_curve[:n])
    # --- drop and fold
    n = int((29.2 - DROP) * SR)
    sw = lp_fast(rng.standard_normal(n), 1800) * np.linspace(0, 1, n) ** 4
    add(buf, DROP, sw, 0.08)
    add(buf, 29.2, kick(), 0.22)
    for k, tt in enumerate(FOLD_TONES):
        add(buf, tt, pluck(hz([62, 64, 66, 69, 71][k]), 0.6, 5000), 0.16, -0.5 + 0.25 * k)
    # --- logo
    pad(buf, LOGO, 5.0, [50, 54, 57, 62, 66], 0.15, cutoff=3000, attack=0.05, release=2.2)
    add(buf, LOGO, sub(hz(38), 2.5) * np.exp(-np.arange(int(2.5 * SR)) / SR / 0.9), 0.45)
    add(buf, LOGO, kick(), 0.35)
    add(buf, LOGO, bell(hz(74)), 0.12, 0.2)
    add(buf, 34.5, bell(hz(81), 2.0), 0.05, 0.1)
    buf = reverb(buf)
    # gentle fade at the very end
    fade = np.clip((DUR - t_all) / 1.2, 0, 1)[:, None]
    buf *= fade
    return buf


if __name__ == "__main__":
    out = build()
    pk = np.max(np.abs(out))
    out = out / pk * 10 ** (-6 / 20)          # leave headroom; the mix sets final level
    y = (out * 32767).astype(np.int16)
    with wave.open(sys.argv[1], "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(y.tobytes())
    print("score written", sys.argv[1])
