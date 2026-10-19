// Reusable vector people and desks. One definition per character; scenes only change pose values.
// Coordinates: a desk's origin is the centre of its top surface. Head height is about a quarter of
// standing height (head ~84 px for a ~340 px figure; seated, the desk hides the legs).
import { people, color } from "../design.js";

const n = (v) => Math.round(v * 10) / 10;

function hair(style, c, back) {
  // `back` layers sit behind the head, the others on top of it.
  if (style === "long") {
    return back
      ? `<path d="M-50,-200 Q-52,-246 0,-247 Q52,-246 50,-200 L54,-128 Q30,-118 22,-140 L-22,-140 Q-30,-118 -54,-128 Z" fill="${c}"/>`
      : `<path d="M-41,-200 Q-40,-238 0,-238 Q42,-238 41,-198 Q22,-222 -6,-214 Q-24,-208 -41,-200 Z" fill="${c}"/>`;
  }
  if (style === "bun") {
    return back
      ? `<circle cx="4" cy="-246" r="20" fill="${c}"/>`
      : `<path d="M-40,-196 Q-42,-238 0,-237 Q42,-238 40,-196 Q30,-224 0,-224 Q-28,-224 -40,-196 Z" fill="${c}"/>`;
  }
  if (style === "short") {
    return back ? "" : `<path d="M-40,-198 Q-44,-240 2,-242 Q30,-246 44,-226 Q46,-212 40,-200 Q34,-226 4,-224 Q-24,-222 -40,-198 Z" fill="${c}"/>`;
  }
  // crop
  return back ? "" : `<path d="M-39,-200 Q-40,-236 0,-236 Q40,-236 39,-200 Q34,-222 0,-222 Q-34,-222 -39,-200 Z" fill="${c}"/>`;
}

// Arm from shoulder through elbow to hand. `lift` 0 rests the forearm on the desk, 1 raises the hand.
// `reach` 0..1 moves the hand towards the centre of the desk (placing something).
function arm(side, p, lift, reach) {
  const sx = side * 54, sy = -122;
  const restE = [side * 74, -50], restH = [side * 46, -8];
  const liftE = [side * 92, -150], liftH = [side * 76, -214];
  const reachE = [side * 66, -46], reachH = [side * 8, -14];
  const mix = (a, b, c) => [a[0] + (b[0] - a[0]) * lift + (c[0] - a[0]) * reach, a[1] + (b[1] - a[1]) * lift + (c[1] - a[1]) * reach];
  const e = mix(restE, liftE, reachE), h = mix(restH, liftH, reachH);
  return `<path d="M${sx},${sy} L${n(e[0])},${n(e[1])} L${n(h[0])},${n(h[1])}" stroke="${p.top}" stroke-width="26" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<circle cx="${n(h[0])}" cy="${n(h[1])}" r="12" fill="${p.skin}"/>`;
}

