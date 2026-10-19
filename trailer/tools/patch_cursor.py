"""Masks the recorded mouse pointer where it sits on top of text in a frozen source frame.

The brief allows masking a distracting cursor. Nothing is repainted: the occluded letters are
restored by copying the identical glyphs from elsewhere in the same frame (same font, same size).
Offsets were measured from column profiles of the neighbouring letters (see the notes per patch).

Usage: python3 -I tools/patch_cursor.py   (run after tools/extract.mjs; extract.mjs calls it)
"""
import os
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "frames")

PATCHES = [
    {
        # Mia's answer: the pointer covers "pa" in "company" (x 1260 to 1290). The same "pa" occurs in
        # "workspace" on the next line (41 px lower): "p" at x 196, "a" 213 to 224; the target "a" ends 1290.
        "file": "reply/588.png",
        "mask": [(1259, 70, 1292, 115)],
        "offset": (-1066, 41),
    },
    {
        # Ben's title (the pointer rests there for the whole range): it covers the lower left of "c" in "client" (starts x 70) and white space
        # below the line. The "c" in "contract" starts at x 148 on the same line.
        "file": "suggest/*",
        "mask": [(64, 36, 86, 55), (64, 55, 104, 80)],
        "offset": (78, 0),
    },
    {
        # Ben's title: two pointer pixels left just under the foot of the "l"; replace with the white below.
        "file": "suggest/*",
        "mask": [(86, 54, 90, 56)],
        "offset": (0, 4),
    },
]

def targets(spec):
    # "suggest/*" patches every extracted frame of that shot: the pointer does not move there.
    shot, name = spec.split("/")
    folder = os.path.join(ROOT, shot)
    if not os.path.isdir(folder):
        return []
    return sorted(os.path.join(folder, f) for f in os.listdir(folder)) if name == "*" else [os.path.join(folder, name)]


# The vertical version's narrower crop of Ben's title shares the same origin, so the same patches apply.
PATCHES += [dict(p, file=p["file"].replace("suggest/", "suggestV/")) for p in PATCHES if p["file"].startswith("suggest/")]

for p in PATCHES:
    paths = [t for t in targets(p["file"]) if os.path.exists(t)]
    for path in paths:
        img = np.asarray(Image.open(path).convert("RGB"))
        out = img.copy()
        dx, dy = p["offset"]
        for x0, y0, x1, y1 in p["mask"]:
            out[y0:y1, x0:x1] = img[y0 + dy:y1 + dy, x0 + dx:x1 + dx]
        Image.fromarray(out).save(path)
    print(f"masked pointer in {p['file']} ({len(paths)} frames)")
