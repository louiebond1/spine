# Spine: build plan

Status: **draft, waiting for approval.** No app code has been written.

Inputs read: `CLAUDE.md` (all 11 sections) and all 13 mockups in `/design`.

---

## 0. How to read this plan

- Section 1 to 5 are the structure: folders, schema, components, routes, server modules.
- Section 6 maps **every behaviour rule in CLAUDE.md section 7** (plus the permission table in section 5) to the file that owns it.
- Section 7 is the phases, with the visual check built into each.
- Section 8 is the questions and contradictions. **Several of them block an exact mockup match, so I need answers before or during Phase 1.** Each one has a recommended default I'll use if you just say "go with your defaults".

---

## 1. Folder structure

```
spine/
  CLAUDE.md
  PLAN.md
  README.md                    run, seed, deploy (Railway)
  .env.example                 every env var, commented
  package.json                 scripts: dev, build, start, lint, typecheck,
                               db:migrate, seed, seed:all-clear, job:daily
  tailwind.config.ts           the ONLY place colours, sizes, radii, spacing live
  next.config.ts
  tsconfig.json                strict: true
  railway.json                 build/start commands, cron service for job:daily
  design/                      the 13 mockups (unchanged)
  prisma/
    schema.prisma
    migrations/
    seed/
      index.ts                 `npm run seed`            (default scenario)
      all-clear.ts             `npm run seed:all-clear`  (default + overrides)
      data/people.ts
      data/topics.ts
      data/questions.ts        open + resolved (Oct 1 to 6, Jul to Sep spread)
      data/projects.ts         9 projects, steps, teams, chat, events
      data/impact.ts           hours saved table
      time.ts                  helpers: daysAgo(), hoursAgo(), at("2026-09-30 16:00")
  scripts/
    daily-job.ts               auto-approve sweep + Slack digest (Railway cron)
  public/
  src/
    app/
      layout.tsx               fonts (Inter via next/font), Shell
      globals.css              Tailwind layers only, no raw values
      (app)/
        layout.tsx             Shell + runs auto-approve sweep on every load
        page.tsx               Home (needs you / all clear)
        loading.tsx            skeleton rows
        error.tsx              calm grey sentence + retry link
        help-desk/
          page.tsx
          [id]/page.tsx
        ideas/
          page.tsx             Pipeline / List (?view=list&owner=me&sort=stage)
          new/page.tsx         Propose form (also edit: ?from=<id>)
          [id]/page.tsx        Workspace (?tab=plan|chat|team|timeline)
          [id]/review/page.tsx AI review (owner only)
          [id]/approve/page.tsx Admin approval
        pulse/page.tsx
        leaderboard/page.tsx   (?period=this-month|last-month|this-year)
        programme/page.tsx     admin only (?period=30d|90d|year)
        admin/page.tsx         admin only (?tab=people|topics|rules|publishers|impact)
      api/
        attachments/[id]/route.ts   streams a file after a permission check
        attachments/route.ts        upload (multipart) for thread messages
        search/route.ts             command palette query
    components/                shared components (section 3); nothing page-specific
      shell/Shell.tsx, Sidebar.tsx, TopBar.tsx, Logo.tsx, UserMenu.tsx,
            NewMenu.tsx, BellMenu.tsx
      ui/PageHeader.tsx, Container.tsx, Row.tsx, IconTile.tsx, Avatar.tsx,
         Button.tsx, Tabs.tsx, SegmentedToggle.tsx, TextField.tsx, TextArea.tsx,
         Select.tsx, NumberField.tsx, Stepper.tsx, LiveDot.tsx, Checkbox.tsx,
         CommandPalette.tsx, Modal.tsx, SectionLabel.tsx, MetaLine.tsx,
         Skeleton.tsx, EmptyState.tsx, ErrorState.tsx, Timeline.tsx,
         ChatMessage.tsx, Composer.tsx, ProgressBar.tsx
    features/                  page-level compositions, one folder per area
      home/        NeedsYouList.tsx, YourWork.tsx
      pulse/       PulseList.tsx
      help-desk/   QuestionRow.tsx, QuestionGroups.tsx, ThreadView.tsx,
                   HistoryPanel.tsx, AskQuestionModal.tsx, SimilarQuestions.tsx
      ideas/       ProposeForm.tsx, BuildPathCards.tsx, ScoreRows.tsx,
                   ApprovalDetails.tsx, ApprovalSidebar.tsx, ReturnModal.tsx,
                   PipelineBoard.tsx, PipelineCard.tsx, ProjectList.tsx,
                   PlanTab.tsx, ChatTab.tsx, TeamTab.tsx, TimelineTab.tsx,
                   HoursSavedRow.tsx
      programme/   RecentWins.tsx, BigFlags.tsx, ValueChart.tsx
      leaderboard/ LeaderboardTable.tsx
      admin/       PeopleTab.tsx, TopicsTab.tsx, RulesTab.tsx,
                   PublishersTab.tsx, ImpactTab.tsx
    server/                    ALL business logic and permission checks
      db.ts                    Prisma client singleton
      clock.ts                 now(): reads SPINE_TODAY, else real time
      session.ts               getCurrentUser() from demo cookie; switchUser()
      permissions.ts           can.*() predicates + assert helpers (throw 403)
      settings.ts              getSettings(), updateSettings()
      questions/
        queries.ts             lists, tabs, counts, thread, history
        actions.ts             ask, reopen, claim, sendMessage, resolve
        similar.ts             similarity search for "Already answered?"
        waiting.ts             isWaitingOnClaimer()
      projects/
        queries.ts             pipeline, list, workspace, your work
        lifecycle.ts           THE stage machine (all stage transitions)
        actions.ts             propose, saveDraft, submit, approve, return,
                               join, step CRUD/reorder/tick, chat, logHours,
                               markLive
        nextAction.ts          the one computed sentence
        publishing.ts          assignPublisher()
        autoApprove.ts         runDueAutoApprovals()
      ai/
        client.ts              Anthropic SDK, model from ANTHROPIC_MODEL
        review.ts              runAiReview(projectId) + zod schema
        buildPlan.ts           generateBuildPlan(projectId) + zod schema
      pulse/
        checks.ts              the three checks, each returns all hits
        pulse.ts               getPulseItems({ mode: "latest-per-check" | "all" })
      home/needsYou.ts         the three needs-you sources, ordered
      programme/queries.ts     wins, flags, value series
      leaderboard/points.ts    points per champion per period, ranking with ties
      digest/
        build.ts               digest text from getPulseItems()
        send.ts                Slack webhook or console.log fallback
      search/palette.ts        questions, projects, people search
      storage/attachments.ts   save/read files (see question Q21)
    lib/
      format.ts                relative time ("2h ago"), dates ("30 Sep at 16:00"),
                               pluralise ("1 thing needs you"), first names
      text.ts                  similarity (token overlap / trigram), no em dashes
      periods.ts               period ranges from now()
      types.ts
  tests/
    unit/                      nextAction, pulse, points/ranking, lifecycle,
                               publisher assignment, similarity, permissions
    e2e/                       Playwright: visual check screenshots at 1536x1024
```

