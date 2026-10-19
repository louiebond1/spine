// Scene 01, 0 to 6 s: company wide fragmentation. Three desks, three disconnected strokes.
import { color, prog, lerp, sec, easeInOut } from "../design.js";
import { headline, chip } from "../components/primitives.js";
import { desk } from "../components/people.js";
import { spineLine } from "../components/brand.js";

export const deskX = [360, 960, 1560];
export const deskY = 700;
export const S01_SCALE = 0.95;

// Where each desk's stroke sits at the end of the scene; scene 02 continues from these.
export const strokeEnd = [
  { x1: 640, x2: 800, y1: 900, y2: 900 },
  { x1: 900, x2: 1060, y1: 900, y2: 900 },
  { x1: 1160, x2: 1320, y1: 900, y2: 900 },
];

export function s01(lf) {
  const settle = prog(lf, 0, 6) * 20;
  const swap = prog(lf, sec(2.7), sec(3.0));
  const toCentre = easeInOut((lf - sec(5.7)) / sec(0.3));
  const glance = prog(lf, sec(5.3), sec(5.8));

  let html = headline("AI is everywhere.", lf, { opacity: 1 - swap }) +
    headline("Progress can get lost.", lf, { opacity: swap });

  const who = ["priya", "mia", "louie"];
  const screens = ["question", "knowledge", "idea"];
  const tags = ["Questions", "Know how", "Ideas"];
  const looks = [
    lf < sec(1.2) ? 0 : prog(lf, sec(1.2), sec(1.6)) * 0.9, // Priya looks towards her question card
    0.6,
    -0.2,
  ];
  who.forEach((w, i) => {
    const x = deskX[i];
    const y = deskY + 20 - settle;
    const look = lerp(looks[i], 0, glance);
    html += desk(w, x, y, S01_SCALE, { screen: screens[i], side: i === 0 ? 1 : i === 1 ? 1 : -1, pose: { mood: "neutral", look } });
    html += chip(x - 90, y - 340, tags[i], { size: 34, bg: "rgba(20,36,58,0.07)" });
  });

  // One disconnected cobalt stroke per desk. They extend slightly from 3.0 s but never meet,
  // then travel towards the centre to become the logo in scene 02.
  const grow = prog(lf, sec(3.0), sec(5.6)) * 40;
  deskX.forEach((x, i) => {
    const base = { x1: x - 70 - grow, x2: x + 70 + grow, y: 900 };
    const e = strokeEnd[i];
    const x1 = lerp(base.x1, e.x1, toCentre), x2 = lerp(base.x2, e.x2, toCentre);
    html += spineLine(`M${x1},${base.y} L${x2},${base.y}`, 1, { z: 2 });
  });
  return { bg: color.paper, html };
}
