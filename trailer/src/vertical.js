// Vertical version, 1080 x 1920, recomposed (not a centre crop of the landscape film).
// Same timing, same footage and the same factual sequence as the master; people are stacked with the
// product instead of desks side by side. Safe area x 90 to 930, y 180 to 1550; captions y 1600 to 1760.
import { color, prog, sec, presence, lerp, easeInOut, easeOut, FPS } from "./design.js";
import { text, box, sourceCrop, sourceFrame, editorialQuote, chip, demoLabel } from "./components/primitives.js";
import { desk, portrait, svgLayer } from "./components/people.js";
import { logo, markBars, strokesToMark, spineLine } from "./components/brand.js";
import { scenes, narration, sceneAt, TOTAL as T } from "./timeline.js";

export const TOTAL = T;
export const SIZE = { w: 1080, h: 1920 };
const X0 = 90, CW = 840;

const head = (content, { y = 180, fill = color.navy, opacity = 1 } = {}) =>
  text(X0, y, content, { size: 70, line: 80, weight: 600, fill, w: CW, opacity, z: 7, track: -0.02 });
const fit = (w) => CW / w; // scale that fits a crop of source width w into the content width

function v01(lf) {
  const swap = prog(lf, sec(2.7), sec(3.0));
  let html = head("AI is everywhere.", { opacity: 1 - swap }) + head("Progress can get lost.", { opacity: swap });
  const who = ["priya", "mia", "louie"], screens = ["question", "knowledge", "idea"], tags = ["Questions", "Know how", "Ideas"];
  const glance = prog(lf, sec(5.3), sec(5.8));
  who.forEach((w, i) => {
    const y = 640 + i * 360 - prog(lf, 0, 6) * 20;
    html += desk(w, 380, y, 0.8, { screen: screens[i], side: 1, pose: { look: lerp(i === 0 ? 0.8 : 0.4, 0, glance) } });
    html += chip(640, y - 170, tags[i], { size: 40 });
    const grow = prog(lf, sec(3.0), sec(5.6)) * 30, toC = easeInOut((lf - sec(5.7)) / sec(0.3));
    const x1 = lerp(640 - grow * 0, 540, toC), x2 = lerp(800 + grow, 700 + i * 30, toC);
    html += spineLine(`M${x1},${y - 60} L${x2},${y - 60}`, 1);
  });
  return { bg: color.paper, html };
}

function v02(lf) {
  const L = { cx: 540, cy: 520, k: 3.4 };
  const bars = markBars(L.cx, L.cy, L.k);
  const from = [0, 1, 2].map((i) => ({ x1: 540, x2: 700 + i * 30, y1: 580 + i * 360, y2: 580 + i * 360 }));
  const swap = prog(lf, sec(0.25), sec(0.5)), toPaper = prog(lf, sec(3.7), sec(4.0)), copy = prog(lf, sec(0.1), sec(0.3));
  let html = box(L.cx - 225, L.cy - 72, "", { w: 450, h: 144, z: 8, opacity: easeOut((lf - 4) / 10) * (1 - toPaper), style: `background:${color.navy};border-radius:34px;` });
  html += strokesToMark(from, bars, prog(lf, 0, sec(0.3), (x) => x), { opacity: 1 - swap });
  html += logo(L.cx, L.cy, L.k, { opacity: swap * (1 - toPaper) });
  html += text(X0, 700, "Welcome to Spine.", { size: 72, weight: 600, fill: color.paper, w: CW, align: "center", opacity: copy * (1 - toPaper), track: -0.02 });
  html += text(X0, 810, "Your company's AI adoption, together.", { size: 46, weight: 500, fill: color.paper, w: CW, align: "center", opacity: copy * (1 - toPaper) });
  const proof = prog(lf, sec(0.6), sec(1.0));
  html += sourceCrop("home", 60, 540 - 560 * 1.2 / 2, 1050 + (1 - proof) * 24, 1.2, { opacity: proof * (1 - toPaper) });
  return { bg: toPaper > 0 ? `rgb(${[67, 92, 245].map((v, i) => Math.round(v + ([245, 242, 234][i] - v) * toPaper)).join(",")})` : color.cobalt, html };
}

