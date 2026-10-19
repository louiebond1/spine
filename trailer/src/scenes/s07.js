// Scene 07, 44 to 51 s: the next action is clear. Source: clip 07. At most two plan rows at once.
import { color, prog, sec, presence } from "../design.js";
import { headline, sourceCrop, sourceFrame, text } from "../components/primitives.js";
import { desk } from "../components/people.js";
import { spineLine } from "../components/brand.js";

export function s07(lf) {
  let html = headline("Everyone knows the next step.", lf);
  const ticked = lf >= sec(1.5); // the tick lands at source frame 241, the page updates at 242

  // Next action line: before the tick "Louie is listing trusted supplier sources", after it the exact
  // source wording "Jamie is building the research template".
  const na = presence(lf, 0, null);
  html += text(120, 236 + na.dy, "Next action", { size: 30, weight: 600, fill: color.cobalt, opacity: na.opacity });
  html += sourceCrop("nextAction", ticked ? 252 : 200, 120, 280 + na.dy, 1.85, { opacity: na.opacity, clipBottom: 4 });

  // Plan rows: Louie ticks the first step (LM), then only the next open step remains (JC).
  const rowsY = 470;
  if (!ticked) {
    const f = sourceFrame(lf, [{ at: sec(0.5), src: 215, until: 241 }]);
    html += sourceCrop("planRows", f, 120, rowsY + na.dy, 0.79, { opacity: na.opacity });
  } else {
    html += sourceCrop("planNext", 252, 120, rowsY, 0.79);
  }
  // Small source label: the first draft came from AI (shown as recorded, not as a reading task).
  html += sourceCrop("aiLabel", 252, 1800 - 390 * 0.9, rowsY - 52, 0.9, { opacity: na.opacity * 0.9, shadow: false, border: false, radius: 6 });

  // The cobalt line joins the plan's steps: from the completed step down the side of the plan to the next one.
  html += spineLine("M96,400 L96,560 Q96,600 136,600 L360,600", prog(lf, sec(0.5), sec(2.0)), { z: 1 });

  html += desk("louie", 420, 900, 0.62, { screen: "plan", side: 1, pose: { mood: ticked ? "pleased" : "attentive", look: 0.5 } });
  html += desk("jamie", 1500, 900, 0.62, { screen: "plan", side: -1, pose: { mood: "attentive", look: -0.5, reachL: ticked ? 0.2 : 0 } });
  return { bg: color.paper, html };
}
