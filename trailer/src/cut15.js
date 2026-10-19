// The 15 second cut: a teaser for the main film, built from the same scenes and the same real footage.
// 0-3 welcome, 3-6 Jamie joins, 6-9 Blocked to Back on track, 9-12 Live and the verified demo result,
// 12-15 logo and Book a demo. Short text only; music only (its own cue, the master audio is not sped up).
import { color, prog, sec, presence, easeOut, lerp } from "./design.js";
import { text, box, sourceCrop, sourceFrame, headline, demoLabel, chip } from "./components/primitives.js";
import { logo } from "./components/brand.js";
import { s06 } from "./scenes/s06.js";
import { s11 } from "./scenes/s11.js";

export const TOTAL = 450;

function welcome(lf) {
  const c = easeOut(lf / 12);
  let html = box(960 - 235, 220 - 75, "", { w: 470, h: 150, z: 8, opacity: c, style: `background:${color.navy};border-radius:36px;transform:scale(${lerp(0.94, 1, c)});` });
  html += logo(960, 220, 3.6, { opacity: c });
  html += text(0, 400, "Welcome to Spine.", { size: 88, weight: 600, fill: color.paper, w: 1920, align: "center", opacity: c, track: -0.02 });
  html += text(0, 520, "Your company's AI adoption, together.", { size: 52, weight: 500, fill: color.paper, w: 1920, align: "center", opacity: c });
  return { bg: color.cobalt, html };
}

function unblocked(lf) {
  let html = headline("Keep good ideas moving.", lf);
  const Y = 300;
  if (lf < sec(1.0)) {
    html += sourceCrop("banner", 482, 960 - 2250 * 0.74 / 2, Y, 0.74);
    html += chip(120, Y + 120, "Blocked", { size: 52, fill: "#B5473A", bg: "rgba(181,71,58,0.10)" });
  } else if (lf < sec(1.6)) {
    const f = sourceFrame(lf, [{ at: sec(1.0), src: 362, until: 380 }]);
    html += sourceCrop("unblock", f, 960 - 2250 * 0.74 / 2, Y, 0.74);
  } else {
    const r = presence(lf, sec(1.6), null, { inDur: 8 });
    html += sourceCrop("recovery", 392, 120, Y + r.dy, 1.3, { opacity: r.opacity });
    html += chip(120, Y + 360 + r.dy, "Back on track", { size: 52, fill: "#1B7F45", bg: "rgba(34,197,94,0.12)", opacity: r.opacity });
  }
  return { bg: color.paper, html };
}

function delivered(lf) {
  let html = headline("Live and verified.", lf);
  html += sourceCrop("launchLeft", 165, 120, 230, 1.0);
  const check = `<svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="${color.live}"/><path d="M18,33 l9,9 l19,-20" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const v = presence(lf, sec(0.3), null);
  html += box(120, 590 + v.dy, `<div style="display:flex;align-items:center;gap:28px">${check}<div><div style="font-size:72px;font-weight:600;letter-spacing:-0.02em;color:${color.navy};line-height:80px">12 hours saved</div><div style="font-size:44px;font-weight:500;color:${color.navy};margin-top:8px">Verified by someone outside the team</div></div></div>`,
    { opacity: v.opacity, z: 7, style: `background:#fff;border-radius:24px;padding:30px 44px;box-shadow:0 0 0 1px ${color.rule},0 20px 48px rgba(20,36,58,0.12);border-left:8px solid ${color.live};` });
  html += demoLabel(1);
  return { bg: color.paper, html };
}

export function frame(f) {
  if (f < 90) return welcome(f);
  if (f < 180) return s06(f - 90 + 20); // the press at 1.8 s and the desks coming together
  if (f < 270) return unblocked(f - 180);
  if (f < 360) return delivered(f - 270);
  return s11(f - 360);
}
