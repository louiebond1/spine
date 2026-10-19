# Spine launch trailer

The 80 second Spine 2.0 launch film, plus a 15 second cut, a vertical version, a separate
"Coming next" teaser and three stills. Built from the real Spine 2.0 recordings on the `spine-2`
branch (`marketing/clips/`), with illustrated people, editorial type and an original score.

- Script and storyboard: [SCRIPT.md](SCRIPT.md) and [storyboard/](storyboard)
- Quality checks and known limitations: [QA.md](QA.md)
- Source manifest (every crop, its clip, frames and use): [src/sources.js](src/sources.js)

## How it's made

A deterministic frame renderer. `index.html` loads `src/main.js`; `window.setFrame(n)` draws frame
`n` from scratch (no timers, no wall clock, no unseeded randomness). `tools/render.mjs` opens it in
headless Chromium (Playwright), screenshots each frame and pipes the PNGs into FFmpeg. Source
footage is never seeked live: `tools/extract.mjs` writes each source frame the edit uses to
`public/frames/<shot>/<frame>.png`, and the scenes map local frames to exact source frames.

```
src/design.js        palette, type, safe areas, easing
src/timeline.js      scene IDs, start frames, durations, narration cues
src/sources.js       source manifest
src/components/      primitives (crop panels, quotes, captions), people (characters, desks), brand (logo, line)
src/scenes/s01..s11  one module per scene of the master
src/cut15.js         the 15 second cut
src/vertical.js      the vertical recomposition
src/teaser.js        the 18 second "Coming next · Concept" teaser
tools/               fetch_sources.sh, extract.mjs, patch_cursor.py, music.py, srt.mjs, render.mjs
```

## Render

Needs Node 22, Python 3 with numpy and Pillow, FFmpeg with libx264, and a Chromium that Playwright
can launch (set `PLAYWRIGHT_BROWSERS_PATH` if it isn't installed in the default place).

```
npm ci
tools/fetch_sources.sh                      # recordings and screenshots from origin/spine-2
node tools/extract.mjs                      # source frames, with the pointer masks applied
python3 -I tools/music.py                   # score and cues (public/assets/audio/*.wav)
# loudness: normalise each wav to -16 LUFS, true peak -1.5 dBTP (two-pass loudnorm), saved as *_norm.wav
node tools/srt.mjs output/Spine_Launch_Master.srt

node tools/render.mjs --out output/Spine_Launch_Master_1080p.mp4 --audio public/assets/audio/mix_norm.wav
node tools/render.mjs --captions --out output/Spine_Launch_Captioned_1080p.mp4 --audio public/assets/audio/mix_norm.wav
node tools/render.mjs --comp vertical --captions --out output/Spine_Launch_Vertical_1080x1920.mp4 --audio public/assets/audio/mix_norm.wav
node tools/render.mjs --comp cut15 --out output/Spine_Launch_15s.mp4 --audio public/assets/audio/cut15_norm.wav
node tools/render.mjs --comp teaser --out output/Spine_Coming_Next_18s.mp4 --audio public/assets/audio/teaser_norm.wav
node tools/render.mjs --stills 250,1230,2140 --dir output/stills
```

The loudness step, exactly as run:

```
for f in mix cut15 teaser; do
  J=$(ffmpeg -hide_banner -nostats -i public/assets/audio/$f.wav -af loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
  M=$(echo "$J" | python3 -c "import sys,json;d=json.load(sys.stdin);print(f\"measured_I={d['input_i']}:measured_TP={d['input_tp']}:measured_LRA={d['input_lra']}:measured_thresh={d['input_thresh']}:offset={d['target_offset']}\")")
  ffmpeg -y -i public/assets/audio/$f.wav -af loudnorm=I=-16:TP=-1.5:LRA=11:$M:linear=true -ar 48000 public/assets/audio/${f}_norm.wav
done
```

A full 2400 frame render takes about five minutes on one core.
To preview a frame in a browser, serve this folder and open `index.html?f=1230` (add `&captions=1`,
or `&comp=vertical|cut15|teaser`).

## Licences

- Inter typeface: SIL Open Font License 1.1 (`licences/Inter-OFL.txt`)
- Playwright: Apache 2.0 (`licences/Playwright-Apache-2.0.txt`)
- Music and sound effects: original, synthesised by `tools/music.py` for this film; no samples or third-party recordings
- Product footage and the Spine logo: Spine's own recordings and logo component (`src/components/shell/Logo.tsx` on `spine-2`)
- Illustrations: drawn in code for this film (`src/components/people.js`)
