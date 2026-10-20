# Spine launch trailer: production feasibility and master plan

Prepared 20 October 2026 for independent review. No trailer frames have been produced for delivery, nothing has been deployed or purchased, and no paid API call was made. Everything marked **verified** below was done or seen in this environment. Everything marked **unverified** was not.

Evidence referred to in this document is in `marketing/trailer-plan/evidence/`.

---

## Contents

- A. Asset audit
- B. Creative concepts and the selection
- C. Master storyboard (shot by shot, frame-timed)
- D. Technical production architecture
- E. Budget
- F. Risk assessment
- G. Production readiness
- H. Schedule, quality control and definition of done
- Final verdict for GPT-6

---

## A. Asset audit

### A.1 What I inspected and how

| Source | Location | How it was inspected |
| --- | --- | --- |
| Trailer brief (ASTRA-BRIEF.md) | `spine-2` branch, `marketing/ASTRA-BRIEF.md` | Read in full |
| 15 story clips | `spine-2` branch, `marketing/clips/*.mp4` | Extracted from git. Probed with ffprobe. One frame per second tiled into contact sheets with burnt-in timecodes (`evidence/contact-sheets/`). Frame-difference analysis at 30 fps to find the exact frame of every click and state change. Full-resolution frames for key end states |
| 18 screenshots | `spine-2` branch, `marketing/*.png` | Size probed, tiled and viewed (`evidence/screenshots-*.jpg`) |
| Spine 2.0 application source | `spine-2` branch | Read: recording script, integrations doc, AI modules, logo component, colour tokens. **Built and run locally**: seeded, served with `next start`, clip 01 re-recorded, still frames captured at 3× and 4× device scale |
| Previous trailers | branches `trailer/rebuild-2026-10-20`, `trailer/downloads-2026-10-20`, `claude/new-session-41hpt8` | Read their scripts, QA records and provenance. The 80-second rebuilt master was decoded and sampled every 3 seconds (`evidence/previous-80s-trailer-every-3s.jpg`) |
| Integrations | `spine-2` branch, `docs/INTEGRATIONS.md` and app code | Read in full |
| Runway account | Runway MCP connector in this session | `whoami` called (read-only). No generation run |

Not inspected: the public Spine website (the brief says it shows the old product), and any brand guidelines document (none exists in the repository). The brand values below were sampled from the app's own CSS tokens and from rendered frames.

### A.2 Story clips (all real Spine 2.0, H.264, 2880 × 1620, 30 fps, no audio track)

All 15 share these traits, measured:

- **The first 2 to 11 frames are a blank or loading page** (mean luma 247 on frame 0). Usable from about frame 12 (0.4 s).
- **The bitrate is very low**, roughly 0.2 to 0.55 Mbps. Static UI compresses well, so at 1:1 the frames look clean. Pushed past about 2 output pixels per source pixel, text goes soft and shows JPEG artefacts. This comes from the screencast JPEG frames inside the recording script, not the final H.264 encode (my re-record with the same script looked the same). See `evidence/sharpness-original-vs-rerecord-vs-dsf4.jpg`.
- The viewport is a 1440 × 810 layout rendered at 2×. Most of the 2880 × 1620 frame is empty canvas: the content column ends about 60% of the way down on most pages.
- **The result states are short.** After the decisive click, most clips hold the result for only 0.9 to 1.5 s before ending.
- The cursor is visible and sometimes covers the exact words that matter (clip 03 at 19.5 s covers "company").

| # | File | Duration | What it shows (verified) | Key frames, from frame-difference analysis (s / frame) | Quality notes | Suitability |
| --- | --- | --- | --- | --- | --- | --- |
| 01 | 01-home-what-needs-you.mp4 | 11.37 s | Alex's Home: "3 things need you" (Supplier Research Assistant, auto-approves in 6h, Review; Can Claude analyse multiple Excel files? Reply; Knowledge Search Assistant, Open). Your initiatives, Our AI priorities, Start something | Static page. Cursor drifts over the rows between 2.80 and 9.63 s. **No click happens** | Clean. The cursor never reaches Review, despite the brief's description | Good for the "turn" shot, held still. A sharper capture would be better |
| 02 | 02-ask-a-question.mp4 | 23.73 s | Priya opens Ask a question, types "Can I put client contract data into Copilot?" and the details, picks Security, clicks Ask, and lands on her thread | Modal opens at 4.57 s (f137). Title typed 5.5 to 13.5 s. Details 13.5 to 19.2 s. Topic 19.2 s. Ask clicked 22.77 s (f683). Thread visible 22.87 s (f686) | Typing is slow: 8 s for the title | Usable for the ask beat if heavily retimed. The privacy line in the modal is useful |
| 03 | 03-champion-answers.mp4 | 19.63 s | Mia's queue. She claims Priya's question and types the reply "Not in Copilot yet: it's approved for internal data only until Legal signs off. Use the company Claude workspace, and replace client names first. It's all in the Playbook." | Claim clicked about 7.47 s (f224; the thread page renders at that frame). Reply typed 10.93 to 15.67 s, **in a single-line field that scrolls sideways** (13.4 to 15.7 s). Send at 18.37 s (f551). Bubble visible from 18.47 s | Sideways scrolling is unreadable. The final bubble is excellent, but the cursor covers one word | Use only the claim and the final bubble. Re-capture recommended |
| 04 | 04-answer-helps-someone-else.mp4 | 16.73 s | Ben opens Ask a question and types "Is client contract data OK in Copilot?" "Already answered?" appears with the link "Can I put client contract data into Copilot?" | Modal opens 4.07 s (f122). Typing 5.5 to 9.1 s. **Suggestion appears 9.17 s (f275)** and holds to the end, with the cursor resting on the link | Clean. A strong 7.5 s hold | Strong. Use as is, or re-capture sharper |
| 05 | 05-approve-the-idea.mp4 | 9.07 s | Admin approval view of Supplier Research Assistant: problem, who benefits, team, effort, difficulty, target date; "Auto-approves in 6h" panel; Approve | Static to 8.0 s. **Approve clicked 8.03 s (f241)**. Forming team page at 8.17 s (f245). Clip ends 9.07 s | Shows the neutral "The AI review raised concerns. The owner has seen the details." banner, which reads badly in a launch film. Only 0.9 s of result | Usable with a crop below the banner. The post-approve hold must be a frozen real frame |
| 06 | 06-someone-joins.mp4 | 6.00 s | Jamie on the Team tab: "1 of 3 people", Join the team → "2 of 3 people", Louie (Owner) and Jamie Chen (Member). "Needs 1 more person to start" | **Join clicked 4.93 s (f148)**. 2 of 3 at 5.07 s (f152) | Clean, short | Good |
| 07 | 07-plan-moves-forward.mp4 | 14.40 s | Plan tab, "First drafted by AI from the brief", 6 steps with avatars and dates. Louie ticks "List the supplier sources Procurement trusts"; the next-action line changes to "Jamie is building the research template / At the current pace: on track, finishing around 11 Nov" | **Tick at 7.93 s (f238)**. Updated line at 8.07 s (f242), held to 14.4 s | Clean, with a long hold | Very good. This is the AI plan moment |
| 08 | 08-blocked.mp4 | 16.77 s | Check-ins tab: On track / At risk / Blocked. Louie picks Blocked and types "We need the approved supplier list exported from SAP. Who can get it for us?" Check in → red banner "Blocked since 7 Oct: ..." | **Blocked selected 6.97 s (f209)**. Typing 9.97 to 15.6 s. Check in 15.73 s. **Banner at 15.83 s (f475)**, held about 0.9 s | Clean | Good with retiming |
| 09 | 09-pulse-catches-it.mp4 | 10.17 s | Alex's Pulse: Blocked 2 (Supplier Research Assistant first, primary Open; Contract Clause Checker), Unanswered questions 3, Overdue steps 1. Opens the project, which shows the blocker banner | Static to 8.9 s. **Open clicked 8.97 s (f269)**. Project page from 9.03 s | Clean. Supplier Research Assistant says "Blocked for 1 day" while the banner says "Blocked since 7 Oct" and today is 7 Oct (a demo-data inconsistency) | Good |
| 10 | 10-unblocked.mp4 | 13.40 s | Louie checks in On track: "Alex got us the SAP export. Back on track." Check in → **the blocker banner disappears**, "Checked in. Thanks." | Typing 7.73 to 12.27 s. Click 12.40 s. **Banner gone at 12.53 s (f376)** | Verified full-res. The page jumps up as the banner is removed | Good. The banner vanishing is the payoff |
| 11 | 11-goes-live.mp4 | 5.87 s | "You're launching this", Mark Live → all six stepper segments fill and a green "Live" dot appears, plus the Outcomes tab | **Mark Live clicked 4.93 s (f148)**. Live at 5.00 s (f150) | Only 0.87 s after the click | Good, with a frozen hold |
| 12 | 12-team-reports-hours.mp4 | 14.07 s | Outcomes: "How did you measure it?" typed as "Six buyers used it on 18 supplier requests; each one took 15 minutes instead of 55 (timed in October)." Hours 12, Report → "October 2026: 12 hours saved ... Reported by Louie Morris · Not verified yet" | Typing 4.33 to 9.87 s. Hours 10.0 to 12.8 s. Report 12.97 s. **Result 13.17 s (f395)** | Clean. The measurement sentence is long | Good. The equation can be lifted into motion graphics without inventing numbers (18 × 40 min = 720 min = 12 h) |
| 13 | 13-verified-outside-the-team.mp4 | 9.53 s | Alex, outside the team, sees the report and clicks Verify → "Verified", "Reported by Louie Morris · Verified by Alex Morgan on 7 Oct" | **Verify clicked 8.53 s (f256)**. Verified at 8.63 s (f259) | The result is small text | Good |
| 14 | 14-leadership-sees-it.mp4 | 16.20 s | Leadership: Verified hours saved 106; Live initiatives 3; In flight 6; People active 7 of 7; Questions asked 102; line chart Jul to Oct; Needs leadership; Pipeline; Went live 3 (Supplier Research Assistant 7 October at the top) | Static. The cursor wanders the sidebar from 6.6 to 13.8 s. **The chart does not animate** | Clean, and the best-composed screen | Good, held still. Animate a reveal wipe of the real chart, never new data |
| 15 | 15-playbook.mp4 | 8.43 s | Playbook: Priorities; AI tools: Claude (company workspace) Approved, Microsoft 365 Copilot Approved with limits ("Internal data only for now. Client data is allowed once Legal signs off the pilot."), Personal AI accounts Not approved | Static | Clean. Uses amber and red status pills | Useful for a short "the rule came from here" insert |

