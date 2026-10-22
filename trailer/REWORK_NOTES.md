# Collaboration rework: focused revision of the V16 idea-to-team sequence

Requested base: V16 `b0f4003e8af6d13099554d0ac95f0f08c7b35602`. Current integration base: V17 `4dd6b8eef2b1ac016c8b7f786f87c938fe95d501` on `louiebond1/spine`, `claude/spine-trailer-polish-4rpg9z`.

## Latest revision: three requested changes

1. The full Help Desk question now fits inside its card with 40 px padding on both sides. A measured font fit preserves the final word and question mark.
2. Recruiting is explicitly Mia's view. Ben and Priya arrive as **Requested to join**. Mia presses **Accept**, then each person becomes Joined and the count increases. The visible pointer, button state and sound follow the acceptance. This follows Louie's explicit correction of 22 October 2026 and supersedes the historical direct-join instruction. It is user-confirmed behaviour, not an independently verified deployed-app change.
3. The closing camera trip through three product cards has been removed. A single typographic structure holds the answer, named team and illustrative 42-hour result. Three surfaces close edge-on, divide at their centre joints and fold as six pieces into the exact Spine mark. The wordmark and final line keep their original timing. The final sound is a softer mechanical landing rather than a cinematic slam.

The proposal, advisory AI review, leadership approval, team-to-plan handover, three-problem opening, Pulse, Slack and human recovery remain as in the previous delivered rework. Earlier source inspection verified advisory review, leadership approval, plan drafting and the Slack-only treatment against the repository brief. Earlier code inspection showed direct joining; the newly requested request/accept treatment is based on the owner's correction rather than that older implementation.

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
| Mia’s recruiting view opens | 34.90 |
| Ben’s request arrives | 35.20 |
| Mia accepts Ben’s request | 35.85 |
| Ben joins | 36.25 |
| Priya’s request arrives | 36.80 |
| Mia accepts Priya’s request | 37.45 |
| Priya joins | 37.85 |
| Team complete | 38.20 |
| Team-to-plan reveal | 38.85 to 40.60 |
| Unchanged source picture resumes | 40.60 |
| Continuous closing resolution begins | 54.80 |
| Three surfaces close edge-on | 56.50 to 57.69 |
| Six pieces gather and land | 57.25 to 60.15 |
| Wordmark | 60.40 |

`sequence_timing.py` is the shared clock. `timeline.py` preserves the V16 renderer and replaces only story seconds 32.6 to 40.0, extended to 44.0. Every later frame uses V16 time minus four seconds. `render.py` applies the corresponding source clock to existing shutter windows and new windows to the new actions. `audio.py` retimes unchanged cues through the same mapping and assigns explicit cues to the new actions. `score.py` inserts exactly eight beats from the existing deterministic score. No later section is stretched.

The three-problem opening, stationary question line, ageing, stopped build, empty impact, three-line logo introduction, independent stall, Pulse, Slack, human recovery and 42 are retained. Help Desk receives the text-fit correction; the finale is rebuilt within its existing duration.

## Build

Requires Python 3.10+, Pillow, NumPy and FFmpeg with libx264. If using the supplied source ZIP:

```bash
export SPINE_FONT_DIR="$PWD/assets/fonts"
WORKERS=6 bash build.sh
```

The build writes `out/Spine_Collaboration_Rework_V2.mp4` and selects the bundled Inter fonts automatically.

## Integration and validation

The current-source preservation check compared seven frames outside the replacement with commit 4dd6b8e, with zero float-pixel delta at every sample. The initial V16 comparison likewise passed eight samples. These are source-render comparisons with the bundled fonts, not a claim of bit-identical encoded MP4s.

This revision renders every frame directly from the editable source. There is no patching from an older film. The full deterministic score is retained, with quiet request-arrival cues and a softer final logo landing.

## Review scope and limits

V16 preservation was checked against the pinned original timeline at eight sample times outside the replacement, including post-shift Pulse, impact and ending frames. Maximum float-pixel delta was zero at every checked sample. Key action labels were checked for width and mobile-size frames were inspected. Rendered sequences, complete decode, frame count and measured audio levels are checked before delivery. Real-time audiovisual perception is not available here, so normal-speed viewing and subjective listening are not claimed. The UI abstractions and business data remain illustrative as in V16; they are not fresh product screen recordings.
