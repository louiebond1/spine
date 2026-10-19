// Fonts, palette, safe areas and easing. Every scene reads from here.

export const W = 1920;
export const H = 1080;
export const FPS = 30;

export const color = {
  paper: "#F5F2EA",
  navy: "#14243A",
  cobalt: "#435CF5",
  white: "#FFFFFF",
  live: "#22C55E", // the green the product footage uses for Live and Verified
  ink2: "#4A5568", // secondary copy on paper
  rule: "rgba(20,36,58,0.12)",
  // Spine's own logo colours (src/app/globals.css on spine-2)
  logoLight: "rgb(129,160,255)",
  logoBrand: "rgb(59,91,219)",
};

// Character colours and skin tones (brief p3: Priya cobalt, Mia terracotta, Louie navy, Jamie green)
export const people = {
  priya: { name: "Priya", top: "#435CF5", skin: "#9C6644", hair: "#231815", hairStyle: "long" },
  mia: { name: "Mia", top: "#C8664A", skin: "#F1C9A5", hair: "#6E3420", hairStyle: "bun" },
  louie: { name: "Louie", top: "#14243A", skin: "#E3AE8C", hair: "#4A3426", hairStyle: "short" },
  jamie: { name: "Jamie", top: "#3E9A6B", skin: "#D6A06E", hair: "#16130F", hairStyle: "crop" },
};

export const safe = { x0: 120, x1: 1800, y0: 96, y1: 910 };
export const captionBox = { y0: 940, y1: 1060 };

export const type = {
  family: "'Inter', sans-serif",
  headline: { size: 80, line: 88, weight: 600 },
  ui: { size: 62, weight: 500 },
  label: { size: 42, weight: 500 },
  caption: { size: 52, line: 56, weight: 500 },
};

export const clamp01 = (t) => Math.max(0, Math.min(1, t));
export const easeOut = (t) => 1 - Math.pow(1 - clamp01(t), 3);
export const easeInOut = (t) => {
  t = clamp01(t);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
// Progress of an animation running from local frame a to b, eased out.
export const prog = (lf, a, b, ease = easeOut) => ease((lf - a) / (b - a));
export const lerp = (a, b, t) => a + (b - a) * t;
export const sec = (s) => Math.round(s * FPS);

// Standard entry (12 frames) and exit (10 frames) used for panels and copy.
export function presence(lf, inAt, outAt, { inDur = 12, outDur = 10, dy = 24 } = {}) {
  const tin = easeOut((lf - inAt) / inDur);
  const tout = outAt == null ? 0 : easeOut((lf - outAt) / outDur);
  return { opacity: tin * (1 - tout), dy: (1 - tin) * dy - tout * dy * 0.5 };
}
