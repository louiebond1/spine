// Deterministic renderer: loads index.html in headless Chromium, calls setFrame(n) for each frame,
// screenshots it and pipes the PNGs into FFmpeg. No real-time capture, no wall clock.
//
//   node tools/render.mjs --out output/video.mp4 [--captions] [--from 0 --to 2399] [--audio file.wav]
//   node tools/render.mjs --stills 120,450,... [--dir output/storyboard] [--captions]
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, dflt) => {
  const i = process.argv.indexOf("--" + name);
  if (i < 0) return dflt;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
};

const types = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".otf": "font/otf", ".svg": "image/svg+xml" };
const server = createServer(async (req, res) => {
  try {
    const path = join(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
    const body = await readFile(path);
    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream", "cache-control": "max-age=3600" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const query = new URLSearchParams({ ...(arg("captions") ? { captions: "1" } : {}), ...(arg("comp") ? { comp: arg("comp") } : {}) });
const url = `http://127.0.0.1:${server.address().port}/index.html?${query}`;

const browser = await chromium.launch();
const vertical = arg("comp") === "vertical";
const page = await browser.newPage({ viewport: vertical ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => { console.error("page error:", e.message); process.exitCode = 1; });
await page.goto(url);
await page.evaluate(() => window.ready);

const shot = async (f) => {
  await page.evaluate((n) => window.setFrame(n), f);
  return page.locator("#stage").screenshot({ type: "png", animations: "disabled" });
};

if (arg("stills")) {
  const dir = join(root, arg("dir", "output/storyboard"));
  await mkdir(dir, { recursive: true });
  for (const f of String(arg("stills")).split(",").map(Number)) {
    await writeFile(join(dir, `frame-${String(f).padStart(4, "0")}.png`), await shot(f));
    console.log("still", f);
  }
} else {
  const total = await page.evaluate(() => window.TOTAL);
  const from = Number(arg("from", 0)), to = Number(arg("to", total - 1));
  const out = join(root, arg("out", "output/render.mp4"));
  await mkdir(dirname(out), { recursive: true });
  const audio = arg("audio");
  const ff = spawn("ffmpeg", [
    "-v", "error", "-y", "-f", "image2pipe", "-framerate", "30", "-c:v", "png", "-i", "-",
    ...(audio ? ["-ss", String(from / 30), "-i", join(root, audio), "-c:a", "aac", "-b:a", "192k", "-shortest"] : []),
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "30",
    "-movflags", "+faststart", out,
  ], { stdio: ["pipe", "inherit", "inherit"] });
  const t0 = Date.now();
  for (let f = from; f <= to; f++) {
    const png = await shot(f);
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once("drain", r));
    if (f % 150 === 0) console.log(`frame ${f} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  console.log("wrote", out);
}
await browser.close();
server.close();
