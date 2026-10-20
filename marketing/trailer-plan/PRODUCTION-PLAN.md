# Spine launch trailer: production feasibility and master plan (revision 2)

Prepared 20 October 2026 for independent review. Nothing has been produced for delivery, deployed or purchased, and no paid API call was made. **Verified** means done or seen in this environment. **Unverified** means not.

Evidence is in `marketing/trailer-plan/evidence/`.

This revision builds the film from a blank page around the ambition in the brief: a cinematic launch film with realistic people and environments, the real Spine product as the star, and seamless transitions between the two.

---

## Contents

- A. Asset audit
- B. Creative concepts and selection
- C. Master storyboard (frame-timed)
- D. Cinematic and generative shot plan
- E. Technical production architecture
- F. Budget
- G. Risk assessment
- H. Production readiness
- I. Schedule, quality control and definition of done
- Final verdict for GPT-6

---

## A. Asset audit

### A.1 What I inspected and how

| Source | Location | How |
| --- | --- | --- |
| Trailer brief | `spine-2` branch, `marketing/ASTRA-BRIEF.md` | Read in full |
| 15 story clips | `spine-2` branch, `marketing/clips/*.mp4` | Probed with ffprobe. One frame per second tiled with timecodes (`evidence/contact-sheets/`). Frame-difference analysis at 30 fps to find the exact frame of every click and state change. Full-resolution frames of the end states |
| 18 screenshots | `spine-2` branch, `marketing/*.png` | Probed and viewed (`evidence/screenshots-*.jpg`) |
| Spine 2.0 application | `spine-2` branch | Source read (recording script, AI modules, integrations, logo, colour tokens). **Built, seeded and run locally**. One clip re-recorded with the repository's script. Stills captured at 3× and 4× device scale |
| Integrations | `docs/INTEGRATIONS.md` and app code | Read in full |
| Runway account | Runway connector in this session | `whoami` (read-only). Nothing generated |

### A.2 Story clips (real Spine 2.0, H.264, 2880 × 1620, 30 fps, no audio)

Measured traits common to all 15 clips:

- The first 2 to 11 frames are a blank, loading page. They are usable from about 0.4 s.
- The bitrate is very low (about 0.2 to 0.55 Mbps). At 1:1 the frames are clean. Pushed past about 2 output pixels per source pixel, text turns soft with JPEG artefacts (`evidence/sharpness-original-vs-rerecord-vs-dsf4.jpg`). The cause is the screencast JPEGs in the recording script.
- The layout is 1440 × 810 rendered at 2×. Most pages fill only the top 60% of the frame.
- After the decisive click, most clips hold the result for only 0.9 to 1.5 s.
- The cursor sometimes covers the key words.

| # | File | Length | Shows | Key events, s (frame) | Notes | Suitability |
| --- | --- | --- | --- | --- | --- | --- |
| 01 | 01-home-what-needs-you | 11.37 s | Alex's Home, "3 things need you" | Static. The cursor drifts 2.8 to 9.6 s. No click | Clean | Good, held still |
| 02 | 02-ask-a-question | 23.73 s | Priya asks "Can I put client contract data into Copilot?" | Modal 4.57 (f137); title 5.5 to 13.5; Ask 22.77 (f683); thread 22.87 (f686) | Slow typing | Usable, retimed |
| 03 | 03-champion-answers | 19.63 s | Mia claims the question and replies with the Copilot and Playbook rule | Claim about 7.47 (f224); reply typed 10.9 to 15.7 **in a single-line field that scrolls sideways**; Send 18.37 (f551) | The cursor covers "company" in the final bubble | Use the claim and bubble only |
| 04 | 04-answer-helps-someone-else | 16.73 s | Ben types a similar question; "Already answered?" suggests Priya's | Modal 4.07 (f122); **suggestion 9.17 (f275)**, held to the end | Clean | Strong |
| 05 | 05-approve-the-idea | 9.07 s | Approval of Supplier Research Assistant, "Auto-approves in 6h" | **Approve 8.03 (f241)**; Forming team 8.17 (f245) | Shows the "AI review raised concerns" banner; crop below it | Good |
| 06 | 06-someone-joins | 6.00 s | Jamie joins: 1 of 3 → 2 of 3 | **Join 4.93 (f148)**; result 5.07 (f152) | Short | Good |
| 07 | 07-plan-moves-forward | 14.40 s | "First drafted by AI from the brief" plan; tick; "Jamie is building the research template" | **Tick 7.93 (f238)**; new line 8.07 (f242) | Long hold | Very good |
| 08 | 08-blocked | 16.77 s | Blocked check-in → red banner | Blocked 6.97 (f209); typing 9.97 to 15.6; **banner 15.83 (f475)** | Clean | Good |
| 09 | 09-pulse-catches-it | 10.17 s | Pulse, the blocked project first, Open | **Open 8.97 (f269)** | "Blocked for 1 day" vs "since 7 Oct" on 7 Oct | Good |
| 10 | 10-unblocked | 13.40 s | "Alex got us the SAP export. Back on track." → the banner disappears | Click 12.40; **banner gone 12.53 (f376)** | Verified at full resolution | Good |
| 11 | 11-goes-live | 5.87 s | Mark Live → green Live dot | **Click 4.93 (f148)**; Live 5.00 (f150) | 0.87 s of result | Good |
| 12 | 12-team-reports-hours | 14.07 s | 18 requests, 15 instead of 55 minutes, 12 hours, Report | **Result 13.17 (f395)** | Long sentence | Good |
| 13 | 13-verified-outside-the-team | 9.53 s | Alex clicks Verify → "Verified by Alex Morgan on 7 Oct" | **Verify 8.53 (f256)**; result 8.63 (f259) | Small text | Good |
| 14 | 14-leadership-sees-it | 16.20 s | Leadership: 106 verified hours, chart, Went live (Supplier Research Assistant first) | Static; the cursor in the sidebar 6.6 to 13.8 | The best-composed screen | Good |
| 15 | 15-playbook | 8.43 s | Approved tools: Claude, Copilot "approved with limits", personal accounts not approved | Static | Clean | Insert |

### A.3 Screenshots

The 13 desktop screenshots are 2880 × 1800, plus 4 phone screenshots at 1170 × 2532 and Ben's Home.

Material in them that isn't in any clip:

- **Discover** (colleagues' discoveries).
- **Propose an idea with "Draft it"** (the AI drafts the proposal).
- **The Initiatives board.**
- **"Open Teams channel"** on an initiative.
- **The ⌘K search palette.**
- **Mobile layouts.**

Screenshot 11 (Leadership) shows 94 hours and must not be mixed with clip 14 (106). The Excel thread (03 and 21) is off-story.

### A.4 Brand (sampled from the Spine 2.0 CSS and rendered pixels)

| Token | Value | Film use |
| --- | --- | --- |
| nav (navy) | #0E1629 | Dark field, end card |
| canvas (warm off-white) | #FAF9F6 | Light field |
| text | #181A20 | Type |
| brand (cobalt) | #3B5BDB | The one thing to look at |
| logo-light | #81A0FF | Logo gradient top |
| live | #22C55E | The Live dot only |
| critical | #BE2D28 | The Blocked banner only |

- **Logo:** three rounded offset bars (24, 32 and 20 units wide), gradient from logo-light to brand, with an Inter semibold wordmark. Rebuilt as vector from `src/components/shell/Logo.tsx`.
- **Typeface:** Inter (installed here).

### A.5 Integrations (from `docs/INTEGRATIONS.md`)

- **Built:**
  - Slack channel posts and Teams channel posts (webhooks). Unit-tested; not tested against a real workspace or tenant.
  - The daily Pulse digest, approvals, new initiatives looking for a team and blockers posted to channels.
  - Teams and Slack channel links on an initiative.
  - Calendar `.ics` export.
- **Not built:** Slack DMs, Teams personal messages and check-ins, @mentions, channel creation, calendar write access, "@Spine" in Teams, "Send to Spine", and Claude proposing initiatives.
- **AI inside Spine (built, using Claude):**
  - Instant first answers on Help Desk questions.
  - "Draft it" for ideas.
  - The AI review.
  - The AI-drafted build plan.
  - "Update from meeting notes".
  - "Spotted by Spine" opportunities.

### A.6 Gaps

1. **The Help Desk AI first answer** isn't in the footage (the clips were recorded without an API key). It needs a capture. Its look on screen is unverified.
2. **The "Share the answer with your company?" consent panel** needs a capture.
3. **"Draft it" on Propose** needs a capture.
4. **Admin > Integrations** needs a capture.
5. **Holds after each click** are too short. Re-capture with dwell after every result.
6. **Sharp frames for zooms past 2×** need re-capture (verified possible; see E.2).
7. **Dates:** every clip says 7 October. Optionally re-capture with dates that progress (needs your approval).
8. **All cinematic footage, music, sound design and voice** have to be created.
9. **The "Book a demo" URL** wasn't supplied, so a placeholder is used.

---

## B. Creative concepts

Shared rules for all three:

- Real Spine 2.0 UI only. No fake product screens.
- One project throughout.
- No AI scores.
- AI drafts and people decide.
- Acme Group numbers are labelled demo data.
- Unbuilt features are labelled coming soon.
- Generated people never "use" invented software. Any screen they look at is either the real Spine UI composited in, or out of focus.

### Concept 1: "Through the Screen"

- **Central idea.** Spine lives between people. Each beat starts in a real-feeling moment of someone's working day (a train, a busy desk, a corridor, a boardroom). The camera then travels *through* that person's screen into the real product, and out again into the next person's world. One continuous journey links six people through one idea.
- **Hook.** Dusk, an empty office. A phone on a desk lights up with a message nobody answers. A meeting-room whiteboard with a half-erased "AI pilot" sketch. Silence. *"Most AI ideas don't fail. They go quiet."*
- **Visual language.**
  - World: natural light, 35 to 50 mm, shallow depth of field, slow motivated camera moves, real textures (worn desks, coffee cups, rain on windows), all graded to one navy-and-warm-white palette.
  - Product: crisp, full-frame, still during reads.
  - The bridge between them: the camera pushing into a screen until the real UI takes over the frame.
- **Structure.** Quiet → the turn (Alex: "3 things need you") → a question travels (Priya → Spine → Mia → Ben) → an idea travels (Louie → Alex → Jamie → the team) → it stalls and is rescued (Pulse) → it proves its value (a buyer, the verifier, the boardroom) → end card.
- **Editing.** Match cuts on the screen push-ins; hard cuts on the beat at act changes; still holds on every read.
- **Sound.** A 120 BPM minimal pulse score. World scenes carry rich room tone (train hum, office murmur, rain); the product is cleaner and closer. A heartbeat motif drops out when work stalls and returns when it's unblocked.
- **Product integration.** 70% of the running time is real UI. Every person's moment exists to hand off to the product.
- **Why it stands out.** Most SaaS films choose between people and screen recordings. This one makes the transition between them the signature. It also tells Spine's real story: a question or idea passing from person to person without being dropped.

### Concept 2: "Quiet until needed"

- **Central idea.** Spine's design principle as a film: stillness by default, action only when a human is needed.
- **Hook.** A single calm Home screen, the sound of breath.
- **Visual.** A gallery-like, full-frame UI with sudden macro pushes onto the one actionable element.
- **Editing.** Long stillness, then bursts.
- **Sound.** Mostly Foley.
- **Why.** Confident and unusual. It falls short on the brief's call for cinematic visuals, people and energy, and autoplay viewers may scroll past.

### Concept 3: "The Spine of the company"

- **Central idea.** Macro, architectural cinematography of a company building at dawn (corridors, stairwells, a lift shaft) forms a literal spine. Each floor holds a Spine moment, revealed by the camera rising through the building.
- **Visual.** Large-scale generated architecture, with UI composited onto glass walls and displays.
- **Why.** Spectacular when it works. But it needs long, complex, continuous generated camera moves, which are the hardest thing for current video models to keep consistent. Generation cost is several times Concept 1's, and putting UI on glass reduces readability.

### Selection: Concept 1, "Through the Screen"

- It fulfils every part of the ambition: cinematic people and places, creative camera moves, seamless transitions, the product as the star, and a "that's clever" moment (the dive through a screen into live UI).
- It keeps generated shots **short (2 to 3 s), simple and forgiving.** Those are the conditions where current models are most reliable.
- From Concept 2 it takes complete stillness during every UI read.
- From Concept 3 it takes the closing idea of the whole company connected: the end card's pull-back.

### Duration: 86 seconds (2580 frames at 30 fps, 120 BPM = 15 frames per beat, 43 bars)

- The cinematic beats add about 24 s of world footage on top of roughly 60 s of product.
- Shorter, and either the people become decoration or the product reads get rushed.
- Cutdowns: 45 s, 15 s and 9:16 (section C.3).

---

## C. Master storyboard

### C.0 Conventions

- **Frame rate and timecode:** 30 fps; `mm:ss.ff`; absolute frame numbers. Shot boundaries fall on the 15-frame beat grid.
- **Canvas:** master 1920 × 1080.
- **Shot types:**
  - **GEN:** a generated live-action plate.
  - **UI:** the real Spine capture, full frame.
  - **GEN→UI:** a plate whose screen carries composited real UI, with a dive-through into full-frame UI.
- **Zoom:** `z` = output pixels per logical UI pixel (1440 × 810 layout; full frame z = 1.333).
  - New 3× captures stay sharp up to z = 3.0 (verified).
  - The supplied clips stay sharp to about z = 2.0.
- **Readability:** the primary read is at least 30 px x-height at 1080p. When the UI text is small, a verbatim editorial line repeats it.
- **Hold rule:** the read lasts at least 0.6 s + words ÷ 3.5 s. The camera is completely still during reads.
- **Camera ease:** cubic-bezier(0.16, 1, 0.3, 1), 18 to 24 frames.
- **Editorial type:** Inter Display Semibold 64 px, −0.02 em tracking, white on navy or #181A20 on off-white, 120 px left margin. In world shots it sits bottom-left over a soft vignette.
- **Demo data:** "Acme Group · Demo data", 18 px, 60%, on every shot showing Acme numbers.
- **The dive-through transition (signature), over 24 frames:**
  - f0 to f12: the camera keeps pushing into the plate while the tracked UI composite on the screen grows.
  - f8 to f16: screen glare, reflections and bezel fade out, and the perspective flattens. The corner pin interpolates to a frontal rectangle.
  - f16 to f24: hand-off to the native full-frame capture at matched scale and position. A 2-frame cross-dissolve hides any residual offset.
  - The reverse (UI → world) runs the same in reverse.
- **"v2"** means the new capture beat (E.2). **"Fallback"** means the exact in/out in the supplied clips.

### C.1 Shot list

#### ACT 0: Quiet (00:00.00 to 00:06.00)

**S01 · 00:00.00 to 00:03.00 · 90 f (0 to 89) · GEN (G01)**

- **Purpose:** the hook. Company-wide, ideas going quiet.
- **Sees:** dusk, a nearly empty open-plan office. On a pale oak desk in the foreground, a phone lies face-up. At f30 it lights with a plain notification card (no readable text); at f70 it dims. Out-of-focus figures leave in the background.
- **Camera:** slow push-in, 3% over 90 f (generated, plus a 1% added in comp).
- **Text:** none.
- **VO:** none.
- **Sound:** room tone, HVAC, distant lift chime; a muted phone buzz at f30 with no follow-up. The music's pulse begins faint at f45.
- **Feels:** recognition, a little loneliness.
- **Connects:** the dimming screen glow matches the light in S02's window.

**S02 · 00:03.00 to 00:06.00 · 90 f (90 to 179) · GEN (G02)**

- **Sees:** an empty meeting room, morning. A whiteboard shows a half-erased hand-drawn sketch: boxes and an arrow, plus the words "AI pilot?" (lettering composited in comp so it's legible and consistent). Chairs pushed back, a cold coffee cup.
- **Camera:** a slow lateral dolly, left to right.
- **Text:** f95 to f140 "Most AI ideas don't fail." f140 to f179 "They go quiet." (white, bottom-left).
- **VO:** f95 to f170 "Every company is full of AI ideas. Most of them just go quiet."
- **Sound:** **true silence f150 to f172**, then a single soft inhale-swell.
- **Feels:** "That's us."
- **Connects:** a hard cut on f180 to the morning light of S03.

#### ACT 1: The turn (00:06.00 to 00:11.00)

**S03 · 00:06.00 to 00:11.00 · 150 f (180 to 329) · GEN→UI (G03 plus v2 H1)**

- **Purpose:** Spine tells you what needs you, calmly.
- **Sees:**
  - f180 to f240: Alex, who leads AI adoption, at a standing desk by a window with coffee, opens a laptop (medium shot from behind and to the side; the face is partly visible, not the subject). The laptop screen is a tracked grey plate showing the real Home capture.
  - f240 to f264: the dive-through into full-frame Home.
  - f264 to f290: glide to the headline.
  - f290 to f329: hold, z 2.6, on "Wednesday, 7 October / 3 things need you" and row 1 "Supplier Research Assistant · Auto-approves in 6h unless you review it · Review".
- **Camera:** a plate push-in, the dive, then a lock.
- **Source:** G03 plate; v2 H1 (Alex Home, 3× capture, no cursor). Fallback: clip 01 at 1.0 s, z ≤ 2.0.
- **Text:** none (the UI headline is the read).
- **VO:** f190 to f320 "Spine keeps them moving, and only asks for you when you're actually needed."
- **Sound:** the laptop-open Foley; the kick enters on f240 (bar 5) as the dive starts.
- **Feels:** calm control.
- **Connects:** a reverse dive out of the UI into S04's phone.

#### ACT 2: A question travels (00:11.00 to 00:32.15)

**S04 · 00:11.00 to 00:14.00 · 90 f (330 to 419) · GEN→UI (G04 plus v2 Q1m)**

- **Purpose:** anyone can ask, wherever they are.
- **Sees:** Priya on a commuter train, morning, holding a phone at chest height. An over-the-shoulder shot; the phone screen shows the real *mobile* Ask a question capture with the title being typed ("Can I put client contract data into Copilot?"). Rain-streaked window, passing light.
- **Camera:** a gentle handheld-style drift, then a push toward the phone from f390.
- **Source:** G04; v2 Q1m (mobile viewport 390 × 844 at 3×).
- **Text:** f340 to f419 "Ask what only your company can answer."
- **VO:** f335 to f410 "Ask the question only your company can answer..."
- **Sound:** train interior hum, soft key taps.
- **Note:** the phone UI is too small to read here by design. S05 delivers the read.
- **Connects:** the dive into the desktop-equivalent modal (S05). It's the same question at full size; the layout jump is hidden by the dive.

**S05 · 00:14.00 to 00:17.00 · 90 f (420 to 509) · UI (v2 Q1)**

- **Sees:** the Ask a question modal.
  - f420 to f450: the last words of the title type.
  - f450 to f509: hold, z 2.5, on the title and the privacy line "Only you and the Champion who picks this up can see the conversation." The privacy line gets a cobalt underline at f455.
  - Ask is clicked at f500.
- **Fallback:** clip 02 at 13.5 s (f405), z ≤ 2.0.
- **VO:** f425 to f500 "...privately."
- **Sound:** a click at f500.
- **Feels:** safe to ask.

**S06 · 00:17.00 to 00:19.15 · 75 f (510 to 584) · UI (v2 Q2, conditional)**

- **Sees:** Priya's thread, where Spine's instant first answer, drafted from the company Playbook, appears (as captured). Hold z ≈ 2.4.
- **Text:** "An instant first answer, from your own Playbook." This line is used only if the captured UI really reflects the Playbook rule.
- **VO:** f515 to f580 "Spine drafts a first answer from your rules..."
- **Fallback (if not approved, or weak):** Mia's Help Desk queue (clip 03 at 6.0 s), pushing to the Unclaimed row "Can I put client contract data into Copilot? · Claim".
- **Unverified:** how the answer looks on screen.
- **Connects:** a reverse dive out into Mia's monitor (S07).

**S07 · 00:19.15 to 00:22.00 · 75 f (585 to 659) · GEN→UI (G05 plus v2 Q3)**

- **Sees:** Mia, a Champion, at a busy desk with headphones round her neck, a plant, a second monitor. A medium shot from her side. Her main monitor (a tracked plate) shows the real Help Desk queue with Priya's question at the top. She leans in (f610), and the camera follows her eyeline into the screen: the dive at f630 to f654.
- **Text:** "A Champion who knows picks it up."
- **VO:** f590 to f655 "...and a Champion confirms it."
- **Sound:** office murmur fades to the product's cleaner sound as we dive.
- **Feels:** real people, real expertise.

**S08 · 00:22.00 to 00:26.00 · 120 f (660 to 779) · UI (v2 Q3)**

- **Sees:**
  - f660 to f680: Claim is clicked (real).
  - f680 to f700: the thread opens.
  - f700 to f779: Mia's reply bubble, held at z 2.3, reading "Not in Copilot yet: it's approved for internal data only until Legal signs off. Use the company Claude workspace, and replace client names first. It's all in the Playbook."
  - f740 to f779: a Playbook inset slides up (clip 15 at 2.0 s, the AI tools crop): "Microsoft 365 Copilot · Approved with limits · Internal data only for now...".
- **Fallback:** clip 03, claim f214 to f234; bubble frame f558 (the cursor covers one word).
- **Text:** "Answered with your company's own rules."
- **Sound:** a click and a soft "sent" tone.

**S09 · 00:26.00 to 00:28.00 · 60 f (780 to 839) · UI (v2 Q4)**

- **Sees:** the real panel "Your Champion suggested sharing this answer" with "Share summary". It's clicked at f805, and "Shared." appears. Hold z 2.4.
- **Text:** "Shared only when the asker agrees."
- **Fallback:** none exists. If it isn't captured, cut the shot and give its 60 f to S10.
- **Feels:** trust.

**S10 · 00:28.00 to 00:32.15 · 135 f (840 to 974) · GEN (G06, 30 f) then UI (v2 Q5)**

- **Sees:**
  - f840 to f869: weeks later. Ben at a hot desk, close on hands typing on a laptop keyboard. The screen is out of frame or defocused. Afternoon light.
  - f870: cut to UI. Ben's Ask modal; "Is client contract data OK in Copilot?" finishes typing.
  - f900: "Already answered?" with the link "Can I put client contract data into Copilot?" appears (real).
  - f905 to f920: push z 2.2 → 2.9.
  - f920 to f974: hold.
- **Fallback:** clip 04, suggestion at 9.17 s (f275), held on f285, z ≤ 2.0.
- **Text:** "The next person gets the answer before they finish asking."
- **VO:** f845 to f965 "Share it, and the next person gets the answer before they even finish asking."
- **Sound:** a rising chord resolves at f900. This is the "clever" beat.
- **Connects:** a hard cut on f975 to the act change.

#### ACT 3: An idea travels (00:32.15 to 00:51.15)

**S11 · 00:32.15 to 00:35.15 · 90 f (975 to 1064) · GEN→UI (G07 plus v2 I1)**

- **Sees:** Louie in Procurement. A desk stacked with supplier folders and printouts, the monitor (tracked plate) showing the real Propose an idea page. He pushes the papers aside (f985 to f1010) and types one sentence into "Describe your idea in a sentence" (the composite plays the real capture). The dive happens at f1040 to f1064.
- **Text:** "An idea from the people doing the work."
- **VO:** f980 to f1060 "Ideas come from the people doing the work."
- **Sound:** paper rustle, keys.

**S12 · 00:35.15 to 00:38.15 · 90 f (1065 to 1154) · UI (v2 I1)**

- **Sees:** Draft it is clicked at f1070 (real); the form fields fill (as captured); hold z 2.0 on the filled Name and Problem fields.
- **Text:** "Describe it in a sentence. Spine drafts the proposal."
- **Fallback (if the AI beats aren't approved):** screenshot 12 for 30 f, then S13 extended.
- **Unverified:** the look and the drafted text. Whatever the drafted text says is used unedited.

**S13 · 00:38.15 to 00:41.15 · 90 f (1155 to 1244) · UI (v2 I2)**

- **Sees:**
  - f1155 to f1195: the approval view, cropped below the AI-concerns banner, z 2.2, then glide to "Auto-approves in 6h · Auto-approves today at 16:00".
  - f1200: Approve (real).
  - f1205 to f1244: the stepper reads **Forming team**, "Needs 2 more people to start".
- **Fallback:** clip 05, f236 to f245 at real speed, the hold frozen on f270.
- **Text:** "Leadership decides in one click. Or it auto-approves."
- **VO:** f1160 to f1240 "Leadership decides, and nothing waits forever."

**S14 · 00:41.15 to 00:44.00 · 75 f (1245 to 1319) · UI (v2 I3)**

- **Sees:** the Team tab, "1 of 3 people". Join the team is clicked at f1270 (real); "2 of 3 people · Jamie Chen · Member" appears. Push z 2.2 → 2.6; hold.
- **Fallback:** clip 06, f120 to f160, then hold f179.
- **Text:** "The right people join."
- **Sound:** a warm two-note tone on the join.

**S15 · 00:44.00 to 00:49.00 · 150 f (1320 to 1469) · UI (v2 I4)**

- **Sees:**
  - f1320 to f1360: the Plan tab, z 1.8. "First drafted by AI from the brief" is underlined at f1335; six steps with LM, JC and SK avatars.
  - f1365: a step is ticked (real).
  - f1375 to f1395: glide up.
  - f1395 to f1469: hold, z 2.8, on "Jamie is building the research template / At the current pace: on track, finishing around 11 Nov".
- **Fallback:** clip 07, tick f230 to f245, hold f270, z ≤ 2.0.
- **Text:** "AI drafts the plan. People own every step."
- **VO:** f1325 to f1460 "Spine drafts the plan. Every step has an owner, and everyone knows what's next."
- **Connects:** a reverse dive out of the UI to the team table.

**S16 · 00:49.00 to 00:51.15 · 75 f (1470 to 1544) · GEN (G08)**

- **Sees:** the team (Louie, Jamie, Sarah) around a small table with laptops and a sketch pad, mid-conversation; one points at a laptop (the screen is out of focus). Warm late-afternoon light. Faces in three-quarter view, medium-wide.
- **Camera:** a slow arc of about 10°.
- **Text:** none.
- **Sound:** an energised murmur; the music builds into bar 26.
- **Feels:** momentum, people together.
- **Connects:** a hard cut on f1545 to the act change; the music cuts out on f1580.

#### ACT 4: It stalls, and Spine notices (00:51.15 to 01:04.00)

**S17 · 00:51.15 to 00:54.15 · 90 f (1545 to 1634) · UI (v2 P1)**

- **Sees:**
  - f1545 to f1565: the check-in card, Blocked selected (real).
  - f1565 to f1575: the note appears: "We need the approved supplier list exported from SAP. Who can get it for us?"
  - f1578: Check in.
  - f1580 to f1634: the red banner "Blocked since 7 Oct: ...", held at z 2.4.
- **Fallback:** clip 08, f205 to f215; typing retimed; banner f475; hold f502.
- **Text:** "Work gets stuck."
- **VO:** f1550 to f1585 "Then it gets stuck."
- **Sound:** **the music drops out at f1580**; a low flat tone at −30 dB under room tone.
- **Feels:** this is where ideas die.

**S18 · 00:54.15 to 00:58.00 · 105 f (1635 to 1739) · UI (v2 P2)**

- **Sees:**
  - f1635 to f1660: Alex's Pulse: "Anything blocked, waiting or going quiet across your AI programme. It's also posted to your team channel each morning."
  - f1660 to f1680: glide.
  - f1680 to f1739: hold, z 2.5, on "Supplier Research Assistant · Blocked for 1 day: We need the approved supplier list exported from SAP... · Open".
  - Open is clicked at f1735.
- **Fallback:** clip 09 at 1.0 s, held, plus the Open click f269.
- **Text:** "Spine notices, and tells someone who can help."
- **VO:** f1640 to f1730 "Spine notices, and brings it to someone who can help."
- **Sound:** a single heartbeat at f1700.

**S19 · 00:58.00 to 01:00.15 · 75 f (1740 to 1814) · GEN (G09)**

- **Sees:** Alex walks through the office (a tracking shot from behind and the side) to a colleague's desk, leans down and talks briefly. The colleague nods and turns to their keyboard. The screens are defocused.
- **Camera:** a smooth follow, then a stop.
- **Sound:** footsteps, a quiet word (an unintelligible murmur, no dialogue), keys.
- **Feels:** a human steps in. Spine prompted it; a person did it.
- **Connects:** a match cut on the colleague's keystroke to Louie's check-in.

**S20 · 01:00.15 to 01:04.00 · 105 f (1815 to 1919) · UI (v2 P3)**

- **Sees:**
  - f1815 to f1845: Louie's check-in, On track, "Alex got us the SAP export. Back on track."
  - f1850: Check in.
  - f1853: **the red banner disappears** (real).
  - f1860 to f1919: hold, z 2.3, on "Jamie is building the research template".
- **Fallback:** clip 10, click f372, banner gone f376, hold f401.
- **Text:** "Someone steps in. It moves again."
- **VO:** f1820 to f1910 "Someone steps in, and it moves again."
- **Sound:** **the music returns on f1860 at full strength.** The emotional peak.

#### ACT 5: It proves its value (01:04.00 to 01:19.15)

**S21 · 01:04.00 to 01:06.15 · 75 f (1920 to 1994) · UI (v2 L1)**

- **Sees:** "You're launching this · Mark Live →", z 2.4. The click at f1945 (real); the full stepper and a green "● Live" (real). Push z 2.4 → 3.0; hold.
- **Fallback:** clip 11, f140 to f150, hold f175.
- **VO:** f1925 to f1975 "It goes live."
- **Sound:** a bright chime on the Live frame.

**S22 · 01:06.15 to 01:08.15 · 60 f (1995 to 2054) · GEN (G10)**

- **Sees:** a Procurement buyer at a sunny desk, with a supplier folder closed beside them. They glance at the laptop (the screen is out of focus) and give a small satisfied nod, then reach for a coffee.
- **Camera:** a slow push.
- **Purpose:** what became useful, and for whom. No product UI is shown, because the assistant itself isn't part of Spine.
- **Text:** "For the Procurement team: 15 minutes instead of 55." This is verbatim from the team's own reported measurement in S23, and the demo-data note shows.
- **Sound:** a light office ambience.

**S23 · 01:08.15 to 01:12.00 · 105 f (2055 to 2159) · UI (v2 L2)**

- **Sees:**
  - f2055 to f2095: the Outcomes sentence (retimed) "Six buyers used it on 18 supplier requests; each one took 15 minutes instead of 55 (timed in October)." with Hours 12 → Report.
  - f2100 to f2159: the report row "October 2026: 12 hours saved · Not verified yet".
  - From f2105 an equation builds from the captured numbers: "18 requests × 40 minutes saved = 12 hours".
- **Fallback:** clip 12, result f395, hold to f421.
- **VO:** f2060 to f2150 "The team reports what it saved, and how they measured it."

**S24 · 01:12.00 to 01:14.15 · 75 f (2160 to 2234) · UI (v2 L3)**

- **Sees:** Verify is clicked at f2185 (real); "Verified by Alex Morgan on 7 Oct". Push z 2.6 → 3.0; hold.
- **Fallback:** clip 13, f250 to f260, hold f285.
- **Text:** "It only counts once someone outside the team verifies it."
- **VO:** f2165 to f2230 "It only counts once someone outside the team checks it."
- **Sound:** a low confident "stamp".

**S25 · 01:14.15 to 01:19.15 · 150 f (2235 to 2384) · GEN→UI (G11 plus v2 L4)**

- **Sees:**
  - f2235 to f2290: a boardroom, morning. Two or three senior leaders in soft focus look at a large wall display (a tracked plate) showing the real Leadership screen.
  - f2290 to f2314: the camera pushes past them into the display; the dive.
  - f2314 to f2340: full-frame Leadership (z 1.333), and the chart line is revealed by a left-to-right wipe mask over the real captured chart. No new data.
  - f2340 to f2384: glide to "Went live · ● Supplier Research Assistant · ... · 7 October", z 2.4, hold.
- **Fallback:** clip 14 at 2.0 s.
- **Text:** "Leaders see what AI actually delivered.", plus the demo-data note.
- **VO:** f2240 to f2375 "And leadership finally sees what AI is really delivering."
- **Sound:** a boardroom hush, then the music lifts.

#### ACT 6: Integrations and the promise (01:19.15 to 01:26.00)

**S26 · 01:19.15 to 01:22.00 · 75 f (2385 to 2459) · UI (v2 X1)**

- **Sees:**
  - f2385 to f2430: Admin > Integrations (Slack and Teams channel rows and the last-delivery status), z 2.0, with the initiative header crop "Link your Teams or Slack channel · Calendar" sliding in beneath.
  - f2430 to f2459: the plane dims, and a grey line with an outlined "Coming soon" label reads "Spine inside Teams chat, Slack and Claude".
- **Fallback:** clip 07 header crop only.
- **Text:** f2390 to f2430 "Posts to your Slack and Teams channels. Plans go straight into your calendar."
- **VO:** none, so the coming-soon line isn't heard as a claim.

**S27 · 01:22.00 to 01:26.00 · 120 f (2460 to 2579) · Motion graphics plus all plates**

- **Sees:**
  - f2460 to f2500: a fast pull-back reveals the six people's moments (frozen frames from G03, G04, G05, G07, G08 and G11) and their Spine screens arranged in three offset rows, matching the logo bars' proportions, linked by a fine cobalt line.
  - f2500 to f2520: the rows collapse into the logo.
  - f2520 to f2579: the end card on navy: the "Spine" logo; "Where your company's AI ideas get answered, built and proven." (f2525); an outlined "Book a demo" and "[URL TBC]" (f2540).
- **VO:** f2525 to f2575 "Spine. Where your company's AI ideas get answered, built and proven."
- **Sound:** the final heartbeat at f2500, then the resolve and a tail; silence on the last 8 frames.

### C.2 Timing self-check

- **Real UI on screen:** 1830 of 2580 frames (71%), counting composited screens.
- **World shots:** 750 frames (29%) in 11 plates, each 2 to 3 s.
- **Shots below the hold rule:** S05 (rescued by type plus VO), S09 and S14. If the rough cut shows they're too fast, drop S12 (Draft it) and give its 90 f to S09 and S14.

### C.3 Cutdowns

- **45 s:** S01, S02 (half), S03, S07, S08, S10, S13, S15, S17, S18, S20, S21, S24, S25, S27.
- **15 s:** S03 (UI part), S10 (UI part), S20, S25 (UI part), S27.
- **9:16:** world plates generated (or re-framed) at 9:16, with the UI re-captured at the mobile viewport so it fills the vertical frame natively.
- **Stills:** S07 (Mia at her monitor, composite), S10 (Already answered?), S25 (boardroom).

---

## D. Cinematic and generative shot plan

### D.1 Approach

- **Only short, simple, forgiving shots.** 2 to 3 s used, from 5 s generated; slow camera; no dialogue or lip sync; faces medium or three-quarter, never extreme close-ups; hands only when they rest or type.
- **Consistent cast.** For each of the six people (Alex, Priya, Mia, Ben, Louie, Jamie, plus Sarah in the group shot), first generate a **reference still** with an image model (Runway `nano-banana-pro`, available on your workspace). Every video shot then starts from a start frame composed with that reference (image-to-video), not from text alone. Wardrobe and hair are locked per person.
- **Screens are composited, never generated.** Prompts ask for a flat, evenly lit, mid-grey (#808080) screen. The real UI is pinned onto it in compositing (D.3).
- **One look.** Every plate is graded through one LUT (navy shadows, warm off-white highlights, gentle contrast, fine grain), applied in FFmpeg (`lut3d`) or Remotion, so world and UI belong together.
- **Model choice (through Runway, the only generator I can drive from here, after an upgrade):**
  - **Drafts:** Gen-4 Turbo (needs a start image).
  - **Finals:** Gen-4.5, or Kling 3 Standard as an alternative.
  - Veo 3.1 only for the hero boardroom dive (S25) if needed.
  - Credit rates below are from third-party sources and **unverified** (see F).
- **Upscaling:** Gen-4.5 and Kling 3 Standard output 720p. Plates are shallow-depth-of-field and get upscaled to 1080p (Runway upscale, cost unverified, or a local Lanczos with light sharpening). Text never lives in a plate, so upscale softness is tolerable.

### D.2 Shot specifications

Every prompt ends with this shared style tail, **[STYLE]**: "Shot on a full-frame cinema camera, natural available light, shallow depth of field, subtle film grain, realistic skin and fabric texture, muted navy and warm off-white palette, premium technology commercial, no text, no logos, no watermarks."

| ID | Shot | Why generative improves it | Model | Duration (generated → used) | Ratio | Prompt (plus [STYLE]) | Connects to Spine | Likely failures | Fallback |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| G01 | S01 phone at dusk | Sets the real-world stakes with no people needed | Gen-4.5 from a start frame | 5 → 3 s | 16:9 | "Locked-off shot with a very slow push-in, 35mm. A smartphone lies face-up on a pale oak desk in an open-plan office at dusk. Cool blue window light, warm lamps far in the background, blurred colleagues leaving. The phone screen lights with a plain white notification card, glows, then dims to black." | Its dimming glow matches S02's light | Readable fake text on the phone; flicker | Mask the screen with a clean comp card; or use a still start frame with a light animation in comp |
| G02 | S02 meeting room | Emotional "quiet" | Gen-4.5 | 5 → 3 s | 16:9 | "Slow lateral dolly left to right across an empty modern meeting room in soft morning light. Chairs pushed back from the table, a half-finished coffee cup, a whiteboard with a faint half-erased marker sketch of boxes and arrows." | Its whiteboard lettering is composited | Warped chairs; gibberish writing on the board | Generate the board blank and comp the sketch; or a static still with parallax |
| G03 | S03 Alex opens a laptop | The turn: a human starts the day with Spine | Gen-4.5 (Veo 3.1 if Gen-4.5 fails) | 5 → 2 s | 16:9 | "Medium shot from behind and slightly to the side of [Alex reference] at a standing desk by a large window, morning. They set down a coffee and open a thin silver laptop. The laptop screen is a flat, evenly lit pure mid-grey rectangle facing the camera at a slight angle, crisp edges. The camera pushes slowly toward the screen." | Dives into Home | The screen bends or isn't grey; hand artefacts on the lid | Start from an already-open laptop (no hand action) and push only |
| G04 | S04 Priya on a train | Anyone, anywhere | Gen-4.5 | 5 → 3 s | 16:9 | "Over-the-shoulder shot of [Priya reference] seated by the window on a commuter train, morning, rain streaks on the glass, soft passing light. They hold a phone at chest height; the phone screen is a flat, evenly lit mid-grey rectangle. Subtle natural motion of the train." | The mobile UI is composited, then the dive | Phone geometry drift; extra fingers | Phone resting on a table instead of in the hand |
| G05 | S07 Mia at her desk | The expert human | Gen-4.5 | 5 → 2.5 s | 16:9 | "Medium side shot of [Mia reference] at a lived-in office desk with headphones around the neck and a plant. The large monitor in front is a flat, evenly lit mid-grey rectangle. They lean in toward the monitor with interest. The camera eases toward the monitor." | The Help Desk queue is composited, then the dive | The monitor plane warps as she leans | Lock the camera; she leans only slightly |
| G06 | S10 Ben's hands typing | "Weeks later", a new person | Gen-4 Turbo | 5 → 1 s | 16:9 | "Close shot of hands typing on a laptop keyboard at a hot desk, afternoon side light, a notebook and pen beside them; the screen is out of frame." | A cut to the Already answered UI | Bad hands | Use a different angle, or drop the plate and start S10 on UI |
| G07 | S11 Louie in Procurement | Where the idea comes from | Gen-4.5 | 5 → 2.5 s | 16:9 | "Medium shot of [Louie reference] at a desk crowded with supplier folders and printed spreadsheets, late morning. They push a stack of papers aside and pull the keyboard closer. The monitor is a flat, evenly lit mid-grey rectangle angled toward the camera." | The Propose page is composited, then the dive | The papers morph; the monitor drifts | Lock the camera; remove the paper action |
| G08 | S16 team table | Collaboration made visible | Gen-4.5 | 5 → 2.5 s | 16:9 | "Medium-wide shot with a slow 10-degree arc around a small table where [Louie], [Jamie] and [Sarah references] work together with laptops and a sketch pad, late-afternoon warm light. One points at a laptop screen that is out of focus. Natural, engaged conversation without speaking to camera." | Leads into the stall | Inconsistent faces with 3 references; merging bodies | Two people, not three; a static camera |
| G09 | S19 Alex steps in | The human response to Pulse | Gen-4.5 | 5 → 2.5 s | 16:9 | "Tracking shot following [Alex reference] from behind and to the side as they walk through a bright open office to a colleague's desk, lean down and speak briefly; the colleague nods and turns to their keyboard. Screens are out of focus." | Match-cut to the unblock | Walk cycles; the second person's consistency | Shorter: only the lean-in and nod |
| G10 | S22 buyer benefits | What became useful, for whom | Gen-4.5 | 5 → 2 s | 16:9 | "Slow push-in on a procurement buyer at a sunny desk with a closed supplier folder beside them. They glance at an out-of-focus laptop, give a small satisfied nod and reach for their coffee." | Bridges Live to Outcomes | Over-acted expression | Hands and coffee only |
| G11 | S25 boardroom | The leadership payoff | Veo 3.1 (fallback Gen-4.5) | 8 → 2 s | 16:9 | "Morning in a glass-walled boardroom. Two senior leaders sit in soft focus in the foreground looking at a large wall-mounted display. The display is a flat, evenly lit mid-grey rectangle with a thin black bezel, viewed slightly off-axis. The camera dollies slowly forward between them toward the display." | The Leadership screen is composited, then the dive | The display plane warps during the dolly | A static camera with a digital push in comp |

### D.3 Compositing real UI into plates

1. **Track:** the screen is a uniform grey quad, so I detect it in each frame (OpenCV threshold, contour, `approxPolyDP` to 4 corners), smooth the corners over time, and hand-correct the outliers. OpenCV is installable from PyPI here; **not yet tested**.
2. **Pin:** the real UI frame for that moment (from the capture manifest) is mapped through a CSS `matrix3d` corner pin in Remotion.
3. **Integrate:**
   - Match the screen's black and white levels to the plate.
   - A 0.5 to 1.5 px blur matched to the plate's focus.
   - Add the plate's own luminance from inside the screen region back at 10 to 15% (reflections and fingerprints).
   - A subtle bloom on bright UI.
   - Matched grain on top.
   - A light 1 px chromatic edge on the bezel only.
4. **Occlusion:** if a hand or head crosses the screen, rotoscope a matte (Runway `remove_video_background` on the plate, paid, or a manual mask). Better: choose plates where nothing crosses the screen.
5. **The dive:** the S-curve in C.0.

The result must read as filmed, not layered. Any composite that fails review is replaced by its fallback.

---

## E. Technical production architecture

### E.1 Pipeline

```
Spine 2.0 app, local (seeded, fixed clock)
  └─ capture-v2 (Playwright): frame-stepped PNGs at 3× desktop and mobile, plus a manifest
Runway (via MCP from this session)
  └─ cast reference stills → start frames → plates (drafts, then finals) → optional upscale
OpenCV: screen-quad tracking → corner data
Remotion: plates, UI composites, dive transitions, camera, type, line, end card
Audio: VO, Runway sound effects, music → FFmpeg mix and loudness
FFmpeg: grade LUT, encode masters and cutdowns
QA: frame extraction, contact sheets, automated checks, human review
```

### E.2 Capture v2 (verified feasible)

- **Verified:**
  - PostgreSQL 16 run locally.
  - Migrations, seed, `next build` and `next start`.
  - The repository's own clip recorder re-recorded clip 01.
  - Home captured at 4× (5760 × 3240).
  - Typing captured frame by frame at 3× (4320 × 2430, lossless PNG) at **0.44 s per frame**.
  - Everything shut down and cleaned afterwards.
- **Method:** per beat, reset the data, optionally set `SPINE_TODAY`, log in as that person, drive the UI step by step with a screenshot after each step, add dwell frames after each result, and write a manifest. The cursor is rendered in Remotion from the manifest, so it can be hidden during reads.
- **AI beats:**
  - Option 1: dev fixtures (`SPINE_AI_FIXTURES=1` under `next dev`). Canned text.
  - Option 2: one or two real Claude calls on your key (a few pence, unverified).
  - The UI look of both is unverified.
- **Mobile:** the same script at a 390 × 844 viewport, 3× (1170 × 2532), for S04 and the vertical cut.

### E.3 Remotion (verified)

- `remotion@4.0.537` installed here. A 3 s 1080p test with a push-in on real footage rendered in 41.8 s on CPU, and its frames were inspected.
- Full master render time is estimated at 20 to 40 minutes. Not measured.
- **Licence:** free for individuals, companies with up to 3 employees, and non-profits; otherwise from $25 per month per seat (Remotion's pricing page). **I don't know which applies to you.**

### E.4 What I can and cannot do here

| Task | Here? | Status |
| --- | --- | --- |
| Inspect sources, run the app, re-capture UI | Yes | Verified |
| Build and render Remotion; inspect frames | Yes | Verified |
| Generate images (cast references, start frames) through Runway | Yes, on your workspace (image models listed) | Available; per-image cost not shown to me; not used |
| Generate video through Runway | **Only after you upgrade** (no video models on a free workspace) | Verified gated |
| Generate sound effects through Runway | Yes, 1 credit per second, free plan | Verified available, not used |
| Generate music through Runway | Only on a paid plan | Verified gated |
| Veo, Kling or Grok Imagine directly | No (no keys or connectors); only you, via their web apps | Verified absence |
| Track screens with OpenCV | Probably (PyPI reachable) | Untested |
| Encode H.264 or ProRes, measure loudness | Yes | Tools present |
| Hear audio, or perceive motion as a viewer | **No** | Limitation |

---

## F. Budget

Runway credit rates are from third-party sources and unverified on runway.com:

| Model | Rate | Notes |
| --- | --- | --- |
| Gen-4 Turbo | about 5 credits/s | Needs a start image |
| Gen-4.5 | about 12 credits/s | 720p |
| Kling 3 Standard | about 9 credits/s, silent | 720p |
| Veo 3.1 | about 20 credits/s silent | 1080p needs 8 s |
| Runway Standard plan | 625 credits a month | $15 billed monthly |

### F.1 Generation estimate (11 plates)

| Item | Calculation | Credits |
| --- | --- | --- |
| Cast references and start frames | about 40 images | Cost not visible to me |
| Drafts (Gen-4 Turbo) | 11 shots × 2 tries × 5 s × 5 | about 550 |
| Finals (Gen-4.5) | 11 × 1.5 tries × 5 s × 12 | about 990 |
| G11 on Veo 3.1 | 2 tries × 8 s × 20 | about 320 |
| Music (Lyria through Runway) | about 5 tries × 8 | about 40 |
| Sound effects | about 120 s × 1 | about 120 (free plan covers this today) |
| **Total** | | **about 2,000 credits plus images** |

That is **about 3 to 4 months of Runway Standard at $15 a month**, within your £20-a-month cap, with production paced to the monthly credit refill. Alternatively, one month of Pro (2,250 credits, about $35) would do it at once, but that's over the cap.

### F.2 Itemised

| Item | Cost | Verified? |
| --- | --- | --- |
| Claude Code | Existing | n/a |
| Runway Standard, 3 to 4 months | $15 a month (GBP depends on exchange rate and VAT) | Third-party price |
| Remotion | $0 if eligible, else from $25 a month | Your eligibility unknown |
| Capture, FFmpeg, Playwright, Inter | $0 | Verified installed |
| Voice | $0 with your own recording or local TTS; ElevenLabs Starter about $5 to $6 a month | TTS unverified here; price third-party |
| Claude API for the AI-beat captures | Pennies | Unverified |

### F.3 Alternatives I can't drive myself

- **Google AI Pro / Flow:** about $19.99 a month, 1,000 credits, and reportedly about 50 Veo Fast clips. You would generate in the web app and upload. A visible watermark on Pro is reported for 2025; current status unverified.
- **Kling Standard:** about $7 to $10 a month, web only.

Both are faster if you're willing to operate them. Prompts and start frames from this plan transfer directly.

---

## G. Risk assessment

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| 1 | Generated people look synthetic or "stock AI" | Medium to high | High | Short shots, no close-ups or dialogue, reference-locked cast, one grade, strict review. Any shot that fails is replaced by its fallback |
| 2 | Cast inconsistency between shots | Medium | High | Reference stills and start frames; one person per shot except G08 |
| 3 | Screen planes warp, so composites swim | Medium | High | Prefer locked cameras with a comp push; drop the plate if tracking fails |
| 4 | Budget runs out before the plates pass | Medium | Medium | Drafts on the cheapest model first; finals only for approved drafts; spread over months |
| 5 | Credit costs differ from the third-party figures | Medium | Medium | One cheap test generation after upgrading, to measure real costs before planning further |
| 6 | 720p plates look soft in a 1080p master | Medium | Medium | Shallow-depth-of-field plates, upscaling, and no text in plates |
| 7 | I can't hear audio | Certain | High | You review the mix; I measure loudness and sync |
| 8 | I can't perceive motion as a viewer | Certain | High | Rough cut and final reviewed by you on a phone and a laptop |
| 9 | AI-beat UI (S06, S12) looks weak | Medium | Medium | Fallbacks specified |
| 10 | Remotion licence cost | Unknown | Medium | Confirm eligibility first |
| 11 | Claims overstate integrations or AI | Low to medium | High | Every line checked against INTEGRATIONS.md and the code |

---

## H. Production readiness

**Verified:**

- All source footage, screenshots, the app, the brand tokens and the integrations facts.
- Local re-capture at 3× and 4×.
- Remotion rendering and frame inspection.
- Runway access (image and sound effects now; video and music after an upgrade).

**Missing:**

- All 11 world plates and the cast references.
- Captures Q2, Q4, I1 and X1.
- Dwell frames for all clicks.
- Music, voice and the demo URL.

**Unverified:**

- Runway paid-plan costs and quality per model.
- OpenCV tracking on generated plates.
- The look of the AI-beat UI.
- Full render times.
- All third-party prices.
- Remotion eligibility.
- Local TTS install.

---

## I. Schedule, quality control and definition of done

### I.1 Decisions needed once, up front

1. Upgrade Runway to Standard (about $15 a month) when phase 3 starts, and keep it for about 3 to 4 months, or operate Veo or Kling yourself.
2. Approve re-capturing the product locally. Optional: progressing dates.
3. AI beats: canned fixtures, real Claude calls, or skip them.
4. Voice: your own recording (best and free), local TTS, or ElevenLabs.
5. Remotion licence eligibility.
6. Approve using free Runway credits on cast reference stills and sound effects.

### I.2 Phases

| Phase | Work | Deliverable | Depends on | Effort | Acceptance |
| --- | --- | --- | --- | --- | --- |
| 1 Capture | All UI beats at 3× (desktop and mobile), plus a manifest | PNG sequences and contact sheets | Decisions 2 and 3 | 1 to 2 sessions | Every event frame matches C.1; no loading frames or cursor |
| 2 Cast and frames | Reference stills for each person; start frames for G01 to G11 | A cast sheet and 11 start frames | Decision 6 | 1 session | ◆ You approve the cast and the look |
| 3 Rough cut | Remotion timeline with UI, start frames as placeholder plates, temp VO and click track | A 540p rough cut | 1 and 2 | 1 session | ◆ You watch it on a phone and a laptop |
| 4 Plates | Drafts → finals for G01 to G11, credit-paced over months | Approved plates | Decision 1 | 3 to 4 months elapsed, about 1 session each month | The I.3 artefact check passes, or the fallback is used |
| 5 Composite and design | Tracking, pins, dives, grade, type, end card | A 1080p picture lock | 3 and 4 | 2 sessions | The I.3 checks pass |
| 6 Sound | VO, sound effects, music, mix | Master audio | Decision 4 | 1 session | −14 LUFS, −1 dBTP, sync within 1 frame. ◆ You listen |
| 7 Delivery | Master, 45 s, 15 s, 9:16, stills, SRT | Files and a QA report | 5 and 6 | 1 session | I.4 |

Everything except the three ◆ reviews runs without further approvals.

### I.3 Quality control

1. **Product accuracy:** every UI pixel comes from a manifest capture. A script compares rendered UI regions against their source frames. Every claim line is checked against the code or the integrations doc.
2. **Feature coverage:** Help Desk (ask, AI first answer, Champion, consent, Already answered); Ideas (draft, approve or auto-approve, join, AI plan); Collaboration (six people acting); Pulse (stall, flag, unblock); Live, report, verify, leadership; Integrations (built versus coming soon). Each is ticked only after review.
3. **Readability:** text height computed from font size × z; phone check at 390 px wide.
4. **AI artefacts (plates):** review at 6 fps for hands, faces, warping, morphing, fake text, flicker and cast mismatch. Any doubt means a regenerate or the fallback.
5. **Compositing:** corner error of 1 px or less after smoothing; levels, blur and grain match; no edge halo; checked on extracted frames at 200%.
6. **Timing:** automated checks at every boundary and keyframe in C.1; human review at the rough cut and final.
7. **Sound (measured):** loudness, peaks, sound effects within ±1 frame of the clicks.
8. **Iteration:** re-render the changed shots only; log what changed and why.

### I.4 Production-ready means

- Every coverage item is ticked.
- Every read passes the readability rule, or carries its verbatim line.
- There is no invented UI, no AI scores, and no unlabelled future features. Acme numbers are labelled.
- No plate shows visible AI artefacts.
- Every composite reads as filmed.
- Clean encodes: H.264 High, yuv420p, BT.709, 30 fps, AAC 48 kHz, −14 LUFS.
- You have watched and listened and approved.

---

## FINAL VERDICT FOR GPT-6 — INDEPENDENT REVIEW REQUEST

GPT-6, I'm handing you this production plan for an independent assessment. Please review it critically.

**1. Can I actually build this trailer?**
**YES, WITH CONDITIONS.** The conditions:

- A paid Runway plan for the 11 cinematic plates, paced over about 3 to 4 months to stay under £20 a month.
- Human review of audio and motion, which I can't perceive.
- Confirmation of the Remotion licence.

**2. What I have personally verified:**

- I read the brief, the AI code and the integrations doc.
- I timed every click and result in all 15 clips frame by frame and viewed all screenshots.
- I built and ran Spine 2.0 locally and re-recorded footage.
- I captured lossless 3× and 4× UI frames.
- I rendered a Remotion 1080p test and inspected its frames.
- I confirmed my Runway access: images and sound effects now, video and music only on a paid plan.

**3. What I can execute myself:**

- All UI capture.
- Cast reference images and start frames.
- All Runway video generation once the plan is upgraded.
- Screen tracking and compositing (OpenCV tracking untested).
- The Remotion build, renders and frame QA.
- Sound effects, the mix and encodes.

**4. External tools I need:**

- Runway Standard (paid).
- A voice source (ideally your own recording).
- A Remotion licence if you aren't eligible for the free one.

**5. Not possible within £20 a month:**

- Generating all 11 plates in a single month on Runway.
- Long or complex continuous generated camera moves (Concept 3).
- Grok Imagine.
- Probably watermark-free Veo on Google AI Pro (unverified).

**6. Genuinely high-end visuals?**
The UI half: yes, I'm confident. Crisp, full-frame, purposeful camera. The cinematic half depends on current video models delivering believable people in short, simple shots. They often can, but not reliably. The plan contains that risk with references, short durations, one grade and a fallback for every plate. Some plates will likely need several attempts or fallbacks.

**7. Every major Spine feature demonstrated?**
Yes on paper: Help Desk with AI first answer, Champion, consent and reuse; Ideas with AI drafting, approval or auto-approve, joining and the AI plan; Pulse with the stall and rescue; outcomes, verification and leadership; built integrations, plus labelled coming-soon ones. Four shots depend on captures that don't exist yet.

**8. Enough time to read the UI?**
Mostly: still holds of 1.3 to 3.0 s at z 2.3 to 3.0, with UI on screen for 71% of the film. S05, S09 and S14 are tight, and dropping S12 fixes them.

**9. Biggest weaknesses:**

- Generated-human quality and consistency.
- Credit costs taken from third-party sources.
- I can't hear the soundtrack or perceive motion pacing.
- 86 s is long for a launch film.
- Two AI-feature shots depend on unseen UI.
- The production stretches over months because of the budget.

**10. What to challenge, improve or reject:**

- Whether 86 s should become 60 to 70 s.
- Whether 11 plates is too many, or whether 6 stronger ones would be better.
- Whether the dive-through transition will feel fresh or gimmicky after the fifth time. Consider using it only three times.
- Casting and character approach.
- Whether Veo through Google AI Pro operated by the user beats Runway driven by me.
- The coming-soon line in the master.

**11. Confidence: 6 out of 10** that the finished film is genuinely outstanding. 8 out of 10 for the product sections alone, and 5 out of 10 for the generated-people sections until test generations prove otherwise.

**12. Recommendation: PROCEED,** starting with the risk-free half: UI capture, cast stills and a rough cut with start frames as placeholders. Then run one paid test month to prove plate quality and real credit costs before committing to the rest. If the test plates fail the artefact review, **RECONSIDER THE TOOLCHAIN** for the world shots: either you operate Veo or Kling, or the film's world shots become fewer and simpler.