function v03(lf) {
  let html = head("Your question. Your company's answer.");
  const q = presence(lf, 0, sec(4.5));
  html += sourceCrop("question", 705, X0, 400 + q.dy, fit(1000), { opacity: q.opacity });
  html += text(X0, 640 + q.dy, "Can I put client contract data into Copilot?", { size: 56, weight: 600, w: CW, opacity: q.opacity, line: 66 });
  if (lf >= sec(4.5) && lf < sec(5.6)) {
    html += sourceCrop("claim", sourceFrame(lf, [{ at: sec(4.5), src: 192, until: 223 }]), X0, 420, fit(1540));
    html += spineLine("M220,1240 C400,900 700,900 860,1240", prog(lf, sec(4.5), sec(5.4)), { z: 2 });
  }
  const r = presence(lf, sec(5.5), sec(11.7));
  html += sourceCrop("reply", 588, X0, 400 + r.dy, fit(1620), { opacity: r.opacity });
  const s = presence(lf, sec(5.6), sec(11.7));
  html += editorialQuote(X0, 560, CW - 88, "Mia's answer · Summary", "Use the company Claude workspace. Replace client names first.", { size: 56, opacity: s.opacity, dy: s.dy });
  html += chip(X0, 900 + s.dy, "Company demo guidance", { size: 32, opacity: s.opacity });
  html += desk("priya", 260, 1350, 0.62, { screen: "question", pose: lf < sec(6.2) ? { mood: "attentive", look: 0.5 } : { mood: "pleased", look: lf < sec(9) ? 0.5 : -0.6 } });
  html += desk("mia", 820, 1350, 0.62, { screen: "knowledge", pose: lf < sec(4.5) ? { look: -0.3 } : { mood: "attentive", look: -0.6 } });
  html += text(140, 1470, "Priya asks", { size: 40, weight: 600, w: 240, align: "center" }) + text(700, 1470, "Mia answers", { size: 40, weight: 600, w: 240, align: "center" });
  return { bg: color.paper, html };
}

function v04(lf) {
  const exit = prog(lf, sec(5.7), sec(6.0));
  let html = head("Once shared, one answer goes further.", { opacity: 1 - exit });
  const c = presence(lf, sec(0.5), null);
  html += sourceCrop("suggestV", sourceFrame(lf, [{ at: sec(0.5), src: 268, until: 300 }]), X0, 520 + c.dy, fit(570), { opacity: c.opacity * (1 - exit) });
  html += portrait(440, 1000, "Ben", { size: 200, labelSize: 44, top: "#7F8CA3", skin: "#E0B190", hair: "#5A3D2B", look: lf > sec(1.5) ? 0.6 : 0, opacity: 1 - exit });
  if (lf >= sec(1.5)) html += spineLine("M540,990 L540,860", prog(lf, sec(1.5), sec(2.1)), { opacity: 1 - exit, z: 4 });
  return { bg: color.paper, html };
}

function v05(lf) {
  let html = chip(X0, 120, "IDEAS & PROJECTS", { size: 30, fill: color.cobalt, bg: "rgba(67,92,245,0.10)" }) + head("Give a good idea a way forward.", { y: 196 });
  const p = presence(lf, sec(0.2), null);
  html += text(X0, 400 + p.dy, "Problem · Summary", { size: 34, weight: 600, fill: color.cobalt, opacity: p.opacity });
  html += text(X0, 446 + p.dy, "Supplier research is scattered across websites and documents.", { size: 48, weight: 500, w: CW, line: 58, opacity: p.opacity });
  html += sourceCrop("approveTitleV", 200, X0, 600 + p.dy, fit(660), { opacity: p.opacity });
  if (lf < sec(5.1)) {
    const a = presence(lf, sec(3.9), sec(5.0));
    html += sourceCrop("approveBtn", sourceFrame(lf, [{ at: sec(4.5) - 8, src: 222, until: 244 }]), X0, 880 + a.dy, fit(600), { opacity: a.opacity });
  }
  const ft = presence(lf, sec(5.0), null);
  html += sourceCrop("formingTeamV", 262, X0, 880 + ft.dy, fit(700), { opacity: ft.opacity });
  html += desk("louie", 540, 1420, 0.7, { screen: "idea", pose: { mood: lf > sec(5) ? "pleased" : "neutral", look: 0.4 } });
  return { bg: color.paper, html };
}

