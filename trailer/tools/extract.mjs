// Writes every source frame the edit uses, cropped at native size, to public/frames/<shot>/<frame>.png.
// Usage: node tools/extract.mjs [shot ...]
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { clips, shots } from "../src/sources.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const only = process.argv.slice(2);

for (const [id, s] of Object.entries(shots)) {
  if (only.length && !only.includes(id)) continue;
  const out = join(root, "public/frames", id);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  for (const [a, b] of s.frames) {
    execFileSync("ffmpeg", [
      "-v", "error", "-i", join(root, "public/assets/clips", clips[s.clip]),
      "-vf", `select=between(n\\,${a}\\,${b}),crop=${s.w}:${s.h}:${s.x}:${s.y}`,
      "-vsync", "0", "-start_number", String(a), join(out, "%d.png"),
    ]);
  }
  console.log(id, s.frames.map((r) => r.join("-")).join(", "));
}

// Mask the recorded pointer where it covers text in a frozen frame (see tools/patch_cursor.py).
execFileSync("python3", ["-I", join(root, "tools/patch_cursor.py")], { stdio: "inherit" });
