# Spine launch film: "Holds it together" (product cut)

Deterministic Python/Pillow/NumPy renderer for `Spine_Give_AI_a_Spine_Polished.mp4`
(1920x1080, 30 fps, 56.7 s, H.264 High yuv420p BT.709, AAC 320k 48 kHz stereo, fast-start,
about -15 LUFS, true peak below -1 dBFS).

## The idea

One continuous world, one camera. Every beat shows a start, an action and a result, large enough to
follow on a phone with the sound off. The film is about what makes Spine different: people get answers,
discover ideas and projects, join teams, keep work moving, and see the impact.

1. **Questions go unanswered.** Ben Carter's "Has anyone automated contract reviews before?" travels;
   the route ahead snaps and it is stranded.
2. **Ideas lose momentum.** Contract Clause Checker reaches Recruiting and waits: Mia alone, two empty
   seats, "Next: Recruit 2 more people to begin". People walk past without seeing it (Ben and Priya
   among them); the one line reaching out to them snaps.
3. **Impact goes unseen.** The Hours saved card, large and empty: "No data yet".
4. **"Your AI needs a spine."** Every loose piece lines up on a spine. "Spine is your AI project manager."
5. **Help Desk.** The question is shown to the Champions; Mia takes it and claims it. Her answer reveals
   work already happening: "Yes, I'm starting one: Contract Clause Checker". The name lifts out.
6. **Ideas & Projects.** It lands on the Ideas & Projects board, among the company's other ideas and
   projects: "Anyone can discover work worth joining." The card grows into view. Ben presses Join
   project and takes a seat; then Priya. "Teams form around good ideas." The team is full, so it moves
   to Building and the plan appears, generated from the project brief, a step for each of them:
   "Next: Mia is testing real contracts".
7. **Pulse.** It goes quiet: "12 days inactive". Pulse flags it, and the daily digest lands in Slack
   ("Build going quiet: Contract Clause Checker", Open). Someone opens it; Mia ticks her step, then Ben.
   "Moving again". Progress only moves when a person acts.
8. **Impact.** Priya finishes the last step; it moves to Publishing and goes Live. The team logs
   "8 hours saved this month"; those 8 hours travel to the company-wide chart ("Hours saved across all
   projects"), where the months stack up and the project's hours land on top of October: 34, then 42.
   "Illustrative data".
9. **The end.** One line runs through the answered question, the project and its team, and the 42
   ("Knowledge becomes action." / "Action becomes impact."). The camera pulls back to all three on the
   line, and each condenses into a bar of the Spine mark, named Questions, Ideas, Impact.
   "Give your company's AI a spine."

What is shown follows the product brief in `CLAUDE.md`: Champions claim questions and reply in a private
thread; anyone can browse Ideas & Projects and press Join project while a project is recruiting (there is
no request-and-approve step, so none is shown); a full team moves the project to Building and Claude
drafts a plan with each step assigned to a team member; the next-action sentences are the product's own;
Pulse flags builds with no activity, and the daily digest goes to Slack (the brief names Slack only, so
Microsoft Teams is not shown); Live projects log hours saved per month. Ben's question, Mia's answer, the
team, the plan steps and the 8 hours are written for the film; the monthly totals are the seeded ones,
and the chart is marked as illustrative.

| Film time | Beat |
| --- | --- |
| 0 - 6 s | Questions go unanswered |
| 6 - 11.9 s | Ideas lose momentum: an idea waiting for people |
| 11.9 - 17.6 s | Impact goes unseen |
| 17.6 - 23.9 s | "Your AI needs a spine." / "Spine is your AI project manager." |
| 23.9 - 30.2 s | Help Desk: "Every question finds someone who knows." |
| 30.2 - 37.6 s | Ideas & Projects: discover, join, plan |
| 37.6 - 42.4 s | Pulse: quiet, flagged, in Slack, picked back up |
| 42.4 - 47.8 s | Impact: Live, 8 hours logged, 42 across all projects |
| 47.8 - 56.7 s | The recap line and the logo |

Timings in the code are story time; the film opens 3.4 s in (`SHIFT` in `timeline.py`, `FILM_START` in
`audio.py`), so film time = story time - 3.4.

## Reproduce

Requirements: Python 3.10+, `numpy`, `Pillow`, FFmpeg with libx264, and the Inter family including
`InterDisplay-Light.otf` (default folder `/usr/share/fonts/opentype/inter`, or set `SPINE_FONT_DIR`).

```bash
pip install numpy pillow
./build.sh                                  # out/Spine_Give_AI_a_Spine_Polished.mp4, about 30 minutes on 4 cores
python3 render.py stills 8.0 33.7 46.2      # PNG stills in out/stills (film time)
```

## Files

| File | Purpose |
| --- | --- |
| `timeline.py` | The whole film: `CAM` (the camera's path through the world), the question, `draw_champions`, `card_project` (Contract Clause Checker in every state), `draw_board`, `draw_joiners`, `draw_pulse`, `draw_slack`, `draw_chip`, the activity pieces (`piece_state`: wander, spine, hours), `SNAPS`, `draw_end` (the recap line and the mark), `IMPACTS`, and `render_scene` |
| `engine.py` | Shared drawing primitives |
| `render.py` | Frame dispatch, motion blur on camera moves and hits (`BLUR`), parallel encode |
| `score.py` | Original synthesised 120 BPM score, sectioned to the story (`section()`): tension, the stall's silence, scatter, the held breath and slam, a major groove building in layers, the drop and the logo chord |
| `audio.py` | Sound cues synced to the picture (`CUES`): send, snaps, slam, docks, the name landing, Pulse, ticks, the hours stacking, the join-up, the logo |
| `master.py` | Gain plus look-ahead peak limiter (ceiling -2.8 dBFS in build.sh) before AAC encoding |
| `build.sh` | Render, score, mix, measure loudness, master, mux with fast-start |

## Tuning

All timings are absolute seconds. If you move a moment, move its sound in `audio.py` (`CUES`), its
motion-blur window in `render.py` (`BLUR`), and keep `kick_on()` in `timeline.py` and `score.py` the same.
