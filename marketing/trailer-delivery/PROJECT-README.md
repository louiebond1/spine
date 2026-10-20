# Spine launch trailer — complete rebuild

An 80-second Remotion film using the supplied Spine 2.0 recordings. This project replaces the rejected first edit. It includes articulated vector people, real recorded actions, stable reading holds, British synthetic narration, an original110BPM score, captions and recomposed variants.

## Render the delivered project

Requirements: Node24 (tested24.19), FFmpeg (tested7), Chromium at `/usr/bin/chromium`. All render assets are local. The bundled WAVs mean no speech service or model download is needed to render.

```bash
npm ci --cache .npm-cache
npx tsc --noEmit
node scripts/render.mjs master
python3 scripts/captions.py
bash scripts/finish.sh
node scripts/render.mjs render Vertical
node scripts/render.mjs render Short
node scripts/render.mjs render Future
bash scripts/finish-variants.sh
python3 scripts/normalise.py
python3 scripts/validate.py
```

`node scripts/render.mjs stills` generates all11 storyboard PNGs. `npm run studio` opens the editable Remotion project on a machine with a supported local browser. The cloud onboarding UI does not expose a local preview.

Render compositions: Master1920×1080/2400frames; Vertical1080×1920/2400; Short1920×1080/450; Future1920×1080/540. Every composition runs at30fps. Silent intermediate exports are combined with audio by FFmpeg. Final MP4s use H.264,yuv420p,AAC and fast-start metadata.

## Files and editing

- `spec/Spine_Trailer_Final_Brief.docx` and `spec/brief.txt`: governing specification, preserved.
- `spec/FINAL-SCRIPT.md`: final narration and scene directions.
- `spec/STORYBOARD.md`, `spec/frame-storyboard.csv`, `output/storyboard/`:11 scene frames and a2400-row timeline.
- `spec/source-manifest.json`: exact source frames, crops and real-time action windows.
- `src/timeline.ts`: locked scene timing.
- `src/scenes/`: editable layouts and frame-driven animation; Vertical is independently composed.
- `src/components/`: reusable vector characters, desks, cropped footage, typography and lines.
- `public/assets/clips/`: immutable supplied source recordings.
- `public/assets/focus/`: derived crops, normal-speed action MP4s and verified hold PNGs. Crops do not invent or repaint product controls. Cursor-free original frames were selected for the shared-answer and Pulse holds. Real cursors remain briefly during deliberate source clicks.
- `public/assets/audio/`: delivered narration, mix, original instrumental and cutdown audio.
- `output/Spine_Launch_QA.md`: review record, revisions and limitations.

The voices are generated phrase by phrase, with their actual start/end times in `src/narration.json`. No narration was omitted or rewritten. Captions are phrase aligned; vertical captions subdivide phrases by their word counts. No celebrity or identifiable-person voice imitation was requested.

Optional regeneration of derived assets uses Python3.12 with `opencv-python-headless`, `pillow`, `numpy`, `scipy`, `soundfile`, `fonttools`, `onnxruntime`, and `kokoro-onnx`. See scripts/prepare.py, logo.py, voice.py and audio.py. Kokoro model and voice files are not bundled; the prepared speech is bundled. Models used:thewh1teagle/kokoro-onnx release model-files-v1.0/kokoro-v1.0.onnx and voices-v1.0.bin. Generated speech uses bf_emma/en-gb, max1.05× speed.

## Rights and truthful presentation

Spine recordings and brand belong to their respective owner and were supplied for this project. The logo uses the exact app mark geometry and Inter600 wordmark converted to vector paths, sourced from `spine-2/src/components/shell/Logo.tsx` and its Tailwind tokens; it is not a screenshot reconstruction. Original vector character drawings, score and effects were created for this task. Inter is SIL OFL1.1. Kokoro tooling is MIT and the Kokoro project/model is Apache2.0; saved licences and source provenance are in spec/licences and spec/PROVENANCE.md. Remotion's own licence applies to commercial use; see the installed package's licence.

Acme Group figures are fictional demo data. Alex never joins the project team. Future integrations appear only in the labelled18-second concept teaser. The CTA has no fabricated destination.

Playback counters, decoding and still inspection are recorded. Human audiovisual/phone-speaker review is not claimed; see QA for the precise remaining review limitations.
