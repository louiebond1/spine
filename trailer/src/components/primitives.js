// Small HTML helpers shared by every scene. Everything is absolutely positioned in 1920 x 1080 space.
import { color, type } from "../design.js";
import { shots } from "../sources.js";

const px = (n) => `${Math.round(n * 100) / 100}px`;

export function box(x, y, inner, { opacity = 1, w, h, z = 0, style = "" } = {}) {
  if (opacity <= 0.001) return "";
  return `<div style="position:absolute;left:${px(x)};top:${px(y)};${w ? `width:${px(w)};` : ""}${h ? `height:${px(h)};` : ""}opacity:${opacity};z-index:${z};${style}">${inner}</div>`;
}

export function text(x, y, content, { size = 42, weight = 500, fill = color.navy, opacity = 1, w, align = "left", line, z = 6, track = 0 } = {}) {
  return box(x, y, content, {
    opacity, w, z,
    style: `font-size:${size}px;font-weight:${weight};color:${fill};line-height:${line || Math.round(size * 1.15)}px;text-align:${align};letter-spacing:${track}em;white-space:${w ? "normal" : "nowrap"};`,
  });
}

export function headline(content, lf, { x = 120, y = 96, fill = color.navy, opacity = 1, w = 1680 } = {}) {
  return text(x, y, content, { size: type.headline.size, line: type.headline.line, weight: type.headline.weight, fill, opacity, w, z: 7, track: -0.02 });
}

// A real source crop, shown in a rounded panel. `frame` is a source frame number of that shot.
export function sourceCrop(id, frame, x, y, scale, { opacity = 1, radius = 18, shadow = true, z = 5, border = true, clipTop = 0, clipBottom = 0 } = {}) {
  const s = shots[id];
  const w = s.w * scale;
  const h = (s.h - clipTop - clipBottom) * scale;
  const img = `<img src="public/frames/${id}/${frame}.png" style="position:absolute;left:0;top:${px(-clipTop * scale)};width:${px(s.w * scale)};height:${px(s.h * scale)};" />`;
  return box(x, y, img, {
    opacity, w, h, z,
    style: `overflow:hidden;border-radius:${radius}px;${border ? `box-shadow:0 0 0 1px ${color.rule}${shadow ? ",0 18px 40px rgba(20,36,58,0.10)" : ""};` : ""}background:#fff;`,
  });
}

// Source frame for a shot whose playback is described as segments of local frames.
// Each segment plays the source from `src` at normal speed starting at local frame `at`,
// clamped to [src, until] so it freezes on `until`.
export function sourceFrame(lf, segments) {
  let f = segments[0].src;
  for (const s of segments) if (lf >= s.at) f = Math.min(s.until ?? s.src, s.src + (lf - s.at));
  return f;
}

export function demoLabel(opacity = 1, { x = 120, y = 878, fill = color.ink2 } = {}) {
  return text(x, y, "Acme Group · Demo data", { size: 40, weight: 600, fill, opacity, z: 8 });
}

export function chip(x, y, content, { fill = color.navy, bg = "rgba(20,36,58,0.06)", size = 30, opacity = 1, z = 7 } = {}) {
  return box(x, y, content, {
    opacity, z,
    style: `font-size:${size}px;font-weight:500;color:${fill};background:${bg};padding:8px 18px;border-radius:999px;white-space:nowrap;`,
  });
}

// Editorial quote card: a short summary set outside the product UI, clearly labelled.
export function editorialQuote(x, y, w, label, content, { size = 60, opacity = 1, dy = 0, z = 7, accent = color.cobalt } = {}) {
  const inner = `<div style="font-size:30px;font-weight:600;color:${accent};letter-spacing:0.01em;margin-bottom:14px;">${label}</div>` +
    `<div style="font-size:${size}px;font-weight:600;line-height:${Math.round(size * 1.14)}px;color:${color.navy};letter-spacing:-0.015em;">${content}</div>`;
  return box(x, y + dy, inner, {
    opacity, w, z,
    style: `background:${color.white};border-radius:24px;padding:30px 40px 34px;box-shadow:0 0 0 1px ${color.rule},0 20px 48px rgba(20,36,58,0.12);border-left:8px solid ${accent};`,
  });
}

export function rect(x, y, w, h, fill, { radius = 0, opacity = 1, z = 0 } = {}) {
  return box(x, y, "", { w, h, opacity, z, style: `background:${fill};border-radius:${radius}px;` });
}
