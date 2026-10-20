# Spine launch trailer: revised treatment, timeline, budget and proof-of-concept (revision 3)

Revised 20 October 2026 in response to GPT-6's verdict, "REVISE BEFORE PRODUCTION".

Nothing has been bought and no paid generation has run. One free-plan image was generated in Runway (20 of the workspace's 500 free credits) for the proof-of-concept plate.

**Verified** means done and inspected in this environment. **Unverified** means not.

Evidence is in `marketing/trailer-plan/evidence/`. The proof-of-concept source is in `marketing/trailer-plan/poc/`.

---

## Contents

1. What changed, point by point
2. Revised creative treatment
3. Exact timeline (72 s)
4. The four cinematic shots
5. Transitions
6. Typography, pacing and sound design
7. Product recordings needed
8. Proof-of-concept: design, what is built, what is blocked
9. Pricing (official sources) and the one-month question
10. Remotion licence
11. Production plan
12. Risks
13. Revised verdict

---

## 1. What changed, point by point

| GPT-6 asked | Response |
| --- | --- |
| 1. Cut to 4 to 6 generated shots | **4 core shots** (G1 to G4), plus 1 optional (G5). Section 4 explains which shots survive and why the other seven were cut |
| 2. Target 60 to 75 s | **72 s** (2160 frames). Section 3 shows each mini-story needs its time |
| 3. Screen-dive as signature, plus 2 or more other transitions | The dive is used **once**. Four other transitions are designed: light match, logo match-move, card lift-off and rack-focus reveal (section 5) |
| 4. Prove compositing before spending | Built and rendered: the dive maths and handoff on a labelled geometry test card, and the full product interaction. The photoreal plate exists in Runway, but **this environment's network blocks downloading it**. That part is not claimed (section 8) |
| 5. Each feature as a mini-story | Five mini-stories, each with an action, Spine's response and an outcome (section 2) |
| 6. Official pricing | Runway, Runway API, Google AI Pro / Flow and Remotion checked against official pages (section 9) |
| 7. One £20 month? | Yes, on one route: **Google AI Pro, £18.99**, with you operating Flow from my prompts. With Runway Standard it's possible only with zero retakes to spare (section 9) |
| 8. Remotion licence | Official licence read. Eligibility depends on Spine's legal entity, which I can't see. One question for you (section 10) |
| 9. Prioritise craft | Typography system, pacing rules and a full sound-design plan (section 6) |
| 10. Four extra recordings | AI first answer, share consent, Draft it and Admin > Integrations. I can capture all four myself (section 7) |

---

## 2. Revised creative treatment: "Through the Screen"

**Idea.** A question and an idea each travel from person to person through Spine, and nothing gets dropped. Real people appear only where a human moment carries the story:
- the quiet before Spine;
- the expert who answers;
- the person who steps in;
- the leaders who see the result.

Everything else is the real product: still during reads, cinematic between them.

**Look.**
- **World:** natural light, 35 to 50 mm, shallow depth of field, real textures, one grade (navy shadows #0E1629, warm off-white highlights #FAF9F6).
- **Product:** crisp 3× captures, full frame, a camera that stops for every read.
- **Accent:** cobalt (#3B5BDB) is the only accent. Green only for Live, red only for Blocked.

**The five mini-stories:**

| Story | User action | Spine's response | Meaningful outcome |
| --- | --- | --- | --- |
| Help Desk | Priya asks "Can I put client contract data into Copilot?", privately | Spine drafts a first answer from the Playbook; Mia, a Champion, claims it and answers with the company's rule | Priya shares it, and weeks later Ben is shown the answer **before he finishes asking** |
| Ideas & Projects | Louie describes an idea in one sentence | Spine drafts the proposal; leadership approves in one click (or it auto-approves) | Jamie joins, Spine drafts a plan, and every step has an owner. "Jamie is building the research template" |
| Pulse | Louie checks in "Blocked: we need the SAP export" | Pulse puts it in front of Alex | Alex steps in; the blocker clears and work moves |
| Proven value | The team marks it Live and reports 18 requests at 15 instead of 55 minutes | Someone outside the team verifies it | Leadership sees verified hours and what went live |
| Integrations | (Built) a channel linked to the initiative | The Pulse digest and approvals are posted to Slack or Teams; plans export to calendars | Coming soon, clearly labelled: Spine inside Teams chat, Slack and Claude |

**Collaboration** runs through all of them: six named people each act once.

---

## 3. Exact timeline (72 s, 30 fps, 120 BPM = 15 frames per beat)

Conventions:
- Timecode is `mm:ss.ff`; frame numbers are absolute.
- `z` = output pixels per logical UI pixel. The full frame is 1.333; 3× captures stay sharp to z 3.0 (verified).
- Every read is completely still and lasts at least 0.6 s + words ÷ 3.5 s.
- **G** = generated plate, **UI** = real capture, **T** = transition (section 5).

### ACT 0: Quiet (00:00.00 to 00:06.00)

**S01 · 00:00.00 to 00:03.15 · f0 to f104 · G1**

- **Sees:** dusk office. A phone face-up on a desk lights with a notification nobody answers, then dims.
- **Camera:** slow push-in.
- **Text:** "Most AI ideas don't fail." (f30 to f104)
- **Sound:** room tone, a muted buzz at f30, no reply.
- **Feels:** recognition.

**S02 · 00:03.15 to 00:06.00 · f105 to f179 · T2 light match**

- **Sees:**
  - f105 to f125: the phone's dimming glow is isolated and becomes a horizontal cobalt line on navy.
  - f125 to f150: the line flattens.
  - f150 to f179: it splits into the three logo bars, and the wordmark arrives.
- **Text:** "They go quiet." (f105 to f150)
- **VO:** f20 to f140 "Every company has AI ideas. Most of them just go quiet."
- **Sound:** **silence from f126 to f149**, then an inhale and a "set" click on f165.

### ACT 1: The turn (00:06.00 to 00:10.00)

**S03 · 00:06.00 to 00:10.00 · f180 to f299 · T4 logo match-move into UI**

- **Sees:**
  - f180 to f210: the logo travels to the sidebar logo position as Alex's real Home builds around it.
  - f210 to f235: glide.
  - f235 to f299: hold, z 2.6, on "3 things need you" and the first row (Review).
- **VO:** f190 to f290 "Spine keeps them moving, and asks for you only when you're needed."
- **Mini-story beat:** the problem is answered by the product's own first screen.

### ACT 2: Help Desk (00:10.00 to 00:29.00)

**S04 · 00:10.00 to 00:13.00 · f300 to f389 · UI (Q1)**

- **Action:** Priya types "Can I put client contract data into Copilot?"
- **Hold:** z 2.5 on the title and "Only you and the Champion who picks this up can see the conversation." (f345 to f389). Ask at f385.
- **Text:** "Ask what only your company can answer."

**S05 · 00:13.00 to 00:15.00 · f390 to f449 · UI (Q2, new recording)**

- **Response:** Spine's instant first answer appears. Hold z 2.4.
- **Text:** "Spine drafts a first answer from your Playbook."
- **Fallback:** if the capture is weak, cut this shot and add its 60 f to S07.

**S06 · 00:15.00 to 00:18.15 · f450 to f554 · G2 then T1 signature dive**

- **Sees:**
  - f450 to f520: Mia at her desk leans toward her monitor, which shows the real Help Desk queue, corner-pinned.
  - f520 to f554: the dive. The monitor becomes the frame.
- **Text:** "A Champion who knows picks it up." (f465 to f515)
- **Sound:** office murmur, which narrows to the product's closer, cleaner sound during the dive.

**S07 · 00:18.15 to 00:23.00 · f555 to f689 · UI (Q3, proof-of-concept interaction)**

- **Response:** Claim; the thread opens; Mia's reply appears.
- **Hold:** z 2.3 on "Not in Copilot yet: it's approved for internal data only until Legal signs off. Use the company Claude workspace, and replace client names first. It's all in the Playbook." (f620 to f689)
- **Text:** "Answered with your company's own rules."
- **VO:** f560 to f680 "A Champion answers with your own rules."

**S08 · 00:23.00 to 00:25.00 · f690 to f749 · UI (Q4, new recording)**

- **Outcome, part 1:** Priya's view: "Your Champion suggested sharing this answer", then Share summary, then "Shared." Hold z 2.4.
- **Text:** "Shared only when the asker agrees."

**S09 · 00:25.00 to 00:29.00 · f750 to f869 · T3 card lift-off into UI (Q5)**

- **Outcome, part 2:**
  - f750 to f790: the shared answer card, a real-pixel crop, lifts off Priya's page, turns 25° in 3D and flies across a navy field.
  - f790 to f810: it lands as the "Already answered?" suggestion under Ben's half-typed title "Is client contract data OK in Copilot?"
  - f810 to f869: hold z 2.8.
- **Text:** "The next person gets the answer before they finish asking."
- **VO:** f755 to f860 "Share it, and the next person gets the answer before they even finish asking."
- **Sound:** a rising chord resolves on the landing.

### ACT 3: Ideas & Projects (00:29.00 to 00:41.15)

**S10 · 00:29.00 to 00:32.00 · f870 to f959 · UI (I1, new recording)**

- **Action:** Louie types one sentence and clicks Draft it; the proposal fields fill.
- **Hold:** z 2.0 (f920 to f959).
- **Text:** "Describe it in a sentence. Spine drafts the proposal."

**S11 · 00:32.00 to 00:35.00 · f960 to f1049 · UI (I2)**

- **Response:** the approval view, cropped below the AI-concerns banner, glides to "Auto-approves in 6h". Approve at f1000; the stepper shows **Forming team**.
- **Text:** "Leadership decides in one click. Or it auto-approves."

**S12 · 00:35.00 to 00:37.00 · f1050 to f1109 · UI (I3)**

- **Outcome:** Join the team; "1 of 3" becomes "2 of 3 · Jamie Chen".
- **Text:** "The right people join."

**S13 · 00:37.00 to 00:41.15 · f1110 to f1244 · UI (I4)**

- **Outcome:** "First drafted by AI from the brief", with owners on every step. A tick at f1150.
- **Hold:** z 2.8 on "Jamie is building the research template" (f1180 to f1244).
- **Text:** "AI drafts the plan. People own every step."
- **VO:** f1115 to f1235 "Spine drafts the plan, and every step has an owner."

### ACT 4: Pulse (00:41.15 to 00:53.00)

**S14 · 00:41.15 to 00:44.15 · f1245 to f1334 · UI (P1)**

- **Action:** a Blocked check-in. The red banner reads "Blocked since 7 Oct: We need the approved supplier list exported from SAP."
- **Hold:** z 2.4.
- **Text:** "Work gets stuck."
- **Sound:** **the music drops out at f1290.**

**S15 · 00:44.15 to 00:47.15 · f1335 to f1424 · UI (P2)**

- **Response:** Alex's Pulse, with Supplier Research Assistant first under Blocked.
- **Hold:** z 2.5. Open at f1420.
- **Text:** "Spine notices, and tells someone who can help."
- **Sound:** one heartbeat at f1380.

**S16 · 00:47.15 to 00:50.00 · f1425 to f1499 · G3 (motion-matched cut in and out)**

- **Sees:** Alex walks through the office to a colleague's desk, leans in and speaks briefly; the colleague nods and types. The screens are defocused.
- **Cut:** the cut in matches the left-to-right glide of the UI.

**S17 · 00:50.00 to 00:53.00 · f1500 to f1589 · UI (P3)**

- **Outcome:** "Alex got us the SAP export. Back on track." Check in; **the red banner disappears.**
- **Hold:** z 2.3.
- **Text:** "Someone steps in. It moves again."
- **Sound:** **the music returns at f1530**, the emotional peak.

### ACT 5: Proven value (00:53.00 to 01:04.15)

**S18 · 00:53.00 to 00:55.00 · f1590 to f1649 · UI (L1)**

- Mark Live, then a green "● Live". Push to z 3.0.
- **Sound:** a chime.

**S19 · 00:55.00 to 00:58.00 · f1650 to f1739 · UI (L2)**

- The team's own measurement becomes "18 requests × 40 minutes saved = 12 hours", built only from the captured numbers.
- **Label:** "Acme Group · Demo data".

**S20 · 00:58.00 to 01:00.00 · f1740 to f1799 · UI (L3)**

- Verify, then "Verified by Alex Morgan". Hold z 3.0.
- **Text:** "It only counts once someone outside the team verifies it."

**S21 · 01:00.00 to 01:04.15 · f1800 to f1934 · G4 then T5 rack-focus reveal, then UI (L4)**

- **Sees:**
  - f1800 to f1850: a boardroom. Focus racks from two leaders in the foreground to the wall display showing the real Leadership screen (static plate, corner-pinned).
  - f1850: a hard cut on the beat to full-frame Leadership. The chart line is revealed by a wipe over the real chart.
  - f1880 to f1934: glide to "Went live · Supplier Research Assistant"; hold.
- **Text:** "Leaders see what AI actually delivered." (with the demo-data label)

### ACT 6: Integrations and end (01:04.15 to 01:12.00)

**S22 · 01:04.15 to 01:07.00 · f1935 to f2009 · UI (X1, new recording)**

- **Sees:** Admin > Integrations (Slack and Teams channels) plus "Link your Teams or Slack channel · Calendar".
- **Text:** "Posts to your Slack and Teams channels. Plans go straight into your calendar."
- **Then (f1985 to f2009):** in grey, with an outlined "Coming soon" label: "Spine inside Teams chat, Slack and Claude".

**S23 · 01:07.00 to 01:12.00 · f2010 to f2159 · End card**

- **Sees:** a pull-back across the film's moments, collapsing into the logo; then on navy, "Where your company's AI ideas get answered, built and proven." and "Book a demo · [URL TBC]".
- **VO:** "Spine. Where your company's AI ideas get answered, built and proven."
- **Sound:** a final heartbeat on f2040, the resolve, then silence on the last 8 frames.

### Why 72 s and not 60

| Part | Time |
| --- | --- |
| Five mini-stories, each with action, response and outcome | 54 s |
| Hook | 6 s |
| Turn | 4 s |
| Integrations | 2.5 s |
| End card | 5 s |

Getting to 60 s means dropping S05 (AI first answer), S10 (Draft it) and S22 (integrations). Those are exactly the AI and integration features the brief asks to show, so **72 s is the primary cut**. A 60 s alternative is specified: no S05, S10 or S22, and a 4 s end card.

### Cutdowns

- 30 s: S02, S03, S06, S07, S09, S14, S17, S20, S21 (shortened) and S23.
- 15 s: S06 (dive), S09, S17, S23.
- 9:16: captured natively at the mobile viewport.

---

## 4. The cinematic shots: which survive, and why

**Survivors:**

| ID | Shot | Why it survives | Generation risk |
| --- | --- | --- | --- |
| **G1** | Dusk office, a phone lights up and nobody answers | The hook needs the real world: it shows the cost of silence before the product appears. No faces, a simple motion | Low |
| **G2** | Mia leans toward her monitor | Hosts the **signature dive**: the one place the film shows people and product joining. The expert is a human | Medium (the screen plane must stay rigid) |
| **G3** | Alex walks over and helps | Pulse's core truth: Spine nudges, and a person acts. The emotional peak needs a human | Medium (a walk cycle and two people) |
| **G4** | Boardroom, focus racks to the wall display | The payoff for the buyer, the leadership team. A static plate keeps the composite simple | Low to medium |
| G5 (optional) | Priya on a train, phone in hand | Only if G1 to G4 pass on the first attempts. Shows that anyone, anywhere can ask | Medium to high (hands and phone) |

**Cut, and why:**

- Alex opening a laptop: replaced by the logo match-move. It was a second screen-push.
- Ben's hands typing: replaced by the card lift-off, which tells the reuse story with the product itself.
- Louie's folders: weak, and generic.
- The team table: a generic "people collaborating" stock look.
- The buyer nodding: it risked implying invented software.
- Two further screen composites: each one adds tracking risk.

### Generation specs

Every shot is image-to-video from an approved start frame. Shared style tail: *"Shot on a full-frame cinema camera, natural light, shallow depth of field, subtle film grain, realistic skin and fabric texture, deep navy shadows and warm off-white highlights. No text, no logos, no watermarks."*

| ID | Start-frame prompt (image) | Motion prompt (video) | Generate → use |
| --- | --- | --- | --- |
| G1 | "A smartphone lies face-up on a pale oak desk in an open-plan office at dusk; cool blue window light, warm lamps out of focus behind, blurred colleagues leaving." | "Very slow push-in. The phone screen lights with a plain white notification card, glows for two seconds, then dims to black. Background figures drift out of frame." | 8 → 3.5 s |
| G2 | **Exists** (Runway task `0d391fa9`; prompt in `poc/README.md` and section 8): Mia at a lived-in desk, the monitor a flat mid-grey rectangle | "Locked-off camera with a very slow push. She leans slightly toward the monitor with interest and settles. The monitor stays perfectly rigid and evenly grey." | 6 → 2.3 s |
| G3 | "Bright open office, morning; Alex (reference) mid-stride between desks toward a colleague seated at a desk." | "Smooth tracking shot from behind and to the side: they reach the desk, lean down, speak briefly; the colleague nods and turns to the keyboard. Screens out of focus." | 6 → 2.5 s |
| G4 | "Glass-walled boardroom, morning. Two senior leaders in the foreground, shoulders and the backs of their heads, look at a large wall display that is a flat, evenly lit mid-grey rectangle with a thin black bezel, slightly off-axis." | "Static camera. Focus racks from the leaders in the foreground to the wall display. Minimal natural movement." | 6 → 1.7 s |

---

## 5. Transitions (the dive is used once)

| # | Transition | Where | How it's built | Status |
| --- | --- | --- | --- | --- |
| T1 | **Screen-dive (signature)** | S06 | Corner-pin the real UI onto the plate's screen; warp the whole plate with a homography that carries the screen quad to the full frame; fade screen sheen, blur and grain; hand off to the native UI | **Maths and handoff verified on a test card.** Photoreal not yet tested (section 8) |
| T2 | **Light match** | S01→S02 | Key the phone's glow (the brightest region), track its centroid, morph it into a 4 px cobalt line on navy as the plate darkens, then retract the line into the logo bars | Designed, not built |
| T3 | **Card lift-off** | S08→S09 | A real-pixel crop of the shared answer becomes a 3D card (CSS perspective, 25° rotation, soft shadow) that flies to Ben's screen and settles into place as the "Already answered?" element. The landing frame is the real capture | Designed. The technique is the same corner-pin code as T1, so moderate confidence |
| T4 | **Logo match-move** | S02→S03 | Vector logo bars scale and translate to the exact sidebar logo position in the Home capture (from `Logo.tsx` geometry); the UI fades in around them | Designed, low risk |
| T5 | **Rack-focus reveal** | S21 | The focus pull in the plate (generated), with the pinned UI blurred in sync with the plate's display; a hard cut on the beat to full-frame UI | Designed. Depends on G4 |

Plus one **sound-led cut**: silence on the stall (S14) and the music's return on the unblock (S17).

---

## 6. Typography, pacing and sound design

### Typography

| Style | Spec | Use |
| --- | --- | --- |
| Headline | Inter Display Semibold 60 px, −0.02 em, line-height 1.1, maximum 8 words | 120 px left margin, 96 px bottom margin |
| Light style | #181A20 on a soft off-white scrim | Over UI |
| Dark style | #FAF9F6 on a navy scrim | Over plates |
| Entry and exit | Enter with a 10-frame fade plus a 14 px rise (glide ease); exit with an 8-frame fade | One headline on screen at a time, never over a UI read |
| Labels | Inter Medium 20 px, 60% opacity | "Acme Group · Demo data", "Coming soon" |
| End card | Wordmark 160 px; line in Inter Display Medium 44 px | End card only |

### Pacing rules

- The camera never moves during a read.
- Moves are 18 to 24 frames with a glide ease (cubic-bezier(0.16, 1, 0.3, 1)).
- Cuts land on the 15-frame beat.
- Acts change on bar lines.
- Click sounds land within ±1 frame of the captured click frame.

### Sound design

- **Score:** 120 BPM, minimal. A felt piano motif over a sub pulse; a soft analogue pad; a drum pattern only in Acts 3 and 5.
- **Motif:** a "heartbeat" (sub at about 50 Hz, a soft kick and a 4 kHz tick). It beats under the hook, flatlines on the stall and returns on the unblock.
- **Foley (world):**
  - S01: dusk room tone, HVAC, a lift chime, a phone buzz.
  - S06: office murmur, a chair creak, a headphone rustle.
  - S16: footsteps, a quiet unintelligible exchange, keys.
  - S21: boardroom hush.
- **Foley (product):** soft key ticks, real mouse-click transients on click frames, a "sent" tone, a two-note join, a Live chime, a verify "stamp". All quieter and closer than the world sound, so the product feels intimate.
- **Mix targets:** VO sits at −20 LUFS short-term; the music ducks 6 dB under VO; master −14 LUFS integrated, −1 dBTP. Stems are delivered: VO, music, SFX, world.
- **Sources, in my recommended order:**
  1. **Your own Foley** recorded on a phone: keyboard, mouse, mug, room tone. Free, real and better than library sound.
  2. Runway sound effects: 1 credit per second, available on your free plan. **Output download is currently blocked by the network policy**, same as images.
  3. Music: a library track you choose (check its licence covers commercial web use), or Runway's music model (paid plans only).
  4. VO: a human recording is strongly preferred over synthetic speech.
- **What I can't do:** I can't hear. I verify by measurement: loudness, true peak, click alignment to frames, ducking depth and spectrum. You approve by listening.

---

## 7. Product recordings needed

All captures are made by me from the locally running Spine 2.0 app at 3× (4320 × 2430, lossless PNG, frame-stepped). **Verified** in this session: the app was built, seeded and run, and the proof-of-concept interaction was captured this way.

**The four additional recordings** (they don't exist in the supplied footage):

1. **Q2: Help Desk instant first answer.** Needs `SPINE_AI_FIXTURES=1` under `next dev` (canned text) or one real Claude call on your key (a few pence; unverified). **Can capture: yes.** Its look on screen is unverified.
2. **Q4: "Share the answer with your company?" consent.** Plain UI, no AI. **Can capture: yes.**
3. **I1: Propose an idea with Draft it.** Same AI condition as Q2. **Can capture: yes.**
4. **X1: Admin > Integrations.** Plain UI. A Slack or Teams webhook URL must be saved to show a connected state. A dummy URL would show "connected" without a real channel, which is acceptable only if no message delivery is shown. **Can capture: yes.**

**Re-takes** (the shots exist in the supplied clips but need 3× sharpness, dwell after results and no cursor in the pixels): Q1, Q3, Q5, I2, I3, I4, P1, P2, P3, L1, L2, L3, L4 and the Home screen.

**A product issue found:** the Help Desk reply field is a single line that scrolls sideways. A long reply shows its tail with the first letters cut off ("ɔany Claude workspace..."), visible in the proof-of-concept render. For the film I'll capture partial typing and cut before it scrolls. A multi-line reply box would fix it in the product.

---

## 8. Proof-of-concept

### Design: about 12 s, three elements

1. **Photoreal cinematic shot:** G2, Mia at her monitor. In the proof-of-concept it is a still plate with camera motion (slow push and drift), film grain and a matched grade. Real plate motion needs a paid image-to-video generation (stage 2 below).
2. **Transition into the real interface:** T1 screen-dive. The real Help Desk queue is corner-pinned onto the monitor with matched levels, blur, screen sheen and grain. The dive warps the plate until the monitor becomes the frame, then hands off to the native UI.
3. **Animated product interaction:** Mia claims Priya's question, the thread opens, she sends the reply, and the answer and history entry appear. The camera then settles on the answer, followed by the headline "Answered with your company's own rules."

**Acceptance criteria:**

- (a) No visible seam at the handoff: a pixel change of 2 or less (mean absolute, 0 to 255 luma) between the last plate frame and the first native frame.
- (b) Pinned UI edges sit within 1 px of the screen corners.
- (c) No flash or dropped frame: no mean-luma jump over 15 between frames, except the intended dive.
- (d) Every UI pixel traces to a capture.
- (e) A viewer (you) believes the screen is in the photograph.
- (f) The reply is readable on a phone screen.

### What is built and verified

| Element | Status | Evidence |
| --- | --- | --- |
| 3× captures of the claim and reply flow | **Done**: 6 states captured from the running app as Priya and Mia | `poc/capture-meta.json` |
| Animated product interaction (element 3) | **Rendered and inspected.** 8 s, 1080p. Two defects found on inspection and fixed: a one-frame grey flash at the page change, and the final framing clipping Mia's avatar. Re-rendered: no luma dip below 209. Criteria (c) and (d) met; (f) needs your phone check | `evidence/poc/poc-product-interaction.mp4` and contact sheet |
| Dive maths and handoff (element 2 geometry) | **Rendered and inspected on a labelled geometry test card** (not a plate). The pin lands on the quad; the dive carries it to the full frame; handoff difference 1.43 (criterion a met); the visible difference is sub-pixel resampling only | `evidence/poc/poc-dive-geometry-test.mp4` and contact sheet |
| Screen detection for plates | **Script written and tested on the test card:** corners found within 0.5 px of truth (criterion b on synthetic data). Untested on a real plate | `poc/find_screen.py` |
| Photoreal plate (element 1) | **Generated, not downloadable.** One 2K still of Mia with a flat grey monitor exists in your Runway library (task `0d391fa9-fea7-4c4d-a873-8d6631777383`, 20 free credits). This environment's network policy blocks Runway's download host (`dnznrvs05pmza.cloudfront.net`). **Not inspected, so not claimed** | None |
| Photoreal composite and dive (elements 1 and 2 together) | **Not done** (blocked by the plate download) | None |

**To finish stage 1 (free), either:**

- add `dnznrvs05pmza.cloudfront.net` to this environment's allowed domains (environment settings → Network access), or
- download that image from your Runway library and commit it to this branch as `marketing/trailer-plan/poc/plate.png`.

Then I run `find_screen.py`, render the full 12 s proof-of-concept, inspect it against criteria (a) to (f), and report honestly whether it passes.

### Stage 2 (the first spend, only after stage 1 passes)

- One image-to-video generation of G2 from the same still (6 s).
- Then the real test: does the screen stay rigid enough for tracking under motion?
- Pass means: corner jitter of 1 px or less after smoothing, and the composite reads as filmed.
- Cost: 20 Flow credits on Google AI Pro (Veo 3.1 Fast), or 72 credits on Runway (Gen-4.5, 6 s).
- **If it fails:** the plan switches G2 to a locked-off plate with a digital push in compositing. Proven technique, smaller wow.

---

## 9. Pricing (official sources) and the one-month question

**Method.** This environment's network policy blocks direct access to runway.com, remotion.dev and google.com (HTTP 403 at the egress proxy). So:

- **Runway and Google:** read through web search restricted to their own domains (help.runwayml.com, runway.com, docs.dev.runwayml.com, academy.runwayml.com, gemini.google, support.google.com). These are official pages, but I read them as extracted text, not the live pages.
- **Remotion:** its licence was read directly from its official GitHub repository.

### Runway (web app and the connector I use)

| Fact | Value | Source |
| --- | --- | --- |
| Standard plan | $15 a month billed monthly; $12 a month billed yearly | runway.com/pricing |
| Standard credits | 625 a month | runway.com/pricing; help centre "Standard plan details" |
| Rollover | **None.** Standard, Pro and Unlimited monthly credits expire on the billing date; only Max carries them forward. Purchased credits never expire and are used after plan credits | Help centre "How do credits work?" and "Managing your subscription" |
| Gen-4.5 | **12 credits per second** (5 s = 60, 10 s = 120); 2 to 10 s per generation; 625 credits ≈ 52 s | Help centre "Creating with Gen-4.5"; runway.com/pricing |
| Gen-4 Turbo | 5 credits/s (help centre). The pricing page's "104 s from 625" implies about 6/s | Help centre "Creating with Gen-4 Video" |
| Veo 3.1 in Runway | 20 credits/s without audio, 40 with audio | academy.runwayml.com/models-pricing |
| Images | Gen-4 Image at 1080p: 8 credits; Nano Banana Pro at 2K: 20 credits | runway.com resources. **Confirmed by my own use:** the workspace went from 500 to 480 |

### Runway API (separate billing)

- Credits cost **$0.01 each** and are **completely separate from web-app subscription credits**.
- Rates: gen4.5 12 credits/s; gen4_turbo 5/s; veo3.1_fast 10/s silent, 15/s with audio.
- Source: docs.dev.runwayml.com/guides/pricing, and the help centre.
- The connector in this session draws on the **workspace's app credits**, not API credits. Verified from the balance change.

### Google AI Pro and Flow

| Fact | Value | Source |
| --- | --- | --- |
| UK price | **£18.99 a month** (the UK page in the search index was about 133 days old; check before buying) | gemini.google/gb/subscriptions |
| Flow credits | **1,000 a month**, no rollover | support.google.com/flow |
| Veo 3.1 Fast | **20 credits per clip** (4, 6 or 8 s) for non-Ultra users | support.google.com/flow |
| Veo 3.1 Quality | 100 credits per clip | support.google.com/flow |
| Watermark | Invisible SynthID always. The visible watermark is a **user toggle**, except in India, South Korea and Vietnam | support.google.com/flow |
| Programmatic access | **None from here.** You would operate the Flow web app | Verified (no connector, host blocked) |

### Can it be done in one £20 month?

| Route | Per month | What it buys for the 4 core shots | Verdict |
| --- | --- | --- | --- |
| **Google AI Pro (Flow), you operate it** | **£18.99** | 1,000 credits = 50 Veo 3.1 Fast clips of up to 8 s, or 10 Quality clips. 4 shots × 3 Fast drafts (240) + 4 Quality finals (400) = 640, with **360 to spare** for G5 or retakes | **Yes, comfortably.** Requires you to run about 16 to 20 generations from my prompts and start frames, then commit the files. Start frames can come from the free Runway credits (about 24 more 2K images available) |
| Runway Standard, I operate it | $15 (GBP depends on exchange rate and VAT) | 625 credits = 52 s of Gen-4.5 ≈ 10 clips of 5 s. 4 shots × 2.5 attempts at 6 s = 720 credits | **No margin, likely short.** Needs the CDN host allowed. Stretched to two months it's about $30 |
| Runway Standard drafts + Flow finals | Over £20 in that month | Not needed | Not recommended |

**Recommendation: one month of Google AI Pro at £18.99.** It is the cheapest realistic route that keeps the full visual ambition (Veo 3.1 Quality finals). The cost is about one evening of your time operating Flow.

**Free items:**

- Remotion, if eligible.
- Capture tooling, FFmpeg, fonts.
- Runway free credits for start frames and sound effects, once the download host is allowed.
- Your own Foley and VO.

**Music:** not covered by Flow. Use a library track you choose (free; licence to check), or a separate month later.

---

## 10. Remotion licence (official text, read directly from github.com/remotion-dev/remotion LICENSE.md)

The free licence covers:

- an individual;
- **a for-profit organisation with up to 3 employees**;
- a non-profit;
- anyone *evaluating* Remotion who isn't yet using it commercially.

It permits commercial use for creating videos. Anyone else needs a Company Licence (remotion.pro).

**Whether Spine qualifies, I can't verify.** It depends on who legally makes the film: you personally, a company of 3 or fewer employees, or a larger employer. The repository holds no company information. The proof-of-concept work so far falls under the evaluation clause.

**Question for you:** who is the legal entity behind Spine, and how many employees does it have?

---

## 11. Production plan

| Phase | Work | Spend | Depends on | Effort | Acceptance |
| --- | --- | --- | --- | --- | --- |
| **0 Proof-of-concept stage 1** | Plate in, screen detection, full 12 s render, inspection | £0 | Host allowed or plate committed | Under 1 session | Criteria (a) to (f) in section 8. **Go / no-go** |
| 0b Proof-of-concept stage 2 | One G2 image-to-video; tracking test | 20 Flow credits (inside the AI Pro month) | Phase 0 passes; you approve AI Pro | Under 1 session | Jitter ≤ 1 px, reads as filmed. **Go / no-go for moving plates** |
| 1 Capture | 4 new recordings plus 14 re-takes; mobile set | £0 | Your decision on canned demo text or real AI calls | 1 to 2 sessions | Every event frame matches section 3 |
| 2 Start frames | G1, G3 and G4 stills; cast references for Alex | Free Runway credits | Host allowed | Under 1 session | You approve the look |
| 3 Rough cut | Full 72 s timeline with stills as plates, temp VO and click track | £0 | 1, 2 | 1 session | You watch it on a phone and a laptop |
| 4 Plates | G1 to G4 in Flow, run by you from my prompt sheet | Inside the same AI Pro month | 3 approved | About 1 evening for you | The artefact review passes, or the fallback is used |
| 5 Composite and design | Tracking, T1 to T5, grade, typography, end card | £0 | 4 | 2 sessions | Section 6 rules met; frame QA passes |
| 6 Sound | Foley, VO, music, mix | £0 to music | Your Foley and VO, a music choice | 1 session plus your recording time | −14 LUFS, −1 dBTP, sync within ±1 frame. You listen |
| 7 Delivery | 72 s master, 60 s alternative, 30 s, 15 s, 9:16, stills, captions | £0 | 5, 6 | 1 session | Definition of done (below) |

**Definition of done:**

- Every mini-story's action, response and outcome is visible and readable.
- No invented UI, no AI scores, coming-soon features labelled, Acme numbers labelled.
- No plate shows visible AI artefacts.
- Composites pass criteria (a) to (e).
- Clean encodes: H.264 High, yuv420p, BT.709, 30 fps, AAC 48 kHz, −14 LUFS.
- Your watch-and-listen approval.

---

## 12. Risks (changed or new since the previous version)

| Risk | Impact | Mitigation |
| --- | --- | --- |
| **The network policy blocks Runway downloads** (new, verified) | Every Runway output (images, SFX) is unreachable | Allow the host, or you commit the files. Flow outputs are uploaded by you in any case |
| Generated motion bends the monitor plane | T1 composite swims | Stage 2 tests it before production. Fallback: a locked-off plate with a digital push |
| Canned AI text in Q2 and I1 looks fake | A weak AI story | One real Claude call each (pennies), if you allow |
| The single-line reply field crops text | Weaker S07 | Partial-typing capture; product fix recommended |
| I can't hear or perceive motion | Audio and pacing quality | Measurements plus your two reviews |
| Remotion licence | Cost | Your answer in section 10 |

---

## 13. Revised verdict: YES, WITH CONDITIONS

**What has changed since the previous proposal:**

1. **Generated shots cut from 11 to 4** (plus 1 optional), each chosen because a human moment carries story meaning that the UI can't.
2. **Length cut from 86 s to 72 s.** A 60 s alternative is specified, and I've stated what it sacrifices.
3. **The dive is used once.** Four other transitions are designed, and two of them (T3, T4) reuse proven code.
4. **Built and inspected, not just described:**
   - the animated product interaction (two defects found and fixed);
   - the dive maths and seamless handoff, on a labelled test card;
   - the screen detector, on synthetic data.
5. **New verified blocker:** Runway outputs can't be downloaded into this environment, which affects every Runway-based step. I didn't fake the missing photoreal element.
6. **Pricing re-verified against official sources.** No rollover on Runway Standard. API credits are separate. The connector uses workspace credits.
7. **The one-month answer is now yes,** through Google AI Pro (£18.99), at the cost of you operating Flow for about an evening. On Runway Standard, one month has no margin.
8. **Each feature now tells a complete mini-story**, and four missing recordings are identified, all capturable by me.
9. **The Remotion licence was read from source.** Eligibility depends on a fact only you know.
10. **A real product issue was found** during capture: the single-line reply field.

**Conditions:**

- (1) The proof-of-concept stage 1 passes once the plate can be read in.
- (2) Stage 2 proves rigid screens under generated motion, or we accept the locked-off fallback.
- (3) One month of Google AI Pro, with you running the generations.
- (4) A Remotion licence answer.
- (5) Your listening and viewing approval at the rough cut and at the mix.

**Confidence:**

- **8.5 / 10** for the product scenes and the interaction craft. They are rendered and inspected.
- **6 / 10** for the cinematic layer, until stage 1 and stage 2 are seen.
- **7 / 10** overall that this becomes a genuinely outstanding film. Up from 6, because the riskiest parts are now fewer, smaller and gated behind tests rather than assumed.
