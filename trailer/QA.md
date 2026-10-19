# Spine launch trailer: QA record

What was checked, how, and what is still missing. Nothing below is claimed beyond what the tools
in this environment could actually verify.

## Deliverables

| File | Spec (measured with ffprobe and ffmpeg ebur128) |
|------|------|
| Spine_Launch_Master_1080p.mp4 | 1920 x 1080, H.264 yuv420p, 30/1 fps, 2400 frames, 80.000 s, AAC, fast start. -16.0 LUFS, true peak -1.5 dBTP |
| Spine_Launch_Captioned_1080p.mp4 | as above, captions burned in (y 940 to 1060, 52 px, two lines max) |
| Spine_Launch_Vertical_1080x1920.mp4 | 1080 x 1920, 2400 frames, 80.000 s, captions burned in (y 1600 to 1760). -16.0 LUFS, -1.5 dBTP |
| Spine_Launch_15s.mp4 | 1920 x 1080, 450 frames, 15.000 s, its own music cue. -16.0 LUFS, -2.8 dBTP |
| Spine_Coming_Next_18s.mp4 | 1920 x 1080, 540 frames, 18.000 s, its own music cue. -16.6 LUFS, -3.2 dBTP |
| Spine_Launch_Master.srt | 19 cues, the narration lines at their caption times (the same file serves the vertical version) |
| Three stills | Spine_Still_1_Welcome.png (frame 250), Spine_Still_2_Together.png (frame 1230), Spine_Still_3_Verified.png (frame 2140, with the demo disclosure) |
| Script and storyboard | SCRIPT.md, storyboard/ (14 frames) |
| Spine_Launch_Source.zip | this folder without node_modules and generated frames; README has the exact render commands |

## Not done, or done differently

1. **No voice.** No authorised voice generation was used, so there is no narration audio. The
   narration exists as captions (captioned master, vertical) and the SRT, timed for a calm read.
   The clean master carries music and effects only. When a voice is recorded, duck the music
   under it and re-check the line timings.
2. **Audio not auditioned by ear.** The score is synthesised in code. I measured loudness and peaks
   and checked the cue times against the picture, but I can't listen in this environment, so I
   haven't checked how it sounds, either on a phone speaker or on headphones.
3. **Playback not watched in real time.** I inspected the encoded files frame by frame: contact
   sheets every 8 frames across the whole master, every 40 frames of the vertical version, every 15
   of the 15 s cut, plus full-size frames and 390 px wide frames. I haven't watched any file
   play at normal speed, with or without sound.
4. **Some source text is below the 56 px target.** Where a crop wide enough to keep the context
   would shrink the text, the reading target is carried by a large editorial summary instead, and
   the crop is proof. Essential reading items and their size in the exported frame:
   question title about 62 px; "Jamie is building the research template" about 52 px; "2 of 3
   people" about 39 px (the bold count, at 1.3x); "Already answered?" and the link about 46 px;
   "Needs 2 more people to start" about 45 px. Context-only crops (the Claim row, Mia's full reply,
   the Pulse row, the check-in history, the report and verification lines, Went live) sit at 20 to
   35 px. Every one of those beats has a 52 to 84 px editorial line or headline beside it.
5. **No call to action URL.** None was supplied, so the end card says "Book a demo" only.
6. **Logo on cobalt.** The real gradient mark has very low contrast on cobalt, so in scenes 02
   and 11 the genuine logo (dark-tone version, white wordmark, as in the app's navy sidebar) sits on
   a small navy plate. That plate is the single accent behind the logo that the brief allows.
7. **The leader in Pulse is labelled "A leader".** The recording doesn't show who opens it, so
   no name is given.
8. **Pointer masks.** In two frozen frames the recorded pointer covered letters: "pa" in
   "company" (Mia's reply, clip 03 frame 588) and the "c" of "client" (Ben's title, clip 04 frames
   268 to 300). The letters were restored by copying the identical glyphs from the same frame
   (`tools/patch_cursor.py`). No wording was changed.
9. **Transition 06 to 07** is a short scale and fade of the team card, not a full morph into the plan.

## Story and truth checks (against the footage)

- Priya asks (clip 02), Mia claims and answers (clip 03), Ben gets the later "Already answered?" suggestion (clip 04).
- The private thread is never shown becoming public; "Once shared" bridges the unrecorded step. No consent click is invented.
- Louie owns Supplier Research Assistant; Jamie joins; the count goes from 1 of 3 to 2 of 3 on the real frame 152; the third seat stays open; no third join is shown.
- Jamie is labelled "Member" only after the join lands. Alex is never shown in the team; in scene 10 he stands apart, labelled "Outside the team".
- No AI score appears. The approval crop excludes the "AI review raised concerns" banner, the auto approval timer and the empty suggested plan.
- The next action uses the source wording, "Jamie is building the research template". The first step ticked is Louie's (LM); the next step is Jamie's (JC). "First drafted by AI from the brief" appears as recorded.
- The blocker, Pulse and recovery appear in source order (clips 08, 09, 10). The banner clears on the real frame 376 after Louie's human check in. No SAP connector, upload or automatic fix is shown.
- Live comes from the real Mark Live press. No tool output is invented.
- "12 hours saved" appears verified only after the source shows Verified (clip 13 frame 259). The number never counts up. The equation 18 × 40 min = 12 hours is derived from the recorded report. "Acme Group · Demo data" stays on screen through scene 10 (and on the verified still). The Leadership crop excludes the 106 total.
- Wording is "verified by someone outside the team", never "independently verified".
- The teaser is labelled "Coming next · Concept" on every frame, has no release date, shows only the selected message travelling, and shows no automatic approval. Chat surfaces are generic drawings, named in text, with no third-party logos.

## Technical checks

- Deterministic renderer, no wall-clock animation; all fonts are local Inter (OFL) and load before the first capture.
- No black pre-roll: frame 0 is the first scene.
- Captions stay inside the caption band and never cover the essential UI in either orientation.
- CRF 18, preset slow. Text inspected after compression at full size: clean.
