"""Original score for the Spine film, synthesised deterministically (no samples). 120 BPM, story time.

  python3 score.py out/score.wav
  0 - 12      a minor groove under the problems
  12 - 15.5   the idea waits for people; 15.5 - 21 scattered, under the empty chart
  21 - 22.5   a held breath and a riser; 22.5 the slam as everything lines up on the spine
  22.5 - 27.5 the turn: a major chord held under "Spine is your AI project manager."
  27.5 - 46.5 major, building as the question is answered, the idea is proposed, approved, and the team forms
  46.5 - 52   the project goes quiet: the drums stop under one held chord, through Pulse and Slack,
              until Mia acts; 52 the groove comes back with her step
  52 - 58.7   moving again; the hours stack up; 57 the 42 lands on its own beat
  58.7 - 64.05 the recap: a soft pulse building into the logo; 64.05 the logo chord
Times here are the film clock (film time + 3.4), which includes the held list of ideas (timeline.warp).
The bass, arpeggio and pads pump against the kick. kick_on() matches kick_env() in timeline.py.
"""
import sys
import wave

import numpy as np

SR = 48000
DUR = 67.7
N = int(SR * DUR)
BEAT = 0.5
rng = np.random.default_rng(21)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def lp(x, fc):
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(np.fft.rfft(x) / np.sqrt(1 + (f / fc) ** 2), len(x))


def hp(x, fc):
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(np.fft.rfft(x) * (f / fc) / np.sqrt(1 + (f / fc) ** 2), len(x))


def env(n, a, tau):
    t = np.arange(n) / SR
    return np.minimum(t / a, 1) * np.exp(-t / tau)


def add(buf, start, x, g=1.0, pan=0.0):
    i = int(round(start * SR))
    if i >= N or i + len(x) <= 0:
        return
    n = min(len(x), N - i)
    buf[i:i + n, 0] += x[:n] * g * np.sqrt(1 - pan)
    buf[i:i + n, 1] += x[:n] * g * np.sqrt(1 + pan)


def kick(v=1.0):
    n = int(0.32 * SR)
    t = np.arange(n) / SR
    f = 46 + 110 * np.exp(-t / 0.03)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.14) * v


def clap():
    n = int(0.2 * SR)
    t = np.arange(n) / SR
    x = hp(rng.standard_normal(n), 1200)
    e = sum(np.exp(-np.maximum(t - d, 0) / 0.012) * (t >= d) for d in (0, 0.011, 0.022)) + np.exp(-t / 0.08) * 0.5
    return lp(x, 6000) * e * 0.5


def hat(open_=False):
    n = int((0.16 if open_ else 0.05) * SR)
    t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 8000) * np.exp(-t / (0.05 if open_ else 0.011))


def bass(m, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = hz(m)
    x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) + 0.12 * np.sign(np.sin(2 * np.pi * f * t))
    return lp(x, 900) * env(n, 0.005, dur * 0.55)


def pluck(m, dur=0.35, bright=4200):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = hz(m)
    tri = 2 * np.abs(2 * ((f * t) % 1) - 1) - 1
    return lp(tri + 0.25 * np.sin(2 * np.pi * 2 * f * t), bright) * np.exp(-t / 0.12)


def pad(notes, dur, cutoff=1600, attack=0.4, release=1.0):
    n = int((dur + release) * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for m in notes:
        for d in (-0.004, 0.0, 0.004):
            x += 2 * ((hz(m) * (1 + d) * t + rng.random()) % 1) - 1
    x = lp(x / (3 * len(notes)), cutoff)
    a = np.minimum(t / attack, 1)
    r = np.clip(1 - (t - dur) / release, 0, 1)
    return x * a * r


def bell(m, dur=3.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = hz(m)
    return sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / d) for r, a, d in
               ((1, 1, 1.3), (2.0, 0.35, 0.7), (3.01, 0.15, 0.45), (4.2, 0.07, 0.3)))


