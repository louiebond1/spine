// Writes an SRT from the narration cues in src/timeline.js.
// Usage: node tools/srt.mjs [out.srt]
import { writeFileSync } from "node:fs";
import { scenes, narration } from "../src/timeline.js";

const ts = (s) => {
  const ms = Math.round(s * 1000);
  const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60, r = ms % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(r).padStart(3, "0")}`;
};

let i = 0;
const out = [];
for (const s of scenes) {
  for (const [a, b, line] of narration[s.id] || []) {
    const t0 = s.start / 30 + a, t1 = s.start / 30 + b;
    out.push(`${++i}\n${ts(t0)} --> ${ts(t1)}\n${line}\n`);
  }
}
const file = process.argv[2] || "output/Spine_Launch_Master.srt";
writeFileSync(file, out.join("\n"));
console.log("wrote", file, i, "cues");
