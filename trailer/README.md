# Spine launch film: "Holds it together" (clarity cut)

Deterministic Python/Pillow/NumPy renderer for `Spine_Give_AI_a_Spine_Polished.mp4`
(1920x1080, 30 fps, 54.2 s, H.264 High yuv420p BT.709, AAC 320k 48 kHz stereo, fast-start,
about -15 LUFS, true peak below -1 dBFS).

## The idea

One continuous world, seen through one camera. Every beat has a starting state, an action and a
result you can see, large enough to follow on a phone with the sound off. Three problems are shown,
the same three objects are resolved in the same order, and those three objects become the logo.

1. **Questions go unanswered.** The film opens on Ben Carter's "Has anyone automated contract reviews
   before?", already travelling. The route ahead snaps, it stops dead, the music cuts out, and it is
   left stranded as its age ticks on.
2. **Ideas lose momentum.** Contract Clause Checker starts as a lone idea on its six-stage track. At
   Recruiting three people fly in and join it (a team forms). At Building the track ahead snaps, the
   team drifts away from it and "12 days inactive" appears.
3. **Impact goes unseen.** The Hours saved card, large and empty ("No data yet"). Activity drifts past
   it; the one line that reaches for it snaps.
4. **"Your AI needs a spine."** Every loose piece slams into line on a spine, which steps aside for
   "Spine is your AI project manager."
5. **Questions answered.** The question is shown to the Champions (Jamie, Sarah, Mia). Mia's line
   lights, the others fade; she travels to the question and claims it, and her reply comes from her:
   "Yes, I'm building one: Contract Clause Checker". The project's name lifts out and carries the
   camera down to the project.
6. **Work moving again (Pulse).** A heartbeat runs along the project's own track and stops on it:
   flagged. Lines reach the three people who drifted away; they are pinged and come back. The camera
   pushes in on the next steps; each person takes one (pinned to it); the project moves through them,
   each ticking as it passes, to Publishing: "Moving again". People do the work; Spine flags it.
7. **Impact visible.** The track carries on to the right, the camera follows, and it becomes the Hours
   saved card's baseline. The hours teams log stack up on it month by month, the big number stepping
   6, 16, 30, 42 as each month fills: "42 hours saved in October". "Illustrative data" sits in the corner.
8. **The end.** "Knowledge becomes action." The answered question, shown large, condenses into a bar
   that takes its place as the top of the Spine mark; then the moving project; then "Action becomes
   impact." and the 42. Each bar names what it was (Questions, Ideas, Impact), the mark locks, and
   "Spine" / "Give your company's AI a spine."

Product content follows the brief and seed data in `CLAUDE.md`: Champions claim questions and reply in a
private thread; projects recruit until full, then build; Pulse flags builds that go quiet; teams log
hours saved per month; Mia Thompson is a Champion and owns Contract Clause Checker (Legal, Building,
12 days without activity); the monthly hours are the seeded totals. Ben's question, Mia's reply, the
project's team and its remaining steps are written for the film to fit the brief.

| Film time | Beat |
| --- | --- |
| 0 - 6 s | Questions go unanswered |
| 6 - 11.9 s | Ideas lose momentum (the team joins, then drifts away) |
| 11.9 - 17.6 s | Impact goes unseen |
| 17.6 - 23.9 s | "Your AI needs a spine." / "Spine is your AI project manager." |
| 23.9 - 30.2 s | "Every question finds someone who knows." |
| 30.2 - 37.4 s | "Pulse spots work going quiet." / "And nudges the right people." / "Work starts moving again." |
| 37.4 - 44.1 s | The track becomes the chart: "Impact everyone can see." |
| 44.1 - 54.2 s | "Knowledge becomes action." / "Action becomes impact." / the logo |

Timings in the code are story time; the film opens 3.4 s in (`SHIFT` in `timeline.py`, `FILM_START` in
`audio.py`), so film time = story time - 3.4.

## Reproduce

Requirements: Python 3.10+, `numpy`, `Pillow`, FFmpeg with libx264, and the Inter family including
`InterDisplay-Light.otf` (default folder `/usr/share/fonts/opentype/inter`, or set `SPINE_FONT_DIR`).

```bash
pip install numpy pillow
./build.sh                                  # out/Spine_Give_AI_a_Spine_Polished.mp4, about 30 minutes on 4 cores
python3 render.py stills 7.6 35.8 45.6      # PNG stills in out/stills (film time)
```

## Files

| File | Purpose |
| --- | --- |
| `timeline.py` | The whole film: `CAM` (the camera's path through the world), the question, `draw_champions`, `draw_name_bridge`, the track, project and team (`team_pos`), `draw_pulse`, the activity pieces (`piece_state`: wander, spine, hours), `SNAPS`, `draw_end` (the three objects condensing into the mark), `IMPACTS`, and `render_scene` |
| `engine.py` | Shared drawing primitives |
| `render.py` | Frame dispatch, motion blur on camera moves and hits (`BLUR`), parallel encode |
| `score.py` | Original synthesised 120 BPM score, sectioned to the story (`section()`): tension, the stall's silence, scatter, the held breath and slam, a major groove building in layers, the drop and the logo chord |
| `audio.py` | Sound cues synced to the picture (`CUES`): send, snaps, slam, docks, the name landing, Pulse, ticks, the hours stacking, the join-up, the logo |
| `master.py` | Gain plus look-ahead peak limiter (ceiling -2.8 dBFS in build.sh) before AAC encoding |
| `build.sh` | Render, score, mix, measure loudness, master, mux with fast-start |

## Tuning

All timings are absolute seconds. If you move a moment, move its sound in `audio.py` (`CUES`), its
motion-blur window in `render.py` (`BLUR`), and keep `kick_on()` in `timeline.py` and `score.py` the same.