Rules the structure enforces:

- Pages and components never import Prisma. They call `server/*` queries and server actions only.
- Every server action starts with `const user = await getCurrentUser()` and an `assert*` from `permissions.ts`. Hiding a button is never the only check.
- Every stage change goes through `server/projects/lifecycle.ts`. Nothing else writes `Project.stage`.
- `now()` from `server/clock.ts` is the only source of time. `Date.now()` / `new Date()` with no args are banned by an ESLint rule.

---

## 2. Data model (Prisma)

Everything in CLAUDE.md section 6, plus a small number of additions marked `// ADDED` with a reason. I've kept additions to things the behaviour rules need to work; each one is also listed in Q-section so you can veto.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ---------- People ----------

model User {
  id                     String   @id @default(cuid())
  name                   String
  initials               String
  isChampion             Boolean  @default(false)
  isAdmin                Boolean  @default(false)
  isPublishingSpecialist Boolean  @default(false)
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  questionsAsked     Question[]        @relation("QuestionAsker")
  questionsClaimed   Question[]        @relation("QuestionClaimer")
  questionMessages   QuestionMessage[]
  questionEvents     QuestionEvent[]
  projectsOwned      Project[]         @relation("ProjectOwner")
  projectsApproved   Project[]         @relation("ProjectApprover")
  projectsPublishing Project[]         @relation("ProjectPublisher")
  teamMemberships    TeamMember[]
  planSteps          PlanStep[]
  projectMessages    ProjectMessage[]
  projectEvents      ProjectEvent[]
}

model Topic {
  id         String    @id @default(cuid())
  name       String    @unique
  archivedAt DateTime? // ADDED: "remove" hides it from pickers without breaking old questions/projects (Q19)
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  questions Question[]
  projects  Project[]
}

// ---------- Help Desk ----------

enum QuestionStatus {
  UNCLAIMED
  IN_PROGRESS
  RESOLVED
}

model Question {
  id          String         @id @default(cuid())
  title       String
  body        String         // shown as the asker's first bubble in the thread; not counted as a reply
  askerId     String         // always stored; never sent to any client when isAnonymous
  isAnonymous Boolean        @default(false)
  topicId     String
  status      QuestionStatus @default(UNCLAIMED)
  claimerId   String?
  postedAt    DateTime
  claimedAt   DateTime?
  resolvedAt  DateTime?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  asker    User              @relation("QuestionAsker", fields: [askerId], references: [id])
  claimer  User?             @relation("QuestionClaimer", fields: [claimerId], references: [id])
  topic    Topic             @relation(fields: [topicId], references: [id])
  messages QuestionMessage[]
  events   QuestionEvent[]

  @@index([status, postedAt])
  @@index([claimerId, resolvedAt])
}

model QuestionMessage {
  id         String   @id @default(cuid())
  questionId String
  authorId   String
  body       String
  sentAt     DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  question    Question     @relation(fields: [questionId], references: [id], onDelete: Cascade)
  author      User         @relation(fields: [authorId], references: [id])
  attachments Attachment[]

  @@index([questionId, sentAt])
}

model Attachment {
  id         String   @id @default(cuid())
  messageId  String
  fileName   String
  sizeBytes  Int
  storageKey String
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  message QuestionMessage @relation(fields: [messageId], references: [id], onDelete: Cascade)
}

enum QuestionEventType {
  POSTED
  CLAIMED
  REPLIED
  REPLIED_WITH_FILE
  RESOLVED
  REOPENED
}

model QuestionEvent {
  id         String            @id @default(cuid())
  questionId String
  type       QuestionEventType
  actorId    String
  at         DateTime
  createdAt  DateTime          @default(now())
  updatedAt  DateTime          @updatedAt

  question Question @relation(fields: [questionId], references: [id], onDelete: Cascade)
  actor    User     @relation(fields: [actorId], references: [id])

  @@index([questionId, at])
}

// ---------- Ideas & Projects ----------

enum BuildPath {
  APP
  COWORK_NATIVE
}

enum Difficulty {
  EASY
  MODERATE
  HARD
}

enum ProjectStage {
  IDEA        // draft, including returned ideas
  APPROVAL
  RECRUITING
  BUILDING
  PUBLISHING
  LIVE
}

enum PlanStatus {   // ADDED: build plan is generated after the response; Plan tab needs to know (Q23)
  NONE
  GENERATING
  READY
  FAILED
}

model Project {
  id                   String       @id @default(cuid())
  title                String
  problem              String
  whoBenefits          String
  topicId              String
  buildPath            BuildPath
  teamSize             Int
  hoursPerWeek         Int
  lengthWeeks          Int
  difficulty           Difficulty
  targetDate           DateTime
  ownerId              String
  stage                ProjectStage @default(IDEA)
  submittedAt          DateTime?
  autoApproveAt        DateTime?
  approvedAt           DateTime?
  approvedById         String?      // null + approvedAt set = auto-approved
  returnNote           String?
  publisherId          String?
  publishingAssignedAt DateTime?    // ADDED: tie-break "assigned least recently" (rule I-11)
  buildCompletedAt     DateTime?    // ADDED: Cowork-native needs to know it already built when in Approval
  liveAt               DateTime?
  lastActivityAt       DateTime
  planStatus           PlanStatus   @default(NONE) // ADDED
  createdAt            DateTime     @default(now())
  updatedAt            DateTime     @updatedAt

  topic      Topic            @relation(fields: [topicId], references: [id])
  owner      User             @relation("ProjectOwner", fields: [ownerId], references: [id])
  approvedBy User?            @relation("ProjectApprover", fields: [approvedById], references: [id])
  publisher  User?            @relation("ProjectPublisher", fields: [publisherId], references: [id])
  aiReview   AiReview?        @relation("ReviewOf")
  relatedIn  AiReview[]       @relation("ReviewRelated")
  team       TeamMember[]
  steps      PlanStep[]
  messages   ProjectMessage[]
  events     ProjectEvent[]
  impact     ImpactLog[]

  @@index([stage, autoApproveAt])
  @@index([stage, lastActivityAt])
}

