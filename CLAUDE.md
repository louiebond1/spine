# Spine: build brief

The 13 final mockups are in /design: 01-home.png, 02-help-desk.png, 03-question-thread.png, 04-propose-idea.png, 05-ai-review.png, 06-admin-approval.png, 07-pipeline.png, 08-project-workspace.png, 09-pulse.png, 10-programme.png, 11-leaderboard.png, 12-admin-settings.png, 13-home-all-clear.png. Read this whole file and open every mockup before doing anything.

## 1. What Spine is

Spine is an AI adoption platform for companies, positioned as an AI project manager. It makes sure good AI ideas and questions never quietly die. This is a fresh codebase built from scratch.

It has three parts:

- **Help Desk:** anyone posts an AI question, a Champion claims it and chats privately with the asker until it's resolved
- **Ideas & Projects:** ideas get an owner, an advisory AI review, leadership approval, a team, an AI-generated build plan, then publishing and Live
- **Pulse:** surfaces anything going quiet (approvals near timeout, unclaimed questions, stalled builds), in the app and as a daily Slack digest

**The core principle:** Spine is quiet until a human is needed. Every screen must answer "what do I do first?" at a glance. When in doubt, show less. Never add a feature, panel, badge, colour or piece of text that isn't in this brief or the mockups.

**Sources of truth:** the mockups in /design decide how things look. This brief decides how things behave. Where a mockup and this brief disagree on behaviour, follow the brief. Where they disagree on appearance, follow the mockup. If you're unsure, ask instead of guessing.

## 2. Stack and environment

- **Framework:** Next.js (App Router) with TypeScript in strict mode
- **Styling:** Tailwind CSS with the design tokens in section 3 defined in the Tailwind config. Don't use a component library that brings its own look. Icons from lucide-react
- **Database:** PostgreSQL with Prisma
- **AI:** Anthropic API for the AI review and the build plan. Read `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` from environment variables, never hard-code either. Ask Claude for JSON and validate it with zod. If a call fails, show a calm grey message ("The AI review couldn't run. Try again.") and never block the user
- **Charts:** a lightweight library (for example Recharts) styled to the design system, or hand-built SVG
- **Hosting:** Railway, app plus Postgres
- **Auth:** for now a demo mode. A small user switcher (in the user menu at the bottom of the sidebar) lets me view the app as any seeded person. Keep all permission checks on the server so real auth can be added later without rewrites
- **Time:** read "today" from `SPINE_TODAY` when it's set (for example `2026-10-07T10:00:00`), otherwise use the real time. All seeded data is relative to that date so the mockups render the same every time
- **Slack:** send the digest through `SLACK_WEBHOOK_URL`. If it isn't set, log the digest to the console instead of failing
- Provide a `.env.example` listing every variable, and a README with how to run, seed and deploy

## 3. Design system

**Important:** the values below are starting estimates taken by eye from the mockups. Before building, sample the real colours, font sizes, spacing and radii directly from the images in /design. Where your measurements differ from these numbers, use your measurements, then write the final values into the Tailwind config and use only those tokens everywhere. Never use one-off values in a component.

**Colours (starting estimates)**

| Token | Value | Used for |
| --- | --- | --- |
| background | #F7F8FA | Page background |
| surface | #FFFFFF | Containers, sidebar, top bar |
| border | #E6E8EE | Borders and dividers |
| text | #0F1733 | Titles and body |
| text-muted | #6B7387 | Dates, meta lines, labels |
| brand | #1660FF | Actions, links, active nav, focus |
| brand-hover | #0F4FE0 | Hover on brand elements |
| brand-soft | #EEF3FF | Active nav background, "You" row, Pulse pill |
| neutral-soft | #F1F3F7 | Icon tiles, avatars, collapsed rows |
| live | #22C55E | The Live dot only |

No other colours anywhere. No amber, red, orange, purple, pink or tinted avatars. Urgency is shown with weight, never colour. No italics anywhere in the app.

**Typography (Inter via next/font, starting estimates)**

- Page date: 15px, regular, text-muted
- Page headline: 40px, semibold, slightly tight letter-spacing
- Section heading ("Your work"): 20px, semibold
- Row title: 17px, medium
- Meta and reason lines: 15px, regular, text-muted
- Small labels and column headers: 13px, medium, text-muted
- Uppercase section labels (Propose an idea, Programme): 12px, semibold, letter-spacing 0.08em, text-muted

