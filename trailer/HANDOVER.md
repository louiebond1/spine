# Active delivery: Collaboration rework, a focused revision of V16

The active source is based on current V17 commit `4dd6b8eef2b1ac016c8b7f786f87c938fe95d501`, descended from the requested V16 commit `b0f4003e8af6d13099554d0ac95f0f08c7b35602`, not the historical V6 cut described below. Read `REWORK_NOTES.md` for the current sequence, exact timings, build instructions and review limits.

Latest correction: the full Help Desk question fits inside its card; recruiting is shown from Mia’s view with Requested to join, her Accept action, then Joined; the final rail recap is replaced by one three-surface structure folding into six logo pieces. The joining change follows Louie’s explicit 22 October correction and supersedes the older direct-joining rule below. Runtime remains 63.7 seconds. See REWORK_NOTES.md for current timings and evidence limits. Historical notes below describe earlier versions, not the current joining treatment.

The rendered delivery is `Spine_Collaboration_Rework_V2.mp4`, supplied separately with this edit. The historical `release/Spine_Launch_Film.mp4` binary is not regenerated in this source commit. Do not assume it represents the active timeline.

## Previous production handover

# Spine launch trailer: handover

This file is for whoever picks up the trailer next. It covers what exists, how to build it, how the code is organised, the rules the owner has set, and what has been tried. Read the whole file before changing anything.

## Where things are

- Repository: `louiebond1/spine`
- Branch: `claude/spine-trailer-polish-4rpg9z`. This work is **not on `main`**.
- Latest cut: `trailer/release/Spine_Launch_Film.mp4`
  - 1920x1080, 30 fps, 59.7 s
  - H.264 and AAC 320k
  - -15.6 LUFS, true peak -1.8 dBFS
- Source: everything else in `trailer/`
- Product brief: `CLAUDE.md` at the repo root. This is the source of truth for what Spine does.
- App mockups: the 13 PNGs in `design/`.
- Each version is a separate commit on the branch, so `git log -- trailer/` gives the history.

## What the film is

A synthesised, code-rendered motion graphic. There is no footage, no stock and no voiceover. Python with Pillow and NumPy draws every frame. FFmpeg encodes. The music and sound effects are synthesised in Python too.

The visual identity is a dark background with electric blue. The look is one continuous world seen through one moving camera, with no slides. Each beat shows a starting state, an action and a result.

### Structure (film seconds)

| Film time | Beat | On screen |
| --- | --- | --- |
| 0 to 6 | Questions go unanswered | Ben Carter's "Has anyone automated contract reviews before?" travels; the route ahead snaps and it is stranded; "Asked 2 hours ago" ages to "3 days ago" |
| 6 to 11.9 | Ideas lose momentum | Large card "Contract Clause Checker", Recruiting, Mia plus 2 empty seats, "1 of 3 people", Join project, "Next: Recruit 2 more people to begin". People walk past; a line reaching to them snaps |
| 11.9 to 17.6 | Impact goes unseen | Empty "Hours saved" chart, "No data yet"; a line reaching it snaps |
| 17.6 to 23.9 | The turn | "Your AI needs a spine." Every loose piece slams into line on a spine. "Spine is your AI project manager." |
| 23.9 to 29.2 | Help Desk | "Every question finds someone who knows." The question is shown to Jamie Chen, Sarah Kim and Mia Thompson; Mia claims it and replies "Yes, I'm starting one: Contract Clause Checker" |
| 29.2 to 31.0 | Propose | The project name lifts out of the reply and becomes the title of one large card, at stage Idea. Problem and Who benefits fill in; Mia presses "Continue to AI review"; "Anyone can propose an idea." |
| 31.0 to 31.9 | AI review | On the same card: Feasibility, Business value, Resourcing confidence, Originality light up as the review reads them; "Advisory. Only Mia sees the scores."; Mia presses "Submit for approval"; "AI reviews the idea." No scores are shown |
| 31.9 to 33.0 | Approval | The card's stage dot moves to Approval; "Next: Waiting for leadership approval"; Alex Morgan (an admin) arrives and presses Approve; a check and "Approved by Alex Morgan"; "Leadership approves it." The AI never approves |
| 33.0 to 35.6 | Join | The dot moves to Recruiting; Ben, then Priya, each press the card's own "Join project" button and drop into an empty seat; each seat links to the last; 3 of 3; the dot moves to Building; "Teams form around good ideas." |
| 35.6 to 38.6 | Plan | Building. Each person moves from their seat to their own plan step; "AI drafts the plan. The team owns it."; "Generated from project brief" |
| 38.6 to 46.6 | Pulse, in five states | **Stalled**: "No activity for N days" counts to 12. **Detected**: heartbeat, then "Pulse · Build going quiet". **Notified**: Slack digest card, "The team gets a nudge." **Action**: Mia presses Open. **Progress**: steps tick, "Moving again", Publishing, Live |
| 46.6 to 50.8 | Impact | "Live · 8 hours saved this month"; "+8 hours" travels to the company chart; months stack 6, 16, 30, then 42 in October; "Impact everyone can see."; "Illustrative data" |
| 50.8 to 59.7 | Ending | "Knowledge becomes action." / "Action becomes impact." One line runs through the answered question, the Live project and the 42; they condense into the 3 bars of the Spine logo, labelled Questions, Ideas, Impact; wordmark "Spine"; "Give your company's AI a spine." |

