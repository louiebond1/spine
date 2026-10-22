# Collaboration rework: focused revision of the V16 idea-to-team sequence

Requested base: V16 `b0f4003e8af6d13099554d0ac95f0f08c7b35602`. Current integration base: V17 `4dd6b8eef2b1ac016c8b7f786f87c938fe95d501` on `louiebond1/spine`, `claude/spine-trailer-polish-4rpg9z`.

## What changed

The name still lifts out of Mia's answer. It lands on one large proposal surface rather than shrinking into a list of already-recruiting projects. The same surface turns to reveal the four advisory AI criteria, then leadership's decision. Alex's explicit Approve idea action produces the only approval tick. Recruiting then opens two places. Ben and Priya each choose Join project directly; their names latch into the structure and the count becomes 3 of 3. Each named team row becomes an assigned plan step: its outline contracts into a checkbox while the person moves to the owner position. The same title and project frame stay in view.

There is no member-approval action, request-to-join workflow, automatic matching or AI approval claim. The proposal, advisory review, leadership approval, direct joining and generated plan follow CLAUDE.md on the specified branch. The actual join action was also checked in `spine-2/src/server/projects/actions.ts`.

Upstream received a concurrent V17 while this edit was rendering. Its updated source and prose were incorporated; the replacement now ends at source story second 40.0, where the owned plan is fully formed. The original branch then advanced to a parallel V18 during final encoding. This variant is stored on `codex/spine-collaboration-rework` to preserve that ongoing work. It is based on V17 commit 4dd6b8e and does not claim to include the parallel V18 changes. The existing release binary is preserved.

## Timing

The film is 63.7 seconds, four seconds longer than V16. Times below are player seconds, not story time:

| Event | Player time |
| --- | --- |
| Replacement starts, title lifts | 29.20 |
| Title lands in proposal | 30.20 |
| Advisory AI review | 31.50 |
| Leadership approval face | 33.10 |
| Alex presses Approve idea | 34.15 |
| Approved state | 34.35 |
| Recruiting opens | 34.90 |
| Ben presses Join project | 35.85 |
| Ben joins | 36.25 |
| Priya presses Join project | 37.45 |
| Priya joins | 37.85 |
| Team complete | 38.20 |
| Team-to-plan reveal | 38.85 to 40.60 |
| Unchanged source picture resumes | 40.60 |

`sequence_timing.py` is the shared clock. `timeline.py` preserves the V16 renderer and replaces only story seconds 32.6 to 40.0, extended to 44.0. Every later frame uses V16 time minus four seconds. `render.py` applies the corresponding source clock to existing shutter windows and new windows to the new actions. `audio.py` retimes unchanged cues through the same mapping and assigns explicit cues to the new actions. `score.py` inserts exactly eight beats from the existing deterministic score. No later section is stretched.

The three-problem opening, stationary question line, ageing, stopped build, empty impact, three-line logo turn, Help Desk, independent stall, Pulse, Slack, human recovery, 42 and final question/idea/impact logo resolution are retained.

## Build

Requires Python 3.10+, Pillow, NumPy and FFmpeg with libx264. If using the supplied source ZIP:

```bash
export SPINE_FONT_DIR="$PWD/assets/fonts"
WORKERS=6 bash build.sh
```

The existing build writes `out/Spine_Give_AI_a_Spine_Polished.mp4`. The delivered copy is named `Spine_Collaboration_Rework.mp4`.

## Integration and validation

The current-source preservation check compared seven frames outside the replacement with commit 4dd6b8e, with zero float-pixel delta at every sample. The initial V16 comparison likewise passed eight samples. These are source-render comparisons with the bundled fonts, not a claim of bit-identical encoded MP4s.

The final delivery reuses the unchanged full render and replaces the complete revised sequence with newly rendered frames before a high-quality H.264 delivery encode. The editable source rebuilds the complete current cut directly.

## Review scope and limits

V16 preservation was checked against the pinned original timeline at eight sample times outside the replacement, including post-shift Pulse, impact and ending frames. Maximum float-pixel delta was zero at every checked sample. Key action labels were checked for width and mobile-size frames were inspected. Rendered sequences, complete decode, frame count and measured audio levels are checked before delivery. Real-time audiovisual perception is not available here, so normal-speed viewing and subjective listening are not claimed. The UI abstractions and business data remain illustrative as in V16; they are not fresh product screen recordings.
