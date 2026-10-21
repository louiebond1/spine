"""Gain plus a look-ahead peak limiter, applied before AAC encoding.

  python3 master.py in.wav out.wav GAIN_DB [CEILING_DB]
The ceiling (default -2 dBFS) leaves headroom for AAC so the delivered file peaks below -1.5 dBFS.
"""
import sys
import wave

import numpy as np

src, dst, gain_db = sys.argv[1], sys.argv[2], float(sys.argv[3])
ceiling = 10 ** (float(sys.argv[4]) / 20) if len(sys.argv) > 4 else 10 ** (-2.0 / 20)

with wave.open(src) as w:
    sr, ch = w.getframerate(), w.getnchannels()
    x = np.frombuffer(w.readframes(w.getnframes()), np.int16).reshape(-1, ch).astype(np.float64) / 32768
x *= 10 ** (gain_db / 20)

look = int(0.004 * sr)            # 4 ms look-ahead
release = np.exp(-1 / (0.08 * sr))
peak = np.abs(x).max(axis=1)
# required gain per sample, then held over the look-ahead window so it acts before each transient
need = np.minimum(1.0, ceiling / np.maximum(peak, 1e-9))
padded = np.r_[need, np.ones(look)]
held = np.minimum.reduce([padded[i:i + len(need)] for i in range(look + 1)])
g = np.empty_like(held)
cur = 1.0
for i, v in enumerate(held):
    cur = v if v < cur else v + (cur - v) * release
    g[i] = cur
# smooth the attack edge
k = np.hanning(look * 2 + 1)
k /= k.sum()
g = np.minimum(np.convolve(g, k, "same"), held)
y = x * g[:, None]
y = np.clip(y, -ceiling, ceiling)
with wave.open(dst, "wb") as w:
    w.setnchannels(ch)
    w.setsampwidth(2)
    w.setframerate(sr)
    w.writeframes((y * 32767).astype(np.int16).tobytes())
print(f"master: gain {gain_db:+.2f} dB, max reduction {20 * np.log10(g.min()):.1f} dB")