## Rules from the owner

The owner has given these across many rounds of feedback. Keep to them.

**Working rules**

- **Never guess.** If you don't know something, say so.
- **Be honest about reviewing.** You cannot watch the video in real time or hear the audio. Say what you actually checked: frames, measurements.
- **Product truth only.** Show nothing Spine doesn't do according to `CLAUDE.md`. In particular:
  - **Joining is direct.** Anyone presses "Join project" while a project is Recruiting, until it is full. There is **no** request/expression-of-interest step and **no** owner-accepts step. The owner asked for one, but the brief doesn't have it, so it was left out.
  - **The digest goes to Slack only.** The brief doesn't mention Microsoft Teams, so don't show it.
  - **Next-action sentences** come from the brief, e.g. "Next: Recruit 2 more people to begin" and "Next: Mia is testing real contracts".
  - **Pulse** flags builds that go quiet (stalledBuildDays, 10 days) and unclaimed questions.
- **No website URL and no "Book a demo".** There is no URL anywhere in the project.

**Copy and type**

- **Don't call people "Champions" on screen.** The current line is "Every question finds someone who knows."
- **No em dashes** anywhere.
- **Large headlines only.** No small unreadable text, except where it is clearly mock UI. Everything important must read on a phone (check at 390px wide).
- **Label made-up numbers.** The chart shows "Illustrative data".

**Story and numbers**