function v06(lf) {
  let html = head("Your idea. Our next project.");
  const join = easeInOut((lf - sec(2.0)) / sec(1.2));
  const clicked = lf >= sec(1.0) - 4 + 32;
  const teamF = sourceFrame(lf, [{ at: sec(1.0) - 4, src: 120, until: 179 }]);
  html += sourceCrop("team", Math.max(120, teamF), X0 + 70, 380, fit(700) * 0.84);
  if (lf < sec(2.2)) {
    const jb = presence(lf, sec(0.2), sec(1.9));
    html += sourceCrop("joinBtn", sourceFrame(lf, [{ at: sec(1.0) - 4, src: 120, until: 151 }]), 930 - 250 * 1.6, 960 + jb.dy, 1.6, { opacity: jb.opacity });
  }
  const lx = lerp(240, 330, join), jx = lerp(840, 750, join);
  const reachL = lf < sec(4.0) ? 0 : Math.min(prog(lf, sec(4.0), sec(4.5)), 1 - prog(lf, sec(4.9), sec(5.4)));
  const reachJ = lf < sec(5.0) ? 0 : Math.min(prog(lf, sec(5.0), sec(5.5)), 1 - prog(lf, sec(5.9), sec(6.4)));
  html += desk("louie", lx, 1330, 0.62, { screen: "team", pose: { mood: lf > sec(2.2) ? "pleased" : "neutral", look: 0.5, reachR: reachL * 0.9 }, deskOpacity: 1 - join });
  html += desk("jamie", jx, 1330, 0.62, { screen: "team", side: -1, pose: { mood: clicked ? "pleased" : "attentive", look: -0.5, reachL: reachJ * 0.9 }, deskOpacity: 1 - join });
  html += svgLayer(540, 1330, 1, `<ellipse cx="0" cy="34" rx="400" ry="70" fill="#B9A688"/><ellipse cx="0" cy="0" rx="410" ry="64" fill="#D9C9AE"/><ellipse cx="0" cy="0" rx="380" ry="52" fill="#E3D6C1"/>`, { opacity: join, z: 4, w: 900, h: 200, ox: 450, oy: 90 });
  html += svgLayer(540, 1322, 1, `<rect x="-60" y="-130" width="120" height="130" rx="30" fill="none" stroke="#B9A688" stroke-width="9" stroke-dasharray="18 12"/>`, { opacity: prog(lf, sec(2.8), sec(3.4)), z: 3, w: 200, h: 200, ox: 100, oy: 160 });
  if (lf > sec(4.4)) html += box(lx + 40, 1310, `<svg width="80" height="64" viewBox="0 0 96 76"><rect x="4" y="4" width="88" height="68" rx="10" fill="#fff" stroke="${color.navy}" stroke-width="4"/><rect x="18" y="22" width="56" height="7" rx="3" fill="#C7CEDA"/><rect x="18" y="38" width="44" height="7" rx="3" fill="#C7CEDA"/></svg>`, { opacity: prog(lf, sec(4.4), sec(4.7)), z: 6 });
  if (lf > sec(5.4)) html += box(jx - 150, 1310, `<svg width="100" height="64" viewBox="0 0 120 76"><path d="M22,38 L60,18 L98,38" stroke="${color.cobalt}" stroke-width="6" fill="none"/><circle cx="22" cy="38" r="14" fill="${color.cobalt}"/><circle cx="60" cy="18" r="14" fill="#fff" stroke="${color.cobalt}" stroke-width="6"/><circle cx="98" cy="38" r="14" fill="${color.cobalt}"/></svg>`, { opacity: prog(lf, sec(5.4), sec(5.7)), z: 6 });
  html += text(lx - 160, 1440, "Louie · Owner", { size: 40, weight: 600, w: 320, align: "center" });
  html += text(jx - 160, 1440, clicked ? "Jamie · Member" : "Jamie", { size: 40, weight: 600, w: 320, align: "center" });
  const out = prog(lf, sec(8.7), sec(9.0));
  return { bg: color.paper, html: out > 0 ? `<div style="position:absolute;inset:0;opacity:${1 - out}">${html}</div>` : html };
}

