"""Original score for the Spine film, synthesised deterministically (no samples). 120 BPM.
The bass, arpeggio and pads pump against the kick (sidechain) for drive.

  python3 score.py out/score.wav
  0 - 12 s    minor groove: kick on every beat, claps on 2 and 4, off-beat hats, syncopated bass
  12 - 13 s   riser into the flash
  13.0        the flash: a hit, then one bar without kick
  14.0        the node lands: full major groove (Bm G D A), arpeggio on top
  28, 46      a lift into Ideas & Projects and into Pulse (riser, crash, an extra arpeggio voice from 28 to 46)
  55 - 56.5   the groove drops out; three tones as the logo's bars land, a chord on the wordmark
  31 - 36     a light groove under the end card, then the tail
Kick gaps match kick_env() in timeline.py, which makes the background breathe on every kick.
"""
import sys
import wave

import numpy as np

SR = 48000
DUR = 61.0
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
    return not (13.0 <= t < 14.0 or 55.0 <= t < 56.5 or t >= 59.0)


def build():
    buf = np.zeros((N, 2))
    mus = np.zeros((N, 2))      # bass, arpeggio and pads: pumped by the kick below
    minor = [(38, [50, 53, 57]), (34, [46, 50, 53]), (36, [48, 52, 55]), (33, [45, 49, 52])]      # Dm Bb C A
    major = [(35, [47, 50, 54]), (31, [43, 47, 50]), (38, [50, 54, 57]), (33, [45, 49, 52])]      # Bm G D A
    for b in range(int(DUR / BEAT)):
        t = b * BEAT
        bar, beat = divmod(b, 4)
        section = "minor" if t < 12.0 else "riser" if t < 13.0 else "flash" if t < 14.0 else \
                  "major" if t < 55.0 else "drop" if t < 56.5 else "outro" if t < 59.0 else "tail"
        prog_ = minor if t < 13.0 else major
        root, chord = prog_[bar % 4]
        # drums
        if kick_on(t) and section != "riser" or (section == "riser" and beat < 2):
            add(buf, t, kick(0.9 if section in ("minor", "outro") else 1.0), 0.62)
        if section in ("minor", "major", "outro") and beat in (1, 3) and t >= 2.0:
            add(buf, t, clap(), 0.28, 0.1)
        if section in ("minor", "major", "outro") and t >= 4.0:
            add(buf, t + BEAT / 2, hat(open_=(beat == 3 and section == "major")), 0.10, -0.3)
            if section == "major":
                add(buf, t + BEAT / 4, hat(), 0.045, 0.35)
                add(buf, t + 3 * BEAT / 4, hat(), 0.05, 0.35)
        # bass: syncopated, on the root of the bar's chord
        if section in ("minor", "major", "outro"):
            for off in ((0.0, 0.75) if beat % 2 == 0 else (0.5,)):
                add(mus, t + off * BEAT, bass(root, 0.22), 0.30 if section == "major" else 0.26)
        # arpeggio
        if section == "major" or (section == "minor" and t >= 8.0):
            notes = chord + [chord[0] + 12]
            for k in range(2):
                add(mus, t + k * BEAT / 2, pluck(notes[(beat * 2 + k) % 4] + 12), 0.08, 0.4 * (1 if k else -1))
                if 28.0 <= t < 46.0:
                    add(mus, t + k * BEAT / 2 + BEAT / 4, pluck(notes[(beat * 2 + k + 1) % 4] + 24, 0.25, 6000), 0.035,
                        0.4 * (-1 if k else 1))
        # pads per bar
        if beat == 0 and section in ("minor", "major", "outro"):
            add(mus, t, pad(chord, 4 * BEAT, 1200 if section == "minor" else 2000), 0.10, -0.2)
            add(mus, t + 0.012, pad(chord, 4 * BEAT, 1200 if section == "minor" else 2000), 0.10, 0.2)
    # sidechain pump: the music ducks on every kick and swells back, then a little drive
    tt = np.arange(N) / SR
    on = np.array([kick_on(x) for x in np.floor(tt / BEAT) * BEAT])
    pump = 1 - 0.55 * on * np.exp(-(tt % BEAT) / 0.11) * np.minimum((tt % BEAT) / 0.004, 1)
    mus *= pump[:, None]
    buf += np.tanh(mus * 2.2) / 2.2
    # riser into the flash, and the flash itself
    add(buf, 12.0, riser(1.0), 0.22)
    add(buf, 13.0, kick(1.0), 0.75)
    n = int(1.5 * SR)
    add(buf, 13.0, np.sin(2 * np.pi * hz(26) * np.arange(n) / SR) * np.exp(-np.arange(n) / SR / 0.55), 0.55)
    add(buf, 13.0, lp(rng.standard_normal(int(1.2 * SR)), 6000) * np.exp(-np.arange(int(1.2 * SR)) / SR / 0.3), 0.12)
    add(buf, 13.0, pad([50, 54, 57, 62], 1.0, 2400, 0.3, 0.8), 0.14)
    # the node lands
    add(buf, 14.0, kick(1.0), 0.6)
    add(buf, 14.0, bell(74, 2.0), 0.06)
    # the drop and the logo
    add(buf, 54.5, riser(0.5), 0.14)
    add(buf, 55.0, pad([50, 54, 57], 1.6, 1800, 0.2, 1.0), 0.12)
    for k, m in enumerate((62, 66, 69)):
        add(buf, 56.0 + 0.25 * k, pluck(m, 0.6, 6000), 0.18, -0.4 + 0.4 * k)
    add(buf, 56.5, kick(1.0), 0.6)
    n = int(2.5 * SR)
    add(buf, 56.5, np.sin(2 * np.pi * hz(26) * np.arange(n) / SR) * np.exp(-np.arange(n) / SR / 0.9), 0.5)
    add(buf, 56.5, pad([50, 54, 57, 62, 66], 5.0, 3000, 0.05, 2.0), 0.16)
    add(buf, 56.5, bell(74), 0.10, 0.2)
    add(buf, 59.0, bell(81, 2.0), 0.05, 0.1)
    # lifts into Ideas & Projects and into Pulse
    for tl_ in (28.0, 46.0):
        add(buf, tl_ - 1.0, riser(1.0), 0.12)
        m = int(1.6 * SR)
        add(buf, tl_, hp(rng.standard_normal(m), 5000) * np.exp(-np.arange(m) / SR / 0.45), 0.10)
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