- **The impact figure is 42 hours in October.** Never show 34 (October before the project's 8 hours land).
- **The three problems come first, in a fixed order:** Questions go unanswered, then Ideas lose momentum, then Impact goes unseen. Then the Spine turn, then the solutions in the same order, then the logo.
- **The owner's taste:** premium, persuasive, clever but simple. The owner liked the "six pieces" snap style, didn't like a "pit / back together" effect, and wants the important moments bigger rather than the film busier.

## Build

Requirements:

- Python 3.10+ with `numpy` and `pillow`
- FFmpeg with libx264
- Inter fonts, including `InterDisplay-Light.otf`, `InterDisplay-Regular.otf`, `InterDisplay-SemiBold.otf`, `Inter-Regular.otf`, `Inter-Medium.otf` and `Inter-SemiBold.otf`. They are read from `/usr/share/fonts/opentype/inter`, or set `SPINE_FONT_DIR`.

```bash
cd trailer
./build.sh                                # full render + score + mix + master + mux, ~30 min on 4 cores
python3 render.py stills 8.0 34.5 42.5    # PNG stills (FILM seconds) into out/stills
./remux.sh                                # after changing only audio.py: re-mix and re-mux, no re-render
```

Output goes to `trailer/out/Spine_Give_AI_a_Spine_Polished.mp4`. Copy it to `trailer/release/Spine_Launch_Film.mp4` when it is approved.

`render.py` has unused code that loads plates from `assets/plates/`. It never runs, because `END_PLATE` is past the last frame, so that folder is not needed.

## How the code works

### Time

All times in the code are **story time**. Film time = story time minus 3.4: `SHIFT` in `timeline.py` and `FILM_START` in `audio.py`. Stills are requested in film time.

### Files

| File | Purpose |
| --- | --- |
| `timeline.py` | The whole picture. `render_scene(t_film)` draws one frame. Everything is a pure function of time, so renders are deterministic |
| `engine.py` | Drawing primitives: anti-aliased bars, dots, text masks, easing functions, `prog(t, a, b, ease)` |
| `render.py` | Frame dispatch, motion blur windows (`BLUR`, story time), parallel encode to H.264 |
| `score.py` | Synthesised 120 BPM score. `section(t)` names the musical section; `kick_on(t)` says where the kick drum plays |
| `audio.py` | Sound effects (`CUES`: time, kind, dB, pan) mixed over the score, then trimmed by `FILM_START` |
| `master.py` | Gain and look-ahead limiter (ceiling -2.8 dBFS) before AAC |
| `build.sh` / `remux.sh` | Full build / audio-only rebuild |

### Inside `timeline.py`

**Camera and drawing helpers**

- `CAM` is the camera path: `(time, (centre x, centre y, zoom))` in world pixels.
- `ws`/`sw` convert world to screen and back.
- `wbar`, `wtext`, `wcard` and `wavatar` draw in world space.

**Cards**

- `Pen` draws a card at 2x supersampling into RGBA.
- `place` composites it onto the frame.
- Pen methods skip fully transparent ink on purpose. PIL writes zero-alpha ink as-is, which punches holes in the card.

**The story's objects**

| Function | Draws |
| --- | --- |
| `card_question` / `card_reply` / `draw_champions` | The Help Desk beat |
| `card_project(t)` | Contract Clause Checker in every state, driven by `STAGE_TIMES`, `SEATS`, `PLAN` and `LOGGED` |
| `draw_grid`, `draw_name_bridge` | The discovery grid and the name that flies into it |
| `draw_seats`, `draw_joiners` | Recruiting |
| `draw_stall`, `draw_pulse`, `card_slack`/`draw_slack` | The Pulse states |
| `piece_state` | 60 drifting field pieces plus 6 snap debris pieces. They wander, line up on the spine at 22.5, then 47 of them become chart units (one per 2 hours: 6, 16, 30, 42) |
| `draw_chart`, `hours_shown`, `draw_chip` | The impact chart |
| `draw_end` | The ending rail and the logo assembly. `LOGO` holds the exact bar positions of the approved logo |

**Hits and headlines**

- `IMPACTS` lists the shake/punch hits; `post()` applies them.
- Headlines are set in `render_scene` with `headline(c, t, text, t_in, t_out)`.

### Moving a moment

When you move a moment, also move:

- its sound in `audio.py` `CUES`;
- its blur window in `render.py` `BLUR`;
- `kick_on()` if needed, which must be identical in `timeline.py` and `score.py`.

## Verification routine used so far

1. **Spot-check stills** at key film times after every code change.
2. **Dense review:** extract one frame every 0.5 s from the final MP4 and lay them out on contact sheets. Look for empty frames, overlaps, text clipped at the edges, and stale numbers.
3. **Phone check:** the same frames scaled to 390px wide. Headlines, names, counts and buttons must be legible.
4. **Audio:**
   - Integrated loudness should be about -15 LUFS. True peak must be at or below -1 dBFS.
   - Measure with `ffmpeg -i film.mp4 -af ebur128=peak=true -f null -`.
   - AAC can overshoot on sharp clicks, especially within about 0.1 s of a kick. When it does, lower or soften that cue and run `./remux.sh`.
5. **Reproducibility:** a fresh copy of the source must render identical stills and an identical score.

## History

| Version | What changed |
| --- | --- |
| V1, V2 | Logo-led concept; the owner liked it and asked for it to be "more clever" |
| V3 | "Journey" structure: problems highlighted, snap into six pieces, less text, no small fonts |
| V4 | Focus on product clarity: collaboration, Help Desk, Pulse cause and effect, impact attribution |
| V5 | Product accuracy pass: direct joining, Slack only, Champions claim, real next-action copy |
| V6 (current) | V4's visual simplicity combined with V5's accuracy: big recruitment, five-state Pulse, the answer opening into the project, 42 only, large-element ending |

## Open points and ideas not yet done

- The owner has not yet given feedback on V6.
- Possible next steps, if asked:
  - more energy in the score;
  - a voiceover (`audio.py` already supports `assets/vo/voiceover.wav` with ducking, but none has been recorded);
  - a vertical 9:16 cut for social.

