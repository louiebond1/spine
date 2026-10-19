// Scene 04, 22 to 28 s: once shared, one answer goes further. Source: clip 04.
import { color, prog, sec, presence } from "../design.js";
import { headline, sourceCrop, sourceFrame, box } from "../components/primitives.js";
import { portrait } from "../components/people.js";
import { spineLine } from "../components/brand.js";

// A separate "shared answer" symbol: an answer card with a check. Not product UI.
function sharedAnswer(x, y, opacity) {
  const svg = `<svg width="150" height="130" viewBox="0 0 150 130"><rect x="6" y="6" width="138" height="96" rx="20" fill="#fff" stroke="${color.cobalt}" stroke-width="6"/>` +
    `<path d="M36,102 L36,124 L60,102" fill="#fff" stroke="${color.cobalt}" stroke-width="6" stroke-linejoin="round"/>` +
    `<path d="M48,56 l18,18 l38,-38" stroke="${color.cobalt}" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return box(x, y, svg, { opacity, z: 6 });
}

export function s04(lf) {
  const exit = prog(lf, sec(5.7), sec(6.0));
  let html = headline("Once shared, one answer goes further.", lf, { opacity: 1 - exit });

  const sym = presence(lf, 0, null, { inDur: 14 });
  html += sharedAnswer(120, 290 + sym.dy, sym.opacity * (1 - exit));

  // 0.5 to 1.5: Ben's near duplicate title, then the real suggestion appears (source frame 275).
  const c = presence(lf, sec(0.5), null, { inDur: 10 });
  const f = sourceFrame(lf, [{ at: sec(0.5), src: 268, until: 300 }]);
  html += sourceCrop("suggest", f, 1800 - 840 * 1.78, 280 + c.dy, 1.78, { opacity: c.opacity * (1 - exit) });

  // Ben turns towards the suggestion. Alex is not in this story beat.
  html += portrait(120, 600, "Ben", { size: 150, top: "#7F8CA3", skin: "#E0B190", hair: "#5A3D2B", look: lf > sec(1.5) ? 1 : 0, opacity: sym.opacity * (1 - exit) });
  if (lf >= sec(1.5)) {
    html += spineLine("M200,600 C210,560 240,520 300,500", prog(lf, sec(1.5), sec(2.1)), { z: 4, opacity: 1 - exit });
  }
  return { bg: color.paper, html };
}
