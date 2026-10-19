// Scene 03, 10 to 22 s: a question only the company can answer. Sources: clips 02 and 03.
import { color, prog, sec, presence } from "../design.js";
import { headline, sourceCrop, sourceFrame, editorialQuote, chip } from "../components/primitives.js";
import { desk } from "../components/people.js";
import { spineLine } from "../components/brand.js";

export function s03(lf) {
  let html = headline("Your question. Your company's answer.", lf);

  // Priya on the left, Mia at a separate desk on the right.
  const priyaPose = lf < sec(6.2)
    ? { mood: "attentive", look: 0.5 }
    : { mood: "pleased", look: lf < sec(9.0) ? 0.5 : -0.6 }; // relaxes, then returns to her own work
  const miaPose = lf < sec(4.5) ? { mood: "neutral", look: -0.3 } : { mood: "attentive", look: 0.7, reachL: lf < sec(5.5) ? prog(lf, sec(4.5), sec(5.0)) * 0.4 : 0 };
  html += desk("priya", 270, 800, 0.72, { screen: "question", side: 1, pose: priyaPose });
  html += desk("mia", 1650, 800, 0.72, { screen: "knowledge", side: 1, pose: miaPose });

  // 0.0 to 4.5: the completed question from clip 02 at readable size.
  const q = presence(lf, 0, sec(4.5), { inDur: 12 });
  html += sourceCrop("question", 705, 960 - 1000 * 1.3 / 2, 236 + q.dy, 1.3, { opacity: q.opacity });

  // 4.5 to 5.5: Mia claims it (clip 03, normal speed; the thread opens at source frame 224).
  if (lf >= sec(4.5) && lf < sec(5.6)) {
    const f = sourceFrame(lf, [{ at: sec(4.5), src: 192, until: 223 }]);
    html += sourceCrop("claim", f, 960 - 1540 * 1.1 / 2, 300, 1.1, { opacity: prog(lf, sec(4.5), sec(4.5) + 4) });
  }
  // The cobalt line travels from Priya's monitor to Mia's.
  if (lf >= sec(4.5)) {
    const d = prog(lf, sec(4.5), sec(5.4));
    html += spineLine("M345,640 C520,560 700,540 960,540 C1220,540 1400,560 1575,640", d, { from: Math.max(0, prog(lf, sec(5.6), sec(6.4)) * 1.01), z: 2 });
  }

  // 5.5 onwards: the completed reply (frozen, pointer masked) and the enlarged summary.
  const r = presence(lf, sec(5.5), sec(11.7), { inDur: 10 });
  html += sourceCrop("reply", 588, 960 - 1620 * 0.86 / 2, 236 + r.dy, 0.86, { opacity: r.opacity });
  const s = presence(lf, sec(5.6), sec(11.7), { inDur: 12 });
  html += editorialQuote(435, 432, 1050, "Mia's answer · Summary", "Use the company Claude workspace. Replace client names first.", { size: 56, opacity: s.opacity, dy: s.dy });
  html += chip(1135, 712 + s.dy, "Company demo guidance", { size: 28, opacity: s.opacity * 0.9 });
  return { bg: color.paper, html };
}
