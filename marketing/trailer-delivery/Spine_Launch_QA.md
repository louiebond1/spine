# Spine launch trailer — QA record

## Source access

All 15 linked Spine 2.0 MP4s, all 18 linked PNGs and ASTRA-BRIEF.md downloaded successfully. No broken source URLs. The attached DOCX was extracted with Python's ZIP/XML libraries and read, including the detailed scene instructions. The final DOCX takes priority over the older linked creative brief.

Inspected five sampled states per recording, all linked screenshot contact sheets, and finer action samples around claiming, approval, joining, plan completion, recovery, launch and verification. Native-size frames were used to locate crops. Only the supplied product footage and a direct logo crop from a supplied screenshot are used as current product imagery. The separate future teaser contains explicitly labelled editorial concepts.

## Revisions from visual checks

1. Recovery crop initially included the old blocked note and cut off the posted recovery. Moved it to the final On track row and checked the full 'Alex got us the SAP export. Back on track.' text.
2. Approval crop included the auto-approval timer. Tightened it to the human Approve button.
3. Full launch header had a partly cropped stage row. Replaced it with a tight crop of the actual green Live state, retaining the project title outside it.
4. Collaboration table touched the disclosure. Raised the table and open-seat outline.
5. Encoded action-end frames showed blank crops when the page changed after Claim, Approve, Join and Check in. Shortened the advancing source window and held its last action frame until the cut to the verified result. No footage was accelerated.
6. Membership disclosure initially said two of three before joining. Made it one of three before the action and two of three afterwards. Jamie's Member label now appears after the join.
7. Removed the recorded 'waiting for your decision' heading after approval; the subsequent title and Forming team state are consistent.
8. Added the opening line convergence and closing mark-to-real-logo crossfades.
9. Vertical layout was separately recomposed. Moved the two desks above the disclosure and corrected the illustrative characters for Ben's suggestion and Louie's idea scenes.

10. Caption inspection found libass scaling the initial 26-point style to oversized text. Reduced its script-resolution font size to produce approximately 52 px captions in the 1080p export.

## Checks performed

- Remotion source type-checked with TypeScript.
- Eleven storyboard frames rendered and visually inspected.
- First 10-second sequence rendered before the full master.
- Encoded master frames inspected at all scene boundaries, midpoints and key internal cuts. Contact sheets are in output/qa. These are frame inspections, not a claim of full-speed playback.
- Vertical storyboard inspected as 390-pixel-wide thumbnails. Headline and editorial focal text are readable; underlying source text is supporting evidence and can be smaller. The export does not claim every recorded UI label meets the brief's minimum text size.
- Short and future-concept keyframes visually inspected.
- Character continuity: Priya asks; Mia answers; Ben gets the suggestion; Louie owns; Jamie joins; Alex helps with recovery and verifies from outside the team. No Alex join event.
- One project throughout: Supplier Research Assistant. One-of-three to two-of-three is preserved. No fabricated third join.
- Private conversation is not animated into a public thread. The editorial 'Once shared' bridge is retained.
- No private AI scores, public-website captures, invented SAP connector, 106-hour project claim, customer endorsement, fake URL or QR code.
- Acme Group demo disclosure retained beside the outcome and in the outcome still.
- Music is original procedural synthesis. Measured WAV: -16.10 LUFS integrated, -2.09 dBTP. No external samples or commercial songs.
- Full-file decoding, dimensions, frame rate, frame count and stream checks are recorded in output/qa/technical-results.json after export.

## Final technical results

All five final MP4s passed full-file decoding. Both landscape masters and the vertical master are exactly 80 seconds and 2400 frames. The cutdown is 15 seconds/450 frames and the concept teaser is 18 seconds/540 frames. All are 30 fps H.264, yuv420p, with AAC audio. The vertical master is 1080×1920; the others are 1920×1080. Full-range renderer output was converted to limited-range yuv420p for delivery.

## Actual limitations

**No voice layer:** no authorised voice-generation capability was available. Exports have original instrumental audio. The captioned landscape version displays the timed narration script; the SRT is a provisional recording script, not alignment to an existing performance. Voice recording, scene-by-scene fitting and final dialogue/music ducking remain outstanding.

**No audiovisual playback claim:** the available inspection tool displays still images, not video or audio. I could inspect decoded exported frames and verify full-file decoding, but could not watch the film at normal speed with sound, listen on a phone speaker, or validate subjective musical feel. Those checks remain open. Contact sheets do not replace them.

**Creative execution:** this is a deterministic vector-and-recording edit. The illustrations are deliberately simple and reuse a compact set of poses. The collaboration transformation uses translated desks and an appearing shared table; it is not a detailed hand-animated performance. Some contextual UI text and disclosure labels will be small in 390-pixel-wide landscape playback; essential messages are enlarged separately. Further craft review may be warranted before publishing.

No independently verified demo destination was provided. The end card uses 'Book a demo' without a URL, as permitted by the brief. A standalone logo vector was not linked, so the genuine logo is cropped from the approved screenshot and will be less sharp than a vector master.

Nothing was published externally. These exports and editable source are delivered for review; the missing voice and full-playback checks prevent a claim that every final-production gate passed.
