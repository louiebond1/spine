"""Render the polished Spine trailer.

  python3 render.py stills 0.5 9.6 14.6        # write PNG stills for checking
  python3 render.py video out/video_only.mp4   # render every frame and encode (no audio)
"""
import os
import subprocess
import sys
from multiprocessing import Pool

import numpy as np
from PIL import Image

from engine import W, H, FPS, quantise
import timeline as tl

HERE = os.path.dirname(os.path.abspath(__file__))
PLATES = os.path.join(HERE, "assets", "plates")

# Windows with fast camera or object moves get 180-degree-shutter motion blur.
BLUR = [(4.45, 4.9, 4), (6.45, 6.9, 4), (8.45, 8.9, 4), (12.8, 13.3, 6), (15.6, 16.4, 6), (18.7, 19.4, 6),
        (19.9, 20.2, 4), (21.7, 22.4, 6), (22.9, 23.2, 4), (24.7, 25.4, 6), (25.9, 26.2, 4), (27.7, 28.4, 6),
        (28.9, 30.6, 6)]
SHUTTER = 0.5 / FPS

_plate = None


def plate():
    global _plate
    if _plate is None:
        _plate = np.asarray(Image.open(os.path.join(PLATES, "f0969.png")).convert("RGB"))
    return _plate


def frame(n):
    t = n / FPS
    if n >= tl.END_PLATE:
        return quantise(tl.end_card(t, plate()))
    if n >= tl.HANDOFF:
        return np.asarray(Image.open(os.path.join(PLATES, f"f{n:04d}.png")).convert("RGB"))
    sub = next((k for a, b, k in BLUR if a <= t < b), 1)
    if sub > 1:
        acc = np.zeros((H, W, 3), np.float32)
        for k in range(sub):
            acc += tl.render_scene(t - SHUTTER / 2 + SHUTTER * (k + 0.5) / sub)
        return quantise(acc / sub)
    return quantise(tl.render_scene(t))


def frame_bytes(n):
    return frame(n).tobytes()


def encode(out_path, workers):
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    cmd = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
           "-r", str(FPS), "-i", "-",
           "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
           "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-profile:v", "high", "-level", "4.1",
           "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
           "-g", "60", out_path]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    with Pool(workers) as pool:
        for i, b in enumerate(pool.imap(frame_bytes, range(tl.TOTAL), chunksize=2)):
            p.stdin.write(b)
            if i % 60 == 0:
                print(f"frame {i}/{tl.TOTAL}", flush=True)
    p.stdin.close()
    if p.wait() != 0:
        raise SystemExit("ffmpeg failed")


if __name__ == "__main__":
    mode = sys.argv[1]
    if mode == "stills":
        out = os.environ.get("STILLS_DIR", os.path.join(HERE, "out", "stills"))
        os.makedirs(out, exist_ok=True)
        for a in sys.argv[2:]:
            n = int(round(float(a) * FPS))
            Image.fromarray(frame(n)).save(os.path.join(out, f"t{n / FPS:06.2f}.png"))
    elif mode == "video":
        encode(sys.argv[2], int(os.environ.get("WORKERS", os.cpu_count() or 4)))
