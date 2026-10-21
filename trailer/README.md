# Spine launch film: "Holds it together"

Deterministic Python/Pillow/NumPy renderer for `Spine_Give_AI_a_Spine_Polished.mp4`
(1920x1080, 30 fps, 38.0 s, H.264 High yuv420p BT.709, AAC 48 kHz stereo, fast-start, about -14.5 LUFS).

Dark, quiet and music-led: light type that resolves word by word (second line in Spine blue),
specific everyday failures shown with small cards, a blue flash on "Your AI needs a spine.", four
lines meeting in one glowing node, then a first look at real Spine screens restyled dark, with the
node travelling between them, ending on the logo.

| Time | Scene |
| --- | --- |
| 0 - 3.4 s | "Your company has AI." / "So why does so much of it quietly die?" |
| 3.6 - 5.6 s | 01 Questions: "A question about client data." / "Still unanswered." (Ben Carter's question, unclaimed) |
| 5.9 - 7.9 s | 02 Ideas: "A build that went quiet." / "No activity for 12 days." (Contract Clause Checker, 3 of 7 steps) |
| 8.2 - 10.2 s | 03 Impact: "Hours saved?" / "Nobody can say." |
| 10.5 - 11.6 s | "Every team. Every week." (faint fragments of the noise drift behind) |
| 11.85 - 13.1 s | "Your AI needs" / "a spine." then a blue flash |
| 13.3 - 16.6 s | Questions, Champions, Ideas, Leadership: four lines meet in the node. "Spine holds it together." |
| 16.8 - 19.6 s | A first look: Pulse, "Worth your attention today". "Quiet until a human is needed." |
| 19.6 - 22.4 s | Help Desk: Unclaimed becomes "Claimed by Alex Morgan". "Every question reaches a Champion." |
| 22.4 - 25.4 s | AI Invoice Assistant: stages fill to Building, the plan appears. "Every idea gets an owner, a team and a plan." |
| 25.4 - 28.4 s | Programme: hours saved draws up to 42. "Impact, measured in hours." |
| 28.4 - 29.6 s | All four screens together |
| 29.2 - 31.1 s | The node splits into the three bars of the logo; "Spine" resolves |
| 31.7 - 38 s | "Give your company's AI a spine." and "Book a demo" |

Product content (names, rows, stages, figures) comes from the final mockups in `/design` and the
seed data in `CLAUDE.md`; the screens are restyled dark for the film. The logo bars and wordmark
use the approved logo's geometry.

## Reproduce

Requirements: Python 3.10+, `numpy`, `Pillow`, FFmpeg with libx264, and the Inter family including
`InterDisplay-Light.otf` (default folder `/usr/share/fonts/opentype/inter`, or set `SPINE_FONT_DIR`).

```bash
pip install numpy pillow
./build.sh                                  # out/Spine_Give_AI_a_Spine_Polished.mp4, about a minute on 4 cores
python3 render.py stills 2.4 15.6 24.4      # PNG stills in out/stills
```

## Files

| File | Purpose |
| --- | --- |
| `timeline.py` | The whole film: background, word reveals, cards (dark-styled real screens), the node, the joining lines, logo and end card |
| `engine.py` | Shared drawing primitives |
| `render.py` | Frame dispatch, motion blur on card moves, parallel encode |
| `score.py` | Original synthesised score: low pulse, riser into the flash, driving section, logo chord |
| `audio.py` | Sound cues on the key moments (`CUES`); optional voiceover with ducking |
| `build.sh` | Render, score, mix, loudness-normalise, mux with fast-start |