**Shape and spacing**

- 4px spacing scale. Rows have generous vertical padding, roughly 20 to 24px
- Corner radius: 12px for containers, 10px for buttons, inputs and icon tiles
- 1px borders. No shadows, except a very faint one on the top bar if the mockups show it
- Main content is centred with a max width of about 1180px. The page date and headline line up with the content's left edge

**Buttons**

- Primary: filled brand, white text, optional "→". Only ONE primary button per screen, for the single most important action
- Secondary: white background, brand border and brand text, optional "→"
- Text link: brand text, no border
- All buttons the same height and radius

**Rules that apply everywhere**

- One container per section with simple dividers between rows. Never cards inside cards
- No ⋮ menus, no tag pills and no badges, except the Pulse count pill and the small "You" label
- No page-level "+" buttons. "+ New" in the top bar is the only way to create something
- No subtitles under headlines, except the one grey line on the all clear Home
- Neutral grey initials avatars only, never photos
- Simple outline icons with one consistent stroke width
- No em dashes anywhere in UI copy or seed data
- Empty states are one calm grey sentence, never an illustration

## 4. App shell and shared components

Every page uses the same shell, exactly as in the mockups.

**Left sidebar** (about 280px, surface background, 1px right border)

- Top: the Spine logo. The wordmark "Spine" next to an abstract mark of 3 to 4 short, slightly offset rounded horizontal bars in brand cobalt. Build it as an inline SVG matching 01-home.png
- Nav: Home (house icon), Help Desk (speech bubble), Ideas & Projects (lightbulb), Pulse (heartbeat line, with a brand-soft count pill when there are Pulse items, hidden when there are none), Leaderboard (trophy)
- A small "Manage" caption, then Programme (bar chart icon) and Admin (gear). Manage and its items only show for admins
- Only the current page is highlighted: brand-soft background, brand text and icon
- Bottom: initials avatar, name and roles ("Champion · Admin"), and a chevron that opens a small menu with the demo user switcher

**Top bar** (surface background, 1px bottom border)

- Search field with a "⌘ K" hint. Clicking it or pressing ⌘K opens a command palette that searches questions, projects and people, plus two actions: Ask a question, Propose an idea
- "+ New" outline button with a chevron. Dropdown: Ask a question, Propose an idea
- Bell icon. Shows a small brand dot only when something on Home needs the current user. Clicking it opens a simple dropdown listing the same items as Home's needs you list, or "Nothing needs you right now"

**Build these shared components first** and use them on every page: Shell, Sidebar, TopBar, PageHeader (date plus headline), Container, Row, IconTile, Avatar, Button (primary, secondary, text), Tabs (plain text with underline), SegmentedToggle, TextField, TextArea, Select, NumberField, Stepper, LiveDot, Checkbox, CommandPalette, Modal. No page builds its own version of any of these.

## 5. Roles and permissions

A person can hold several roles at once. Everyone is at least a member. Enforce every rule below on the server, not just by hiding buttons.

| Action | Member | Champion | Publishing specialist | Admin |
| --- | --- | --- | --- | --- |
| Ask a question (named or anonymous) | Yes | Yes | Yes | Yes |
| Claim and answer questions | No | Yes | No | Yes, if also a Champion |
| Post in a question thread | Only as the asker | Only as the asker or claimer | Only as the asker | Only as the asker or claimer |
| Propose an idea | Yes | Yes | Yes | Yes |
| See their own idea's AI scores | Yes | Yes | Yes | Yes |
| See anyone else's AI scores | No | No | No | No |
| Join a recruiting project | Yes | Yes | Yes | Yes |
| Edit a project's plan | Team members only | Team members only | Team members only | Team members only |
| Publish a project | No | No | Only projects assigned to them | No |
| Approve or return ideas | No | No | No | Yes |
| See Programme and Admin | No | No | No | Yes |

Nobody, including admins, ever sees another person's AI scores. Admins only see the neutral "AI review raised concerns" flag. The anonymous asker's identity is never shown to anyone, including admins and the claimer.

## 6. Data model

Turn this into a Prisma schema in the plan. Every table gets an id and created and updated timestamps.

