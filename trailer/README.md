# Spine launch film: "Holds it together" (journey cut)

Deterministic Python/Pillow/NumPy renderer for `Spine_Give_AI_a_Spine_Polished.mp4`
(1920x1080, 30 fps, 60.0 s, H.264 High yuv420p BT.709, AAC 320k 48 kHz stereo, fast-start,
about -15 LUFS, peak below -1 dBFS).

Dark, on a steady 120 BPM beat, with one big line per scene and no small type outside the product
screens. Each everyday failure is underlined in Spine blue; the issue slams in and the underline
snaps in two, and the halves fly to the edges of frame. On "a spine." they slam together into the
Spine mark. Then the three problems become a journey along the top of frame: Questions, Builds,
Hours saved. A marker travels along it through real Spine screens (restyled dark), and each stop
lights up once Spine has solved that problem. The marker is also the piece that drops into each
screen to do the work: the leaderboard's bars sized to each person's points, six pieces that land as
the six stages from Idea to Live, Pulse's heartbeat that finds one quiet item per beat, and on Home
the logo's three bars becoming the three things that need you. At the end the journey line folds
down and its three sections become the logo's three bars. Product content comes from the final
mockups in `/design` and the brief and seed data in `CLAUDE.md`.

| Time | Scene |
| --- | --- |
| 0 - 4 s | "Your company has AI." / "So why do your AI ideas quietly die?" |
| 4 - 10 s | "Questions. Unanswered." / "Builds. Gone quiet." / "Hours saved? Nobody knows." Each underline snaps |
| 10 - 13 s | "Every team. Every week." / "Your AI needs a spine." The six halves slam into the mark |
| 13 - 16.5 s | "Spine is your AI project manager." |
| 17 - 27 s | Questions: "Ask anything about AI." / "Someone who knows picks it up." / "Sorted, one to one." / "Helpers get the credit." |
| 27 - 45.5 s | Builds: "Anyone can pitch an idea." / "AI reviews it, privately." / "Approvals can't stall." / "A team forms around it." / "AI writes the build plan." / "Nothing goes quiet unnoticed." / "From idea to Live." |
| 45.5 - 51.5 s | Hours saved: "Everyone knows what to do first." / "Every hour saved, counted." |
| 51.5 - 60 s | The journey folds into the logo; "Give your company's AI a spine." and "Book a demo" |

## Reproduce

Requirements: Python 3.10+, `numpy`, `Pillow`, FFmpeg with libx264, and the Inter family including
`InterDisplay-Light.otf` (default folder `/usr/share/fonts/opentype/inter`, or set `SPINE_FONT_DIR`).

```bash
pip install numpy pillow
./build.sh                                  # out/Spine_Give_AI_a_Spine_Polished.mp4, about 15 to 20 minutes on 4 cores
python3 render.py stills 4.7 21.0 44.6      # PNG stills in out/stills
```

## Files

| File | Purpose |
| --- | --- |
| `timeline.py` | The whole film: `BPM`, `SHOTS` (cut points), `SHOTS_HOW` (the journey's scenes and headlines), `STOPS` and `CHAPTERS` (the journey along the top), `ACTORS` (where the marker's piece lands in each screen), `draw_heartbeat`, `IMPACTS`, `piece()` (the six halves), the cards, logo and end card |
| `engine.py` | Shared drawing primitives |
| `render.py` | Frame dispatch, motion blur on moves and hits, parallel encode |
| `score.py` | Original synthesised 120 BPM score: minor groove, riser and flash, major groove with lifts as each stop lights, drop and logo chord |
| `audio.py` | Snap, slam, stop, rising stage ticks, heartbeat beeps and shot-change sounds (`CUES`); optional voiceover with ducking |
| `master.py` | Gain plus look-ahead peak limiter (ceiling -2 dBFS) before AAC encoding |
| `build.sh` | Render, score, mix, measure loudness, master, mux with fast-start |

## Tuning

All timings are absolute seconds in `timeline.py`. To change a scene's headline, edit `SHOTS_HOW`.
If you move a hit, move it in `IMPACTS`, its sound in `audio.py` (`CUES`) and its motion-blur window
in `render.py` (`BLUR`), and keep `kick_env()` in `timeline.py` matching `kick_on()` in `score.py`.
