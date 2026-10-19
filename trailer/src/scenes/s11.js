// Scene 11, 75 to 80 s: the final invitation. Everything holds absolutely still from 0.4 s.
import { color, prog, sec, easeOut, lerp } from "../design.js";
import { text, box } from "../components/primitives.js";
import { logo, markBars, strokesToMark } from "../components/brand.js";

const LOGO = { cx: 960, cy: 220, k: 3.6 };

export function s11(lf) {
  const bars = markBars(LOGO.cx, LOGO.cy, LOGO.k);
  const from = [
    { x1: 520, x2: 860, y1: 760, y2: 760 },
    { x1: 880, x2: 1180, y1: 760, y2: 760 },
    { x1: 1200, x2: 1420, y1: 760, y2: 760 },
  ];
  const t = prog(lf, 0, sec(0.3), (x) => x);
  const swap = prog(lf, sec(0.2), sec(0.4));
  let html = "";
  html += box(LOGO.cx - 235, LOGO.cy - 75, "", { w: 470, h: 150, z: 8, opacity: easeOut(lf / 8), style: `background:${color.navy};border-radius:36px;` });
  html += strokesToMark(from, bars, t, { opacity: 1 - swap });
  html += logo(LOGO.cx, LOGO.cy, LOGO.k, { opacity: swap });

  const c = easeOut(lf / 12);
  html += text(0, 346, "Good ideas deserve<br>to go somewhere.", { size: 88, line: 98, weight: 600, fill: color.paper, w: 1920, align: "center", opacity: c, track: -0.02 });
  html += text(0, 622, "Spine · Run your company's AI adoption.", { size: 56, weight: 500, fill: color.paper, w: 1920, align: "center", opacity: c });
  html += box(960 - 210, 760, `<div style="font-size:56px;font-weight:600;color:${color.navy};line-height:64px;text-align:center">Book a demo</div>`,
    { w: 420, opacity: c, z: 8, style: `background:${color.paper};border-radius:999px;padding:18px 0;` });
  return { bg: color.cobalt, html };
}