| Model | Fields |
| --- | --- |
| User | name, initials, isChampion, isAdmin, isPublishingSpecialist |
| Topic | name (seed: Security, Office, Excel, SAP, Technical, Productivity, Procurement, Finance, Sales, Operations, Legal, People) |
| Question | title, body, askerId, isAnonymous, topicId, status (unclaimed, in progress, resolved), claimerId, postedAt, claimedAt, resolvedAt |
| QuestionMessage | questionId, authorId, body, sentAt |
| Attachment | messageId, fileName, sizeBytes, storageKey |
| QuestionEvent | questionId, type (posted, claimed, replied, replied with a file, resolved, reopened), actorId, at |
| Project | title, problem, whoBenefits, topicId, buildPath (app, cowork-native), teamSize, hoursPerWeek, lengthWeeks, difficulty (easy, moderate, hard), targetDate, ownerId, stage, submittedAt, autoApproveAt, approvedAt, approvedById, returnNote, publisherId, liveAt, lastActivityAt |
| AiReview | projectId, feasibility, businessValue, resourcingConfidence, originality (each 1 to 10 with a one-line explanation), relatedProjectId, raisedConcerns (true when any score is 5 or below), completedAt |
| TeamMember | projectId, userId, joinedAt |
| PlanStep | projectId, title, activePhrase, assigneeId, dueDate, done, doneAt, order, generatedFromBrief |
| ProjectMessage | projectId, authorId, body, sentAt, isSystem |
| ProjectEvent | projectId, type, actorId, detail, at |
| ImpactLog | projectId, month, hoursSaved |
| Settings | approvalTimeoutDays (7), stalledBuildDays (10), unclaimedQuestionHours (2), digestChannel (Slack), digestTime (09:00), digestWeekdaysOnly (true), hourlyCost (empty), programmeCost (empty) |

Points are not stored. A Champion's points for a period are the number of questions they claimed that were resolved in that period.

## 7. Behaviour rules

### Help Desk

1. **Asking:** title, details, topic and an "Ask anonymously" checkbox. While the title is typed, show up to three similar resolved questions under the field ("Already answered?") with links. Matching can be simple text similarity
2. **Duplicate reopen:** if the asker picks one of their own resolved questions from the suggestions, it reopens that thread (status back to in progress with the same claimer, a "reopened" event logged) instead of creating a new one
3. **Claiming:** any Champion can claim an unclaimed question. It becomes in progress, the claimer is recorded and the thread opens for them
4. **Thread:** only the asker and claimer can post. Messages can include file attachments. Every action is logged as a QuestionEvent for the History panel
5. **Resolving:** either the asker or claimer can mark it resolved. The claimer gets 1 point
6. **Waiting on you:** a question is waiting on the claimer when the last message is from the asker

### Ideas & Projects

1. **Stages for App ideas:** Idea, Approval, Recruiting, Building, Publishing, Live
2. **Stages for Cowork-native ideas:** Idea, Recruiting, Building, Approval, Publishing, Live
3. **Proposing:** the form in 04-propose-idea.png. "Continue to AI review" saves the idea as a draft and runs the AI review
4. **AI review:** Claude scores Feasibility, Business value, Resourcing confidence and Originality from 1 to 10, higher is always better, each with one short plain-English explanation. Originality compares the idea against all existing projects and names the closest one. Scores are advisory only and never block anything
5. **Submitting:** "Submit for approval" (App) moves it to Approval and sets autoApproveAt to now plus the approval timeout. For Cowork-native, submitting moves it straight to Recruiting, and it goes to Approval after the build is finished
6. **Approval:** admins see the idea details and, if raisedConcerns is true, the neutral flag "AI review raised concerns". They can Approve or Return with note. Returning sends it back to the owner as a draft with the note shown at the top of the form
7. **Auto-approve:** if nobody acts by autoApproveAt, the idea is approved automatically and the timeline says "Auto-approved". Check this whenever the app is loaded and in the daily job
8. **Recruiting:** members can join until the team reaches teamSize. When it's full, the project moves to Building and Claude generates the build plan from the problem and details: 6 to 10 concrete steps, each assigned to a team member with a due date spread before the target date, all marked "Generated from project brief". For each step Claude also writes a short present-tense phrase (for example "testing supplier cases") stored on the step and used in the next action sentence
9. **Building:** team members can add, edit, reorder, reassign and tick off steps. Ticking or editing updates lastActivityAt
10. **Finishing the build:** when every step is done, App projects move to Publishing. Cowork-native projects move to Approval first, then Publishing once approved
11. **Publishing:** assigned automatically to the publishing specialist with the fewest projects currently in Publishing (ties go to whoever was assigned least recently). They mark it Live
12. **Live:** the team can log hours saved per month on the project
13. **Next action sentence:** every project shows one computed sentence. Approval: "Next: Waiting for leadership approval". Recruiting: "Next: Recruit N more people to begin" ("1 more person" when one). Building: "Next: [assignee first name] is [activePhrase of the next open step]". Publishing: "Next: [publisher first name] is publishing this" or "You're publishing this". Live: "Live · N hours saved this month"

