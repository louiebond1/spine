// Scene 09, 61 to 66 s: the project reaches use. Source: clip 11. No invented tool output.
import { color, prog, sec, presence } from "../design.js";
import { headline, sourceCrop, sourceFrame } from "../components/primitives.js";
import { desk } from "../components/people.js";
import { spineLine } from "../components/brand.js";

export function s09(lf) {
  let html = headline("From idea to something the team uses.", lf);
  const live = lf >= sec(1.0); // Mark Live press at source 148, the Live state at 150

  const l = presence(lf, 0, null, { inDur: 10 });
  const leftF = sourceFrame(lf, [{ at: sec(0.5), src: 120, until: 165 }]);
  html += sourceCrop("launchLeft", live ? Math.max(150, leftF) : 120, 120, 250 + l.dy, 1.2, { opacity: l.opacity });
  if (lf < sec(1.1)) {
    const f = sourceFrame(lf, [{ at: sec(0.5) - 13, src: 120, until: 149 }]);
    html += sourceCrop("launchBtn", f, 1330, 470 + l.dy, 1.6, { opacity: l.opacity * (1 - prog(lf, sec(1.0), sec(1.1))) });
  }
  // The connector completes its route.
  html += spineLine("M640,560 C900,560 1100,620 1240,730", prog(lf, sec(1.0), sec(2.2)), { z: 1 });

  const pleased = lf > sec(1.3) && lf < sec(4.6);
  html += desk("louie", 1330, 900, 0.58, { screen: "plan", side: -1, pose: { mood: pleased ? "pleased" : "neutral", look: 0.3, liftR: pleased ? prog(lf, sec(1.3), sec(1.7)) * 0.35 : 0 } });
  html += desk("jamie", 1640, 900, 0.58, { screen: "plan", side: 1, pose: { mood: pleased ? "pleased" : "neutral", look: -0.3 } });
  return { bg: color.paper, html };
}