function v07(lf) {
  let html = head("Everyone knows the next step.");
  const ticked = lf >= sec(1.5);
  html += text(X0, 400, "Next action", { size: 36, weight: 600, fill: color.cobalt });
  html += sourceCrop("nextActionV", ticked ? 252 : 200, X0, 450, fit(560), { clipBottom: 4 });
  html += ticked ? sourceCrop("planNextV", 252, X0, 640, fit(860)) : sourceCrop("planRowsV", sourceFrame(lf, [{ at: sec(0.5), src: 215, until: 241 }]), X0, 640, fit(860));
  html += spineLine("M70,450 L70,640", prog(lf, sec(0.5), sec(2.0)), { z: 1 });
  html += desk("louie", 280, 1300, 0.66, { screen: "plan", pose: { mood: ticked ? "pleased" : "attentive", look: 0.5 } });
  html += desk("jamie", 800, 1300, 0.66, { screen: "plan", side: -1, pose: { mood: "attentive", look: -0.5 } });
  html += text(120, 1420, "Louie", { size: 40, weight: 600, w: 320, align: "center" }) + text(640, 1420, "Jamie", { size: 40, weight: 600, w: 320, align: "center" });
  return { bg: color.paper, html };
}

function v08(lf) {
  let html = head("Keep good ideas moving.");
  const Y = 400;
  if (lf < sec(0.5)) {
    html += sourceCrop("checkinV", sourceFrame(lf, [{ at: 0, src: 455, until: 466 }]), X0, Y, fit(740));
    html += sourceCrop("noteV", 466, X0, Y + 190, fit(1120));
  }
  if (lf >= sec(0.4) && lf < sec(3.1)) {
    const b = presence(lf, sec(0.4), sec(3.0), { inDur: 8 });
    html += sourceCrop("noteV", 466, X0, Y + b.dy, fit(1120), { opacity: b.opacity });
    html += editorialQuote(X0, Y + 140 + b.dy, CW - 88, "Summary", "Blocked: waiting for the SAP supplier list.", { size: 58, opacity: b.opacity, accent: "#B5473A" });
  }
  if (lf >= sec(3.0) && lf < sec(6.1)) {
    const p = presence(lf, sec(3.0), sec(6.0), { inDur: 8 });
    html += chip(X0, Y - 6 + p.dy, "Pulse", { size: 34, fill: color.cobalt, bg: "rgba(67,92,245,0.10)", opacity: p.opacity });
    html += sourceCrop("pulse", 232, X0, Y + 70 + p.dy, fit(1180), { opacity: p.opacity });
    html += sourceCrop("pulseOpen", sourceFrame(lf, [{ at: sec(3.0), src: 232, until: 268 }]), 930 - 170 * 1.8, Y + 260 + p.dy, 1.8, { opacity: p.opacity });
    html += portrait(160, Y + 250, "A leader", { size: 150, labelSize: 40, opacity: p.opacity, look: 1, top: "#5B6B85", skin: "#B57A55", hair: "#1E1712" });
  }
  if (lf >= sec(6.0) && lf < sec(6.6)) html += sourceCrop("unblock", sourceFrame(lf, [{ at: sec(6.0), src: 362, until: 380 }]), X0, Y, fit(2250));
  if (lf >= sec(6.5)) {
    const r = presence(lf, sec(6.5), null, { inDur: 10 });
    html += sourceCrop("recovery", 392, X0, Y + r.dy, fit(1100), { opacity: r.opacity });
    html += editorialQuote(X0, Y + 240 + r.dy, CW - 88, "Summary", "SAP export received. Back on track.", { size: 58, opacity: r.opacity, accent: color.live });
  }
  html += desk("louie", 540, 1380, 0.66, { screen: "plan", pose: { mood: lf < sec(6.5) ? "neutral" : "pleased", look: 0.3 } });
  return { bg: color.paper, html };
}

