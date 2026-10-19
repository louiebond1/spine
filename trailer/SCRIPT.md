# Spine launch trailer: script and storyboard

80 seconds, 1920 x 1080, 30 fps, 2400 frames. British English. Frames are inclusive.
Storyboard frames are in `storyboard/` (one per scene, rendered from the real composition).

Narration is written for a warm, conversational British voice. **No voice track has been recorded or
generated yet**: the captions and the SRT carry the narration, and the timings below are where each
line is placed. Every main message also reads with the sound off.

| # | Time | Frames | Headline on screen | Narration (caption) | Source footage and action |
|---|------|--------|--------------------|---------------------|---------------------------|
| 01 | 0 to 6 s | 0 to 179 | AI is everywhere. / Progress can get lost. | AI is everywhere at work. But good questions and ideas can get lost. | Illustration only. Priya (Questions), Mia (Know how), Louie (Ideas) at separate desks, three disconnected cobalt strokes. |
| 02 | 6 to 10 s | 180 to 299 | Welcome to Spine. / Your company's AI adoption, together. | Welcome to Spine. | The strokes resolve into the Spine mark, then the real logo. Clip 01 frame 60: "3 things need you". |
| 03 | 10 to 22 s | 300 to 659 | Your question. Your company's answer. | Ask the question only your company can answer. A Champion helps you move forward. | Clip 02 frame 705: Priya's question "Can I put client contract data into Copilot?", private to the asker and Champion. Clip 03 frames 192 to 223: Mia clicks Claim. Clip 03 frame 588: Mia's sent answer. Editorial card "Mia's answer · Summary: Use the company Claude workspace. Replace client names first." with "Company demo guidance". |
| 04 | 22 to 28 s | 660 to 839 | Once shared, one answer goes further. | Once shared, that answer helps the next person too. | Clip 04 frames 268 to 300: Ben's title "Is client contract data OK in Copilot?" and the real "Already answered?" suggestion (appears at 275). No consent click or automatic publication is shown. |
| 05 | 28 to 35 s | 840 to 1049 | Give a good idea a way forward. | Give a useful idea a place to start and a decision that moves it forward. | Editorial "Problem · Summary: Supplier research is scattered across websites and documents." Clip 05 frame 200: title. Clip 05 frames 222 to 244: Approve press. Clip 05 frame 262: Forming team, needs 2 more people. The AI concern banner, the auto approval timer and the empty suggested plan are cropped out. |
| 06 | 35 to 44 s | 1050 to 1319 | Your idea. Our next project. | Find the people who want to build it with you. | Clip 06 frames 120 to 179: 1 of 3 people, Jamie presses Join the team, 2 of 3 people (frame 152). Desks slide together around a round table; the third seat stays open. Louie places a source document, Jamie a workflow symbol. Labels "Louie · Owner", "Jamie · Member" (after the join). |
| 07 | 44 to 51 s | 1320 to 1529 | Everyone knows the next step. | A clear plan. A named owner. Everyone knows the next step. | Clip 07 frames 215 to 241: Louie ticks "List the supplier sources Procurement trusts" (LM). Clip 07 frame 252: "Jamie is building the research template" and the next step (JC). Source label "First drafted by AI from the brief". |
| 08 | 51 to 61 s | 1530 to 1829 | Keep good ideas moving. | When work gets blocked, Pulse brings it to someone's attention, so the team can move again. | Clip 08 frames 455 to 466: Blocked check in with the full note. Clip 08 frame 482: blocker banner, with the summary "Blocked: waiting for the SAP supplier list." Clip 09: Pulse's top blocked item, a leader presses Open (frames 232 to 268). Clip 10 frames 362 to 380: the recovery check in clears the banner. Clip 10 frame 392: "Alex got us the SAP export. Back on track." with the summary "SAP export received. Back on track." |
| 09 | 61 to 66 s | 1830 to 1979 | From idea to something the team uses. | Take it live and put it to work. | Clip 11 frames 120 to 165: "You're launching this", Mark Live press, the green Live state. |
| 10 | 66 to 75 s | 1980 to 2249 | See what it delivered. | Report what it saved. Have someone outside the team verify it. Give leadership a clear view. | Clip 12 frame 410: "October 2026: 12 hours saved ... Reported by Louie Morris · Not verified yet", status Reported, editorial equation "18 × 40 min = 12 hours". Clip 13 frames 247 to 270: Verify press, "Verified by Alex Morgan on 7 Oct". Editorial "12 hours saved · Verified by someone outside the team". Clip 14 frame 300: Went live, Supplier Research Assistant (the 106 total is cropped out). Persistent "Acme Group · Demo data". |
| 11 | 75 to 80 s | 2250 to 2399 | Good ideas deserve to go somewhere. / Spine · Run your company's AI adoption. / Book a demo | Spine. Run your company's AI adoption. | The cobalt strokes resolve into the logo. Everything holds still from 0.4 s to the last frame. No URL (none was supplied). |

## Sound

One original instrumental (synthesised in `tools/music.py`, 110 BPM, D major): curious and sparse
for scene 01, a warm chord and bells as the logo lands (6.0 s), light percussion through Help Desk,
bass from the idea chapter, a fuller texture when Jamie joins (36.9 s), a brief reduction for the
blocker (51.3 s to 57.3 s), a Live chime (62.1 s), a resolution on verification (69.5 s) and a
natural cadence under the logo. Small clicks on the nine recorded presses; a soft arrival on the
join. Mix: -15.9 LUFS integrated, true peak -1.5 dBTP.

## What is editorial, not product UI

Headlines, the "Problem · Summary", "Mia's answer · Summary", the two blocker summaries, the
equation, the "12 hours saved · Verified by someone outside the team" card, chapter chips
("Ideas & Projects", "Pulse"), portrait and role labels, the shared answer symbol, the round table,
the document and workflow symbols, and the cobalt line. They sit outside the recorded frames and
never repaint them.