### Pulse

Three checks, recalculated on every page load:

- **Approval nearing timeout:** in Approval with less than 24 hours until autoApproveAt. Action: Review
- **Unanswered question:** unclaimed for longer than unclaimedQuestionHours. Action: Claim
- **Build going quiet:** in Building with no activity for longer than stalledBuildDays. Action: Open

Pulse shows at most one item per check: the one that crossed its threshold most recently, so it stays a short nudge rather than a backlog (the full lists live on Help Desk and Ideas & Projects). This is a product decision I may change, so keep it easy to switch to showing every item. Items disappear as soon as their condition stops being true. The daily digest sends the same list to Slack at digestTime (weekdays only when set), and sends nothing when the list is empty.

### Home

The needs you list for the current user, in this order:

1. Approvals waiting on them (admins only, never their own ideas), soonest auto-approve first
2. Questions they've claimed that are waiting on them
3. Projects in Publishing assigned to them

The headline is "N things need you" ("1 thing needs you" for one). The top item gets the only primary button. When the list is empty, show the all clear state from 13-home-all-clear.png. Your work shows the user's three most recently active projects that are past Approval and that they own, are on the team of, approved or published, leaving out anything already in the needs you list. "View all" goes to Ideas & Projects filtered to them.

### Programme

- **Recent wins:** projects that went Live within the selected period (Last 30 days, Last 90 days, This year)
- **Big flags:** "Waiting on approval" lists ideas in Approval for more than 3 days. "Stalled builds" lists projects in Building with no activity for longer than stalledBuildDays
- **Value over time:** total hours saved per month as a line chart. "Estimated value" multiplies hours by hourlyCost. If hourlyCost isn't set, the chart area shows one grey sentence: "Add an hourly cost in Admin > Impact assumptions to see estimated value"
- Never show AI scores, speed metrics or rankings of people on this page

### Leaderboard

Champions ranked by points in the selected period (This month, Last month, This year), highest first. Ties share a rank. The current user's row is highlighted with a "You" label. Champions with 0 points are listed after everyone else.

## 8. Screen by screen

### Mocked up screens (match the image)

| Route | Mockup | Primary button | Notes |
| --- | --- | --- | --- |
| / | 01-home.png and 13-home-all-clear.png | The top needs you item | Rows: icon tile, title, one reason line, button. Your work rows: title and status line only |
| /help-desk | 02-help-desk.png | None | Tabs Open, Mine (count), Resolved, All. Groups Unclaimed and In progress. Search filters by title |
| /help-desk/[id] | 03-question-thread.png | Send | Private chat, newest at the bottom. Composer: attach, field, Send, outline Mark resolved. History panel on the right |
| /ideas/new | 04-propose-idea.png | Continue to AI review | Three sections. Build path as two selectable cards |
| /ideas/[id]/review | 05-ai-review.png | Submit for approval | Four score rows, advisory line, outline Edit idea |
| /ideas/[id]/approve | 06-admin-approval.png | Approve | Admins only. Neutral concern flag, details table, slim right column with countdown, timeline and actions |
| /ideas | 07-pipeline.png | None | Pipeline / List toggle, five columns, compact cards |
| /ideas/[id] | 08-project-workspace.png | None | Breadcrumb, small stepper, next action line, tabs Plan, Chat, Team, Timeline |
| /pulse | 09-pulse.png | Top item | Same row style as Home |
| /programme | 10-programme.png | None | Admins only |
| /leaderboard | 11-leaderboard.png | None | Narrow list, "You" row highlighted |
| /admin | 12-admin-settings.png | Save changes | Admins only. Tabs, Rules active by default |