function v09(lf) {
  let html = head("From idea to something the team uses.");
  const live = lf >= sec(1.0);
  html += sourceCrop("launchLeft", live ? Math.max(150, sourceFrame(lf, [{ at: sec(0.5), src: 120, until: 165 }])) : 120, X0, 400, fit(960));
  if (lf < sec(1.1)) html += sourceCrop("launchBtn", sourceFrame(lf, [{ at: sec(0.5) - 13, src: 120, until: 149 }]), 930 - 270 * 1.8, 760, 1.8, { opacity: 1 - prog(lf, sec(1.0), sec(1.1)) });
  html += spineLine("M300,720 C300,900 540,960 540,1100", prog(lf, sec(1.0), sec(2.2)), { z: 1 });
  const pleased = lf > sec(1.3) && lf < sec(4.6);
  html += desk("louie", 300, 1330, 0.66, { screen: "plan", pose: { mood: pleased ? "pleased" : "neutral", look: 0.3 } });
  html += desk("jamie", 780, 1330, 0.66, { screen: "plan", side: -1, pose: { mood: pleased ? "pleased" : "neutral", look: -0.3 } });
  return { bg: color.paper, html };
}

function v10(lf) {
  let html = head("See what it delivered.") + demoLabel(1, { x: X0, y: 1500 });
  const Y = 360;
  if (lf < sec(3.1)) {
    const r = presence(lf, 0, sec(3.0));
    html += sourceCrop("report", 410, X0, Y + r.dy, fit(1500), { opacity: r.opacity });
    html += chip(X0, Y + 120 + r.dy, "Reported", { size: 36, opacity: r.opacity });
    const e = presence(lf, sec(0.4), sec(3.0));
    html += box(X0, 600 + e.dy, `<div style="font-size:34px;font-weight:600;color:${color.cobalt};margin-bottom:16px">Demo result · from the team's report</div>` +
      `<div style="font-size:80px;font-weight:600;color:${color.navy};line-height:92px;letter-spacing:-0.02em">18 × 40 min<br>= 12 hours</div>` +
      `<div style="font-size:36px;color:${color.ink2};margin-top:14px">18 requests × 40 minutes saved each</div>`,
      { w: CW - 88, opacity: e.opacity, z: 7, style: `background:#fff;border-radius:24px;padding:30px 44px;box-shadow:0 0 0 1px ${color.rule},0 20px 48px rgba(20,36,58,0.12);` });
  }
  if (lf >= sec(3.0) && lf < sec(6.6)) {
    const v = presence(lf, sec(3.0), sec(6.5), { inDur: 8 });
    const f = sourceFrame(lf, [{ at: sec(3.0), src: 247, until: 270 }]);
    html += sourceCrop("verifyText", f, X0, Y + v.dy, fit(1290), { opacity: v.opacity });
    html += sourceCrop("verifyBtn", f, 930 - 180 * 1.8, Y + 120 + v.dy, 1.8, { opacity: v.opacity });
  }
  const ok = presence(lf, sec(3.5), null, { inDur: 12 });
  const check = `<svg width="72" height="72" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="${color.live}"/><path d="M18,33 l9,9 l19,-20" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  html += box(X0, 640 + ok.dy, `${check}<div style="font-size:80px;font-weight:600;letter-spacing:-0.02em;color:${color.navy};line-height:90px;margin-top:16px">12 hours saved</div><div style="font-size:50px;font-weight:500;color:${color.navy};line-height:60px;margin-top:8px">Verified by someone outside the team</div>`,
    { w: CW - 96, opacity: ok.opacity, z: 7, style: `background:#fff;border-radius:24px;padding:34px 44px;box-shadow:0 0 0 1px ${color.rule},0 20px 48px rgba(20,36,58,0.12);border-left:8px solid ${color.live};` });
  if (lf >= sec(6.5)) {
    const w = presence(lf, sec(6.5), null, { inDur: 10 });
    html += sourceCrop("wentLiveV", 300, X0, Y + w.dy, fit(1000), { opacity: w.opacity });
  }
  const g = presence(lf, sec(0.2), null);
  html += portrait(120, 1150, "Louie", { size: 120, labelSize: 36, opacity: g.opacity, top: color.navy, skin: "#E3AE8C", hair: "#4A3426" });
  html += portrait(290, 1150, "Jamie", { size: 120, labelSize: 36, opacity: g.opacity, top: "#3E9A6B", skin: "#D6A06E", hair: "#16130F" });
  html += text(100, 1360, "Project team", { size: 34, fill: color.ink2, w: 330, align: "center", opacity: g.opacity });
  html += portrait(720, 1150, "Alex", { size: 120, labelSize: 36, opacity: g.opacity, top: "#8A94A6", skin: "#C98B63", hair: "#2E2119", look: -1 });
  html += text(615, 1360, "Outside the team", { size: 34, fill: color.ink2, w: 330, align: "center", opacity: g.opacity });
  return { bg: color.paper, html };
}

