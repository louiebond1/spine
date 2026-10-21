# Spine launch film: "Holds it together" (rhythm cut)

Deterministic Python/Pillow/NumPy renderer for `Spine_Give_AI_a_Spine_Polished.mp4`
(1920x1080, 30 fps, 38.0 s, H.264 High yuv420p BT.709, AAC 320k 48 kHz stereo, fast-start,
about -15 LUFS, peak below -1.5 dBFS).

The dark film from v6, re-cut to a steady 120 BPM beat: shorter lines, bigger type, a new shot
every one to three seconds with a slow push-in, and a background glow that breathes on every kick.
Light type resolves word by word (second line in Spine blue). Product content comes from the final
mockups in `/design` and the seed data in `CLAUDE.md`, restyled dark for the film.

| Time | Scene |
| --- | --- |
| 0 - 2 s | "Your company has AI." |
| 2 - 4 s | "So why does it" / "quietly die?" |
| 4 - 6 s | 01 Questions: "Questions." / "Unanswered." (Ben Carter's question, unclaimed) |
| 6 - 8 s | 02 Ideas: "Builds." / "Gone quiet." (Contract Clause Checker, 3 of 7 steps) |
| 8 - 10 s | 03 Impact: "Hours saved?" / "Nobody knows." |
| 10 - 12 s | "Every team." / "Every week." |
| 12 - 13 s | "Your AI needs" / "a spine." then a blue flash |
| 13 - 16 s | Questions, Champions, Ideas, Leadership: four lines meet in the node. "Spine holds it together." |
| 16 - 19 s | Pulse: "Quiet until you're needed." |
| 19 - 22 s | Help Desk, claimed by Alex Morgan: "Every question gets a Champion." |
| 22 - 25 s | AI Invoice Assistant, stages fill to Building: "An owner. A team. A plan." |
| 25 - 28 s | Programme, hours saved draws up to 42: "Impact, in hours." |
| 28 - 29 s | All four screens together |
| 29 - 31 s | The music drops; three bars land on the beat and "Spine" resolves |
| 31.5 - 38 s | "Give your company's AI a spine." and "Book a demo" |

## Reproduce

Requirements: Python 3.10+, `numpy`, `Pillow`, FFmpeg with libx264, and the Inter family including
`InterDisplay-Light.otf` (default folder `/usr/share/fonts/opentype/inter`, or set `SPINE_FONT_DIR`).

```bash
pip install numpy pillow
./build.sh                                  # out/Spine_Give_AI_a_Spine_Polished.mp4, a few minutes on 4 cores
python3 render.py stills 4.6 15.0 23.5      # PNG stills in out/stills
```

## Files

| File | Purpose |
| --- | --- |
| `timeline.py` | The whole film: `BPM`, `SHOTS` (cut points), `kick_env` (glow on the kick), word reveals, cards, node, logo, end card |
| `engine.py` | Shared drawing primitives |
| `render.py` | Frame dispatch, motion blur on card moves, parallel encode |
| `score.py` | Original synthesised 120 BPM score: minor groove, riser and flash, major groove, drop and logo chord |
| `audio.py` | Sound cues on the key moments (`CUES`); optional voiceover with ducking |
| `master.py` | Gain plus look-ahead peak limiter (ceiling -2 dBFS) before AAC encoding |
| `build.sh` | Render, score, mix, measure loudness, master, mux with fast-start |

## Tuning

All timings are absolute seconds in `timeline.py`. If you move a moment, move its sound in
`audio.py` (`CUES`) and `score.py`, and keep `kick_env()` in `timeline.py` matching `kick_on()` in
`score.py` so the glow stays on the beat.