### Screens that weren't mocked up

Design these yourself using only the components and rules above, so they look like they belong with the mockups. Show me a screenshot of each one for approval.

- **Ask a question:** a modal from "+ New" or the command palette. Fields: title, details, topic, "Ask anonymously" checkbox. The similar questions suggestions appear under the title. Primary button: Ask
- **Ideas & Projects List view:** one container with rows, columns for title, owner, stage, build path and next action. Sortable by stage. Same filters as the pipeline
- **Project Chat tab:** same chat style as the question thread, open to the whole team, system messages in small grey text ("Mia completed Fix edge cases from testing")
- **Project Team tab:** one container listing members with avatar, name and role in the project (Owner or Member), and "N of M people" while recruiting. A "Join project" secondary button only while recruiting and not full
- **Project Timeline tab:** one container of dated events, newest first, grouped by day, plain grey text
- **Return with note:** a modal with a text area and a primary "Return to owner" button
- **Log hours saved:** on Live projects, a small row on the Plan tab: "Hours saved this month" with a number field and a secondary Save button
- **Admin tabs:** People & roles (list of people with checkboxes for Champion, Admin and Publishing specialist), Topics (list with add, rename and remove), Publishing specialists (list with their current publishing load), Impact assumptions (hourly cost and programme cost number fields)
- **Resolved Help Desk tab and closed states:** same rows, status line "Resolved by [name] · [date]"
- **Command palette:** centred modal, search field at the top, grouped results (Questions, Projects, People, Actions), keyboard navigation
- **Errors and loading:** skeleton rows in the same shape as the real rows. Errors are one calm grey sentence with a retry text link

## 9. Seed data

Today is Wednesday 7 October 2026, 10:00. Viewing the app as Alex Morgan must reproduce every mockup exactly. Take any wording not listed here directly from the mockups.

### People

| Name | Initials | Roles |
| --- | --- | --- |
| Alex Morgan | AM | Champion, Admin, Publishing specialist |
| Louie Morris | LM | Champion |
| Jamie Chen | JC | Champion |
| Sarah Kim | SK | Champion |
| Mia Thompson | MT | Champion, Publishing specialist |
| Priya Shah | PS | Member |
| Ben Carter | BC | Member |

### Open questions

| Question | Asker | Topic | Posted | Status |
| --- | --- | --- | --- | --- |
| Best way to anonymise client data? | Ben Carter | Security | 2h 5m ago | Unclaimed |
| Is Claude allowed to access client information? | Anonymous | Security | 4h ago | Unclaimed |
| Create a template for client status reports? | Priya Shah | Office | 1 day ago | Unclaimed |
| Can Claude analyse multiple Excel files? | Sarah Kim | Excel | 2h ago | Claimed by Alex 1h ago, 2 replies, last message from Sarah |
| How do I use Claude with SAP data? | Louie Morris | SAP | 2h ago | Claimed by Mia Thompson, 2 replies |
| Error when connecting Claude to SAP | Jamie Chen | Technical | 5h ago | Claimed by Alex, 1 reply, last message from Alex |
| Turn meeting notes into a client email? | Mia Thompson | Productivity | 1 day ago | Claimed by Louie Morris, 1 reply |

The Excel thread uses the exact three messages and the Sales_Data_Sample.xlsx (240 KB) attachment from 03-question-thread.png.

### Resolved questions (for the Leaderboard)

Generate realistic resolved questions so that, for October 2026, Jamie Chen has 18, Mia Thompson 14, Sarah Kim 11, Louie Morris 8 and Alex Morgan 6 resolved. Spread them from 1 to 6 October with believable titles and topics. Also seed a smaller spread across July to September so other periods aren't empty.

### Projects