function v11(lf) {
  const L = { cx: 540, cy: 460, k: 3.4 };
  const bars = markBars(L.cx, L.cy, L.k);
  const from = [0, 1, 2].map((i) => ({ x1: 300 + i * 160, x2: 440 + i * 160, y1: 1400, y2: 1400 }));
  const swap = prog(lf, sec(0.2), sec(0.4)), c = easeOut(lf / 12);
  let html = box(L.cx - 225, L.cy - 72, "", { w: 450, h: 144, z: 8, opacity: easeOut(lf / 8), style: `background:${color.navy};border-radius:34px;` });
  html += strokesToMark(from, bars, prog(lf, 0, sec(0.3), (x) => x), { opacity: 1 - swap });
  html += logo(L.cx, L.cy, L.k, { opacity: swap });
  html += text(X0, 640, "Good ideas deserve to go somewhere.", { size: 72, line: 84, weight: 600, fill: color.paper, w: CW, align: "center", opacity: c, track: -0.02 });
  html += text(X0, 930, "Spine · Run your company's AI adoption.", { size: 50, line: 60, weight: 500, fill: color.paper, w: CW, align: "center", opacity: c });
  html += box(540 - 220, 1120, `<div style="font-size:56px;font-weight:600;color:${color.navy};line-height:64px;text-align:center">Book a demo</div>`, { w: 440, opacity: c, z: 8, style: `background:${color.paper};border-radius:999px;padding:20px 0;` });
  return { bg: color.cobalt, html };
}

const render = { "01": v01, "02": v02, "03": v03, "04": v04, "05": v05, "06": v06, "07": v07, "08": v08, "09": v09, "10": v10, "11": v11 };

export function frame(f) {
  const s = sceneAt(f);
  return render[s.id](f - s.start);
}

export function captionHTML(f) {
  const s = sceneAt(f);
  const t = (f - s.start) / FPS;
  const cue = (narration[s.id] || []).find(([a, b]) => t >= a && t < b);
  if (!cue) return "";
  return `<div style="position:absolute;left:60px;right:60px;top:1600px;height:160px;display:flex;align-items:center;justify-content:center;z-index:20">` +
    `<div style="text-align:center;font-size:50px;line-height:56px;font-weight:500;color:#fff;background:rgba(20,36,58,0.86);padding:6px 24px 8px;border-radius:14px;">${cue[2]}</div></div>`;
}
