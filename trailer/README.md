# Spine launch trailer, polished cut

Deterministic Python/Pillow/NumPy renderer for `Spine_Give_AI_a_Spine_Polished.mp4`
(1920x1080, 30 fps, 38.0 s, H.264 High yuv420p BT.709, AAC 48 kHz stereo, fast-start).

## Reproduce

Requirements: Python 3.10+, `numpy`, `Pillow`, FFmpeg with libx264, and the Inter font family
(`Inter-*.otf` and `InterDisplay-*.otf`). By default the fonts are read from
`/usr/share/fonts/opentype/inter`. Set `SPINE_FONT_DIR` to use another folder.

```bash
pip install numpy pillow
./build.sh                                  # uses the bundled assets
./build.sh path/to/Spine_Give_AI_a_Spine.mp4    # or re-extract assets from the approved cut
```

Output: `out/Spine_Give_AI_a_Spine_Polished.mp4`. A full build takes a few minutes on 4 cores.
Set `WORKERS` to change the number of render processes.

Check individual moments without encoding:

```bash
python3 render.py stills 9.6 14.6 24.9     # writes out/stills/t009.60.png etc.
```

## Files

| File | Purpose |
| --- | --- |
| `engine.py` | Camera with perspective, anti-aliased segment drawing (gradient, shadow, fill/outline), masked text reveals, backgrounds |
| `timeline.py` | All choreography: segment states per scene, camera path, transitions, text timing, end card |
| `render.py` | Frame dispatch (rendered / reused / end card), motion blur, parallel encode |
| `audio.py` | Original soundtrack plus synthesised landing cues (`CUES` list) |
| `build.sh` | Render, mix, limit, mux with fast-start |
| `assets/original_audio.wav` | Soundtrack extracted from the approved cut (voiceover and score, unchanged) |
| `assets/plates/f0879.png` to `f0968.png` | The approved cut's stage-bar-to-logo fold, reused frame for frame |
| `assets/plates/f0969.png` | The approved cut's settled logo (end-card background) |

## Structure

| Time | Frames | Source |
| --- | --- | --- |
| 0.00 to 29.27 s | 0 to 878 | Rendered by `timeline.render_scene` |
| 29.30 to 32.27 s | 879 to 968 | Approved cut, unchanged (stage bar folds into the logo) |
| 32.30 to 38.00 s | 969 to 1139 | Approved cut's logo plate plus re-set tagline and button |

The rendered section ends with the six segments exactly on the approved cut's settled stage bar
(measured at frame 879: six 250 px bars, 260 px pitch, centred on y = 491), so the cut is invisible.

The six segments keep their identity throughout: pair A (0, 1) is Answers and becomes the
logo's top bar, pair B (2, 3) is Ideas and becomes the middle bar, and pair C (4, 5) is Impact
and becomes the bottom bar. That mapping is how the approved fold already assembles the logo.

## Tuning

- Timings are absolute seconds in `timeline.py` and were placed against measured events in the
  original soundtrack (voice phrases and score onsets). If you change a landing, move its cue in
  `audio.py` too.
- Colours are sampled from the approved cut and defined once at the top of `engine.py`.
- Motion-blur windows and subframe counts are in `render.py` (`BLUR`).
