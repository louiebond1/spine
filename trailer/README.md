# Spine launch film: "Holds it together" (final cut, polished)

Deterministic Python/Pillow/NumPy renderer for `Spine_Give_AI_a_Spine_Polished.mp4`
(1920x1080, 30 fps, 54.1 s, H.264 High yuv420p BT.709, AAC 320k 48 kHz stereo, fast-start,
about -15 LUFS, peak below -1 dBFS).

## The idea

One continuous world, seen through one camera. Three problems are shown, not told; then the same
three objects return, in the same order, in a resolved state; and the three resolved bars lift out of
the world to become the Spine logo.

1. **Questions go unanswered.** The film opens on the question itself, already moving: Ben Carter's
   "Has anyone automated contract reviews before?" rides its route with the camera alongside. Two
   seconds in, the route ahead snaps, it brakes to a stop and the music cuts out for a beat. It is left
   stranded while traffic below keeps moving; its age ticks on: 2 hours, 1 day, 3 days.
2. **Ideas lose momentum.** The camera drops to the six-stage track. Contract Clause Checker glides from
   Idea to Building; the route ahead snaps and it stalls in silence: "No activity for 12 days".
3. **Impact goes unseen.** The Hours saved card, large and empty ("No data yet"), with activity drifting
   past it. The camera pulls back to show it among everything else; a line reaches for it and snaps.
4. **"Your AI needs a spine."** A spine draws down the frame and every loose piece slams into line on it.
   It steps aside, and "Spine is your AI project manager." holds for over two seconds.
5. **The same three objects, resolved.**
   * Mia Thompson claims Ben's question and answers: "Yes, I'm building one: Contract Clause Checker".
     The project's name lifts out of her reply and carries the camera down to the stalled project,
     where it becomes the project's label. The Help Desk answer leads straight into the project.
   * Pulse's heartbeat beats on the stalled project; the team arrives and docks with it; every step
     has an owner and they tick off; it moves on to Publishing.
   * Once the project is moving, its track line keeps going: the camera follows it to the right until
     it arrives under the same Hours saved card and becomes the chart's baseline. The drifting activity
     then stacks up on that line as the hours saved (one piece per two hours: 6, 16, 30, 42), and a
     large "42 hours saved in October" lands on its own beat.
6. **The payoff.** The chart closes into one bar and the camera pulls back to the same wide view as
   "Impact goes unseen", now joined up: the answered question, the moving project and the hours, linked
   where before the line snapped. Those three bars lift out of the world and lock into the Spine mark,
   one per beat, each briefly naming what it was (Questions, Ideas, Impact). Light passes along it.
   "Spine" / "Give your company's AI a spine."

No website URL appears: none is recorded anywhere in the project, so none is shown.

Product content follows the brief and seed data in `CLAUDE.md`: Mia Thompson is a Champion and owns
Contract Clause Checker (Legal, Building, 3 of 7 steps, 12 days without activity); hours saved per
month are the seeded totals. Ben's question, Mia's reply, the project's team and its four remaining
steps are written for the film to fit the brief (a Champion claims a question and replies in a private
thread; plans have steps with owners and dates).

| Time | Beat |
| --- | --- |
| 0 - 6 s | Questions go unanswered (the film opens on the moving question) |
| 6 - 11.9 s | Ideas lose momentum |
| 11.9 - 17.6 s | Impact goes unseen |
| 17.6 - 23.9 s | "Your AI needs a spine." The spine. "Spine is your AI project manager." |
| 23.9 - 30.2 s | "Every question finds someone who knows." The answer names the project |
| 30.2 - 39.3 s | "Spine notices when work goes quiet." / "And nudges the right people." / "Every step has an owner." |
| 39.3 - 45 s | The track carries on into the chart: "Impact everyone can see." |
| 45 - 54.1 s | The connected wide view; the three bars become the logo; "Give your company's AI a spine." |

Timings in the code are in story time; the film is cut to open 3.4 s in (`SHIFT` in `timeline.py`,
`FILM_START` in `audio.py`), so film time = story time - 3.4.

## Reproduce

Requirements: Python 3.10+, `numpy`, `Pillow`, FFmpeg with libx264, and the Inter family including
`InterDisplay-Light.otf` (default folder `/usr/share/fonts/opentype/inter`, or set `SPINE_FONT_DIR`).

```bash
pip install numpy pillow
./build.sh                                  # out/Spine_Give_AI_a_Spine_Polished.mp4, about 30 minutes on 4 cores
python3 render.py stills 0.9 21.4 46.5      # PNG stills in out/stills (film time)
```

## Files

| File | Purpose |
| --- | --- |
| `timeline.py` | The whole film: `CAM` (the camera's path through the world), the question and answer, `draw_name_bridge` (the project name travelling from the answer to the project), the track and project, the activity pieces (`piece_state`: wander, spine, chart), `SNAPS`, `draw_connections` and `draw_logo` (the three bars becoming the logo), `IMPACTS`, and `render_scene` |
| `engine.py` | Shared drawing primitives |
| `render.py` | Frame dispatch, motion blur on camera moves and hits (`BLUR`), parallel encode |
| `score.py` | Original synthesised 120 BPM score, sectioned to the story (`section()`): tension, the stall's silence, scatter, the held breath and slam, a major groove building in layers, the drop and the logo chord |
| `audio.py` | Sound cues synced to the picture (`CUES`): send, snaps, slam, docks, the name landing, Pulse, ticks, the hours stacking, the join-up, the logo |
| `master.py` | Gain plus look-ahead peak limiter (ceiling -2 dBFS) before AAC encoding |
| `build.sh` | Render, score, mix, measure loudness, master, mux with fast-start |

## Tuning

All timings are absolute seconds. If you move a moment, move its sound in `audio.py` (`CUES`), its
motion-blur window in `render.py` (`BLUR`), and keep `kick_on()` in `timeline.py` and `score.py` the same.
