// Frame renderer. window.setFrame(frame) draws exactly one frame from scratch: no timers, no wall clock,
// no randomness, so any frame renders identically in any order.
import { FPS } from "./design.js";
import { scenes, narration, sceneAt, TOTAL } from "./timeline.js";
import { caption } from "./components/brand.js";
import { s01 } from "./scenes/s01.js";
import { s02 } from "./scenes/s02.js";
import { s03 } from "./scenes/s03.js";
import { s04 } from "./scenes/s04.js";
import { s05 } from "./scenes/s05.js";
import { s06 } from "./scenes/s06.js";
import { s07 } from "./scenes/s07.js";
import { s08 } from "./scenes/s08.js";
import { s09 } from "./scenes/s09.js";
import { s10 } from "./scenes/s10.js";
import { s11 } from "./scenes/s11.js";
import * as cut15 from "./cut15.js";
import * as teaser from "./teaser.js";
import * as vertical from "./vertical.js";

const render = { "01": s01, "02": s02, "03": s03, "04": s04, "05": s05, "06": s06, "07": s07, "08": s08, "09": s09, "10": s10, "11": s11 };

export function captionAt(frame) {
  const s = sceneAt(frame);
  if (!s) return null;
  const t = (frame - s.start) / FPS;
  const cue = (narration[s.id] || []).find(([a, b]) => t >= a && t < b);
  return cue ? cue[2] : null;
}

const stage = document.getElementById("stage");
const params = new URLSearchParams(location.search);
let showCaptions = params.get("captions") === "1";
const comp = params.get("comp") || "master";

function master(frame) {
  const s = sceneAt(frame);
  return render[s.id](frame - s.start);
}
const compositions = { master: { TOTAL, frame: master }, cut15, teaser, vertical };

window.TOTAL = compositions[comp].TOTAL;
const size = compositions[comp].SIZE || { w: 1920, h: 1080 };
stage.style.width = size.w + "px";
stage.style.height = size.h + "px";
window.scenes = scenes;
window.setCaptions = (on) => { showCaptions = on; };
window.setFrame = async (frame) => {
  const { bg, html } = compositions[comp].frame(frame);
  stage.style.background = bg;
  const cap = !showCaptions ? "" : comp === "master" ? caption(captionAt(frame)) : comp === "vertical" ? vertical.captionHTML(frame) : "";
  stage.innerHTML = html + cap;
  await Promise.all([...stage.querySelectorAll("img")].map((img) => img.decode().catch(() => { throw new Error("missing " + img.src); })));
  return true;
};
window.ready = document.fonts.ready.then(() => Promise.all([...document.fonts].map((f) => f.load()))).then(() => true);

if (params.has("f")) window.ready.then(() => window.setFrame(Number(params.get("f"))));
