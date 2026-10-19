// Scene 10, 66 to 75 s: reporting becomes evidence. Sources: clips 12, 13 and 14.
// 12 hours is fictional Acme Group demo data. It is verified only after the Verify press.
// The Leadership total (106) is cropped out so it can't be read as this project's saving.
import { color, prog, sec, presence } from "../design.js";
import { headline, sourceCrop, sourceFrame, box, demoLabel, chip, text } from "../components/primitives.js";
import { portrait } from "../components/people.js";

function equation(x, y, opacity, dy) {
  const part = (big, small, w) => `<div style="display:flex;flex-direction:column;align-items:center;width:${w}px"><div style="font-size:84px;font-weight:600;letter-spacing:-0.02em;color:${color.navy};line-height:96px">${big}</div><div style="font-size:30px;font-weight:500;color:${color.ink2};margin-top:6px">${small}</div></div>`;
  const op = (s) => `<div style="font-size:72px;font-weight:500;color:${color.ink2};line-height:96px;padding:0 12px">${s}</div>`;
  const inner = `<div style="font-size:28px;font-weight:600;color:${color.cobalt};margin-bottom:18px">Demo result · from the team's report</div>` +
    `<div style="display:flex;align-items:flex-start">${part("18", "Requests", 220)}${op("×")}${part("40 min", "Minutes saved each", 320)}${op("=")}${part("12 hours", "", 360)}</div>`;
  return box(x, y + dy, inner, { opacity, z: 7, style: `background:#fff;border-radius:24px;padding:28px 44px 30px;box-shadow:0 0 0 1px ${color.rule},0 20px 48px rgba(20,36,58,0.12);` });
}

function verifiedCard(x, y, opacity, dy) {
  const check = `<svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="${color.live}"/><path d="M18,33 l9,9 l19,-20" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const inner = `<div style="display:flex;align-items:center;gap:28px">${check}<div><div style="font-size:72px;font-weight:600;letter-spacing:-0.02em;color:${color.navy};line-height:80px">12 hours saved</div>` +
    `<div style="font-size:44px;font-weight:500;color:${color.navy};margin-top:8px">Verified by someone outside the team</div></div></div>`;
  return box(x, y + dy, inner, { opacity, z: 7, style: `background:#fff;border-radius:24px;padding:30px 44px;box-shadow:0 0 0 1px ${color.rule},0 20px 48px rgba(20,36,58,0.12);border-left:8px solid ${color.live};` });
}

export function s10(lf) {
  let html = headline("See what it delivered.", lf);
  html += demoLabel(1);
  const Y = 236;

  // 0.0 to 3.0: the completed report from clip 12, status Reported, and the equation derived from it.
  if (lf < sec(3.1)) {
    const r = presence(lf, 0, sec(3.0), { inDur: 10 });
    html += sourceCrop("report", 410, 120, Y + r.dy, 1.0, { opacity: r.opacity });
    html += chip(1650, Y + 20 + r.dy, "Reported", { size: 30, opacity: r.opacity });
    const e = presence(lf, sec(0.4), sec(3.0), { inDur: 12 });
    html += equation(120, 470, e.opacity, e.dy);
  }
  // 3.0 to 6.5: the real Verify press (Verified appears at source 259), then the verified result.
  if (lf >= sec(3.0) && lf < sec(6.6)) {
    const v = presence(lf, sec(3.0), sec(6.5), { inDur: 8 });
    const f = sourceFrame(lf, [{ at: sec(3.0), src: 247, until: 270 }]);
    html += sourceCrop("verifyText", f, 120, Y + v.dy, 1.05, { opacity: v.opacity });
    html += sourceCrop("verifyBtn", f, 1520, Y + 4 + v.dy, 1.5, { opacity: v.opacity });
  }
  // The verified highlight appears only once the source shows Verified (local 3.4 s), and stays.
  const ok = presence(lf, sec(3.5), null, { inDur: 12 });
  html += verifiedCard(120, 470, ok.opacity, ok.dy);

  // 6.5 to 9.0: Leadership's Went live entry, as context.
  if (lf >= sec(6.5)) {
    const w = presence(lf, sec(6.5), null, { inDur: 10 });
    html += sourceCrop("wentLive", 300, 120, Y + w.dy, 0.95, { opacity: w.opacity });
  }

  // The project group, and Alex outside it.
  const g = presence(lf, sec(0.2), null);
  html += portrait(1250, 660, "Louie", { size: 110, labelSize: 30, opacity: g.opacity, top: color.navy, skin: "#E3AE8C", hair: "#4A3426" });
  html += portrait(1390, 660, "Jamie", { size: 110, labelSize: 30, opacity: g.opacity, top: "#3E9A6B", skin: "#D6A06E", hair: "#16130F" });
  html += text(1236, 830, "Project team", { size: 28, weight: 500, fill: color.ink2, opacity: g.opacity, w: 280, align: "center" });
  html += portrait(1640, 660, "Alex", { size: 110, labelSize: 30, opacity: g.opacity, top: "#8A94A6", skin: "#C98B63", hair: "#2E2119", look: -1 });
  html += text(1560, 830, "Outside the team", { size: 28, weight: 500, fill: color.ink2, opacity: g.opacity, w: 270, align: "center" });
  return { bg: color.paper, html };
}
