// Scene 08, 51 to 61 s: a real blocker reaches a person. Sources: clips 08, 09 and 10, in source order.
// Pulse makes the blocker visible; a person helps. No SAP connector, no upload, no automatic fix.
import { color, prog, sec, presence } from "../design.js";
import { headline, sourceCrop, sourceFrame, editorialQuote, chip } from "../components/primitives.js";
import { desk, portrait } from "../components/people.js";

const BLOCKED = "#B5473A"; // muted red, only for the Blocked summary

export function s08(lf) {
  let html = headline("Keep good ideas moving.", lf);
  const Y = 250;

  // 0.0 to 0.4: the recorded Blocked check in with its complete note; Check in is pressed.
  if (lf < sec(0.5)) {
    const f = sourceFrame(lf, [{ at: 0, src: 455, until: 466 }]);
    html += sourceCrop("checkin", f, 960 - 2180 * 0.76 / 2, Y, 0.76);
  }
  // 0.4 to 3.0: the posted blocker, with the short summary outside the footage.
  if (lf >= sec(0.4) && lf < sec(3.1)) {
    const b = presence(lf, sec(0.4), sec(3.0), { inDur: 8 });
    html += sourceCrop("banner", 482, 960 - 2250 * 0.74 / 2, Y + b.dy, 0.74, { opacity: b.opacity });
    html += editorialQuote(120, 420 + b.dy, 1180, "Summary", "Blocked: waiting for the SAP supplier list.", { size: 58, opacity: b.opacity, accent: BLOCKED });
  }
  // 3.0 to 6.0: match cut to Pulse's top blocked item; a leader opens it.
  if (lf >= sec(3.0) && lf < sec(6.1)) {
    const p = presence(lf, sec(3.0), sec(6.0), { inDur: 8 });
    const f = sourceFrame(lf, [{ at: sec(3.0), src: 232, until: 268 }]);
    html += chip(120, Y - 6 + p.dy, "Pulse", { size: 30, fill: color.cobalt, bg: "rgba(67,92,245,0.10)", opacity: p.opacity });
    html += sourceCrop("pulse", 232, 120, Y + 60 + p.dy, 1.15, { opacity: p.opacity });
    html += sourceCrop("pulseOpen", f, 1800 - 170 * 1.5, Y + 160 + p.dy, 1.5, { opacity: p.opacity });
    html += portrait(1610, 560, "A leader", { size: 140, opacity: p.opacity, look: -1, top: "#5B6B85", skin: "#B57A55", hair: "#1E1712" });
  }
  // 6.0 to 6.5: Louie's recovery check in; the banner clears (source frame 376).
  if (lf >= sec(6.0) && lf < sec(6.6)) {
    const f = sourceFrame(lf, [{ at: sec(6.0), src: 362, until: 380 }]);
    html += sourceCrop("unblock", f, 960 - 2250 * 0.74 / 2, Y, 0.74);
  }
  // 6.5 to 10.0: the posted result and the recovery summary.
  if (lf >= sec(6.5)) {
    const r = presence(lf, sec(6.5), null, { inDur: 10 });
    html += sourceCrop("recovery", 392, 120, Y + r.dy, 1.0, { opacity: r.opacity });
    html += editorialQuote(1250, Y + 30 + r.dy, 460, "Summary", "SAP export received. Back on track.", { size: 52, opacity: r.opacity, accent: color.live });
  }

  const mood = lf < sec(6.5) ? "neutral" : "pleased";
  html += desk("louie", 330, 900, 0.6, { screen: "plan", side: 1, pose: { mood, look: 0.4 } });
  return { bg: color.paper, html };
}
