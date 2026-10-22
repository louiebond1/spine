# Spine launch film: "Holds it together" (V6)

Deterministic Python/Pillow/NumPy renderer for `Spine_Give_AI_a_Spine_Polished.mp4`
(1920x1080, 30 fps, 64.2 s, H.264 High yuv420p BT.709, AAC 320k 48 kHz stereo, fast-start,
about -15 LUFS, true peak below -1 dBFS).

## The idea

One continuous world, one camera. Every beat shows a start, an action and a result, large enough to
follow on a phone with the sound off. The important moments are big: one large card, large people,
large buttons, one headline at a time.

1. **Questions go unanswered.** Ben Carter's "Has anyone automated contract reviews before?" travels;
   the route ahead snaps and it is stranded.
2. **Ideas lose momentum.** Contract Clause Checker reaches Recruiting and waits: Mia, two large empty
   seats, "1 of 3 people", Join project, "Next: Recruit 2 more people to begin". People walk past; the
   one line reaching out to them snaps.
3. **Impact goes unseen.** The Hours saved card, large and empty: "No data yet".
4. **"Your AI needs a spine."** Every loose piece lines up on a spine. "Spine is your AI project manager."
5. **Help Desk.** The question is shown to the Champions; Mia claims it. Her answer reveals work already
   happening: "Yes, I'm starting one: Contract Clause Checker".
6. **Propose, review, approve.** The name lifts out of her answer and lands as the newest idea in the
   Ideas & Projects list, beside five of the company's projects. The list holds, then hers grows into one card,
   whose stage dots then advance: Idea (Problem and Who benefits fill in, Continue to AI review), the AI
   review (four criteria, advisory, only Mia sees the scores, Submit for approval), Approval (Alex Morgan,
   an admin, presses Approve), Recruiting. The AI review is advisory and never approves anything.
7. **Join.** Ben arrives, presses Join project and takes a seat; a line links him to Mia. Then Priya.
   "2 of 3", "3 of 3 people": "Teams form around good ideas."
8. **Plan.** The team is full, so it moves to Building. The plan is generated from the project brief and
   each person moves from their seat to their own step: "AI drafts the plan. The team owns it."
9. **Pulse, in five states.** Stalled: the card greys and "No activity for 12 days" counts up. Detected:
   Pulse's heartbeat runs along it and flags it, "Pulse · Build going quiet". Notified: the daily digest
   arrives in Slack, "The team gets a nudge." Action: Mia presses Open and it takes her back to her step.
   Progress: Mia, Ben and Priya tick their steps, "Moving again", Publishing, Live.
10. **Impact.** "Live · 8 hours saved this month". "+8 hours" lifts off the project and travels to the
   company-wide chart, where the months stack up and the project's hours complete October: 42. The total
   shown is only ever a whole month (6, 16, 30, then 42); October is never shown without them.
   "Illustrative data".
11. **The end.** The opening's three problems come back, stacked. Each turns into its fix ("Questions
   get answered." / "Ideas keep moving." / "Impact is seen.") and gains a blue bar; the three bars gather
   into the Spine mark, named Questions, Ideas, Impact. "Give your company's AI a spine."

What is shown follows the product brief in `CLAUDE.md`: Champions claim questions and reply in a private
thread; anyone can browse Ideas & Projects and press Join project while a project is recruiting (the
brief has no expression-of-interest or owner-accepts step, so none is shown); a full team moves the
project to Building and Claude drafts a plan with each step assigned to a team member; the next-action
sentences are the product's own; Pulse flags builds with no activity, and the daily digest goes to Slack
(the brief names Slack only, so Microsoft Teams is not shown); Live projects log hours saved per month.
Ben's question, Mia's answer, the team, the plan steps and the 8 hours are written for the film; the
monthly totals are the seeded ones, and the chart is marked as illustrative. There is no website URL in
the project, so none is shown.

| Film time | Beat |
| --- | --- |
| 0 - 6 s | Questions go unanswered |
| 6 - 11.9 s | Ideas lose momentum: an idea waiting for people |
| 11.9 - 17.6 s | Impact goes unseen |
| 17.6 - 23.9 s | "Your AI needs a spine." / "Spine is your AI project manager." |
| 23.9 - 29.2 s | Help Desk: "Every question finds someone who knows." |
| 29.2 - 32.9 s | The ideas list: Mia's lands as the newest idea, then grows into its own card |
| 32.9 - 36.5 s | Propose, AI review, leadership approval, on one card |
| 36.5 - 40.1 s | Join: the team forms |
| 40.1 - 43.1 s | Plan: a step for each person |
| 43.1 - 51.1 s | Pulse: stalled, detected, notified, action, progress |
| 51.1 - 55.3 s | Impact: 8 hours travel to the chart; 42 in October |
| 55.3 - 64.2 s | The three problems turn into their fixes; their bars become the logo |

Timings in the code are story time; the film opens 3.4 s in (`SHIFT` in `timeline.py`, `FILM_START` in
`audio.py`), so film time = story time - 3.4.

## Reproduce

Requirements: Python 3.10+, `numpy`, `Pillow`, FFmpeg with libx264, and the Inter family including
`InterDisplay-Light.otf` (default folder `/usr/share/fonts/opentype/inter`, or set `SPINE_FONT_DIR`).

```bash
pip install numpy pillow
./build.sh                                  # out/Spine_Give_AI_a_Spine_Polished.mp4, about 30 minutes on 4 cores
python3 render.py stills 8.0 34.5 42.5      # PNG stills in out/stills (film time)
```

## Files

| File | Purpose |
| --- | --- |
| `timeline.py` | The whole film: `CAM` (the camera's path through the world), the question, `draw_champions`, `card_project` (Contract Clause Checker in every state), `draw_grid`, `draw_seats`, `draw_joiners`, `draw_stall`, `draw_pulse`, `draw_slack`, `draw_chip`, the activity pieces (`piece_state`: wander, spine, hours), `SNAPS`, `draw_end` (the recap line and the mark), `IMPACTS`, and `render_scene` |
| `engine.py` | Shared drawing primitives |
| `render.py` | Frame dispatch, motion blur on camera moves and hits (`BLUR`), parallel encode |
| `score.py` | Original synthesised 120 BPM score, sectioned to the story (`section()`): tension, the stall's silence, scatter, the held breath and slam, a major groove building in layers, the drop and the logo chord |
| `audio.py` | Sound cues synced to the picture (`CUES`): send, snaps, slam, docks, the name landing, Pulse, ticks, the hours stacking, the join-up, the logo |
| `master.py` | Gain plus look-ahead peak limiter (ceiling -2.8 dBFS in build.sh) before AAC encoding |
| `build.sh` | Render, score, mix, measure loudness, master, mux with fast-start |

## Tuning

All timings are absolute seconds. If you move a moment, move its sound in `audio.py` (`CUES`), its
motion-blur window in `render.py` (`BLUR`), and keep `kick_on()` in `timeline.py` and `score.py` the same.