def riser(dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    u = t / dur
    noise = lp(rng.standard_normal(n), 1500 + 9000 * u.mean()) * u ** 2.2
    tone = np.sin(2 * np.pi * np.cumsum(110 + 700 * u ** 2) / SR) * u ** 2
    return noise * 0.6 + tone * 0.25


def kick_on(t):
    # matches kick_on() in timeline.py
    return (2.0 <= t < 12.0) or (15.5 <= t < 21.0) or (27.5 <= t < 46.5) or (52.0 <= t < 58.7) or (64.5 <= t < 66.7)


def section(t):
    for end, name in ((4.0, "intro"), (12.0, "problem"), (15.5, "stall"), (21.0, "chaos"), (23.0, "hold"),
                      (27.5, "turn"), (40.0, "solveA"), (46.5, "solveB"), (52.0, "quiet"), (58.7, "solveC"),
                      (64.05, "drop"), (66.7, "outro")):
        if t < end:
            return name
    return "tail"


def build():
    buf = np.zeros((N, 2))
    mus = np.zeros((N, 2))      # bass, arpeggio and pads: pumped by the kick below
    minor = [(38, [50, 53, 57]), (34, [46, 50, 53]), (36, [48, 52, 55]), (33, [45, 49, 52])]      # Dm Bb C A
    major = [(35, [47, 50, 54]), (31, [43, 47, 50]), (38, [50, 54, 57]), (33, [45, 49, 52])]      # Bm G D A
    chaos_rng = np.random.default_rng(5)
    for b in range(int(DUR / BEAT)):
        t = b * BEAT
        bar, beat = divmod(b, 4)
        sec = section(t)
        dark = sec in ("intro", "problem", "stall", "chaos", "hold")
        root, chord = (minor if dark else major)[bar % 4]
        # drums: the kick only where the picture is moving forward
        if kick_on(t):
            v = 0.8 if sec in ("intro", "outro") else 1.0
            add(buf, t, kick(v), 0.6)
        if sec in ("problem", "chaos", "solveA", "solveB", "solveC", "outro") and beat in (1, 3) and t >= 4.0:
            add(buf, t, clap(), 0.26, 0.1)
        if sec in ("problem", "solveB", "solveC", "outro") and t >= 6.0:
            add(buf, t + BEAT / 2, hat(), 0.09, -0.3)
        if sec in ("chaos", "solveC"):
            for q in range(4):
                add(buf, t + q * BEAT / 4, hat(open_=(q == 2 and sec == "solveC")), 0.05 + 0.02 * (q % 2), 0.35)
        # bass
        if sec in ("problem", "chaos", "solveA", "solveB", "solveC", "outro"):
            for off in ((0.0, 0.75) if beat % 2 == 0 else (0.5,)):
                add(mus, t + off * BEAT, bass(root, 0.22), 0.28)
        # melody: an arpeggio once ideas are moving; scattered notes while everything is scattered
        if sec in ("solveB", "solveC") or (sec == "problem" and 9.5 <= t < 12.0):
            notes = chord + [chord[0] + 12]
            for k in range(2):
                add(mus, t + k * BEAT / 2, pluck(notes[(beat * 2 + k) % 4] + 12), 0.08, 0.4 * (1 if k else -1))
                if sec == "solveC":
                    add(mus, t + k * BEAT / 2 + BEAT / 4, pluck(notes[(beat * 2 + k + 1) % 4] + 24, 0.25, 6000),
                        0.035, 0.4 * (-1 if k else 1))
        if sec == "chaos":
            for q in range(2):
                m = int(chaos_rng.choice(chord + [chord[0] + 12, chord[1] + 12])) + 12
                add(mus, t + q * BEAT / 2 + chaos_rng.uniform(0, 0.12), pluck(m, 0.3, 5000), 0.05,
                    chaos_rng.uniform(-0.7, 0.7))
        # pads
        if beat == 0 and sec in ("intro", "problem", "solveA", "solveB", "solveC", "outro", "turn"):
            cut = 1200 if dark else 2000
            add(mus, t, pad(chord, 4 * BEAT, cut), 0.10, -0.2)
            add(mus, t + 0.012, pad(chord, 4 * BEAT, cut), 0.10, 0.2)
    # the stall: everything stops but one low held chord
    add(buf, 12.0, pad([38, 50, 53], 3.5, 700, 0.6, 1.2), 0.16)
    # the held breath, the slam on the spine, and the turn to major
    add(buf, 21.5, riser(1.0), 0.2)
    add(buf, 22.5, kick(1.0), 0.75)
    n = int(1.8 * SR)
    add(buf, 22.5, np.sin(2 * np.pi * hz(26) * np.arange(n) / SR) * np.exp(-np.arange(n) / SR / 0.6), 0.55)
    add(buf, 22.5, lp(rng.standard_normal(int(1.2 * SR)), 6000) * np.exp(-np.arange(int(1.2 * SR)) / SR / 0.3), 0.10)
    add(buf, 22.5, pad([50, 54, 57, 62], 3.0, 2400, 0.25, 1.0), 0.14)
    add(buf, 23.0, bell(74, 2.5), 0.05, 0.2)
    # Pulse: the project goes quiet; the groove thins to a held chord until someone acts
    add(buf, 46.5, pad([47, 50, 54], 5.5, 1400, 0.4, 0.8), 0.14)
    # the 42 lands on a beat of its own
    add(buf, 57.0, kick(1.0), 0.5)
    add(buf, 57.0, pad([47, 50, 54, 59], 1.2, 2600, 0.01, 0.8), 0.12)
    add(buf, 57.0, bell(78, 1.6), 0.05, 0.3)
    # the recap: a held chord and a soft pulse that builds into the logo
    add(buf, 58.7, pad([50, 54, 57], 5.4, 1800, 0.3, 1.0), 0.2)
    for k in range(11):
        add(buf, 58.5 + 0.5 * k, kick(0.7), 0.14 + 0.02 * k)
    add(buf, 63.05, riser(1.0), 0.2)
    for k, (tk, m) in enumerate(((63.65, 62), (63.85, 66))):     # one note as each bar takes its place
        add(buf, tk, pluck(m, 0.7, 6000), 0.18, -0.4 + 0.4 * k)
    add(buf, 64.05, kick(1.0), 0.65)
    n = int(2.5 * SR)
    add(buf, 64.05, np.sin(2 * np.pi * hz(26) * np.arange(n) / SR) * np.exp(-np.arange(n) / SR / 0.9), 0.5)
    add(buf, 64.05, pad([50, 54, 57, 62, 66], 5.0, 3000, 0.05, 2.0), 0.16)
    add(buf, 64.05, bell(74), 0.10, 0.2)
    for k, m in enumerate((62, 66, 69)):             # the light passing along the three bars
        add(buf, 64.3 + 0.12 * k, pluck(m + 12, 0.6, 6000), 0.06, -0.4 + 0.4 * k)
    add(buf, 65.3, bell(81, 2.0), 0.05, 0.1)
    # sidechain pump: the music ducks on every kick and swells back, then a little drive
    tt = np.arange(N) / SR
    on = np.array([kick_on(x) for x in np.floor(tt / BEAT) * BEAT])
    pump = 1 - 0.5 * on * np.exp(-(tt % BEAT) / 0.11) * np.minimum((tt % BEAT) / 0.004, 1)
    mus *= pump[:, None]
    buf += np.tanh(mus * 2.2) / 2.2
    # the solutions build: each resolved problem a little fuller than the last
    keys = [(0.0, 1.0),
            (27.5, 0.82), (40.0, 0.88), (46.5, 0.95), (52.0, 1.0), (58.3, 1.08), (58.5, 1.0), (DUR, 1.0)]
    kt = np.array([k[0] for k in keys])
    kv = np.array([k[1] for k in keys])
    buf *= np.interp(tt, kt, kv)[:, None]
    # simple room
    out = np.zeros_like(buf)
    L = int(1.4 * SR)
    t = np.arange(L) / SR
    for ch in range(2):
        ir = lp(rng.standard_normal(L) * np.exp(-t / 0.22), 6000)
        ir /= np.sqrt((ir ** 2).sum())
        M = N + L
        wet = np.fft.irfft(np.fft.rfft(buf[:, ch], M) * np.fft.rfft(ir, M), M)[:N]
        out[:, ch] = buf[:, ch] * 0.85 + wet * 0.18
    out *= np.clip((DUR - np.arange(N) / SR) / 1.5, 0, 1)[:, None]
    return out


if __name__ == "__main__":
    x = build()
    x = x / np.max(np.abs(x)) * 10 ** (-6 / 20)
    with wave.open(sys.argv[1], "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())
    print("score written", sys.argv[1])
