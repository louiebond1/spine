// Scene 05, 28 to 35 s: a useful idea gets a start. Source: clip 05. No AI scores, no timer.
import { color, prog, sec, presence } from "../design.js";
import { headline, sourceCrop, sourceFrame, text, chip } from "../components/primitives.js";
import { desk } from "../components/people.js";

export function s05(lf) {
  let html = chip(120, 104, "IDEAS & PROJECTS", { size: 26, fill: color.cobalt, bg: "rgba(67,92,245,0.10)", opacity: prog(lf, 0, 12) });
  html += headline("Give a good idea a way forward.", lf, { y: 160 });

  // Louie's idea, at his desk.
  html += desk("louie", 175, 830, 0.56, { screen: "idea", side: 1, pose: { mood: lf > sec(5.0) ? "pleased" : "neutral", look: 0.6 } });

  // Editorial problem summary above the crop, then the real title.
  const p = presence(lf, sec(0.2), null);
  html += text(380, 300 + p.dy, "Problem · Summary", { size: 28, weight: 600, fill: color.cobalt, opacity: p.opacity });
  html += text(380, 342 + p.dy, "Supplier research is scattered across websites and documents.", { size: 44, weight: 500, fill: color.navy, opacity: p.opacity });
  const t = presence(lf, sec(0.3), null);
  html += sourceCrop("approveTitle", 200, 380, 420 + t.dy, 1.15, { opacity: t.opacity });

  // 4.5 to 5.0: the real Approve press (source 222 to 244, the page changes at 245).
  if (lf < sec(5.1)) {
    const a = presence(lf, sec(3.9), sec(5.0), { inDur: 10 });
    const f = sourceFrame(lf, [{ at: sec(4.5) - 8, src: 222, until: 244 }]);
    html += sourceCrop("approveBtn", f, 1800 - 600 * 1.5, 640 + a.dy, 1.5, { opacity: a.opacity });
  }
  // 5.0 to 7.0: the resulting Forming team state, needs 2 more people.
  const ft = presence(lf, sec(5.0), null, { inDur: 10 });
  html += sourceCrop("formingTeam", 262, 1800 - 840 * 1.75, 630 + ft.dy, 1.75, { opacity: ft.opacity });
  return { bg: color.paper, html };
}
