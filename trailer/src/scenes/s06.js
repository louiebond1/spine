// Scene 06, 35 to 44 s: someone chooses to join. Source: clip 06. The centrepiece transformation.
// One of three becomes two of three. The third seat stays open. Alex is never shown as a member.
import { color, prog, sec, lerp, easeInOut, presence } from "../design.js";
import { headline, sourceCrop, sourceFrame, text, box } from "../components/primitives.js";
import { desk, svgLayer, personSVG } from "../components/people.js";

const CARD = { x: 960, y: 330, scale: 1.0 };

function table(opacity, scale) {
  // A round shared table, drawn as an ellipse. Editorial illustration, not a product feature.
  const inner = `<ellipse cx="0" cy="34" rx="590" ry="92" fill="#B9A688"/><ellipse cx="0" cy="0" rx="600" ry="86" fill="#D9C9AE"/>` +
    `<ellipse cx="0" cy="0" rx="560" ry="70" fill="#E3D6C1"/>`;
  return svgLayer(960, 800, scale, inner, { opacity, z: 4, w: 1300, h: 260, ox: 650, oy: 110 });
}

// The open third place: an empty chair back behind the table.
function openSeat(opacity, scale) {
  const inner = `<rect x="-70" y="-150" width="140" height="150" rx="34" fill="none" stroke="#B9A688" stroke-width="10" stroke-dasharray="20 14"/>`;
  return svgLayer(960, 790, scale, inner, { opacity, z: 3, w: 200, h: 200, ox: 100, oy: 170 });
}

function documentIcon(x, y, opacity) {
  return box(x, y, `<svg width="96" height="76" viewBox="0 0 96 76"><rect x="4" y="4" width="88" height="68" rx="10" fill="#fff" stroke="${color.navy}" stroke-width="4"/><rect x="18" y="20" width="52" height="7" rx="3" fill="#C7CEDA"/><rect x="18" y="34" width="60" height="7" rx="3" fill="#C7CEDA"/><rect x="18" y="48" width="40" height="7" rx="3" fill="#C7CEDA"/></svg>`, { opacity, z: 6 });
}
function workflowIcon(x, y, opacity) {
  return box(x, y, `<svg width="120" height="76" viewBox="0 0 120 76"><path d="M22,38 L60,18 L98,38" stroke="${color.cobalt}" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="22" cy="38" r="14" fill="${color.cobalt}"/><circle cx="60" cy="18" r="14" fill="#fff" stroke="${color.cobalt}" stroke-width="6"/><circle cx="98" cy="38" r="14" fill="${color.cobalt}"/></svg>`, { opacity, z: 6 });
}

export function s06(lf) {
  let html = headline("Your idea. Our next project.", lf);

  // Desk spaces slide together between 2.0 and 3.2 s; the camera pulls back by 5 percent.
  const join = easeInOut((lf - sec(2.0)) / sec(1.2));
  const pull = lerp(1, 0.95, join);
  const zoom = (x, y) => [960 + (x - 960) * pull, 540 + (y - 540) * pull];

  const louieX = lerp(290, 450, join), jamieX = lerp(1630, 1470, join);
  const deskOpacity = 1 - join;
  const clicked = lf >= sec(1.0) - 4 + 32; // the team view shows 2 of 3 from source frame 152

  // Louie places a source document (4.0 s), Jamie places a workflow symbol (5.0 s).
  const louieReach = lf < sec(4.0) ? 0 : Math.min(prog(lf, sec(4.0), sec(4.5)), 1 - prog(lf, sec(4.9), sec(5.4)));
  const jamieReach = lf < sec(5.0) ? 0 : Math.min(prog(lf, sec(5.0), sec(5.5)), 1 - prog(lf, sec(5.9), sec(6.4)));
  const louiePose = { mood: lf > sec(2.2) ? "pleased" : "neutral", look: 0.5, reachR: louieReach * 0.9 };
  const jamiePose = { mood: clicked ? "pleased" : "attentive", look: lf < sec(2.0) ? -0.2 : -0.5, reachL: jamieReach * 0.9, liftR: lf > sec(1.0) && lf < sec(1.0) + 24 ? 0.15 : 0 };

  let [lx, ly] = zoom(louieX, 800), [jx, jy] = zoom(jamieX, 800);
  html += desk("louie", lx, ly, 0.72 * pull, { screen: "team", side: 1, pose: louiePose, deskOpacity });
  html += desk("jamie", jx, jy, 0.72 * pull, { screen: "team", side: -1, pose: jamiePose, deskOpacity });
  html += table(join, pull);
  html += openSeat(prog(lf, sec(2.8), sec(3.4)) * 0.9, pull);

  // Portrait labels under each person.
  const lab = presence(lf, sec(0.2), null);
  html += text(lx - 150, ly + 120, "Louie · Owner", { size: 36, weight: 600, w: 300, align: "center", opacity: lab.opacity });
  html += text(jx - 150, jy + 120, clicked ? "Jamie · Member" : "Jamie", { size: 36, weight: 600, w: 300, align: "center", opacity: lab.opacity });

  // The real team view: 1 of 3, Jamie's press at 1.0 to 2.0 s, then 2 of 3 people.
  const teamF = sourceFrame(lf, [{ at: sec(1.0) - 4, src: 120 + 0, until: 179 }]);
  const handover = prog(lf, sec(8.7), sec(9.0));
  const cardScale = lerp(1.22, 1.3, join) * lerp(1, 0.9, handover);
  const [cx, cy] = zoom(960, CARD.y);
  html += sourceCrop("team", Math.max(120, teamF), cx - 700 * cardScale / 2, cy - 80 - handover * 40, cardScale, { opacity: prog(lf, 0, 10) });

  // Jamie's own view of the Join the team button, beside Jamie, until the press lands.
  if (lf < sec(2.2)) {
    const jb = presence(lf, sec(0.2), sec(1.9));
    const f = sourceFrame(lf, [{ at: sec(1.0) - 4, src: 120, until: 151 }]);
    html += sourceCrop("joinBtn", f, 1440, 400 + jb.dy, 1.45, { opacity: jb.opacity });
  }

  html += documentIcon(lx + 70, ly - 6, prog(lf, sec(4.4), sec(4.7)));
  html += workflowIcon(jx - 190, jy - 6, prog(lf, sec(5.4), sec(5.7)));

  // 8.7 to 9.0: the work surface hands over to the plan.
  const out = prog(lf, sec(8.7), sec(9.0));
  return { bg: color.paper, html: out > 0 ? `<div style="position:absolute;inset:0;opacity:${1 - out}">${html}</div>` : html };
}