### A.3 Screenshots

| File | Size | Shows | Notes for the trailer |
| --- | --- | --- | --- |
| 01-home-what-needs-you.png | 2880 × 1800 | Same Home as clip 01, with sidebar user "Alex Morgan, Acme Group" | Good still |
| 02-help-desk.png | 2880 × 1800 | Help Desk Queue: Unclaimed 3, In progress 4, Champions this month | Supporting |
| 03-private-question-thread.png | 2880 × 1800 | "Can Claude analyse multiple Excel files?" thread with attachment Sales_Data_Sample.xlsx | Off-story (a different question). Avoid in the master; the brief warns against the Excel question |
| 04-initiatives-board.png | 2880 × 1800 | Initiatives board: Approval, Forming team, Building, Launching, Live columns | Useful as a "whole programme" plane in the final pull-back |
| 05-initiative-plan.png | 2880 × 1800 | AI Invoice Assistant plan with "Open Teams channel" | Shows the built Teams channel link. A different project |
| 06-check-ins.png | 2880 × 1800 | AI Invoice Assistant check-ins with On track and At risk history | Supporting |
| 07-approval-decision.png | 2880 × 1800 | Approval view (same as clip 05) | Still for the approval hold |
| 08-pulse-whats-stuck.png | 2880 × 1800 | Pulse with Blocked 1, Decisions waiting 1, Unanswered 3, Overdue 1 | A different state from clip 09 |
| 09-playbook.png | 2880 × 1800 | Playbook with Guidance section and edit controls | Supporting |
| 10-discover.png | 2880 × 1800 | Discover: colleagues' discoveries and Recently shared answers | **Not in any clip.** A real feature (collaboration). Candidate insert |
| 11-leadership.png | 2880 × 1800 | Leadership with 94 hours and 2 live (a state before Supplier Research Assistant) | Do not mix with clip 14: the numbers differ |
| 12-propose-an-idea.png | 2880 × 1800 | Propose an idea: "Describe your idea in a sentence. Spine drafts the proposal below." and Draft it | **The AI drafting feature, not in any clip.** Needs a capture |
| 13-search-palette.png | 2880 × 1800 | ⌘K search palette | Optional |
| 20 to 23 phone PNGs | 1170 × 2532 | Mobile Home, thread (Excel), initiative (AI Invoice Assistant, Open Teams channel), Pulse | Shows the product is responsive. Useful for the 9:16 cut, but they are off-story projects |
| 30-member-home.png | 2880 × 1800 | Ben's Home: "You're all clear", Contract Clause Checker with a red Blocked pill | Supporting |

### A.4 Brand (sampled from `spine-2` CSS tokens and rendered pixels)

| Token | Value | Use in the film |
| --- | --- | --- |
| nav (sidebar navy) | #0E1629 (pixel-verified) | The film's dark field |
| canvas (warm off-white) | #FAF9F6 (pixel-verified) | The film's light field |
| surface | #FFFFFF | UI containers |
| text | #181A20 | Dark type |
| brand (cobalt) | #3B5BDB | The one thing to look at, the line, the pulse |
| logo-light | #81A0FF | Top of the logo gradient |
| live | #22C55E | The Live dot only |
| critical | #BE2D28 | The Blocked banner only |
| Logo | Three rounded bars (24, 32 and 20 units wide, offset), gradient from logo-light to brand, Inter semibold wordmark | Source geometry is in `src/components/shell/Logo.tsx`. Rebuild it as vector. Never screenshot it |
| Typeface | Inter (installed here: Inter and Inter Display OTF, verified with fc-list) | All film type |