model AiReview {
  id                         String   @id @default(cuid())
  projectId                  String   @unique // one current review per project; re-running replaces it
  feasibility                Int
  feasibilityReason          String
  businessValue              Int
  businessValueReason        String
  resourcingConfidence       Int
  resourcingConfidenceReason String
  originality                Int
  originalityReason          String
  relatedProjectId           String?
  raisedConcerns             Boolean  // true when any score <= 5; computed on the server, never by the model
  completedAt                DateTime
  createdAt                  DateTime @default(now())
  updatedAt                  DateTime @updatedAt

  project        Project  @relation("ReviewOf", fields: [projectId], references: [id], onDelete: Cascade)
  relatedProject Project? @relation("ReviewRelated", fields: [relatedProjectId], references: [id], onDelete: SetNull)
}

model TeamMember {
  id        String   @id @default(cuid())
  projectId String
  userId    String
  joinedAt  DateTime
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id])

  @@unique([projectId, userId])
}

model PlanStep {
  id                 String    @id @default(cuid())
  projectId          String
  title              String
  activePhrase       String    // e.g. "testing supplier cases"; written by Claude, or derived for manual steps (Q24)
  assigneeId         String
  dueDate            DateTime
  done               Boolean   @default(false)
  doneAt             DateTime?
  order              Int
  generatedFromBrief Boolean   @default(false)
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  project  Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  assignee User    @relation(fields: [assigneeId], references: [id])

  @@index([projectId, order])
}

model ProjectMessage {
  id        String   @id @default(cuid())
  projectId String
  authorId  String?  // null for system messages
  body      String
  sentAt    DateTime
  isSystem  Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  author  User?   @relation(fields: [authorId], references: [id])

  @@index([projectId, sentAt])
}

enum ProjectEventType {
  CREATED
  AI_REVIEWED
  SUBMITTED
  RETURNED
  APPROVED
  AUTO_APPROVED
  JOINED
  RECRUITED          // team full, moved to Building
  PLAN_GENERATED
  STEP_ADDED
  STEP_EDITED
  STEP_COMPLETED
  STEP_REOPENED
  BUILD_COMPLETED
  PUBLISHER_ASSIGNED
  WENT_LIVE
  HOURS_LOGGED
}

model ProjectEvent {
  id        String           @id @default(cuid())
  projectId String
  type      ProjectEventType
  actorId   String?          // null for automatic events (auto-approve, publisher assignment)
  detail    String?          // e.g. step title, return note summary
  at        DateTime
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  actor   User?   @relation(fields: [actorId], references: [id])

  @@index([projectId, at])
}

model ImpactLog {
  id         String   @id @default(cuid())
  projectId  String
  month      DateTime // first day of the month, 00:00
  hoursSaved Int
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, month])
}

// ---------- Settings (single row) ----------

