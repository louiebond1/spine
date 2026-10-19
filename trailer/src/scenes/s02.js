// Scene 02, 6 to 10 s: a warm arrival. The three strokes resolve into the Spine mark, then the real logo.
import { color, prog, sec, lerp, easeOut } from "../design.js";
import { text, sourceCrop, box } from "../components/primitives.js";
import { logo, markBars, strokesToMark, spineLine } from "../components/brand.js";
import { strokeEnd } from "./s01.js";

const LOGO = { cx: 960, cy: 210, k: 3.6 };

export function s02(lf) {
  const bars = markBars(LOGO.cx, LOGO.cy, LOGO.k);
  const from = strokeEnd.map((s) => ({ x1: s.x1, x2: s.x2, y1: s.y1, y2: s.y2 }));
  const t = prog(lf, 0, sec(0.3), (x) => x); // linear into strokesToMark's own easing
  const swapToLogo = prog(lf, sec(0.25), sec(0.5));
  const toPaper = prog(lf, sec(3.7), sec(4.0));
  const copy = prog(lf, sec(0.1), sec(0.3));

  let html = "";
  // understated navy accent behind the logo so the genuine gradient mark reads on cobalt
  const plateW = 470, plateH = 150;
  html += box(LOGO.cx - plateW / 2, LOGO.cy - plateH / 2, "", {
    w: plateW, h: plateH, z: 8, opacity: easeOut((lf - 4) / 10) * (1 - toPaper),
    style: `background:${color.navy};border-radius:36px;transform:scale(${lerp(0.94, 1, easeOut(lf / 14))});`,
  });
  html += strokesToMark(from, bars, t, { opacity: 1 - swapToLogo, z: 9 });
  html += logo(LOGO.cx, LOGO.cy, LOGO.k, { opacity: swapToLogo * (1 - toPaper), z: 9 });

  html += text(0, 330, "Welcome to Spine.", { size: 80, weight: 600, fill: color.paper, w: 1920, align: "center", opacity: copy * (1 - toPaper), track: -0.02 });
  html += text(0, 440, "Your company's AI adoption, together.", { size: 48, weight: 500, fill: color.paper, w: 1920, align: "center", opacity: copy * 0.92 * (1 - toPaper) });

  // Supporting proof of a calm starting point: the real Home heading from clip 01.
  const proof = prog(lf, sec(0.6), sec(1.0));
  html += sourceCrop("home", 60, 960 - 280 * 1.1, 640 + (1 - proof) * 24, 1.1, { opacity: proof * (1 - toPaper), radius: 20 });

  // At the end the line leaves the logo and heads down towards Priya's desk.
  if (lf >= sec(3.7)) {
    const go = prog(lf, sec(3.7), sec(4.0));
    html += spineLine(`M960,300 C900,600 500,700 300,860`, go, { from: Math.max(0, go - 0.35), z: 3 });
  }
  const bg = toPaper > 0 ? mix(color.cobalt, color.paper, toPaper) : color.cobalt;
  return { bg, html };
}

function mix(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(",")})`;
}