Note: the root `CLAUDE.md` on `main` lists older tokens (#1660FF, #F7F8FA). Spine 2.0 ships the values above. The film follows Spine 2.0.

### A.5 Integrations: what is actually built (from `docs/INTEGRATIONS.md` and the UI)

| Capability | Status | Evidence in footage |
| --- | --- | --- |
| Slack channel posts (incoming webhook) | **Built** and unit-tested. The doc says no real Slack workspace has been tested | No Slack UI captured. "Link your Teams or Slack channel" is visible on the initiative page in clips 07 to 13 |
| Teams channel posts (Teams Workflows webhook, Adaptive Card) | **Built** and unit-tested. No real Teams tenant tested | "Open Teams channel" in screenshots 05 and 22 |
| What gets posted | Daily Pulse digest, approvals needing a decision, newly approved initiatives looking for a team, blocked initiatives | Pulse subtitle: "It's also posted to your team channel each morning." |
| Channel links on an initiative | **Built** | Visible |
| Calendar (.ics export of plan steps and target date) | **Built**. Import into each calendar app not tested | "Calendar" button visible |
| Slack DMs, Teams personal messages, @mentions, channel creation, calendar write access | **Not built** (proposals only) | None |
| "@Spine in Teams", "Send to Spine" from Slack, Claude proposing an initiative | **Not built**. ASTRA calls these coming soon | None |
| Anthropic Claude (inside Spine) | **Built**: AI review, build plan, "Draft it" for ideas, instant first answers on Help Desk questions, "Update from meeting notes", "Spotted by Spine" opportunities on Discover | Only the build-plan label is visible in the clips |

### A.6 Gaps: material that does not exist yet

1. **AI on the Help Desk.** Spine 2.0 has an instant-answer feature (`src/server/ai/answer.ts`): Spine drafts a first answer from the Playbook and shared answers, and a Champion still owns the follow-up. The clips were recorded without an API key, so it never appears. The user's brief asks for "AI assistance" on the Help Desk. **Needs a capture.** Unverified: how the answer looks in the UI.
2. **Consent to share.** The real "Share the answer with your company?" panel (`SharePanel.tsx`) explains how Priya's private answer became Ben's "Already answered?". Not in any clip. **Needs a capture.** The previous trailer "bridged editorially" here.
3. **"Draft it" on Propose an idea.** Screenshot only. **Needs a capture.**
4. **Admin > Integrations.** Not captured anywhere. **Needs a capture** if integrations are to be shown as product rather than as a text line.
5. **Discover and "Spotted by Spine".** Screenshot only. Optional.
6. **Hold frames after each click.** Most clips end 0.9 s after the payoff. Freezing the last real frame works but looks static. A new capture with 3 s of dwell after every result is better.
7. **Sharp frames for push-ins past 2×.** Not possible from the supplied clips (see A.2).
8. **Dates that progress.** Every clip says 7 October, so approval, launch and verification all happen on one day. New captures can set `SPINE_TODAY` per beat so the story spans weeks. This is my recommendation, but it changes the demo dataset, so it needs your approval.
9. **Music, sound effects and voice.** None exist apart from the previous trailer's local synthesis.
10. **A destination URL for "Book a demo".** None supplied. The end card will use a placeholder.

### A.7 The existing trailers (inspected)

The 80-second rebuild (`trailer/rebuild-2026-10-20`) is carefully truthful: one project, real clicks, demo-data labels, a Kokoro British voice and locally synthesised music. Its QA record is honest about what it couldn't verify. Sampled every 3 seconds, its weaknesses are:

- It still reads as an explainer: a headline at top-left, a small UI card, and articulated clip-art characters beside it on most frames.
- The UI is mostly lifted into cards and enlarged excerpts, so the real product surfaces rarely fill the screen. The product is not the star.
- Camera movement is minimal, and there is no visual idea tying the scenes together.
- The music is deterministic synthesis, and the sound design is thin.
- The Help Desk AI, the sharing consent, Draft it, integrations and Discover are absent.

The plan below fixes these structurally rather than polishing that edit.

---

## B. Creative concepts

All three obey the same rules: real Spine 2.0 UI only, one project throughout, no AI scores, AI drafts and people decide, Acme Group is labelled demo data, and future features are labelled coming soon.

### Concept 1: "One Line"

- **Central idea.** Spine's logo is three offset bars: a spine. The film is built on one cobalt line that never breaks. It is the thread that carries a question to an answer and an idea to Live, and it is also a pulse. When work stalls it flattens. When someone steps in it beats again.
- **Hook.** Out of black, a single cobalt line draws across the frame with a soft heartbeat. Around it, unanswered messages from everyday workplace chat (generic, not Spine and not real brands) go grey one by one and the line flattens. Silence. Then the line snaps into the three bars of the logo.
- **Visual language.** A deep navy (#0E1629) void with the real Spine UI as large, crisp planes laid out in 2.5D space, connected by the line. A virtual camera glides plane to plane: it pushes in to read one sentence, then flies along the line to the next plane. Warm off-white (#FAF9F6) planes on navy; cobalt is the only accent; green only for Live, red only for Blocked.
- **Structure.** Quiet (problem) → the turn (Home: "3 things need you") → Ask → Answer → Share → Idea → Approve → Join → Plan → Stall → Pulse → Unblock → Live → Prove → Lead → the whole spine → end card.
- **Editing.** Few cuts. Mostly continuous camera moves that feel like one take, punctuated by hard cuts on the beat at the three act changes. Every read is held still.
- **Sound.** 120 BPM (exactly 15 frames per beat at 30 fps), minimal electronic pulse. A low "heartbeat" kick is the motif, UI clicks are designed foley, and real silence falls on the stall. The music drops out under the flatline and returns on the unblock.
- **Product integration.** The product is literally the set: every plane is a real capture.
- **Why it stands out.** It turns the product's core promise ("ideas never quietly die") into a visual and sonic device that pays off twice (Pulse and the logo), and it keeps real UI on screen almost the whole time.

### Concept 2: "Quiet until needed"

- **Central idea.** Spine's design principle as a film: silence and stillness by default, motion only when a human is needed. Each scene starts almost empty and calm. Then one notification-like cobalt point appears, and the camera, sound and edit spring into action until a person acts, and everything settles.
- **Hook.** Ten seconds of near-stillness: a calm Home screen, slow breath sound. Then "3 things need you" and a single sharp sound.
- **Visual language.** Static, gallery-like full-frame UI, with sudden extreme macro pushes onto the one actionable element. Lots of negative space.
- **Editing.** Contrast cuts: long stillness, then fast bursts.
- **Sound.** Mostly ambience and Foley. Music only in the bursts.
- **Product integration.** Strong: full-frame UI.
- **Why it stands out.** Unusually restrained and confident. The risk is that it feels slow and austere, the "dead air" hurts on social autoplay, and it does less to explain the breadth of the product.

### Concept 3: "A week at Acme" (cinematic people-first)

- **Central idea.** Follow Priya, Mia, Louie, Jamie and Alex through their real working days in live action, with each person's moment cutting into the UI on their screen via screen composites.
- **Hook.** A phone lights up on a dark desk; a message goes unread.
- **Visual language.** Shallow-depth-of-field office cinematography with UI composited into screens.
- **Editing.** Classic commercial match cuts from world to screen.
- **Sound.** Licensed-style indie track, room tone.
- **Product integration.** Weaker: UI lives inside screens in the world, often small or angled.
- **Why it stands out.** Human and warm, but it depends heavily on AI-generated people. On a £20 budget that means roughly 50 seconds of generated video in total, high failure rates, inconsistent faces between shots, and the "generic AI corporate ad" look the brief forbids. It also puts the product second.

### Selection: Concept 1, "One Line", with two elements from Concept 2

- Concept 1 makes the product the star, has one memorable idea that runs through the whole film, and needs no generative video to look premium. That suits the budget and the "don't fake the product" rule.
- From Concept 2 I take **genuine stillness during every read** (the camera stops; nothing else moves) and **silence on the stall**.
- From Concept 3 I keep only an **optional** pair of live-action plates (cold open and end), behind a budget decision. The master is designed to work fully without them.

### Duration: 72 seconds (2160 frames at 30 fps)

The ASTRA brief recommends about 60. Counted against reading time (section C.0), 60 s cannot fit the four product areas, the AI moments and the integrations beat while keeping 2 s or more on each read. 80 s (the previous edit) sagged. 72 s gives 22 shots, about 2.4 s of held reading time per product beat, and 120 BPM gives exactly 36 bars. Cutdowns: 30 s, 15 s and 9:16 vertical (section C.3).

---

## C. Master storyboard

### C.0 Conventions

- **Frame rate:** 30 fps everywhere (the source is 30 fps, so there is no conversion). Timecode is `mm:ss.ff` (frames 00 to 29). Frame numbers are absolute (0 to 2159).
- **Beat grid:** 120 BPM = 15 frames per beat. Every shot boundary is a multiple of 15 frames.
- **Canvas:** master render 1920 × 1080 (a 4K render is possible; see D.4).
- **Zoom notation:** `z` = output pixels per logical UI pixel. The UI layout is 1440 × 810 logical pixels, so a full-frame fit is z = 1.333.
  - New captures at 3× device scale (4320 × 2430) stay pixel-sharp up to z = 3.0 at 1080p (verified: `evidence/frame-stepped-capture-dsf3-crop.jpg`).
  - The supplied clips (2×) stay sharp to about z = 2.0. Beyond that, softness is visible (verified: `evidence/remotion-test-frame-2.2x-push.jpg`).
- **Readability rule:** the one thing to read in each shot must render at 30 px x-height or more at 1080p. Inter's x-height is about 0.55 em, so 14 px meta text needs z ≥ 3.9 (too far; it's never the primary read). 17 px row titles need z ≥ 3.2. 20 px or larger headings need z ≥ 2.7. When the primary read is small UI text, the shot carries an editorial type line restating it (verbatim from the UI, never paraphrased into a claim).
- **Hold rule:** read time = 0.6 s + (words ÷ 3.5) s. The camera is completely still during a read, except for an optional push of 2% or less.
- **Ease:** camera moves use cubic-bezier(0.16, 1, 0.3, 1) ("glide"), 18 to 24 frames. Type enters with a 10-frame fade plus a 12 px rise, and exits with an 8-frame fade.
- **Source columns:** "v2" means the new capture beat (section D.2) that replaces the original. "Fallback" gives the exact in/out in the supplied clip, used if v2 isn't approved. Times are clip seconds / frames.
- **Type:** editorial lines are Inter Display Semibold, 64 px, tracking −0.02 em, on navy in white or on off-white in #181A20, left-aligned to a 120 px margin. Labels are Inter Medium 22 px #8790A8 (navy) or #636772 (light).
- **Demo-data note:** "Acme Group · Demo data" in Inter Medium 18 px, 60% opacity, bottom-left, on every shot that shows Acme numbers (S18 to S20).

### C.1 Shot list

#### ACT 0: Quiet (00:00.00 to 00:07.00)

**S01 · 00:00.00 to 00:02.15 · 75 f (frames 0 to 74)**

- **Purpose:** hook. Introduce the line, the motif of the whole film.
- **Sees:** a pure navy #0E1629 frame. At f10 a 4 px cobalt line starts drawing from the left edge at y = 540 and reaches the right edge at f60 (ease-out). At f30 and f54 the line kicks upward in a small 18 px heartbeat blip that travels along it.
- **Camera:** locked.
- **Source:** motion graphics only.
- **On-screen text:** none.
- **VO:** none.
- **Sound:** f0 low room tone. f30 and f54 a soft sub "heartbeat" kick with a high tick on the blip. The music bed (pulse synth) starts very low at f45.
- **Viewer understands/feels:** something alive and calm. "What is this line?"
- **Additional asset:** none.
- **Connects:** the camera pulls back on the line into S02.

**S02 · 00:02.15 to 00:05.15 · 90 f (75 to 164)**

- **Purpose:** the company-wide problem.
- **Sees:** the camera pulls back over 20 f (z of the line scene from 1.0 to 0.55) to reveal nine generic chat-message fragments floating above and below the line. They are white rounded bubbles at 70% opacity, sans avatars, deliberately unbranded (not Teams, Slack or Spine UI). Copy:
  1. "Can I put client data into Copilot?" · Seen
  2. "Has anyone automated supplier checks?" · 3 weeks ago
  3. "I made a prompt that saves me an hour a day. Where do I share it?"
  4. "Pilot paused. Waiting on the SAP export." · last updated 19 days ago
  5. "Who owns AI here?"
  6. "Is this tool approved?" · Seen
  7. "We should build this." · 1 reaction
  8. "Any update?"
  9. "Following up on this"

  From f105 bubbles fade to 25% grey one per 6 frames, and the line's blips stop. By f150 the line is flat.
- **Camera:** pull back (f75 to f95), then a slow 2% drift.
- **Source:** motion graphics (mock chat, not product).
- **On-screen text:** f110 to f164 "Most AI ideas don't fail." (centred, white, 72 px).
- **VO:** f90 to f145 "Every company is full of AI questions and ideas."
- **Sound:** soft notification ticks as bubbles appear (f75 to f100), then nothing. The music thins to the pulse only.
- **Feels:** recognition. "That's us."
- **Additional asset:** none.
- **Connects:** the line is flat; cut to the silence beat.

**S03 · 00:05.15 to 00:07.00 · 45 f (165 to 209)**

- **Purpose:** the punchline of the problem, then the turn.
- **Sees:**
  - f165 to f180: bubbles gone. Only the flat line and the text "They go quiet." (replacing the S02 line in place).
  - f186 to f204: the line retracts from both ends into three short offset segments that round off into the exact logo bars (lengths 24, 32 and 20, offsets as in `Logo.tsx`), scaling to 240 px tall at the frame centre.
  - f198: the wordmark "Spine" fades in.
- **Camera:** locked.
- **Source:** motion graphics (brand vector).
- **Text:** "They go quiet." (f165 to f185).
- **VO:** f168 to f190 "Most of them go quiet."
- **Sound:** **true silence f166 to f185**, then a single inhale/air swell into a clean "set" click at f204 when the bars lock.
- **Feels:** a small jolt. The brand arrives as the answer.
- **Additional asset:** none.
- **Connects:** the logo is the anchor for the zoom-out into the real sidebar.

#### ACT 1: The turn (00:07.00 to 00:11.15)

**S04 · 00:07.00 to 00:11.15 · 135 f (210 to 344)**

- **Purpose:** show that Spine is calm and tells you what to do first.
- **Sees:**
  - f210 to f240: the centre logo travels and shrinks into the sidebar logo position of the real Home screen, which fades up around it. Match-move: logo scale 10 → 1, Home plane z 6.0 → 1.333, with origin locked on the logo.
  - f240 to f270: the camera glides to frame the headline and the first row.
  - f270 to f344: hold, z = 2.6, on "Wednesday, 7 October / 3 things need you" and row 1 "Supplier Research Assistant · Auto-approves in 6h unless you review it · Review".
  - f300: a 2 px cobalt outline ring traces around the Review button once. Drawn outside the button with an 8 px gap, so it can't be mistaken for UI.
- **Camera:** dolly out, then glide, then hold.
- **Source:** v2 beat H1 (Alex Home, DSF 3, no cursor). Fallback: clip 01, frame at 1.0 s (f30), held. z is capped at 2.0 with the fallback.
- **Text:** none (the UI headline is the read).
- **VO:** f235 to f330 "Spine keeps them moving, and only asks for you when you're needed."
- **Sound:** the music's kick enters on f210 (bar 1 proper). A soft UI tick at f300.
- **Feels:** relief. "It tells me the one thing."
- **Asset needed:** H1 (or none with the fallback).
- **Connects:** the camera flies down the cobalt line to the Help Desk plane (S05).

#### ACT 2: Help Desk (00:11.15 to 00:27.00)

**S05 · 00:11.15 to 00:14.15 · 90 f (345 to 434)**

- **Purpose:** asking a company-specific question, privately.
- **Sees:**
  - f345 to f365: the camera arrives on the Ask a question modal.
  - f365 to f405: the title types "Can I put client contract data into Copilot?" at a natural pace (the 44 characters retimed into 40 frames).
  - f405 to f434: hold, z = 2.5, framing Title plus the privacy line "Only you and the Champion who picks this up can see the conversation." That line gets a cobalt underline, drawn on at f410.
- **Camera:** glide in, then lock.
- **Source:** v2 beat Q1 (Priya, typing frame-stepped). Fallback: clip 02 modal from 4.57 s; title typing 5.5 to 13.5 s retimed ×6 (240 f → 40 f); hold on the frame at 13.5 s (f405); z ≤ 2.0.
- **Text (f370 to f434, top-left):** "Ask what only your company can answer."
- **VO:** f350 to f425 "Ask the question only your company can answer."
- **Sound:** soft key ticks matched to the characters, and a whoosh on arrival.
- **Feels:** "This is safe to ask."
- **Asset:** Q1.
- **Connects:** Ask is pressed (Q1 frame) and the camera slides right to the thread.

**S06 · 00:14.15 to 00:17.00 · 75 f (435 to 509)**

- **Purpose:** AI assistance that follows company rules.
- **Sees:** Priya's thread with Spine's first answer drafted from the Playbook (the `aiAnswer` UI, captured in v2).
  - f435 to f455: the answer area reveals as recorded.
  - f455 to f509: hold, z ≈ 2.4, on the drafted answer text, which, given the Playbook rule, should say that Copilot is internal-data-only until Legal signs off. The exact wording comes from the captured run and is not known yet.
- **Camera:** short glide, then lock.
- **Source:** v2 beat Q2 (needs either the dev-mode fixtures or one real Claude call; see D.2).
- **Text:** "A first answer from your own Playbook." The line is only kept if the captured UI really cites or uses the Playbook.
- **VO:** f440 to f505 "Spine drafts a first answer from your Playbook..."
- **Sound:** a soft shimmer as the text appears. No sci-fi sound.
- **Feels:** instant help, within the rules.
- **Asset:** Q2 (**unverified UI**).
- **Fallback if Q2 is not approved or looks weak:** a 75 f Help Desk Queue plane (Mia's view, clip 03, 0.4 to 7.4 s), pushing to the Unclaimed row "Can I put client contract data into Copilot? · Claim". The text becomes "Champions see it straight away." Hold on clip 03 f200.
- **Connects:** the line runs from the answer to Mia's avatar (S07).

**S07 · 00:17.00 to 00:21.15 · 135 f (510 to 644)**

- **Purpose:** a Champion confirms with the company's own rules.
- **Sees:**
  - f510 to f530: Mia's queue, Claim pressed (real click).
  - f530 to f545: the thread opens.
  - f545 to f600: Mia's reply bubble appears whole, with no sideways scrolling.
  - f560 to f644: hold, z = 2.3, on the bubble: "Not in Copilot yet: it's approved for internal data only until Legal signs off. Use the company Claude workspace, and replace client names first. It's all in the Playbook."
  - f615 to f644: a 30 f inset slides up from the bottom right (40% frame width): the Playbook row "Microsoft 365 Copilot · Approved with limits · Internal data only for now..." (clip 15 at 2.0 s, f60, crop to the AI tools section, z 2.0), linked to the word "Playbook" by the cobalt line.
- **Camera:** glide, then lock.
- **Source:** v2 beat Q3. Fallback: clip 03, Claim at 7.47 s (f224, play f214 to f234 at real speed); the bubble frame at 18.6 s (f558); a cursor-free bubble is not available in the fallback, because the cursor sits over "company" from 18.47 s. Plus clip 15 f60.
- **Text:** "A Champion answers with your rules."
- **VO:** f515 to f600 "...and a Champion confirms it, with your company's own rules."
- **Sound:** a click on Claim; a soft "sent" tone at f545.
- **Feels:** expert humans, not a chatbot.
- **Asset:** Q3.
- **Connects:** the camera pulls down to the share panel below the thread.

**S08 · 00:21.15 to 00:23.15 · 60 f (645 to 704)**

- **Purpose:** private by default; shared only when the asker agrees.
- **Sees:** the real panel "Your Champion suggested sharing this answer" with the summary text and the primary "Share summary". It is clicked at f675 (real) and "Shared." appears at f680. Hold z = 2.4 to f704.
- **Source:** v2 beat Q4 (new; no fallback exists in the supplied material). If not captured, this shot is removed and S09 grows to 165 f (starting at f645).
- **Text:** "Shared only when the asker agrees."
- **VO:** none (it's covered by the type, which gives breathing room).
- **Sound:** a click, then a confirmation tick.
- **Feels:** trust.
- **Asset:** Q4.
- **Connects:** the camera flies along the line to a new person (Ben).

**S09 · 00:23.15 to 00:27.00 · 105 f (705 to 809)**

- **Purpose:** knowledge compounds.
- **Sees:**
  - f705 to f725: Ben's Ask modal; the title types "Is client contract data OK in Copilot?"
  - f740: "Already answered?" with the link "Can I put client contract data into Copilot?" appears (real).
  - f745 to f809: push from z 2.2 to z 2.9 over 12 f, then lock on the suggestion.
  - The cobalt line from S07/S08 arrives and underlines the link at f750.
- **Source:** v2 beat Q5. Fallback: clip 04, typing 5.5 to 9.1 s retimed ×5.4 (108 f → 20 f); the suggestion appears at 9.17 s (f275); hold on 9.5 s (f285) (cursor near the link); z ≤ 2.0.
- **Text:** "The next person gets the answer before they finish asking."
- **VO:** f710 to f800 "Share it, and the next person gets the answer before they even ask."
- **Sound:** a rising chord resolution at f740. This is the "clever" moment.
- **Feels:** "Wow, that's smart."
- **Asset:** Q5.
- **Connects:** a hard cut on the downbeat at f810 (act change) to Ideas.

#### ACT 3: Ideas & Projects (00:27.00 to 00:42.00)

**S10 · 00:27.00 to 00:30.00 · 90 f (810 to 899)**

- **Purpose:** an idea becomes a proposal, with AI help.
- **Sees:** Propose an idea.
  - f810 to f835: one sentence is typed in "Describe your idea in a sentence": "A supplier research assistant that gathers supplier details for Procurement".
  - f840: Draft it is clicked (real).
  - f845 to f880: the form fields fill (as captured).
  - Hold to f899 on the filled Name and Problem fields, z 2.0.
- **Source:** v2 beat I1 (needs fixtures or one Claude call; **unverified UI**). The resulting problem text must match the Supplier Research Assistant's seeded problem ("Sourcing supplier information is slow and manual, with key details spread across different websites and documents."). If the drafted text differs, we use the real drafted text and don't edit it.
- **Text:** "Describe it in a sentence. Spine drafts the proposal."
- **VO:** f815 to f890 "Turn an idea into a real proposal in one sentence."
- **Sound:** keys, a click, a soft fill shimmer.
- **Fallback:** screenshot 12-propose-an-idea.png (empty form) for 30 f, then straight to S11, with S11 extended by 60 f.
- **Connects:** the line runs to the approval plane.

**S11 · 00:30.00 to 00:33.15 · 105 f (900 to 1004)**

- **Purpose:** leadership decides, and ideas can't stall in approval.
- **Sees:**
  - f900 to f960: approval view cropped below the AI-concerns banner (crop top at logical y = 300 so the banner is never in frame), z 2.2, on Problem / Who benefits / Team.
  - f960 to f975: glide right to the panel "Auto-approves in 6h · Submitted by Louie Morris · Auto-approves today at 16:00".
  - f975: Approve is clicked (real).
  - f980 to f1004: the stage stepper reads Draft, Approval, **Forming team**; "Needs 2 more people to start".
- **Source:** v2 beat I2 (with a 3 s dwell after the click). Fallback: clip 05, the frame at 4.0 s for the details hold; real click frames f236 to f245 at real speed; frozen hold on f270 (the last frame).
- **Text (f965 to f1004):** "Decided in one click. Or it auto-approves."
- **VO:** f905 to f990 "Leadership decides, and nothing waits forever."
- **Sound:** a clean click on f975, and a stepper "advance" tick.
- **Feels:** momentum, accountability.
- **Asset:** I2.
- **Connects:** the camera drops down the stepper to the Team tab.

**S12 · 00:33.15 to 00:36.15 · 90 f (1005 to 1094)**

- **Purpose:** collaboration. The right people join.
- **Sees:** the Team tab, "1 of 3 people", Louie Morris (Owner). Join the team is clicked at f1040 (real); "2 of 3 people", Jamie Chen (Member) appears at f1045. Push z 2.2 → 2.6 on the count, hold to f1094.
- **Source:** v2 beat I3. Fallback: clip 06, f120 to f160 at real speed, then hold on f179.
- **Text:** "The right people join."
- **VO:** f1010 to f1060 "The right people join."
- **Sound:** a click, then a warm two-note "join" tone.
- **Feels:** a team forming.
- **Asset:** I3.
- **Connects:** a cut on the beat to the Plan tab.

**S13 · 00:36.15 to 00:42.00 · 165 f (1095 to 1259)**

- **Purpose:** the AI-drafted plan, with people owning every step.
- **Sees:**
  - f1095 to f1140: the Plan tab, z 1.8, showing the label "First drafted by AI from the brief" (cobalt-underlined at f1110) and six steps with avatars LM, JC, SK and dates 9 Oct to 10 Nov.
  - f1140: Louie ticks step 1 (real).
  - f1150 to f1170: glide up to the next-action line.
  - f1170 to f1259: hold, z 2.8, on "Jamie is building the research template / At the current pace: on track, finishing around 11 Nov".
- **Source:** v2 beat I4. Fallback: clip 07, the frame at 3.0 s for the plan, real tick f230 to f245, hold on the frame at 9.0 s (f270), z ≤ 2.0.
- **Text (f1180 to f1259):** "AI drafts the plan. People own every step."
- **VO:** f1100 to f1250 "Spine drafts the plan. Every step has an owner, and everyone knows what's next."
- **Sound:** a tick sound on the checkbox. The music builds to bar 21 at f1260.
- **Feels:** clarity.
- **Asset:** I4.
- **Connects:** hard cut at f1260 (act change) to the Check-ins tab.

#### ACT 4: Pulse (00:42.00 to 00:53.00)

**S14 · 00:42.00 to 00:45.00 · 90 f (1260 to 1349)**

- **Purpose:** work stalls.
- **Sees:**
  - f1260 to f1280: the check-in card; Blocked is selected (real).
  - f1280 to f1300: the note appears ("We need the approved supplier list exported from SAP. Who can get it for us?"), retimed.
  - f1305: Check in.
  - f1310 to f1349: the red banner "Blocked since 7 Oct: We need the approved supplier list exported from SAP. Who can get it for us?" Hold z 2.4.
  - The film's cobalt line (running along the plane's bottom edge since S04) **flattens** at f1312.
- **Source:** v2 beat P1. Fallback: clip 08, f205 to f215 real, the typing 9.97 to 15.6 s retimed ×8.5, click f472, banner f475, hold on the last frame f502.
- **Text:** "Work gets stuck."
- **VO:** f1265 to f1300 "When work gets stuck,"
- **Sound:** **the music drops out at f1312**, leaving a thin flat sine at very low level for 1 s.
- **Feels:** tension. This is where ideas usually die.
- **Asset:** P1.
- **Connects:** the camera pulls back from the banner, the plane turns away, and the Pulse plane arrives.

**S15 · 00:45.00 to 00:48.15 · 105 f (1350 to 1454)**

- **Purpose:** Spine notices.
- **Sees:**
  - f1350 to f1380: the Pulse page as Alex (a different person and screen), "Anything blocked, waiting or going quiet across your AI programme. It's also posted to your team channel each morning."
  - f1380 to f1400: glide to the Blocked group.
  - f1400 to f1454: hold, z 2.5, on row 1 "Supplier Research Assistant · Blocked for 1 day: We need the approved supplier list exported from SAP. Who can get it for us? · Open". The sidebar "Pulse" count is visible at left, but small.
  - f1420: the flat line gives one heartbeat blip under the row.
- **Source:** v2 beat P2. Fallback: clip 09, the frame at 1.0 s (f30), held, z ≤ 2.0.
- **Text:** "Spine notices, and tells the person who can help."
- **VO:** f1355 to f1440 "Spine notices, and brings it to someone who can help."
- **Sound:** a single heartbeat on f1420.
- **Feels:** a safety net.
- **Note:** the subtitle sentence about the team channel is real product copy. It doubles as the built Slack/Teams integration, shown without faking a Slack screen.
- **Connects:** Open is clicked at f1450 (real) and we cut to S16.

**S16 · 00:48.15 to 00:53.00 · 135 f (1455 to 1589)**

- **Purpose:** someone steps in, and work resumes.
- **Sees:**
  - f1455 to f1475: the project with the blocker banner (as Alex).
  - f1475: cut to Louie's check-in, On track selected, typing "Alex got us the SAP export. Back on track."
  - f1520: Check in.
  - f1525: **the red banner disappears and the page settles** (real).
  - f1530 to f1589: hold on "Jamie is building the research template" and "Checked in. Thanks.", z 2.3.
  - From f1525 the cobalt line beats again: three blips, then continuous.
- **Source:** v2 beat P3 (with a 3 s dwell). Fallback: clip 09 f269 to f300; clip 10 typing 7.73 to 12.27 s retimed ×3; click f372; banner gone f376; hold to f401.
- **Text:** "Someone steps in. It moves again."
- **VO:** f1460 to f1580 "Someone steps in, and it moves again."
- **Sound:** **the music returns on f1530** with a full drum pattern (bar 26). The heartbeat motif becomes the kick.
- **Feels:** release. This is the emotional peak.
- **Asset:** P3.
- **Connects:** a cut on the beat to Launching.

#### ACT 5: Live and proven (00:53.00 to 01:04.15)

**S17 · 00:53.00 to 00:55.15 · 75 f (1590 to 1664)**

- **Purpose:** it ships.
- **Sees:**
  - f1590 to f1615: "You're launching this · Mark Live →", z 2.4.
  - f1615: click (real).
  - f1617 to f1645: all six stepper segments read filled and a green dot "Live" appears (real). The camera pushes z 2.4 → 3.0 on "● Live" over 15 f.
  - f1645 to f1664: hold.
- **Source:** v2 beat L1. Fallback: clip 11, f140 to f150 real; hold on f175.
- **Text:** none. "Live" is the read.
- **VO:** f1595 to f1640 "It goes live."
- **Sound:** the brightest moment in the score: a chime on f1617.
- **Feels:** achievement.
- **Connects:** a glide down to Outcomes.

**S18 · 00:55.15 to 00:59.00 · 105 f (1665 to 1769)**

- **Purpose:** honest value reporting.
- **Sees:**
  - f1665 to f1700: the Outcomes form with the measurement typed (retimed): "Six buyers used it on 18 supplier requests; each one took 15 minutes instead of 55 (timed in October)." Hours 12, Report clicked at f1705.
  - f1710 to f1769: the report row "October 2026: 12 hours saved · Reported by Louie Morris · Not verified yet".
  - From f1715 to f1769 a motion-graphic equation builds above the plane from the captured numbers only: "18 requests × 40 minutes saved = 12 hours". Each number flies out of its exact place in the UI sentence.
- **Source:** v2 beat L2. Fallback: clip 12, typing 4.33 to 9.87 s retimed ×6, hours f300 to f385, click f389, result f395, hold to f421.
- **Text:** the equation, plus "Acme Group · Demo data".
- **VO:** f1670 to f1760 "The team reports what it saved, and how they measured it."
- **Sound:** three ticks as the numbers land.
- **Feels:** credibility, not hype.
- **Connects:** the line runs to a new avatar, AM, outside the team.

**S19 · 00:59.00 to 01:01.15 · 75 f (1770 to 1844)**

- **Purpose:** verified by someone outside the team.
- **Sees:** Alex's view of the report, Verify (secondary button), z 2.6.
  - f1800: click (real).
  - f1803: "Verified" (green text) and "Reported by Louie Morris · Verified by Alex Morgan on 7 Oct".
  - Push to z 3.0 on that line and hold to f1844.
- **Source:** v2 beat L3. Fallback: clip 13, f250 to f260 real; hold on f285.
- **Text:** "It only counts once someone outside the team verifies it."
- **VO:** f1775 to f1840 "It only counts once someone outside the team checks it."
- **Sound:** a confident low "stamp".
- **Feels:** "These numbers are real."
- **Connects:** the camera pulls back hard to the Leadership plane.

**S20 · 01:01.15 to 01:04.15 · 90 f (1845 to 1934)**

- **Purpose:** leadership visibility.
- **Sees:**
  - f1845 to f1870: Leadership full frame (z 1.333).
  - f1850 to f1880: the "Verified hours saved" chart line is revealed by a left-to-right wipe mask of the real captured chart (no new data). "106" is held still. A counting animation is not used, because it would show numbers the product doesn't.
  - f1880 to f1934: glide to the "Went live" list, z 2.4, on "● Supplier Research Assistant · Louie Morris · Procurement · for Procurement team · 7 October" (or a later date if the dates progress).
- **Source:** v2 beat L4. Fallback: clip 14, the frame at 2.0 s (f60), held.
- **Text:** "Leaders see what AI actually delivered.", plus the demo-data note.
- **VO:** f1850 to f1930 "And leadership sees what AI actually delivered."
- **Sound:** the music lifts toward the final bars.
- **Feels:** confidence for the buyer (the AI programme lead).
- **Connects:** the line exits right toward the integrations beat.

#### ACT 6: Everywhere your work is, and the end (01:04.15 to 01:12.00)

**S21 · 01:04.15 to 01:07.00 · 75 f (1935 to 2009)**

- **Purpose:** integrations, clearly separated into built and coming soon.
- **Sees:**
  - f1935 to f1985: Admin > Integrations as captured in v2 (Slack and Teams channel rows and the delivery status), z 2.0, with the initiative header crop "Link your Teams or Slack channel · Calendar" sliding in beneath it (clip 07 header at 3.0 s, crop z 2.0).
  - f1985 to f2009: the plane dims to 40%. Text: "Coming soon: Spine inside Teams chat, Slack and Claude." In grey, with a small outline label "Coming soon".
- **Source:** v2 beat X1 (new). Fallback: clip 07 header crop only.
- **Text (f1945 to f1985):** "Posts to your Slack and Teams channels. Plans go straight into your calendar." The wording must stay within what INTEGRATIONS.md says is built; it shows no Slack message mock.
- **VO:** none. This shot is type-led, to keep the coming-soon line from being heard as a claim.
- **Sound:** the music continues; one soft tick.
- **Feels:** "It fits how we work."
- **Connects:** the camera pulls back to a wide shot.

**S22 · 01:07.00 to 01:12.00 · 150 f (2010 to 2159)**

- **Purpose:** the whole product as one spine, then the promise and the action.
- **Sees:**
  - f2010 to f2060: a long pull-back reveals every plane from the film arranged in three offset rows, matching the logo bars' proportions: Help Desk planes top, Ideas & Projects middle, Pulse and Leadership bottom. All are connected by the one cobalt line.
  - f2060 to f2090: the planes recede and the three rows collapse into the logo bars (an exact match-shape).
  - f2090 to f2159: the end card on navy:
    - "Spine" wordmark and logo (centre, 160 px).
    - Line 1, f2095: "Where your company's AI ideas get answered, built and proven." (white, 44 px).
    - f2110: an outlined cobalt "Book a demo" button and the URL placeholder "[URL TBC]".
    - The final frame holds 1.5 s.
- **Source:** motion graphics plus every plane used.
- **VO:** f2095 to f2150 "Spine. Where your company's AI ideas get answered, built and proven."
- **Sound:** the final pulse beat on f2090, and the music resolves to the tonic on f2100 with a 2 s tail. Silence on the last 10 frames.
- **Feels:** a memorable, specific promise.
- **Connects:** end.

### C.2 Timing self-check

- Product UI is on screen from f210 to f2090, which is 1880 of 2160 frames (87%).
- Held reads: S04 2.5 s, S05 1.0 s, S06 1.8 s, S07 2.8 s, S08 0.8 s, S09 2.1 s, S10 0.6 s, S11 1.0 s, S12 1.6 s, S13 3.0 s, S14 1.3 s, S15 1.8 s, S16 2.0 s, S17 0.6 s, S18 2.0 s, S19 1.4 s, S20 1.8 s, S21 1.6 s.
- S05, S08, S10 and S17 fall below the hold rule (0.6 s + words/3.5). They are mitigated by the editorial type line, which carries the same content, and by short UI reads ("Live" is one word). **GPT-6 should challenge S08 and S10 in particular.** The cleanest fix, if they prove too fast at the animatic stage, is to drop S10 ("Draft it") and give its 90 f to S08 and S11.

### C.3 Cutdowns

- **30 s:** S03 (logo), S04, S09, S13, S16, S17, S19, S20, S22 (shortened).
- **15 s:** S04 (60 f), S09 (90 f), S16 (90 f), S19 (75 f), S22 (135 f).
- **9:16 vertical (72 s):** recomposed rather than cropped. Captures re-run at the mobile viewport (390 × 844, DSF 3 = 1170 × 2532, the same as the supplied phone screenshots) so UI fills the frame natively. The same timeline, and type moved to the upper safe area (y 220 to 560).
- **Stills ×3:** S09 (Already answered?), S16 (banner gone, line beating), S22 (end card).
- **Teaser (optional, 15 to 20 s):** "Coming soon" Teams, Slack and Claude, with persistent "Concept · Coming soon" labelling. Out of scope of this plan's master.

---

## D. Technical production architecture

### D.1 Pipeline

```
spine-2 app (local, seeded, fixed clock)          Remotion 4.0.537 (React)          FFmpeg 6.1.1
  └─ capture-v2.mjs (Playwright, Chromium)   →      compositions: Master, 30s,  →     loudnorm, mux,
     frame-stepped PNG sequences at DSF 3           15s, Vertical, Stills             H.264 / ProRes masters
     + JSON manifest (beat, frame, event)           planes, camera, line, type
                                                    audio tracks (VO, music, SFX)
Audio: Kokoro (local TTS) or human VO · Runway sound-effects (free credits) · music (see E)
QA: ffprobe, frame extraction, contact sheets, loudness, cut-list diff against this storyboard
```

### D.2 Capture v2: re-recording the product (verified feasible)

**Verified in this session:**

- Started PostgreSQL 16 (system binaries, run as the `postgres` user, because embedded-postgres refuses root).
- Applied migrations, ran the seed, ran `next build` and `next start`.
- Ran the repository's own `scripts/record-clips.mjs` for clip 01 successfully.
- Captured Home at device scale 4 (5760 × 3240).
- Captured a typing sequence frame by frame at DSF 3 (4320 × 2430, lossless PNG) at **0.44 s per frame** (30 frames).
- Everything was then shut down and removed.

**Method:** a new script that, for each beat:

1. Resets the database to the beat's state (the existing record script already does this with direct Prisma updates between clips).
2. Sets `SPINE_TODAY` per beat, so the dates progress (pending your approval; see A.6, gap 8).
3. Logs in as the beat's person.
4. Drives the UI step by step (type one character, click and so on), taking a PNG after each step, plus N identical dwell frames after each result.
5. Writes a manifest of the frames, with an event label on each.

CSS transitions: either capture with `animations: "disabled"` (verified to run) and recreate any fade in Remotion, or step real time between screenshots for transitions shorter than 200 ms. The cursor: render it in Remotion from the manifest's pointer coordinates instead of baking it into the pixels, so it can be hidden during reads.

**Throughput estimate (from the measured rate):** about 1,100 captured frames of UI change for the whole master, at roughly 0.44 s each, is about 8 minutes of capture, plus dwell frames, which are duplicated rather than re-captured. Not yet measured for the full set.

**AI beats (Q2, I1):** the app has a dev-only fixture mode (`SPINE_AI_FIXTURES=1`, only when `NODE_ENV` isn't production, so it needs `next dev` rather than `next start`). Fixture text is canned. For example, the instant answer reuses the first line of a shared answer. It is real UI, but not real model output. The alternative is one or two real Claude calls with your `ANTHROPIC_API_KEY`: real output, at a cost of a few pence (unverified exact cost). **Your decision.** Unverified: how either looks on screen.

### D.3 Remotion (verified)

- `remotion@4.0.537` installed from npm here. A test composition rendered a 1920 × 1080, 90-frame H.264 file with an `OffthreadVideo` push-in and Inter type in **41.8 s** (bundling included, concurrency 4, CPU only, using the pre-installed Chromium headless shell).
- I can extract and view any rendered frame, as done for the test.
- The full 2,160-frame master at that rate is roughly 15 to 25 minutes per render, extrapolated and not measured. Camera motion blur (`@remotion/motion-blur`) multiplies render time by the sample count. Use it only on fast glides.
- Licence: free for individuals, for-profit companies with up to 3 employees, and non-profits; otherwise paid (Creators $25 per month per seat, according to Remotion's pricing page). **I don't know which applies to you.** This is a real budget question.

### D.4 Resolution

- 1080p master: sharp to z 3.0 with DSF-3 captures.
- 4K master: needs DSF-6 captures (8640 × 4860) to stay sharp at the same framing. Untested here; screenshot time and memory will rise. The fallback is a 1080p master plus 4K stills.

### D.5 What I can and cannot execute here

| Task | Can I do it here? | Status |
| --- | --- | --- |
| Read every source file | Yes | Verified |
| Run Spine 2.0 locally and re-capture | Yes | Verified |
| Build and render Remotion | Yes | Verified |
| Extract and inspect rendered frames | Yes | Verified |
| Encode the final H.264 MP4 and ProRes | Yes (libx264, libx265, prores_ks present) | Verified (present; a final delivery encode not yet run) |
| Loudness normalisation and measurement | Yes (FFmpeg loudnorm) | Present, not yet run |
| Local TTS voice (Kokoro, as in the previous trailer) | Probably. onnxruntime 1.29 is installed; the model must be downloaded | Unverified in this session |
| Runway sound effects | Yes, through the connected Runway MCP, 1 credit per second on your free workspace (500 credits) | Verified available, not used |
| Runway video and music | **No**. Your Runway workspace is free; `availableVideoModels` is empty, and music needs a paid plan | Verified |
| Veo, Kling or Grok Imagine directly | **No**. No API keys or connectors here. Their web apps would need you to generate and upload the files | Verified absence |
| Listen to audio | **No**. I can measure loudness, peaks, spectra and sync points, but not judge the sound | Limitation |
| Watch the film as a human does | **No**. I review frames and contact sheets, not motion as perceived | Limitation |
| Push the plan or renders to the repo | Yes, on the designated branch | Done for this plan |

### D.6 Optional generative shots (only if you approve a paid month)

Use only to replace the S02 mock-chat backdrop or to add one human beat before S22. The master works without them.

**G1 (S02 alternative, 4 s, 16:9).**

- **Why:** a real-world texture for "ideas go quiet" before the product enters.
- **Model:** Runway Gen-4.5 or Veo 3.1 through the Runway MCP. Both are listed in the tool's model enum. Availability on a paid plan and the per-call credit cost are **unverified**, because the cost table was truncated in the tool description.
- **Prompt:** "Locked-off close shot, 35mm, shallow depth of field. A smartphone lies face-up on a pale oak office desk at dusk, cool blue window light from the left, warm practical lamp far behind out of focus. The phone screen lights with a plain white notification card with no readable text, glows for two seconds, then dims and goes dark. No hands, no people, no logos. Calm, quiet, premium commercial look, natural grain, colour palette of deep navy and warm off-white."
- **Camera:** locked, with a 2% push added in Remotion.
- **Connection:** the dimming screen glow becomes the cobalt line (matched by luminance, then crossfaded at f150).
- **Likely failures:** readable fake text on the screen, warped phone geometry, flicker.
- **Fallback:** keep the motion-graphic S02 (the default).
- **Cost:** at the reported 12 credits per second for Gen-4.5, about 48 credits per attempt; plan on 4 attempts (about 200 credits). Unverified.

**G2 (pre-S22, 3 s).**

- **Prompt:** "Slow dolly-in, 50mm. A manager's hands rest beside an open laptop on a meeting-room table in morning light. The laptop screen is a flat, evenly lit, pure mid-grey rectangle facing camera at a slight angle, sharp edges, no reflections. No faces, no text, no logos. Clean modern office, navy and warm white tones, soft shadows."
- **Compositing:** a four-corner pin of the Leadership capture onto the grey screen, keyed every 5 frames by hand or with OpenCV feature tracking (installable from PyPI here; not tested), applied as a CSS `matrix3d` in Remotion. Add a reflection layer from the plate's screen luminance at 10 to 15%, a slight blur matched to the plate's depth of field, and matched grain.
- **Likely failures:** the screen bends or drifts (AI geometry), which makes the corner pin swim.
- **Fallback:** drop the shot.

---

## E. Budget

| Item | Cost | Needed? | Verified? |
| --- | --- | --- | --- |
| Claude Code (this environment) | Your existing plan | Yes | n/a |
| Remotion | $0 if you qualify as an individual, a company of 3 or fewer employees, or a non-profit; otherwise from $25 per month per seat | Yes | Licence terms read via search results and the official pricing page summary; **your eligibility is unknown** |
| Spine capture, FFmpeg, Playwright, Inter font, Kokoro TTS | $0 | Yes | Verified installed, except Kokoro |
| Runway sound effects | $0 (uses the free plan's existing 500 credits at 1 credit per second) | Recommended | Verified available, not spent |
| Music, option A: licensed library track you choose and download (for example YouTube Audio Library or Pixabay Music; check each licence for your use) | $0 | One of A, B or C | Licence terms not checked |
| Music, option B: Runway Standard for one month (also unlocks video generation for G1 and G2) | $15 per month billed monthly, according to search results; GBP price depends on exchange rate and VAT | Optional | Price from third-party sources, not runway.com |
| Music, option C: local synthesis (as before) | $0 | Fallback only | Previous result judged weak |
| Voice, option A: Kokoro local | $0 | Default | Unverified here |
| Voice, option B: you or a colleague record the VO (about 110 words) | $0 | Best quality for free | n/a |
| Voice, option C: ElevenLabs Starter (commercial use) | About $5 to $6 per month, according to search results | Optional | Not verified on elevenlabs.io |
| Claude API for real AI-feature captures (Q2, I1) | A few pence (unverified) | Optional | No |
| Veo through Google AI Pro / Flow | About $19.99 per month, according to search results. Videos may carry a visible watermark on Pro (2025 reports; current status unverified) | Not recommended | No |
| Kling Standard | About $7 to $10 per month, according to search results (sources disagree) | Not recommended (web only, no API here) | No |
| Grok Imagine | SuperGrok $30 per month, over budget; the free tier no longer includes video (according to search results) | No | No |

**Recommended spend:** $0 to $15 (one month of Runway Standard), plus Remotion only if your organisation doesn't qualify for the free licence. Within £20 either way, unless Remotion needs a paid seat (about $25, which is over the target) or exchange rates move.

---

## F. Risk assessment

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| 1 | I can't hear audio, so the music, VO and mix quality are unjudged by me | Certain | High | You review the audio at the animatic and final stages. I measure loudness (−14 LUFS integrated, −1 dBTP true peak), sync and spectra |
| 2 | I don't watch motion as a human does. Pacing errors may survive frame review | Likely | High | Render a 540p animatic early. You watch it on a phone and a laptop. A timing-change log follows |
| 3 | Synthetic VO sounds cheap | Medium | High | Option B: record a human VO. Or a no-VO cut, which is type-led |
| 4 | The "One Line" device feels gimmicky or cluttered | Medium | Medium | The line is 4 px and only visible between planes and at the three pulse moments. The animatic tests it |
| 5 | The AI instant answer (S06) or Draft it (S10) UI looks weak, or the fixture text is unconvincing | Medium | Medium | Fallbacks are specified for both shots |
| 6 | Re-capturing changes the demo data (dates) in ways you don't want | Low | Medium | Ask first (gap 8). The default keeps 7 October |
| 7 | The fallback (supplied clips only) caps zoom at about 2.0 and the reads become smaller | Certain if capture v2 is refused | High | Capture v2 is the main quality lever |
| 8 | Remotion licence cost if you aren't eligible | Unknown | Medium | Confirm eligibility first. FFmpeg-plus-Chromium frame rendering (as in the `claude/new-session` trailer) is a licence-free fallback |
| 9 | Generative plates warp or look like stock AI | High | Medium | Optional only; drop on failure |
| 10 | Render time grows with motion blur or 4K | Medium | Low | Blur only on glides. 4K only if needed |
| 11 | Claims drift beyond what's built (integrations, AI) | Medium | High | Every integration and AI line is checked against INTEGRATIONS.md and the code before rendering |
| 12 | The demo-data inconsistency ("Blocked for 1 day" vs "since 7 Oct") is noticed | Low | Low | Fixed by per-beat clocks in capture v2 |
| 13 | A session ends mid-render, so long renders are lost | Medium | Low | Render per shot, cache to disk, stitch at the end, commit sources often |

---

## G. Production readiness

**Available and verified:**

- All 15 clips, 18 screenshots, the brief, the app source, the integrations doc and the brand tokens.
- A local app build with seed data.
- A frame-stepped high-DPI capture path.
- Remotion and FFmpeg rendering.
- Frame inspection.
- Runway sound-effect access (free credits).

**Missing:**

- Captures Q2, Q4, I1 and X1 (none exist).
- Longer post-result dwells for the click beats.
- Music.
- VO.
- A demo URL.
- Your decisions in H.1.

**Unverified:**

- Kokoro installation in this session.
- The look of the AI answer and Draft it UI.
- Full-length render time.
- 4K capture at DSF 6.
- OpenCV tracking.
- Runway paid-plan model availability and video credit costs.
- All third-party prices (search results only; none confirmed on the vendors' own pages).
- Remotion licence eligibility.

---

## H. Schedule, quality control and definition of done

### H.1 Decisions I need from you (once, up front)

1. Approve capture v2 (re-recording from the local app). Optional: progressing dates per beat.
2. AI beats: fixtures (canned, free) or real Claude calls (a few pence, needs your key), or skip S06 and S10.
3. Music: a library track you pick, Runway Standard for one month, or local synthesis.
4. Voice: Kokoro, your own recording, or no VO.
5. Is your organisation eligible for Remotion's free licence?
6. Approve spending free Runway credits on sound effects (about 60 to 120 credits).

After these answers, phases 1 to 6 run without further approvals, except the two review checkpoints marked ◆.

### H.2 Phases

| Phase | Work | Tools | Deliverable | Depends on | Effort (my estimate) | Blockers | Acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 Capture | Write capture-v2.mjs; capture 18 desktop beats and the vertical set; manifest | Playwright, local app, Postgres | PNG sequences and a manifest; contact sheet per beat | H.1 items 1 and 2 | 1 to 2 sessions | Database state resets between beats | Every beat's event frames match this storyboard; no loading frames; no cursor in the PNGs |
| 2 Animatic | Remotion project, timeline, planes, camera, placeholder type, temp VO and click track | Remotion | 540p animatic MP4 and a cut list | 1 | 1 session | none | Timings match C.1 within 1 frame. ◆ You watch it and give notes |
| 3 Design | The line system, type, transitions, the end card, demo-data notes, motion blur | Remotion | 1080p picture lock (silent) | ◆ notes | 1 to 2 sessions | none | QA checklist H.3 passes |
| 4 Sound | VO, SFX through Runway, music, mix, loudness | Kokoro or human VO, Runway, FFmpeg | Mixed stems and the master WAV | H.1 items 3, 4 and 6 | 1 session | Paid music if chosen | −14 LUFS ±0.5, −1 dBTP; sync points within 1 frame. ◆ You listen |
| 5 Optional generation | G1 and G2 | Runway (paid) | Plates and composites | Budget approval | 1 session | Credits, failures | Passes the AI-artefact check, or the shot is dropped |
| 6 Delivery | Master, 30 s, 15 s, 9:16, stills, captions SRT, script | Remotion, FFmpeg | Files on the branch and a QA report | 3 and 4 | 1 session | Repo size (keep MP4s small or use releases) | H.4 definition of done |

A "session" is one working session in this environment; five-hour limits may split them.

### H.3 Quality control

1. **Product accuracy.** Every on-screen UI frame comes from a capture manifest entry. A script diffs the rendered frame regions against their source PNGs (scaled) to prove no UI pixels were painted over, except overlays declared in the storyboard. Every claim line is checked against the code or INTEGRATIONS.md.
2. **Feature coverage matrix.** Help Desk (ask, AI first answer, Champion, share consent, Already answered); Ideas (draft, approve or auto-approve, join, AI plan, owned steps); Collaboration (Priya, Mia, Ben, Louie, Jamie and Alex each act); Pulse (stall, flag, unblock); Live, report, verify, leadership; Integrations (built versus coming soon). Each is ticked only when its shot passes review.
3. **Readability.** For each shot, the primary-read text height is computed from its source font size × z and must be at least 30 px x-height at 1080p. Phone check: downscale every hold frame to 390 px wide and inspect.
4. **Timing.** Automated: extract frames at every shot boundary and keyframe listed in C.1 and compare against the expected content. Human: you watch the animatic and final.
5. **Visual.** Contact sheets at 2 fps; checks for colour tokens only, no italics, no em dashes, consistent type sizes, safe areas, cursor-free reads, no loading frames.
6. **Sound (measurable).** Loudness, peaks, SFX on click frames (within ±1 frame), VO not overlapping key reads.
7. **AI artefacts (optional plates).** Frame-by-frame review at 6 fps for warping, fake text and flicker. Any doubt means the shot is dropped.
8. **Iteration loop.** Render the changed shots only. Re-run the checks. Update the QA report with what changed and why.

### H.4 Production-ready means

- Every box in the coverage matrix is ticked.
- Every primary read passes the readability rule, or carries its verbatim type line.
- There is no invented UI, no AI scores, and no unlabelled future features. Acme numbers carry the demo-data note.
- The masters decode cleanly: H.264 High, yuv420p, BT.709, 30 fps CFR, AAC 48 kHz, faststart, −14 LUFS.
- You have watched and listened on a phone and a laptop and approved.

---

## FINAL VERDICT FOR GPT-6 — INDEPENDENT REVIEW REQUEST

GPT-6, I'm handing you this production plan for an independent assessment. Here is my honest position.

**1. Can I actually build this trailer?**
**YES, WITH CONDITIONS.** I can build the picture side to a high standard in this environment. The audio side and the final judgement on motion and pacing need a human, because I cannot hear the result and I don't perceive motion the way a viewer does.

**2. What I have personally verified (in this session):**

- I read the brief and all integration and AI source code.
- I inspected all 15 clips frame by frame: contact sheets, plus frame-difference timing of every click and result.
- I viewed all 18 screenshots and the previous 80-second trailer.
- I built and ran Spine 2.0 locally with its seed data.
- I re-recorded a clip with the repository's own script.
- I captured lossless 3× and 4× UI frames, frame-stepped at 0.44 s per frame.
- I rendered a Remotion 1080p test and inspected its frames.
- I confirmed FFmpeg encoders and filters.
- I confirmed my Runway access: a free workspace with 500 credits, sound effects only.

**3. What I can execute myself:**

- Re-capture every product beat at high resolution.
- Build the full Remotion project (camera, the line system, typography, transitions, end card).
- Render every version and inspect frames.
- Run automated QA (timing, readability, loudness, format).
- Generate sound effects with the free Runway credits.
- Assemble and encode the deliverables.
- Iterate on notes.

**4. External tools I need:**

- Music: a library track you choose, or Runway Standard (paid) to generate one.
- Optionally a human voice or ElevenLabs.
- A Remotion licence if the user's organisation isn't eligible for the free one.
- For any generative video, a paid Runway plan (the only video generator I can drive from here).

**5. Not possible within £20 a month:**

- A people-first live-action film (Concept 3) at acceptable quality.
- More than about 50 seconds of generated video per month.
- Veo watermark-free output (if the visible-watermark rule still applies to Pro).
- Grok Imagine (SuperGrok is $30).
- Remotion paid seat plus Runway in the same month, if the user isn't eligible for the free licence.

**6. Will it produce genuinely high-end visuals?**
I believe the picture can look premium: crisp full-frame UI, controlled camera, one strong visual device, a disciplined palette. I'm less sure it will feel *cinematic* in the way the brief imagines. Without live action it is a motion-design film, not a cinema film. That is a deliberate trade-off, and you may disagree with it.

**7. Is every major Spine feature demonstrated?**
On paper, yes, including the AI instant answer, consent to share, Draft it and the integrations, which no previous cut showed. But four of those shots (S06, S08, S10, S21) depend on captures that don't exist yet and UI I haven't seen rendered.

**8. Does the pacing give viewers enough time to read the UI?**
For most shots, yes (1.3 to 3.0 s still holds, with z 2.3 to 3.0). S05, S08, S10 and S17 are below my own hold rule. I have flagged them. The fix is to drop S10.

**9. The biggest weaknesses in my proposal:**

- (a) I can't hear, so audio quality is the single biggest unknown.
- (b) 72 s is longer than the brief's recommended 60.
- (c) The line motif could feel like a device rather than an idea if it's over-used.
- (d) Two AI beats rely on fixture or canned text or a paid API call.
- (e) All prices come from third-party search results, not vendor pages.
- (f) It has no real people. The collaboration story is carried by names, avatars and actions in the UI only.

**10. What you should challenge, improve or reject:**

- Whether 72 s is justified, or whether a 60 s cut without S10 and S21 is stronger.
- Whether "One Line" is distinctive enough or reads as decoration.
- Whether the AI instant-answer beat breaks the brief's rule that AI never looks like it's running things.
- Whether a type-led no-VO version would be more premium than synthetic VO.
- Whether the mock-chat cold open is clichéd.
- Whether progressing the dates is worth changing the demo data.
- Whether the Remotion licence question changes the toolchain.

**11. My confidence: 6.5 out of 10** that the result will be *genuinely outstanding*, and **8 out of 10** that it will be clearly better than the previous edit, accurate and readable.

- In favour: a verified capture-and-render pipeline, sharpness evidence, exact source timings, a cohesive concept, and a near-zero budget dependency.
- Against: unheard audio, untested AI-beat UI, a pacing judgement I can't make myself, and no human footage.

**12. My recommendation: PROCEED** with the toolchain as proposed (local capture v2, Remotion, FFmpeg, free Runway sound effects), after the six decisions in H.1. A human review sits at the animatic and at the audio stage. Revise the storyboard after the animatic. Don't reconsider the toolchain unless the Remotion licence is unavailable, in which case switch to the FFmpeg-plus-Chromium frame renderer already proven in the `claude/new-session-41hpt8` branch.
