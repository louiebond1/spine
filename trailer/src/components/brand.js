// The Spine logo (from src/components/shell/Logo.tsx on spine-2), the cobalt connecting line and captions.
import { color, type, lerp, easeInOut, clamp01 } from "../design.js";

// The genuine logo: three offset rounded bars with the product's gradient, plus the wordmark.
// `k` scales the product's 18 x 24 px mark and 19 px wordmark. tone "dark" = white wordmark.
export function logo(cx, cy, k, { tone = "dark", opacity = 1, z = 9 } = {}) {
  if (opacity <= 0.001) return "";
  const markW = 18 * k, markH = 24 * k, gap = 10 * k, fs = 19 * k;
  const wordW = fs * 2.55; // measured width of "Spine" in Inter 600 at -0.02em
  const totalW = markW + gap + wordW;
  return `<div style="position:absolute;left:${cx - totalW / 2}px;top:${cy - markH / 2}px;opacity:${opacity};z-index:${z};display:flex;align-items:center;gap:${gap}px;">` +
    `<svg width="${markW}" height="${markH}" viewBox="0 0 36 50"><defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color.logoLight}"/><stop offset="1" stop-color="${color.logoBrand}"/></linearGradient></defs>` +
    `<rect x="9" y="2" width="24" height="10" rx="5" fill="url(#lg)"/><rect x="2" y="20" width="32" height="10" rx="5" fill="url(#lg)"/><rect x="0" y="38" width="20" height="10" rx="5" fill="url(#lg)"/></svg>` +
    `<span style="font-size:${fs}px;line-height:${markH}px;font-weight:600;letter-spacing:-0.02em;color:${tone === "dark" ? "#fff" : color.navy}">Spine</span></div>`;
}

// Where the three bars of the mark sit, in page pixels, for a logo drawn with logo(cx, cy, k).
export function markBars(cx, cy, k) {
  const markW = 18 * k, markH = 24 * k, gap = 10 * k, fs = 19 * k;
  const totalW = markW + gap + fs * 2.55;
  const x0 = cx - totalW / 2, y0 = cy - markH / 2, u = markW / 36;
  // centre lines of the bars (x from rounded end to rounded end, at the bar's vertical centre)
  return [[9, 2, 24], [2, 20, 32], [0, 38, 20]].map(([x, y, w]) => ({ x1: x0 + (x + 5) * u, x2: x0 + (x + w - 5) * u, y: y0 + (y + 5) * u, h: 10 * u }));
}

// Three short strokes that travel from `from` positions into the mark's bars as t goes 0 to 1.
export function strokesToMark(from, bars, t, { opacity = 1, z = 9, width = 8 } = {}) {
  if (opacity <= 0.001) return "";
  const e = easeInOut(t);
  const segs = from.map((f, i) => {
    const b = bars[i];
    const x1 = lerp(f.x1, b.x1, e), x2 = lerp(f.x2, b.x2, e), y1 = lerp(f.y1, b.y, e), y2 = lerp(f.y2, b.y, e);
    const w = lerp(width, b.h, e);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color.cobalt}" stroke-width="${w}" stroke-linecap="round"/>`;
  }).join("");
  return `<svg style="position:absolute;left:0;top:0;z-index:${z};opacity:${opacity}" width="1920" height="1080">${segs}</svg>`;
}

// The signature: an 8 px cobalt line with round ends, drawn along `d` up to fraction `draw`.
// `from` lets the tail retract, so the line can travel instead of only growing.
export function spineLine(d, draw, { from = 0, opacity = 1, z = 2, stroke = color.cobalt, width = 8 } = {}) {
  if (opacity <= 0.001 || draw <= from) return "";
  const a = clamp01(from), b = clamp01(draw);
  return `<svg style="position:absolute;left:0;top:0;z-index:${z};opacity:${opacity};overflow:visible" width="1920" height="1080">` +
    `<path d="${d}" pathLength="1000" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ` +
    `stroke-dasharray="0 ${a * 1000} ${(b - a) * 1000} 2000"/></svg>`;
}

// Burned-in caption, two lines at most, inside y 940 to 1060 on a dark backing for contrast.
export function caption(content, opacity = 1) {
  if (!content || opacity <= 0.001) return "";
  return `<div style="position:absolute;left:0;right:0;top:940px;height:120px;display:flex;align-items:center;justify-content:center;z-index:20;opacity:${opacity}">` +
    `<div style="max-width:1560px;text-align:center;font-size:${type.caption.size}px;line-height:${type.caption.line}px;font-weight:${type.caption.weight};color:#fff;background:rgba(20,36,58,0.86);padding:6px 26px 8px;border-radius:14px;">${content}</div></div>`;
}