| Project | Owner | Topic | Path | Stage and state |
| --- | --- | --- | --- | --- |
| Supplier Research Assistant | Louie Morris | Procurement | App | Approval. Team size 3, 2 hrs a week, 4 weeks, Moderate, target 19 Nov 2026. Problem: "Sourcing supplier information is slow and manual, with key details spread across different websites and documents." Who benefits: Procurement team. Submitted 30 Sep 16:00, AI review 30 Sep 16:05 with raisedConcerns true, auto-approves 7 Oct 16:00 |
| Supplier Risk Checker | Alex Morgan | Procurement | App | Approval, submitted today 09:40. Team size 2, 2 hrs a week, 3 weeks, Moderate, target 26 Nov 2026. Problem and AI scores exactly as in 04 and 05 (8, 7, 7, 4, Originality linked to Supplier Research Assistant) |
| Client Brief Generator | Alex Morgan | Sales | Cowork-native | Recruiting, 3 of 4 people, last activity 4 days ago |
| Meeting Summary Bot | Sarah Kim | Operations | Cowork-native | Recruiting, 1 of 3 people |
| AI Invoice Assistant | Jamie Chen | Finance | App | Building, approved by Alex. Team Jamie Chen, Mia Thompson, Sarah Kim. Target 19 Nov 2026. 9 steps, 6 done. Open steps: "Test against real supplier cases" (Jamie, 9 Oct, activePhrase "testing supplier cases"), "Fix edge cases from testing" (Mia, 14 Oct), "Prepare for publishing" (Jamie, 16 Oct). Last activity 2 hours ago |
| Contract Clause Checker | Mia Thompson | Legal | App | Building, 3 of 7 steps done, last activity 12 days ago |
| Knowledge Search Assistant | Priya Shah | People | Cowork-native | Publishing, build completed and assigned to Alex 2 hours ago |
| Claude Onboarding Guide | Priya Shah | People | Cowork-native | Live since 14 Jul 2026, published by Alex, last activity 1 day ago |
| Expense Review Assistant | Ben Carter | Finance | App | Live since 4 Aug 2026, published by Mia Thompson |

Invent realistic completed steps, team members, chat messages and timeline events for every project, consistent with this table.

### Hours saved

| Month | Claude Onboarding Guide | Expense Review Assistant | Total |
| --- | --- | --- | --- |
| July 2026 | 6 | 0 | 6 |
| August 2026 | 10 | 6 | 16 |
| September 2026 | 12 | 18 | 30 |
| October 2026 | 14 | 28 | 42 |

### Settings

Approval timeout 7 days, stalled build threshold 10 days, unanswered question threshold 2 hours, digest to Slack at 09:00 on weekdays, hourly cost and programme cost empty.

### All clear scenario

A second seed command (`npm run seed:all-clear`) loads the same data but with nothing needing Alex: Supplier Research Assistant already approved, the Excel question's last message from Alex and Knowledge Search Assistant already Live. It must reproduce 13-home-all-clear.png, with no Pulse pill and no bell dot.

## 10. How to work

### Plan first

Before writing any app code, write PLAN.md: folder structure, Prisma schema, shared components, routes, where each behaviour rule in section 7 lives in the code, the phases, and a list of questions or contradictions you found. Then stop and wait for approval.

### Phases

Commit at the end of each phase and stop for approval before starting the next.

1. Setup, sampled design tokens, every shared component, app shell, seed scripts
2. Home (both states) and Pulse
3. Help Desk, question thread and Ask a question
4. Propose an idea, AI review, Admin approval and Return with note
5. Pipeline, List view and project workspace (all four tabs, hours saved)
6. Programme, Leaderboard and all Admin tabs
7. Slack digest, auto-approve job, command palette, loading and error states, final polish

### Visual check after every screen

1. Run the app with the seed loaded and `SPINE_TODAY` set
2. Open the page in the browser at 1536 x 1024, signed in as Alex Morgan
3. Take a screenshot and compare it side by side with its mockup
4. Check, in this order: layout and alignment, spacing, type sizes and weights, colours, icons, copy and data, then anything extra that isn't in the mockup
5. List every difference, fix them, screenshot again and repeat until it matches
6. Where two mockups slightly disagree with each other, follow the design system so the whole app stays consistent

### Before calling a phase done

- Every screen in the phase passes the visual check
- Every behaviour rule in the phase works, including the permission rules on the server
- Only one primary button per screen, no colours outside the tokens, no italics, no em dashes, no ⋮ menus, no cards inside cards
- No TypeScript errors, no console errors, no hard-coded colours or sizes outside the tokens
- A short summary for me: what's built, anything you couldn't match and why, and any decisions you made

### Never

- Add features, screens, badges, colours or copy that aren't in this brief
- Show AI scores to anyone except the idea's owner
- Reveal an anonymous asker
- Skip the visual check because it "looks close enough"
