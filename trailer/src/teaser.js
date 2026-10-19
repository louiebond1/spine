// "Coming next" teaser, 18 s. Illustrative future concepts, not recordings: Teams, Slack and Claude
// integrations are not built. Labelled "Coming next · Concept" on every frame. No release date.
// Chat surfaces are generic drawings named in text only, with no third-party logos.
import { color, prog, sec, presence, easeOut } from "./design.js";
import { text, box } from "./components/primitives.js";
import { logo } from "./components/brand.js";

export const TOTAL = 540;
const PAPER = color.paper;

function label() {
  return text(120, 96, "Coming next · Concept", { size: 44, weight: 600, fill: "#AFC0FF", z: 10 });
}

function window(title, body, { y = 330, h = 520 } = {}) {
  return box(260, y, `<div style="height:64px;display:flex;align-items:center;padding:0 32px;border-bottom:1px solid rgba(20,36,58,0.10);font-size:30px;font-weight:600;color:${color.ink2}">${title}</div><div style="padding:30px 36px">${body}</div>`,
    { w: 1400, h, z: 5, style: `background:#fff;border-radius:28px;box-shadow:0 30px 60px rgba(0,0,0,0.25);overflow:hidden;` });
}

function msg(name, initials, content, { tint = "#EEF1F6", opacity = 1, highlight = false } = {}) {
  return `<div style="display:flex;gap:22px;margin-bottom:26px;opacity:${opacity};${highlight ? `background:rgba(67,92,245,0.10);outline:4px solid ${color.cobalt};border-radius:18px;padding:14px;margin-left:-14px;margin-right:-14px;` : ""}">` +
    `<div style="width:64px;height:64px;border-radius:50%;background:${tint};display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:600;color:${color.navy};flex:none">${initials}</div>` +
    `<div><div style="font-size:28px;font-weight:600;color:${color.navy};margin-bottom:6px">${name}</div><div style="font-size:44px;line-height:54px;font-weight:500;color:${color.navy}">${content}</div></div></div>`;
}

const spineBadge = `<span style="display:inline-flex;vertical-align:middle;margin-right:4px"><svg width="22" height="30" viewBox="0 0 36 50"><rect x="9" y="2" width="24" height="10" rx="5" fill="${color.logoBrand}"/><rect x="2" y="20" width="32" height="10" rx="5" fill="${color.logoBrand}"/><rect x="0" y="38" width="20" height="10" rx="5" fill="${color.logoBrand}"/></svg></span>`;

function teams(lf) {
  let html = text(120, 180, "Company guidance, in the conversation.", { size: 80, weight: 600, fill: PAPER, track: -0.02 });
  const reply = presence(lf, sec(1.6), null, { inDur: 12 });
  const body = msg("A colleague", "PS", "Can I use Copilot for client data?") +
    msg(`${spineBadge}Spine`, "", `From the company Playbook: use the company Claude workspace, and replace client names first.<div style="font-size:28px;font-weight:500;color:${color.ink2};margin-top:10px">Company demo guidance</div>`, { tint: "#E8ECFD", opacity: reply.opacity });
  html += window("Teams · Client work", body);
  return html;
}

function slack(lf) {
  let html = text(120, 180, "Keep the useful idea.", { size: 80, weight: 600, fill: PAPER, track: -0.02 });
  const selected = lf >= sec(0.0);
  const pressed = lf >= sec(1.5) && lf < sec(2.0);
  const draft = presence(lf, sec(2.0), null, { inDur: 10 });
  let body = msg("A colleague", "JC", "We built a supplier research workflow", { highlight: selected });
  body += `<div style="display:flex;gap:16px;margin:4px 0 24px 86px"><div style="font-size:32px;font-weight:600;padding:12px 26px;border-radius:14px;color:#fff;background:${pressed ? "#2E44C7" : color.cobalt};transform:scale(${pressed ? 0.97 : 1})">Send this message to Spine</div></div>`;
  html += window("Slack · #procurement", body, { h: 470 });
  html += box(1080, 640 + draft.dy, `<div style="font-size:28px;font-weight:600;color:${color.cobalt};margin-bottom:8px">Draft initiative</div><div style="font-size:44px;font-weight:600;color:${color.navy};line-height:52px">Supplier research workflow</div><div style="font-size:28px;color:${color.ink2};margin-top:8px">Only this message was sent. Nothing is approved yet.</div>`,
    { w: 640, opacity: draft.opacity, z: 7, style: `background:#fff;border-radius:24px;padding:28px 36px;border-left:8px solid ${color.cobalt};box-shadow:0 24px 48px rgba(0,0,0,0.25);` });
  return html;
}

function claude(lf) {
  let html = text(120, 180, "A conversation can become a project.", { size: 80, weight: 600, fill: PAPER, track: -0.02 });
  const yes = lf >= sec(4.0);
  const draft = presence(lf, sec(4.4), null, { inDur: 10 });
  let body = msg("Claude", "", "Useful for the team? Propose it in Spine.", { tint: "#F1E6DA" });
  body += `<div style="display:flex;gap:16px;margin:0 0 0 86px"><div style="font-size:34px;font-weight:600;padding:12px 30px;border-radius:14px;color:#fff;background:${yes ? "#2E44C7" : color.cobalt}">Yes, propose it</div><div style="font-size:34px;font-weight:600;padding:12px 30px;border-radius:14px;color:${color.navy};border:2px solid rgba(20,36,58,0.2)">Not now</div></div>`;
  html += window("Claude", body, { h: 380 });
  html += box(1080, 650 + draft.dy, `<div style="font-size:28px;font-weight:600;color:${color.cobalt};margin-bottom:8px">Draft initiative</div><div style="font-size:44px;font-weight:600;color:${color.navy};line-height:52px">Supplier research workflow</div><div style="font-size:28px;color:${color.ink2};margin-top:8px">A person proposes it. Nothing is approved yet.</div>`,
    { w: 640, opacity: draft.opacity, z: 7, style: `background:#fff;border-radius:24px;padding:28px 36px;border-left:8px solid ${color.cobalt};box-shadow:0 24px 48px rgba(0,0,0,0.25);` });
  return html;
}

export function frame(f) {
  const lf = f % 180;
  const part = f < 180 ? teams(lf) : f < 360 ? slack(lf) : claude(lf);
  const html = label() + part + logo(1620, 980, 2.0, { opacity: 1, z: 10 });
  return { bg: color.navy, html };
}