// pose: { mood: "neutral" | "attentive" | "pleased", look: -1..1 (eyes and head turn), lean: px,
//         liftL, liftR, reachL, reachR: 0..1 }
export function personSVG(who, pose = {}) {
  const p = people[who];
  const { mood = "neutral", look = 0, lean = 0, liftL = 0, liftR = 0, reachL = 0, reachR = 0, blink = false } = pose;
  const ex = look * 6;
  const tilt = look * 5;
  const eye = (cx) => blink
    ? `<path d="M${cx - 5},-190 Q${cx},-187 ${cx + 5},-190" stroke="${color.navy}" stroke-width="3" fill="none" stroke-linecap="round"/>`
    : mood === "pleased"
      ? `<path d="M${cx - 6},-188 Q${cx},-195 ${cx + 6},-188" stroke="${color.navy}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`
      : `<ellipse cx="${cx}" cy="-190" rx="4.6" ry="${mood === "attentive" ? 5.6 : 5}" fill="${color.navy}"/>`;
  const mouth = mood === "pleased"
    ? `<path d="M-12,-170 Q0,-158 12,-170" stroke="${color.navy}" stroke-width="3.5" fill="#fff" stroke-linecap="round"/>`
    : mood === "attentive"
      ? `<ellipse cx="0" cy="-168" rx="4.5" ry="3.6" fill="${color.navy}"/>`
      : `<path d="M-9,-169 Q0,-163 9,-169" stroke="${color.navy}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
  const brows = `<path d="M-19,${mood === "attentive" ? -206 : -203} l10,-2 M9,${mood === "attentive" ? -208 : -205} l10,2" stroke="${p.hair}" stroke-width="3.4" stroke-linecap="round"/>`;
  const head =
    `<g transform="rotate(${n(tilt)} 0 -160)">` +
    hair(p.hairStyle, p.hair, true) +
    `<rect x="-11" y="-162" width="22" height="26" rx="8" fill="${p.skin}"/>` +
    `<circle cx="-39" cy="-188" r="7" fill="${p.skin}"/><circle cx="39" cy="-188" r="7" fill="${p.skin}"/>` +
    `<ellipse cx="0" cy="-192" rx="39" ry="43" fill="${p.skin}"/>` +
    hair(p.hairStyle, p.hair, false) +
    `<g transform="translate(${n(ex)},0)">${eye(-14)}${eye(14)}${brows}${mouth}</g>` +
    (mood === "pleased" ? `<circle cx="-24" cy="-174" r="6" fill="#E8785F" opacity="0.18"/><circle cx="24" cy="-174" r="6" fill="#E8785F" opacity="0.18"/>` : "") +
    `</g>`;
  const torso = `<path d="M-60,-118 Q-62,-142 -34,-144 L34,-144 Q62,-142 60,-118 L66,6 L-66,6 Z" fill="${p.top}"/>` +
    `<path d="M-14,-144 L0,-126 L14,-144" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="3" stroke-linejoin="round"/>`;
  return `<g transform="translate(${n(lean)},0)">${torso}${head}${arm(-1, p, liftL, reachL)}${arm(1, p, liftR, reachR)}</g>`;
}

const objects = {
  mug: (x) => `<g transform="translate(${x},0)"><rect x="-15" y="-38" width="30" height="38" rx="6" fill="#fff" stroke="${color.navy}" stroke-width="3"/><path d="M15,-30 q14,0 14,11 q0,11 -14,11" fill="none" stroke="${color.navy}" stroke-width="3"/><rect x="-15" y="-26" width="30" height="7" fill="${color.cobalt}"/></g>`,
  books: (x) => `<g transform="translate(${x},0)"><rect x="-34" y="-16" width="68" height="16" rx="3" fill="${color.navy}"/><rect x="-28" y="-31" width="60" height="15" rx="3" fill="#E9B9A6"/><rect x="-31" y="-45" width="56" height="14" rx="3" fill="${color.cobalt}"/></g>`,
  notebook: (x) => `<g transform="translate(${x},0)"><rect x="-36" y="-8" width="72" height="8" rx="2" fill="#fff" stroke="${color.navy}" stroke-width="2.5"/><path d="M-26,-14 L28,-24" stroke="${color.navy}" stroke-width="5" stroke-linecap="round"/></g>`,
  headphones: (x) => `<g transform="translate(${x},0)"><path d="M-24,-10 Q-26,-44 0,-46 Q26,-44 24,-10" fill="none" stroke="${color.navy}" stroke-width="5" stroke-linecap="round"/><rect x="-32" y="-22" width="14" height="22" rx="5" fill="#3E9A6B"/><rect x="18" y="-22" width="14" height="22" rx="5" fill="#3E9A6B"/></g>`,
};

const deskObject = { priya: "mug", mia: "books", louie: "notebook", jamie: "headphones" };

// Monitor seen at a slight angle so its screen is visible. `screen` is inner SVG drawn in a 150 x 96 box.
function monitor(x, screen) {
  return `<g transform="translate(${x},0)">` +
    `<rect x="-8" y="-34" width="16" height="34" fill="#B9C0CC"/><rect x="-34" y="-6" width="68" height="6" rx="3" fill="#B9C0CC"/>` +
    `<rect x="-84" y="-140" width="168" height="110" rx="10" fill="${color.navy}"/>` +
    `<g transform="translate(-75,-131)"><rect width="150" height="92" rx="5" fill="#fff"/>${screen}</g></g>`;
}

export const screens = {
  blank: "",
  question: `<rect x="14" y="16" width="96" height="9" rx="4" fill="#D4D9E3"/><rect x="14" y="34" width="70" height="9" rx="4" fill="#D4D9E3"/><circle cx="122" cy="62" r="17" fill="${color.cobalt}"/><text x="122" y="70" font-size="24" font-weight="700" fill="#fff" text-anchor="middle" font-family="Inter">?</text>`,
  knowledge: `<rect x="14" y="16" width="110" height="9" rx="4" fill="#D4D9E3"/><rect x="14" y="34" width="90" height="9" rx="4" fill="#D4D9E3"/><rect x="14" y="52" width="100" height="9" rx="4" fill="#D4D9E3"/><path d="M110,66 l8,8 l16,-18" stroke="${color.live}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  idea: `<rect x="14" y="16" width="80" height="9" rx="4" fill="#D4D9E3"/><circle cx="114" cy="46" r="17" fill="none" stroke="${color.cobalt}" stroke-width="5"/><rect x="107" y="66" width="14" height="8" rx="2" fill="${color.cobalt}"/>`,
  team: `<circle cx="40" cy="46" r="15" fill="#D4D9E3"/><circle cx="76" cy="46" r="15" fill="#D4D9E3"/><circle cx="112" cy="46" r="15" fill="none" stroke="#D4D9E3" stroke-width="4" stroke-dasharray="6 5"/>`,
  plan: `<rect x="14" y="16" width="12" height="12" rx="3" fill="${color.cobalt}"/><rect x="34" y="17" width="90" height="9" rx="4" fill="#D4D9E3"/><rect x="14" y="40" width="12" height="12" rx="3" fill="none" stroke="#B9C0CC" stroke-width="2.5"/><rect x="34" y="41" width="80" height="9" rx="4" fill="#D4D9E3"/><rect x="14" y="64" width="12" height="12" rx="3" fill="none" stroke="#B9C0CC" stroke-width="2.5"/><rect x="34" y="65" width="70" height="9" rx="4" fill="#D4D9E3"/>`,
};

