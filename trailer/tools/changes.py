"""List the frames where a clip's content changes (cursor motion is mostly filtered by area)."""
import subprocess, sys, numpy as np, glob, os
W, H = 480, 270
for path in sorted(glob.glob(os.path.join(os.path.dirname(__file__), "../public/assets/clips/*.mp4"))):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={W}:{H}", "-f", "rawvideo", "-pix_fmt", "gray", "-"], capture_output=True).stdout
    f = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.int16)
    d = np.abs(np.diff(f, axis=0)) > 12
    area = d.sum(axis=(1, 2))
    ev = [(i + 1, int(a)) for i, a in enumerate(area) if a > 60]
    print(os.path.basename(path), len(f), ev)
