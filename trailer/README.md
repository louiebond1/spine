# Spine launch film: "Holds it together" (director's cut)

Deterministic Python/Pillow/NumPy renderer for `Spine_Give_AI_a_Spine_Polished.mp4`
(1920x1080, 30 fps, 58.0 s, H.264 High yuv420p BT.709, AAC 320k 48 kHz stereo, fast-start,
about -15 LUFS, peak below -1 dBFS).

## The idea

One continuous world, seen through one camera. Nothing is a slide: every object that appears has a
destination, and the same objects carry the story from problem to payoff.

1. **Questions go unanswered.** A question is sent along a line. The route ahead of it snaps, and it
   is left stranded while traffic on the lane below keeps moving past. Its age ticks on: 2 hours,
   1 day, 3 days.
2. **Ideas lose momentum.** The camera drops to the six-stage track. An idea glides from Idea to
   Building; the route ahead snaps, it dims, and the music stops dead: "No activity for 12 days".
3. **Impact goes unseen.** The camera pulls back to show the whole company: the stranded question,
   the stalled idea, dozens of small pieces of activity drifting without direction, and an empty
   hours-saved chart. Once the camera settles, a line reaches towards the chart and snaps before it arrives.
4. **"Your AI needs a spine."** Everything holds its breath. A spine draws down the frame and every
   loose piece, including the snapped halves, slams into line on it like vertebrae.
   "Spine is your AI project manager."
5. **The same three objects are resolved.** The stranded question: a route draws in and someone who
   knows (Alex Morgan) arrives on it and docks with the question; the answer appears. The stalled
   idea: Pulse's heartbeat runs across and beats on it, the team (MT, JC, SK) arrives and docks, the
   plan's steps, each with an owner, tick off, and it moves on to Publishing. The drifting activity:
   every piece streams into the chart and stacks up as the real hours saved (one piece per two hours:
   6, 16, 30, 42), "42 hours saved in October".
6. **The payoff.** Each resolved connection quietly leaves its scene and parks in the top-left corner,
   where, bar by bar, the Spine mark has been assembling all along. At the end it comes forward to
   full size, each bar briefly naming what it was (Questions, Ideas, Impact), light passes along it,
   and it becomes the logo: "Give your company's AI a spine."

Pacing: fast where something breaks or connects, still where it needs to land (the stranded
question, the stall, the spine, the answer, the 42). One large line per beat; product text that
matters is set large; anything small is only there to make the product feel real.

Product content comes from the final mockups in `/design` and the brief and seed data in `CLAUDE.md`
(Sarah Kim's Excel question and Alex Morgan's reply, Contract Clause Checker stalled at 3 of 7 steps
for 12 days, hours saved per month). The four plan steps for Contract Clause Checker and its team are
invented to fit the brief, as the brief allows for seed data.

| Time | Beat |
| --- | --- |
| 0 - 4 s | "Your company has AI." / "So why do your AI ideas quietly die?" over directionless pieces |
| 4 - 9.5 s | Questions go unanswered |
| 9.5 - 15.3 s | Ideas lose momentum |
| 15.3 - 21 s | Impact goes unseen |
| 21 - 25.5 s | "Your AI needs a spine." The spine. "Spine is your AI project manager." |
| 25.5 - 31.5 s | "Every question finds someone who knows." |
| 32 - 41.7 s | "Spine notices when work goes quiet." / "And nudges the right people." / "Every step has an owner." |
| 42.8 - 48 s | "Impact everyone can see." |
| 48 - 58 s | The mark comes forward and becomes the logo; "Give your company's AI a spine." / "Book a demo" |

## Reproduce

Requirements: Python 3.10+, `numpy`, `Pillow`, FFmpeg with libx264, and the Inter family including
`InterDisplay-Light.otf` (default folder `/usr/share/fonts/opentype/inter`, or set `SPINE_FONT_DIR`).

```bash
pip install numpy pillow
./build.sh                                  # out/Spine_Give_AI_a_Spine_Polished.mp4, about 30 minutes on 4 cores
python3 render.py stills 5.6 22.7 44.6      # PNG stills in out/stills
```

## Files

| File | Purpose |
| --- | --- |
| `timeline.py` | The whole film: `CAM` (the camera's path through the world), the question, the track and idea, the activity pieces (`piece_state`: wander, spine, chart), `SNAPS`, `PARKS` and `draw_mark` (the mark assembling in the corner), `IMPACTS`, and `render_scene` |
| `engine.py` | Shared drawing primitives |
| `render.py` | Frame dispatch, motion blur on camera moves and hits (`BLUR`), parallel encode |
| `score.py` | Original synthesised 120 BPM score, sectioned to the story (`section()`): tension, the stall's silence, scatter, the held breath and slam, a major groove building in layers, the drop and the logo chord |
| `audio.py` | Sound cues synced to the picture (`CUES`): send, snaps, slam, docks, Pulse, ticks, the hours stacking, each bar parking, the logo |
| `master.py` | Gain plus look-ahead peak limiter (ceiling -2 dBFS) before AAC encoding |
| `build.sh` | Render, score, mix, measure loudness, master, mux with fast-start |

## Tuning

All timings are absolute seconds. If you move a moment, move its sound in `audio.py` (`CUES`), its
motion-blur window in `render.py` (`BLUR`), and keep `kick_on()` in `timeline.py` and `score.py` the same.
