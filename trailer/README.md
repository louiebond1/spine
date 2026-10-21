# Spine launch film: "Holds it together" (explainer cut)

Deterministic Python/Pillow/NumPy renderer for `Spine_Give_AI_a_Spine_Polished.mp4`
(1920x1080, 30 fps, 61.0 s, H.264 High yuv420p BT.709, AAC 320k 48 kHz stereo, fast-start,
about -15 LUFS, peak below -1 dBFS).

Dark, on a steady 120 BPM beat. Each everyday failure is underlined in Spine blue, and the
underline snaps in two as its issue slams in. The six broken halves slam together into the Spine
mark on "a spine.". Then the film explains the product one idea per shot, each with a real Spine
screen (restyled dark), a headline and one plain line of explanation; underlines lock back together
on the key moments, and the logo's bars fly in as halves to finish. Every hit shakes, punches and
briefly splits the frame.

The six pieces carry one story through the whole film. On "a spine." they slam into the mark but
keep hairline cracks: held together, not yet fixed. Each chapter's underline is one broken pair, and
it is repaired on the shot that solves its problem: the Questions pair on "A colleague claims it.",
the Builds pair on "AI writes the build plan.", the Hours pair on "Leaders see the impact." The logo
at the end is built from the three repaired bars. Along the way a piece peels off each underline and
becomes the thing the line describes: the leaderboard's five bars sized to each person's points, six
pieces that land as the six stages from Idea to Live, Pulse's heartbeat that finds one quiet item per
beat, and on Home the logo's three bars becoming the three things that need you. Chapters change
behind the logo's three bars blown up to full frame.

| Time | Scene |
| --- | --- |
| 0 - 4 s | "Your company has AI." / "So why do your AI ideas quietly die?" |
| 4 - 10 s | "Questions. Unanswered." / "Builds. Gone quiet." / "Hours saved? Nobody knows." Each underline snaps |
| 10 - 13 s | "Every team. Every week." / "Your AI needs a spine." The six halves slam into the mark |
| 13 - 17 s | "Spine is your AI project manager." / "It makes sure good AI ideas and questions never quietly die." |
| 17 - 28 s | 01 Help Desk: anyone asks (named or anonymous); a colleague claims it (someone the company has chosen to answer AI questions); private chat until resolved; the Leaderboard (one point per resolved question) |
| 28 - 46 s | 02 Ideas & Projects: propose an idea; AI review (advisory, only the owner sees the scores); leadership approval (or auto-approve); a team joins; AI writes the build plan; published, then Live |
| 46 - 49 s | 03 Pulse: approvals near timeout, unclaimed questions, stalled builds; daily in Slack |
| 49 - 52 s | 04 Home: what needs you first; quiet until a human is needed |
| 52 - 55 s | 05 Programme: what went Live and the hours it saved |
| 55 - 61 s | The logo bars lock on the beat; "Give your company's AI a spine." and "Book a demo" |

## Reproduce

Requirements: Python 3.10+, `numpy`, `Pillow`, FFmpeg with libx264, and the Inter family including
`InterDisplay-Light.otf` (default folder `/usr/share/fonts/opentype/inter`, or set `SPINE_FONT_DIR`).

```bash
pip install numpy pillow
./build.sh                                  # out/Spine_Give_AI_a_Spine_Polished.mp4, about 15 to 20 minutes on 4 cores
python3 render.py stills 4.6 22.4 42.4      # PNG stills in out/stills
```

## Files

| File | Purpose |
| --- | --- |
| `timeline.py` | The whole film: `BPM`, `SHOTS` (cut points), `SHOTS_HOW` (the explainer shots and their copy), `HEAL` (when each pair is repaired), `ACTORS` (where each shot's piece lands), `draw_heartbeat`, `WIPES`, `SECTIONS`, `IMPACTS`, `piece()` (the six halves), the cards, logo and end card |
| `engine.py` | Shared drawing primitives |
| `render.py` | Frame dispatch, motion blur on moves and hits, parallel encode |
| `score.py` | Original synthesised 120 BPM score: minor groove, riser and flash, major groove with lifts at 28 and 46 s, drop and logo chord |
| `audio.py` | Snap, repair, slam, rising stage ticks, heartbeat beeps and shot-change sounds (`CUES`); optional voiceover with ducking |
| `master.py` | Gain plus look-ahead peak limiter (ceiling -2 dBFS) before AAC encoding |
| `build.sh` | Render, score, mix, measure loudness, master, mux with fast-start |

## Tuning

All timings are absolute seconds in `timeline.py`. To change the explainer copy, edit `SHOTS_HOW`.
If you move a hit, move it in `IMPACTS`, its sound in `audio.py` (`CUES`) and its motion-blur window
in `render.py` (`BLUR`), and keep `kick_env()` in `timeline.py` matching `kick_on()` in `score.py`.