// A desk with its person. side: which side the monitor sits on (-1 left, 1 right).
// deskOpacity < 1 fades the desk, monitor and object away (used when desks become the shared table).
export function deskSVG(who, { pose = {}, screen = "blank", side = 1, object = true, showMonitor = true, deskOpacity = 1 } = {}) {
  const obj = object ? objects[deskObject[who]](-side * 120) : "";
  return personSVG(who, pose) +
    `<g opacity="${deskOpacity}">` +
    `<rect x="-180" y="0" width="360" height="20" rx="8" fill="#C9B79C"/>` +
    `<rect x="-166" y="20" width="332" height="128" rx="6" fill="#E3D6C1"/>` +
    `<rect x="-166" y="20" width="332" height="10" fill="rgba(0,0,0,0.06)"/>` +
    (showMonitor ? monitor(side * 104, screens[screen]) : "") + obj + `</g>`;
}

// Place SVG content at x, y with a uniform scale, as an absolutely positioned layer.
export function svgLayer(x, y, scale, inner, { opacity = 1, z = 3, w = 520, h = 460, ox = 260, oy = 300 } = {}) {
  if (opacity <= 0.001) return "";
  return `<svg style="position:absolute;left:${n(x - ox * scale)}px;top:${n(y - oy * scale)}px;opacity:${opacity};z-index:${z};overflow:visible" width="${n(w * scale)}" height="${n(h * scale)}" viewBox="0 0 ${w} ${h}"><g transform="translate(${ox},${oy})">${inner}</g></svg>`;
}

export function desk(who, x, y, scale, opts = {}) {
  return svgLayer(x, y, scale, deskSVG(who, opts), { opacity: opts.opacity ?? 1, z: opts.z ?? 3 });
}

// Simple labelled portrait icon (Ben, Alex): a head-and-shoulders roundel with a name label.
export function portrait(x, y, label, { size = 120, skin = "#C98B63", hair = "#2E2119", top = "#8A94A6", opacity = 1, z = 6, look = 0, labelSize = 34 } = {}) {
  if (opacity <= 0.001) return "";
  const s = size / 120;
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 120 120" style="display:block"><circle cx="60" cy="60" r="60" fill="#E7E1D4"/>` +
    `<clipPath id="pc"><circle cx="60" cy="60" r="60"/></clipPath><g clip-path="url(#pc)">` +
    `<path d="M14,126 Q16,88 60,86 Q104,88 106,126 Z" fill="${top}"/>` +
    `<ellipse cx="60" cy="54" rx="24" ry="27" fill="${skin}"/>` +
    `<path d="M36,52 Q34,26 60,25 Q86,26 84,52 Q76,36 60,37 Q44,37 36,52 Z" fill="${hair}"/>` +
    `<ellipse cx="${51 + look * 4}" cy="56" rx="3.2" ry="3.6" fill="${color.navy}"/><ellipse cx="${69 + look * 4}" cy="56" rx="3.2" ry="3.6" fill="${color.navy}"/>` +
    `<path d="M53,68 Q60,72 67,68" stroke="${color.navy}" stroke-width="2.6" fill="none" stroke-linecap="round"/></g></svg>`;
  return `<div style="position:absolute;left:${n(x)}px;top:${n(y)}px;opacity:${opacity};z-index:${z};display:flex;flex-direction:column;align-items:center;gap:${n(10 * s)}px;">${svg}<div style="font-size:${labelSize}px;font-weight:600;color:${color.navy};white-space:nowrap">${label}</div></div>`;
}