model Settings {
  id                     String    @id @default("singleton")
  approvalTimeoutDays    Int       @default(7)
  stalledBuildDays       Int       @default(10)
  unclaimedQuestionHours Int       @default(2)
  digestChannel          String    @default("Slack")
  digestTime             String    @default("09:00") // HH:mm
  digestWeekdaysOnly     Boolean   @default(true)
  hourlyCost             Decimal?  @db.Decimal(10, 2)
  programmeCost          Decimal?  @db.Decimal(12, 2)
  lastDigestSentOn       DateTime? // ADDED: stops the cron sending twice in one day
  createdAt              DateTime  @default(now())
  updatedAt              DateTime  @updatedAt
}
```

Not stored, by design: points (computed from `Question.claimerId` + `resolvedAt`), Pulse items, needs-you items, next action sentences, "N of M people", "6 of 9 steps".

---

## 3. Shared components

Built first in Phase 1, each with every variant the mockups use. No page builds its own version.

| Component | Variants / props | Where it appears |
| --- | --- | --- |
| `Shell` | sidebar + top bar + centred main (max ~1180px), optional right rail | every page |
| `Sidebar` | active item, Pulse count pill (hidden at 0), Manage group (admins only), user block | every page |
| `Logo` | inline SVG: offset rounded bars + "Spine" wordmark | sidebar |
| `UserMenu` | avatar, name, roles line, chevron, demo user switcher list | sidebar bottom |
| `TopBar` | search trigger with ⌘ K hint, `+ New` dropdown, bell with dot and dropdown | every page |
| `PageHeader` | `date?`, `title`, `subtitle?` (all clear Home only), `eyebrow?` ("AWAITING YOUR APPROVAL"), `back?` link, `breadcrumb?`, `meta?` dot-separated line, `aside?` (period Select) | every page |
| `Container` | `label?` (uppercase section label), `heading?` + `action?` ("Your work" + View all), divided rows | everywhere |
| `Row` | `icon?`, `avatar?`, `title`, `meta`, `trailing` (button / text / link), `highlighted` (You row), `collapsed` (neutral-soft "6 completed steps") | Home, Pulse, Help Desk, Plan, Leaderboard, Admin |
| `IconTile` | lucide icon in a neutral-soft 10px-radius square | Home, Pulse |
| `Avatar` | initials or anonymous person icon, neutral-soft circle, sizes sm/md | everywhere |
| `Button` | `primary` / `secondary` / `text`, `arrow?`, `icon?`, `fullWidth?`, one height and radius | everywhere |
| `Tabs` | plain text, brand underline on active, optional count ("Mine 2") | Help Desk, workspace, Admin |
| `SegmentedToggle` | two options, active = white with brand border | Pipeline/List, Hours saved/Estimated value |
| `TextField`, `TextArea`, `Select`, `NumberField` | label, value, suffix text ("days", "hours"), leading search icon | forms, Admin, filters |
| `Checkbox` | square, brand when checked | Ask modal, plan steps, People & roles |
| `Stepper` | ordered stages, done (filled check) / current (ring) / upcoming (hollow), path-dependent order | workspace |
| `LiveDot` | the only use of the `live` token | Home, pipeline, Programme |
| `ProgressBar` | brand fill on neutral track | pipeline cards |
| `Modal` | centred, title, body, footer with one primary | Ask, Return with note, command palette |
| `CommandPalette` | search field, grouped results, arrow keys + Enter, Esc | top bar / ⌘K / Ctrl+K |
| `Timeline` | dot + text + muted time, vertical line; `dotTone` (see Q8) | History panel, approval sidebar, Timeline tab |
| `ChatMessage` | avatar, name, time, bubble (`mine` = brand-soft), attachments, `system` (small grey text) | thread, project chat |
| `Composer` | attach button, field, Send primary, optional trailing secondary (Mark resolved) | thread, project chat |
| `SectionLabel`, `MetaLine` | uppercase label; muted dot-separated meta | many |
| `Skeleton`, `EmptyState`, `ErrorState` | skeleton rows in Row's shape; one grey sentence; grey sentence + "Try again" text link | loading/empty/error everywhere |

The brief's required list (Shell, Sidebar, TopBar, PageHeader, Container, Row, IconTile, Avatar, Button, Tabs, SegmentedToggle, TextField, TextArea, Select, NumberField, Stepper, LiveDot, Checkbox, CommandPalette, Modal) is fully covered. The extra ones (Logo, UserMenu, Timeline, ChatMessage, Composer, ProgressBar, SectionLabel, MetaLine, Skeleton, EmptyState, ErrorState) are shared pieces the mockups repeat. They are structural, not new UI.

### Design tokens

Phase 1 starts by sampling the mockups (colours with a pixel picker, sizes and spacing by measuring at 1536px width) and writing the results into `tailwind.config.ts`. The config **replaces** Tailwind's default palette, font sizes and radii rather than extending them, so a stray `text-red-500` or `rounded-2xl` fails to compile instead of slipping through. I'll put a table of "brief estimate vs measured" in the Phase 1 summary.

Token names: `background, surface, border, text, text-muted, brand, brand-hover, brand-soft, neutral-soft, live`; font sizes `date, headline, section, row-title, meta, label, eyebrow` (+ any measured extras, such as the score numerals on 05 and the thread title on 03); radii `container (12px), control (10px), full`.

Guard rails (run in `npm run lint`):
- ESLint/regex check that fails on hex colours, `rgb(`, arbitrary Tailwind values (`[...]`), `italic`, `—` (em dash) and `⋮` anywhere in `src/` and `prisma/seed/`.
- A test that counts primary buttons per page in the Playwright run (must be 0 or 1).

---

## 4. Routes

| Route | Who | Mockup | Primary | Notes |
| --- | --- | --- | --- | --- |
| `/` | everyone | 01, 13 | top needs-you item | all clear when empty |
| `/help-desk` | everyone | 02 | none | `?tab=open\|mine\|resolved\|all&q=` |
| `/help-desk/[id]` | see Q14 | 03 | Send | History panel in right rail |
| `/ideas` | everyone | 07 | none | `?view=pipeline\|list&owner=me&sort=stage` |
| `/ideas/new` | everyone | 04 | Continue to AI review | `?from=<id>` edits an existing draft; return note at top |
| `/ideas/[id]/review` | owner only | 05 | Submit for approval | 404 for anyone else (never reveal scores) |
| `/ideas/[id]/approve` | admins only | 06 | Approve | Return with note opens a modal |
| `/ideas/[id]` | everyone (read), team (edit) | 08 | none (see Q12) | `?tab=plan\|chat\|team\|timeline` |
| `/pulse` | everyone | 09 | top item | |
| `/leaderboard` | everyone | 11 | none | `?period=` |
| `/programme` | admins only | 10 | none | `?period=` |
| `/admin` | admins only | 12 | Save changes | `?tab=`, Rules default |
| `/api/attachments` (POST), `/api/attachments/[id]` (GET) | thread participants | | | permission-checked file stream |
| `/api/search` | everyone | | | command palette |

Mutations are Next.js server actions in `server/**/actions.ts`. Admin-only and owner-only pages check on the server and return `notFound()` (not a redirect), so their existence isn't leaked.

---

## 5. Cross-cutting server pieces

- **Clock** (`server/clock.ts`): `now()` returns `new Date(SPINE_TODAY)` when set, else real time. See Q2 on whether it should tick.
- **Demo auth** (`server/session.ts`): an httpOnly cookie `spine_user` holds a user id; defaults to Alex Morgan. `switchUser(id)` is a server action used by the UserMenu. `getCurrentUser()` is the only way any code learns who is acting, so swapping in real auth later means rewriting this one file.
- **Permissions** (`server/permissions.ts`): one predicate per row of the CLAUDE.md section 5 table (`canClaim`, `canPostInThread`, `canEditPlan`, `canPublish`, `canApprove`, `canSeeScores`, `canSeeManage`, ...). Each action calls `assertX()`, which throws a 403. The UI uses the same predicates to decide what to render, so UI and server can never disagree.
- **Anonymity**: question queries go through one serializer, `toQuestionDTO(question, viewer)`, which replaces the asker with `{ anonymous: true }` whenever `isAnonymous` is true, **for every viewer including admins, the claimer and the asker's own view of the row.** `askerId` never leaves the server for anonymous questions. Events whose actor is the anonymous asker are rendered as "Anonymous ...". A unit test asserts no DTO for an anonymous question contains the asker id or name.
- **AI** (`server/ai/*`): `@anthropic-ai/sdk`, model and key from env. Prompts ask for JSON only; output goes through a zod schema; one retry on a parse failure; any failure returns `{ ok: false }` and the UI shows "The AI review couldn't run. Try again." (or the build plan equivalent). Nothing waits on the AI to change a stage.
- **Auto-approve sweep**: `runDueAutoApprovals()` runs in the `(app)/layout.tsx` server component on every page load and in `scripts/daily-job.ts`. It is idempotent: a single `updateMany ... where stage = APPROVAL and autoApproveAt <= now and approvedAt is null`, then per-project follow-ups through `lifecycle.ts`.
- **Daily job** (`scripts/daily-job.ts`, Railway cron every 15 minutes): runs the sweep, then sends the digest if `now >= digestTime today`, `lastDigestSentOn != today`, and (if weekdays only) today is Mon to Fri. Sends nothing when the Pulse list is empty, but still marks the day as done.
- **Activity**: `touchProject(projectId)` sets `lastActivityAt = now()`. Called by step tick/untick/edit/add/reorder/reassign, chat messages, joins, stage changes and hours logged (see Q25 for which of these should count).

---

## 6. Behaviour rules mapped to code

### Permissions (CLAUDE.md section 5)

| Rule | Lives in |
| --- | --- |
| Anyone can ask (named or anonymous) | `questions/actions.ts#askQuestion` (no role check, auth only) |
| Claim: Champions only (admins only if also Champion) | `permissions.ts#canClaim` → `questions/actions.ts#claimQuestion` |
| Post in thread: asker, or claimer | `permissions.ts#canPostInThread` → `sendMessage`, attachment upload route |
| Propose an idea: everyone | `projects/actions.ts#saveDraft` |
| See own AI scores only; nobody sees others' | `permissions.ts#canSeeScores` (owner only) → `/ideas/[id]/review`, `ai/review.ts` read path; approval page query selects only `raisedConcerns` |
| Join a recruiting project: everyone | `permissions.ts#canJoin` (stage RECRUITING, not full, not already on team) → `joinProject` |
| Edit plan: team members only | `permissions.ts#canEditPlan` → every step action |
| Publish: assigned specialist only | `permissions.ts#canPublish` (`publisherId === user.id` and `isPublishingSpecialist`) → `markLive` |
| Approve / return: admins | `permissions.ts#canApprove` → `approveIdea`, `returnIdea`, `/approve` page |
| Programme + Admin: admins | `permissions.ts#canSeeManage` → pages, Sidebar Manage group, all admin actions |
| Anonymous asker never shown | `questions/queries.ts#toQuestionDTO` (single serializer) |

### Help Desk

| # | Rule | Lives in |
| --- | --- | --- |
| H1 | Ask: title, details, topic, anonymous; up to 3 similar resolved questions under the title as you type | `features/help-desk/AskQuestionModal.tsx` (debounced) → `questions/similar.ts#findSimilarResolved(title, limit 3)` (Postgres `pg_trgm` similarity on title, resolved only; falls back to token overlap in `lib/text.ts`) |
| H2 | Picking your own resolved question reopens it (IN_PROGRESS, same claimer, REOPENED event) | `SimilarQuestions.tsx` marks the viewer's own items; `questions/actions.ts#reopenQuestion` (asserts viewer is the asker and status RESOLVED) |
| H3 | Any Champion claims an unclaimed question → IN_PROGRESS, claimer recorded, thread opens | `questions/actions.ts#claimQuestion` (conditional update `where status = UNCLAIMED` so two Champions can't both claim) then `redirect` to thread |
| H4 | Only asker and claimer post; attachments; every action logged as QuestionEvent | `sendMessage` + `storage/attachments.ts`; event writes live inside each action in one transaction; `HistoryPanel.tsx` renders `questions/queries.ts#getHistory` |
| H5 | Asker or claimer resolves; claimer gets 1 point | `questions/actions.ts#resolveQuestion`; the point is just `resolvedAt` + `claimerId`, read by `leaderboard/points.ts` |
| H6 | Waiting on claimer = last message is from the asker | `questions/waiting.ts#isWaitingOnClaimer` (latest QuestionMessage author === askerId); used by `home/needsYou.ts` |

### Ideas & Projects

| # | Rule | Lives in |
| --- | --- | --- |
| I1 | App stages: Idea, Approval, Recruiting, Building, Publishing, Live | `projects/lifecycle.ts#STAGE_ORDER.APP`; `Stepper` reads it |
| I2 | Cowork stages: Idea, Recruiting, Building, Approval, Publishing, Live | `lifecycle.ts#STAGE_ORDER.COWORK_NATIVE` |
| I3 | Propose: "Continue to AI review" saves draft, runs review | `features/ideas/ProposeForm.tsx` → `projects/actions.ts#saveDraft` → redirect to `/ideas/[id]/review`, which calls `ai/review.ts#runAiReview` if no current review |
| I4 | Four 1 to 10 scores with one-line reasons; originality compares against all projects and names the closest; advisory only | `ai/review.ts` (prompt includes every other project's title + problem; zod schema; `raisedConcerns` computed server-side as any score <= 5; `relatedProjectId` validated against real ids) |
| I5 | Submit (App) → Approval, `autoApproveAt = now + timeout`. Cowork → Recruiting; Approval after build | `lifecycle.ts#submit` |
| I6 | Admin sees details + neutral concern flag; Approve or Return with note; return → owner's draft with note at top | `/ideas/[id]/approve` + `ApprovalDetails.tsx`; `lifecycle.ts#approve`, `lifecycle.ts#returnToOwner`; `ProposeForm.tsx` shows `returnNote` at top |
| I7 | Auto-approve when nobody acts by `autoApproveAt`; timeline says "Auto-approved"; checked on load and daily | `projects/autoApprove.ts#runDueAutoApprovals` called from `(app)/layout.tsx` and `scripts/daily-job.ts`; writes AUTO_APPROVED event |
| I8 | Join until full; when full → Building and Claude generates 6 to 10 steps, each assigned, due dates spread before target, "Generated from project brief", with an activePhrase | `projects/actions.ts#joinProject` → `lifecycle.ts#startBuilding` → `after(() => ai/buildPlan.ts#generateBuildPlan)`; zod enforces 6 to 10 steps and that every assignee is a team member; due dates are recomputed on the server to be evenly spread between today and `targetDate` rather than trusting the model's dates |
| I9 | Team members add, edit, reorder, reassign, tick; ticking/editing updates `lastActivityAt` | `projects/actions.ts#addStep / editStep / reorderSteps / reassignStep / toggleStep`, each calls `touchProject` |
| I10 | All steps done → App to Publishing; Cowork to Approval, then Publishing when approved | `lifecycle.ts#onStepsChanged` (called by toggleStep/addStep) → `completeBuild`; `lifecycle.ts#approve` branches on `buildCompletedAt` |
| I11 | Publishing assigned to the specialist with fewest projects in Publishing, ties to least recently assigned | `projects/publishing.ts#assignPublisher` (count where stage PUBLISHING; tie-break on `max(publishingAssignedAt)` asc, never-assigned first, then name for determinism) |
| I12 | Live: team logs hours saved per month | `features/ideas/HoursSavedRow.tsx` → `projects/actions.ts#logHours` (upsert ImpactLog for current month, team only) |
| I13 | One computed next action sentence per project | `projects/nextAction.ts#nextAction(project, viewer)`, unit-tested for every stage and the "1 more person" / "You're publishing this" cases |

### Pulse

| Rule | Lives in |
| --- | --- |
| Approval nearing timeout: Approval with < 24h to `autoApproveAt`; action Review | `pulse/checks.ts#approvalsNearTimeout` (crossed at `autoApproveAt - 24h`) |
| Unanswered question: unclaimed longer than `unclaimedQuestionHours`; action Claim | `pulse/checks.ts#unclaimedQuestions` (crossed at `postedAt + hours`) |
| Build going quiet: Building, no activity for longer than `stalledBuildDays`; action Open | `pulse/checks.ts#quietBuilds` (crossed at `lastActivityAt + days`) |
| At most one per check, the most recently crossed; easy to switch to all | `pulse/pulse.ts#getPulseItems({ mode })`; a single constant `PULSE_MODE = "latest-per-check"` |
| Recalculated on every load; disappears when condition is false | computed per request, nothing stored; sidebar pill uses the same function |
| Daily digest to Slack at `digestTime`, weekdays only when set, nothing when empty | `digest/build.ts` + `digest/send.ts` from `scripts/daily-job.ts` |

### Home

| Rule | Lives in |
| --- | --- |
| Needs you, in order: approvals (admins, not own, soonest first), claimed questions waiting on me, my Publishing projects | `home/needsYou.ts#getNeedsYou(user)` |
| Headline "N things need you" / "1 thing needs you"; top item primary | `lib/format.ts#pluralise` + `NeedsYouList.tsx` (index 0 gets `variant="primary"`) |
| Empty → all clear state | `app/(app)/page.tsx` |
| Your work: 3 most recently active projects past Approval that I own / am on team / approved / published, excluding needs-you items; View all → filtered list | `projects/queries.ts#getYourWork(user, excludeIds)`; link to `/ideas?view=list&owner=me` |
| Bell dot only when needs you is non-empty; dropdown lists the same items | `BellMenu.tsx` uses `getNeedsYou` |

### Programme

| Rule | Lives in |
| --- | --- |
| Recent wins: went Live in period (30d / 90d / this year) | `programme/queries.ts#recentWins(period)` + `lib/periods.ts` |
| Big flags: Approval > 3 days; Building with no activity > `stalledBuildDays` | `programme/queries.ts#bigFlags` (reuses the pulse check predicates with "all" mode) |
| Value over time: hours per month line chart; estimated value = hours × `hourlyCost`; grey sentence if unset | `programme/queries.ts#valueSeries` + `features/programme/ValueChart.tsx` (hand-built SVG, tokens only) |
| Never show AI scores, speed metrics or rankings of people | review checklist item; Programme queries never select from AiReview |

### Leaderboard

| Rule | Lives in |
| --- | --- |
| Champions ranked by points in period, highest first; ties share rank; You row highlighted; 0-point champions last | `leaderboard/points.ts#getLeaderboard(period, viewer)` (count of questions with `claimerId = champion`, `status = RESOLVED`, `resolvedAt` in period; standard competition ranking 1, 2, 2, 4) |

---

## 7. Phases

Each phase ends with: visual check of every screen in it (Playwright at 1536×1024 as Alex, `SPINE_TODAY=2026-10-07T10:00:00`, side-by-side with the mockup, diff list, fix, repeat), `tsc --noEmit` clean, lint guard rails clean, no console errors, a git commit, and a short summary to you. I stop for approval after each.

> The folder isn't a git repository yet. Phase 1 starts with `git init` (see Q30).

**Phase 1: Setup, tokens, shared components, shell, seeds**
1. `git init`, Next.js (App Router, TS strict), Tailwind, Prisma, lucide-react, zod, Anthropic SDK, Playwright, ESLint guard rails.
2. Sample tokens from the mockups; write `tailwind.config.ts`; record the measured vs estimated table.
3. Prisma schema + first migration; `server/clock.ts`, `session.ts`, `permissions.ts`, `settings.ts`.
4. Every shared component, plus a dev-only `/_components` page that shows each variant for review (removed or blocked in production).
5. Shell: Sidebar (logo SVG, nav, Pulse pill, Manage, UserMenu with switcher), TopBar (search trigger, + New menu, bell). Palette and bell dropdown are stubs until their phases.
6. Both seed scripts with all data from CLAUDE.md section 9, including the resolved-question spread and every invented step, member, message and event.
7. Visual check of the shell against all mockups (sidebar and top bar only).

**Phase 2: Home (both states) and Pulse**
`needsYou.ts`, `getYourWork`, `nextAction.ts` (full, since Home needs it), `pulse/*`, bell dot + dropdown, Pulse pill. Visual check 01, 13, 09.

**Phase 3: Help Desk, question thread, Ask a question**
Lists, tabs, search, groups, claim, thread, composer, attachments, history, resolve, Ask modal with similar questions and reopen. Visual check 02, 03; screenshots of the Ask modal and Resolved tab for your approval.

**Phase 4: Propose, AI review, Admin approval, Return with note**
Form, draft save, AI review (live + failure state), submit, approval page, approve, return modal, return note on the form, auto-approve sweep, `lifecycle.ts` up to Recruiting, publisher assignment. Visual check 04, 05, 06; screenshot of Return modal.

**Phase 5: Pipeline, List view, project workspace**
Pipeline board, List view with sort and filter, workspace header + stepper + next action, Plan tab (CRUD, reorder, tick, collapsed completed, build-plan generation), Chat, Team (join), Timeline, Log hours saved, Mark Live. Rest of `lifecycle.ts`. Visual check 07, 08; screenshots of List, Chat, Team, Timeline, hours row.

**Phase 6: Programme, Leaderboard, Admin**
Visual check 10, 11, 12; screenshots of People & roles, Topics, Publishing specialists, Impact assumptions, and Programme with no hourly cost.

**Phase 7: Slack digest, daily job, command palette, loading and error states, polish**
`scripts/daily-job.ts`, Railway cron, command palette with keyboard nav, skeletons and errors for every route, README, `.env.example`, Railway deploy. Final full pass of all 13 mockups and all non-mocked screens.

---

## 8. Questions and contradictions

Grouped by how much they matter. **Bold = blocks matching a mockup or a rule.** Each has my recommended default.

### A. Seed data contradicts a mockup or rule

**Q1. All clear seed still has Pulse items.** 13 must show no Pulse pill, but the all-clear changes listed in section 9 leave "Best way to anonymise client data?" unclaimed for 2h 5m (over the 2h threshold) and Contract Clause Checker quiet for 12 days (over 10). Both are Pulse items, so the pill would show "2".
*Default:* in the all-clear seed, also have Ben's question claimed (by Louie Morris) and give Contract Clause Checker activity 1 day ago. The other unclaimed questions are also over threshold, so they need claiming too (Priya's by Jamie, the anonymous one by Sarah).

**Q2. All clear "Your work" would change.** In the all-clear seed, Knowledge Search Assistant is "already Live", published by Alex, and so becomes eligible for Your work. If it went live recently it pushes Client Brief Generator off the list, which no longer matches 13. Same for Supplier Research Assistant: if Alex approved it, it enters Recruiting with fresh activity and joins Your work.
*Default:* Knowledge Search Assistant went live on 1 Oct with last activity 5 days ago (older than Client Brief Generator's 4 days). Supplier Research Assistant was **auto-approved** (`approvedById` null) on 30 Sep, so it isn't "approved by Alex". With those two changes 13 matches exactly.

**Q3. Mockups 04 and 05 can't both be reproduced from the seed.** The seed puts Supplier Risk Checker in Approval (submitted today 09:40), and 07 shows it there. But 04 is the filled-in propose form and 05 shows a "Submit for approval" button, which only exist before submitting. Also, a live Claude call won't reliably return 8, 7, 7, 4 with those exact sentences.
*Default:* (a) the visual check for 04/05 walks the real flow in Playwright on a throwaway database, entering the 04 values; (b) add `SPINE_AI_FIXTURES=1` (dev/test only) that returns stored fixture responses for known titles, so 05 renders the exact mockup text. For an idea already submitted, `/ideas/[id]/review` still shows the owner their scores but replaces the two buttons with nothing (no "Submitted" text, since it isn't in the brief). OK?

**Q4. Plan edit rights vs mockup 08.** Alex sees AI Invoice Assistant with live checkboxes and "+ Add step", but Alex is not on its team (Jamie, Mia, Sarah). The brief says only team members can edit.
*Default:* behaviour follows the brief. For non-members the checkboxes render as non-interactive and "+ Add step" is hidden. That means 08 viewed as Alex will be missing "+ Add step". Alternatives: (a) add Alex to the AI Invoice Assistant team (it's then a team of 4, and Alex's Your work is unchanged); (b) do the 08 visual check as Jamie (but the sidebar shows Jamie and no Manage section). **I recommend (a).** Note that (a) means the team is 4, so team size must be 4 for consistency.

**Q5. Sidebar role line.** Alex is Champion, Admin and Publishing specialist, but every mockup shows "Champion · Admin".
*Default:* show Champion and Admin only. Publishing specialist is a duty, not a role you identify by, and leaving it out matches all 13 mockups. Or should it be "Champion · Admin · Publishing specialist"?

**Q6. "Waiting 7 days" on Programme.** Supplier Research Assistant was submitted 30 Sep 16:00, which is 6 days 18 hours before now.
*Default:* round to the nearest day (shows 7). Same rounding everywhere ("12 days").

### B. Mockup conflicts with the design rules

**Q7. Green Excel icon in 03.** The attachment shows a green spreadsheet icon. The colour rule allows no colours outside the tokens.
*Default:* lucide `FileSpreadsheet` outline in `text` colour, same stroke width as the other icons.

**Q8. Timeline dot colour differs.** History dots are brand blue in 03; the approval timeline dots are grey in 06.
*Default:* match each mockup. Brand dots for the question History panel, muted dots for the approval sidebar and project Timeline tab. If you want one style everywhere, I'd pick muted.

**Q9. Logo colour.** The brief says brand cobalt bars; the mockup bars look like a lighter sky-blue to cobalt gradient.
*Default:* I'll sample it. If it's a gradient, use a two-stop gradient from a measured lighter blue to `brand`, adding one `brand-light` token used only by the logo. If you'd rather keep strictly to the 10 tokens, the bars become solid `brand`.

**Q10. Subtitle on the pipeline.** 07 has "Approval: App ideas before recruiting · Cowork-native after building" under the toggle. The brief says no subtitles except all clear Home.
*Default:* keep it (appearance follows the mockup), styled as a meta line.

**Q11. Page date is missing on some mockups.** 07, 08, 04, 05, 06, 03 have no date line; 01, 02, 09, 10, 11, 12, 13 do.
*Default:* follow each mockup. Pages with a back link or breadcrumb, plus Ideas & Projects, have no date.

### C. Behaviour not specified

**Q12. Where does the publisher mark a project Live?** The brief says the specialist "marks it Live", and Home's "Open" goes to the workspace, but the workspace's primary button is listed as "None" and no mockup shows the control.
*Default:* on the workspace, for the assigned publisher only while in Publishing, a primary "Mark Live" button on the right of the next-action line ("You're publishing this"). It is that screen's only primary.

**Q13. Where do drafts and returned ideas live?** Stage Idea isn't a pipeline column and isn't in needs you. A returned idea would be invisible to its owner.
*Default:* drafts appear only in the List view (stage "Idea", filtered to their owner; other people never see drafts), and in the command palette. Should a returned idea also be a needs-you item for its owner ("Returned with a note", action Edit)? That's a 4th needs-you type the brief doesn't list, so I won't add it unless you say so.

**Q14. Who can read a question thread?** The brief calls it a private chat and only lists who can *post*. But "Already answered?" links to other people's resolved questions, so resolved threads must be readable.
*Default:* unclaimed: everyone can open it (title and body only; Champions see Claim). In progress: asker and claimer only; for others the row is not a link. Resolved: everyone can read it, read-only.

**Q15. "Mine" tab definition.** 02 shows "Mine 2" for Alex, which matches the questions Alex has claimed that are still open.
*Default:* Mine = open questions I asked or claimed. Count shown is that number.

**Q16. Who can approve their own idea?** Home leaves out an admin's own ideas. Should the server also block an admin approving their own idea on `/approve`?
*Default:* yes, block it (403). Their own ideas still auto-approve. With Alex as the only admin, his ideas always wait for the timeout. Is that acceptable?

**Q17. Cowork-native returned after building.** Returning sends the idea back to the owner as a draft. For a Cowork-native project that has already been built, that would throw away the team and plan.
*Default:* a Cowork-native return in post-build Approval goes back to Building, with the note posted as a system message in Chat and shown at the top of the Plan tab. App returns go to Idea as the brief says. Also: does the approval timeout and auto-approve apply to Cowork-native post-build approvals? *Default:* yes, same rule.

**Q18. Pulse for non-admins / non-Champions.** Pulse is in everyone's nav. A Member would see "Review" (admin only) and "Claim" (Champions only).
*Default:* everyone sees the same items (it's a team-wide nudge, and the count pill is global), but the action button only shows when the viewer can do it; otherwise the row links to the item. Alternatively, hide items the viewer can't act on, which would make the pill count differ per person.

**Q19. Removing a topic that's in use.**
*Default:* removing archives it (`Topic.archivedAt`): gone from pickers and filters, still shown on existing questions and projects.

**Q20. Admin save behaviour across tabs.** 12 shows Save changes on Rules.
*Default:* Rules, People & roles and Impact assumptions each have one Save changes primary. Topics act immediately (add with a secondary Add button, inline rename, Remove as a text link), since there's nothing to batch. The server blocks removing Admin from the last admin.

**Q21. Attachment storage on Railway.** The container disk is wiped on redeploy.
*Default:* a Railway volume mounted at `/data/uploads` (`UPLOAD_DIR` env var), 10 MB per file limit, any file type, downloads only through the permission-checked route. Alternative: a Railway bucket (S3-compatible). Which do you want, and is there a size or type limit?

**Q22. Timezone for dates and the digest.** "Today at 16:00", "09:00 each weekday" and month boundaries all need a timezone.
*Default:* `SPINE_TIMEZONE`, defaulting to `Europe/London`. All formatting and the digest schedule use it.

**Q23. Build plan generation timing.** Generating 6 to 10 steps takes several seconds. The brief says never block the user.
*Default:* the join that fills the team returns immediately; the plan generates in the background (`after()`), and the Plan tab shows skeleton rows while `planStatus = GENERATING`, or "The build plan couldn't be generated. Try again." on failure. Adds `Project.planStatus`.

**Q24. activePhrase for manually added steps.** Claude writes it for generated steps. A step added by hand has no phrase, but could become "the next open step".
*Default:* ask Claude for a phrase when a manual step is added or renamed (falling back to "working on [title in lower case]" if the call fails).

**Q25. What counts as activity?** The brief says ticking and editing update `lastActivityAt`.
*Default:* plan changes, chat messages, joins, stage changes and hours logged all count. Pure page views don't. Agreed?

**Q26. "0-point champions listed after everyone else": do they get a rank number?** With ties sharing ranks they'd be last anyway.
*Default:* they share the last rank like any tie (e.g. all 0-point champions show "6"). Or should they show no rank number?

**Q27. Reopening a resolved question and points.** If a question resolved on 3 Oct is reopened, does the claimer lose that point?
*Default:* yes. Reopen clears `resolvedAt`; it scores again in whichever period it's re-resolved in. The new details from the Ask form are posted as a new message from the asker in the reopened thread.

**Q28. Next action for drafts, and Live with no hours this month.**
*Default:* drafts show nothing (no sentence) in the List view's next action column. Live with no log this month shows "Live · 0 hours saved this month".

**Q29. Form option ranges (04).**
*Default:* team size 1 to 10, hours per week 1 to 10, length 1 to 12 weeks, difficulty Easy / Moderate / Hard, target date must be after today. A team size of 1 means the owner alone fills the team, so the project skips straight to Building.

**Q30. Owner on the team.** Client Brief Generator is "3 of 4 people" with Alex as owner. I'm assuming the owner is automatically the first team member when recruiting starts. Correct?

**Q31. SPINE_TODAY: frozen or ticking?**
*Default:* frozen. Every request sees exactly 2026-10-07 10:00 so the mockups always match. New messages sent while frozen all share that timestamp, so ordering falls back to creation order. Alternatively it could tick forward from server start, but then "6h" drifts.

**Q32. Digest channel and weekday setting.** 12 shows a channel select (Slack) and fixed text "each weekday", but no control for `digestWeekdaysOnly`.
*Default:* the channel select has one option, Slack. The "each weekday" text reflects the setting ("every day" if false) and isn't editable in the UI, since the mockup has no control for it. Should it be editable, and how?

**Q33. What is `programmeCost` for?** It's in Settings and on the Impact assumptions tab, but no screen uses it.
*Default:* store and edit it only; display nothing derived from it.

**Q34. List view "same filters as the pipeline".** The pipeline mockup has no filter controls. The only filter in the brief is "filtered to them" from Home's View all.
*Default:* one filter, owner=me (my projects: owner, team, approved or published), set by URL. When it's active, a "Show all" text link sits next to the toggle so you can clear it. No other filter UI. Is that right, or did you mean specific filters (topic, build path)?

**Q35. Pipeline card status lines.** 07 uses per-stage lines instead of the next-action sentence: "Auto-approves in 6 hours" (under 24h) vs "Submitted today", "3 of 4 people" + bar, "6 of 9 steps" + bar, "You're publishing this", and Live without the "Live ·" prefix.
*Default:* Approval cards show "Auto-approves in N hours" when under 24h, otherwise "Submitted today" / "Submitted N days ago". Publishing cards for other viewers show "[First name] is publishing this". The List view uses the full next-action sentence.

**Q36. ⌘K on Windows.**
*Default:* both ⌘K and Ctrl+K open the palette; the hint always shows "⌘ K" as in the mockups.

**Q37. Git.** The project folder isn't a git repo, and the brief says commit at the end of each phase.
*Default:* `git init` at the start of Phase 1 in `spine/`, local commits only, no remote until you give me one.

---

Once you answer (or say "use the defaults"), I'll update this file with the decisions and start Phase 1.
