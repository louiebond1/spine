# Spine launch film: "One line"

Deterministic Python/Pillow/NumPy renderer for `Spine_Give_AI_a_Spine_Polished.mp4`
(1920x1080, 30 fps, 38.0 s, H.264 High yuv420p BT.709, AAC 48 kHz stereo, fast-start).

## Concept

A bright, typographic film. One brand-blue line carries the story:

| Time | What happens |
| --- | --- |
| 0 - 3 s | "Your company has AI." The line draws beneath it. |
| 3 - 9 s | The problems. The line falls short of a question ("Unanswered."), sags as an idea stalls ("Stalled."), and breaks into dashes ("Unproven."). |
| 9.5 s | It snaps taut: "Spine is your AI project manager." |
| 12.6 - 16 s | It circles a question and carries it to a Champion. "Answered." |
| 16.7 - 22 s | It becomes the six real stages (Idea, Approval, Recruiting, Building, Publishing, Live). Owner and team join. It stalls at Building, spikes into the Pulse heartbeat as Spine flags it, then reaches Live. |
| 22.7 - 26 s | It rises into hours saved: 6, 16, 30, 42 (the product's seeded July to October totals). |
| 27 - 29.4 s | "From idea to live." The line gathers into the centre. |
| 29.4 - 32.3 s | It cuts into three pieces that stack into the Spine logo; the wordmark rises in. |
| 32.3 - 38 s | End card: "Give your company's AI a spine." and "Book a demo". |

Copy and stage names follow the product brief (`CLAUDE.md`). The film is fully readable without
narration; a voiceover can be added at `assets/vo/voiceover.wav` (it is mixed in with the music
ducked underneath).

## Reproduce

Requirements: Python 3.10+, `numpy`, `Pillow`, FFmpeg with libx264, and the Inter font family
(`Inter-*.otf`, `InterDisplay-*.otf`, default folder `/usr/share/fonts/opentype/inter`, or set
`SPINE_FONT_DIR`).

```bash
pip install numpy pillow
./build.sh                       # writes out/Spine_Give_AI_a_Spine_Polished.mp4 (about a minute on 4 cores)
python3 render.py stills 9.7 20.3 30.6   # PNG stills for checking, in out/stills
```

## Files

| File | Purpose |
| --- | --- |
| `timeline.py` | The whole film: camera rail, the line's shape per scene and the morphs between them, type, final logo build, end card |
| `engine.py` | Drawing primitives: anti-aliased segments, masked type reveals, dots, compositing |
| `render.py` | Frame dispatch, motion blur on camera moves, parallel encode |
| `score.py` | Original synthesised score, timed to the picture |
| `audio.py` | Sound cues on the line's key moments, optional voiceover with ducking |
| `build.sh` | Render, score, mix, loudness-normalise (-16 LUFS, peak -1.5 dBFS), mux with fast-start |
| `assets/plates/f0969.png` | The approved end card's logo (wordmark and final bars come from it exactly) |

## Tuning

All timings are absolute seconds in `timeline.py` (`RAIL`, `SCENES`, `SNAPS` and the text calls).
If you move a moment, move its cue in `audio.py` (`CUES`) and, for camera moves, `score.py` (`WHIPS`).
