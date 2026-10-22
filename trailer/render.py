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
BLUR = [(3.3, 5.45, 3), (5.45, 5.9, 4), (9.4, 10.3, 4), (11.95, 12.4, 4), (15.3, 16.2, 4), (19.85, 20.3, 4),
        (22.45, 22.95, 6), (26.4, 27.3, 4), (28.25, 28.95, 4), (32.6, 33.6, 4), (36.45, 37.3, 3), (37.45, 38.3, 3),
        (39.0, 39.6, 3), (44.9, 45.4, 3), (46.6, 47.1, 3), (50.0, 50.9, 4), (50.9, 52.3, 3), (55.1, 55.9, 4),
        (56.6, 57.4, 4), (57.9, 58.6, 3), (58.7, 59.6, 4)]

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
    sub = next((k for a, b, k in BLUR if a <= t + tl.SHIFT < b), 1)     # BLUR is in story time
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
