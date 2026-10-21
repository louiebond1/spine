# Spine launch film: "Holds it together" (six pieces cut)

Deterministic Python/Pillow/NumPy renderer for `Spine_Give_AI_a_Spine_Polished.mp4`
(1920x1080, 30 fps, 38.0 s, H.264 High yuv420p BT.709, AAC 320k 48 kHz stereo, fast-start,
about -15 LUFS, peak below -1.5 dBFS).

Dark, on a steady 120 BPM beat. Each everyday failure is underlined in Spine blue, and the
underline snaps in two as its issue slams in. The six broken halves hang at the edges of frame,
get pulled in around "Your AI needs a spine." and slam together into the Spine mark. Under each
real Spine screen an underline locks back together, and at the end the three logo bars fly in as
halves and lock into the logo. Every hit shakes, punches and briefly splits the frame; the score
pumps against the kick and each snap, lock and slam has its own sound. Product content comes from
the final mockups in `/design` and the seed data in `CLAUDE.md`, restyled dark for the film.

| Time | Scene |
| --- | --- |
| 0 - 2 s | "Your company has AI." |
| 2 - 4 s | "So why does it" / "quietly die?" |
| 4 - 6 s | 01 Questions: "Questions." underlined; the line snaps as "Unanswered." slams in (Ben Carter's question, unclaimed) |
| 6 - 8 s | 02 Ideas: "Builds." snaps on "Gone quiet." (Contract Clause Checker, 3 of 7 steps) |
| 8 - 10 s | 03 Impact: "Hours saved?" snaps on "Nobody knows." |
| 10 - 12 s | "Every team." / "Every week." The six halves hang at the edges, trembling on the kick |
| 12 - 13 s | "Your AI needs" / "a spine." The halves are pulled in, shaking |
| 13 s | They slam together into the Spine mark: flash, shockwave |
| 13 - 16 s | "Spine holds it together." then the mark whips off |
| 16 - 19 s | Pulse: "Quiet until you're needed." |
| 19 - 22 s | Help Desk, claimed by Alex Morgan: "Every question gets a Champion." (underline locks on 20.0) |
| 22 - 25 s | AI Invoice Assistant, stages fill to Building: "An owner. A team. A plan." (locks on 23.0) |
| 25 - 28 s | Programme, hours saved draws up to 42: "Impact, in hours." (locks on 26.0) |
| 28 - 29 s | All four screens together |
| 29 - 31 s | The music drops; each logo bar flies in as two halves and locks on the beat; "Spine" resolves |
| 31.5 - 38 s | "Give your company's AI a spine." and "Book a demo" |

## Reproduce

Requirements: Python 3.10+, `numpy`, `Pillow`, FFmpeg with libx264, and the Inter family including
`InterDisplay-Light.otf` (default folder `/usr/share/fonts/opentype/inter`, or set `SPINE_FONT_DIR`).

```bash
pip install numpy pillow
./build.sh                                  # out/Spine_Give_AI_a_Spine_Polished.mp4, a few minutes on 4 cores
python3 render.py stills 4.6 13.07 30.6     # PNG stills in out/stills
```

## Files

| File | Purpose |
| --- | --- |
| `timeline.py` | The whole film: `BPM`, `SHOTS` (cut points), `IMPACTS` (shake and punch), `piece()` (the six halves), word reveals, cards, logo, end card |
| `engine.py` | Shared drawing primitives |
| `render.py` | Frame dispatch, motion blur on card moves, parallel encode |
| `score.py` | Original synthesised 120 BPM score: minor groove, riser and flash, major groove, drop and logo chord |
| `audio.py` | Snap, lock and slam sounds on the hits (`CUES`); optional voiceover with ducking |
| `master.py` | Gain plus look-ahead peak limiter (ceiling -2 dBFS) before AAC encoding |
| `build.sh` | Render, score, mix, measure loudness, master, mux with fast-start |

## Tuning

All timings are absolute seconds in `timeline.py`. If you move a hit, move it in `IMPACTS`, its sound in
`audio.py` (`CUES`) and its motion-blur window in `render.py` (`BLUR`), and keep `kick_env()` in `timeline.py` matching `kick_on()` in
`score.py` so the glow stays on the beat.
