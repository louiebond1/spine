import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { BuildPath, Difficulty, PrismaClient, ProjectEventType, ProjectStage } from "@prisma/client";
import { addMonths, parseZoned, zonedParts, zonedTime } from "../../src/lib/tz";
import { RESOLVED_TITLES } from "./data/resolved-titles";

// All seed times are written as wall-clock times on the reference "today" in CLAUDE.md
// (Wednesday 7 October 2026, 10:00) and shifted so they stay relative to SPINE_TODAY.

const REFERENCE = parseZoned("2026-10-07T10:00:00");
const NOW = process.env.SPINE_TODAY ? parseZoned(process.env.SPINE_TODAY) : new Date();
const SHIFT = NOW.getTime() - REFERENCE.getTime();

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** An absolute reference time ("2026-09-30T16:00"), shifted relative to now. */
const at = (wallClock: string) => new Date(parseZoned(wallClock).getTime() + SHIFT);
const ago = (ms: number) => new Date(NOW.getTime() - ms);
/** First day of a month as stored in ImpactLog. */
// Month-based data (hours saved, leaderboard periods) moves by whole calendar months, so
// "this month" in the seed is always the real current month, whatever SPINE_TODAY is.
const REF = zonedParts(REFERENCE);
const NOW_PARTS = zonedParts(NOW);
const MONTH_SHIFT = (NOW_PARTS.year - REF.year) * 12 + (NOW_PARTS.month - REF.month);
const month = (year: number, m: number) => addMonths(zonedTime(year, m, 1), MONTH_SHIFT);
/** Days available in a seeded month: the whole month, or only the days before today in the current month. */
const daysIn = (year: number, m: number, fullDays: number) => {
  const start = month(year, m);
  const p = zonedParts(start);
  const isCurrent = p.year === NOW_PARTS.year && p.month === NOW_PARTS.month;
  return isCurrent ? Math.max(1, Math.min(fullDays, NOW_PARTS.day - 1)) : Math.min(fullDays, 28);
};

type Options = { allClear: boolean };

const PEOPLE = [
  { id: "u-alex", name: "Alex Morgan", initials: "AM", isChampion: true, isAdmin: true, isPublishingSpecialist: true },
  { id: "u-louie", name: "Louie Morris", initials: "LM", isChampion: true, isAdmin: false, isPublishingSpecialist: false },
  { id: "u-jamie", name: "Jamie Chen", initials: "JC", isChampion: true, isAdmin: false, isPublishingSpecialist: false },
  { id: "u-sarah", name: "Sarah Kim", initials: "SK", isChampion: true, isAdmin: false, isPublishingSpecialist: false },
  { id: "u-mia", name: "Mia Thompson", initials: "MT", isChampion: true, isAdmin: false, isPublishingSpecialist: true },
  { id: "u-priya", name: "Priya Shah", initials: "PS", isChampion: false, isAdmin: false, isPublishingSpecialist: false },
  { id: "u-ben", name: "Ben Carter", initials: "BC", isChampion: false, isAdmin: false, isPublishingSpecialist: false },
] as const;

const TOPICS = ["Security", "Office", "Excel", "SAP", "Technical", "Productivity", "Procurement", "Finance", "Sales", "Operations", "Legal", "People"];
const topicId = (name: string) => `t-${name.toLowerCase()}`;
const USER_IDS = PEOPLE.map((p) => p.id);

export async function seed(db: PrismaClient, { allClear }: Options) {
  await wipe(db);

  // People, created in a fixed order so the default demo user (first created) is Alex.
  for (const [i, p] of PEOPLE.entries()) {
    await db.user.create({ data: { ...p, createdAt: new Date(REFERENCE.getTime() - (100 - i) * DAY) } });
  }
  await db.topic.createMany({ data: TOPICS.map((name) => ({ id: topicId(name), name })) });
  await db.settings.create({ data: { id: "singleton" } });
  // Example approval rules (Admin > Approvals). They only route ideas submitted from now on,
  // so the seeded Approval items still match the mockups.
  await db.approvalRule.createMany({
    data: [
      {
        id: "r-leadership",
        name: "Leadership sign-off for Legal and Finance apps",
        position: 0,
        topicIds: [topicId("Legal"), topicId("Finance")],
        buildPaths: ["APP"],
        approverIds: ["u-alex", "u-louie"],
        requireAll: true,
        autoApproveDays: null,
      },
      { id: "r-fast-track", name: "Fast track small Cowork-native builds", position: 1, active: false, buildPaths: ["COWORK_NATIVE"], difficulties: ["EASY"], maxTotalHours: 40, fastTrack: true },
    ],
  });

  await seedOpenQuestions(db, allClear);
  await writeSeedAttachment();
  await seedResolvedQuestions(db);
  await seedProjects(db, allClear);
}

async function wipe(db: PrismaClient) {
  await db.opportunity.deleteMany();
  await db.approvalRule.deleteMany();
  await db.leadershipReport.deleteMany();
  await db.notification.deleteMany();
  await db.attachment.deleteMany();
  await db.questionMessage.deleteMany();
  await db.questionEvent.deleteMany();
  await db.question.deleteMany();
  await db.planStep.deleteMany();
  await db.projectMessage.deleteMany();
  await db.projectEvent.deleteMany();
  await db.impactLog.deleteMany();
  await db.teamMember.deleteMany();
  await db.aiReview.deleteMany();
  await db.project.deleteMany();
  await db.topic.deleteMany();
  await db.settings.deleteMany();
  await db.user.deleteMany();
}

// ---------------------------------------------------------------------------
// Help Desk
// ---------------------------------------------------------------------------

type Msg = { author: string; body: string; at: Date; file?: { name: string; size: number } };

async function createQuestion(
  db: PrismaClient,
  q: {
    id: string;
    title: string;
    body: string;
    asker: string;
    anonymous?: boolean;
    topic: string;
    postedAt: Date;
    claimer?: string;
    claimedAt?: Date;
    resolvedAt?: Date;
    messages?: Msg[];
  },
) {
  const status = q.resolvedAt ? "RESOLVED" : q.claimer ? "IN_PROGRESS" : "UNCLAIMED";
  await db.question.create({
    data: {
      id: q.id,
      title: q.title,
      body: q.body,
      askerId: q.asker,
      isAnonymous: q.anonymous ?? false,
      topicId: topicId(q.topic),
      status,
      claimerId: q.claimer ?? null,
      postedAt: q.postedAt,
      claimedAt: q.claimedAt ?? null,
      resolvedAt: q.resolvedAt ?? null,
      createdAt: q.postedAt,
    },
  });

  const events: { type: "POSTED" | "CLAIMED" | "REPLIED" | "REPLIED_WITH_FILE" | "RESOLVED"; actorId: string; at: Date }[] = [
    { type: "POSTED", actorId: q.asker, at: q.postedAt },
  ];
  if (q.claimer && q.claimedAt) events.push({ type: "CLAIMED", actorId: q.claimer, at: q.claimedAt });

  for (const [i, m] of (q.messages ?? []).entries()) {
    await db.questionMessage.create({
      data: {
        id: `${q.id}-m${i + 1}`,
        questionId: q.id,
        authorId: m.author,
        body: m.body,
        sentAt: m.at,
        createdAt: m.at,
        attachments: m.file
          ? { create: { fileName: m.file.name, sizeBytes: m.file.size, storageKey: `seed/${m.file.name}` } }
          : undefined,
      },
    });
    events.push({ type: m.file ? "REPLIED_WITH_FILE" : "REPLIED", actorId: m.author, at: m.at });
  }
  if (q.resolvedAt && q.claimer) events.push({ type: "RESOLVED", actorId: q.claimer, at: q.resolvedAt });

  await db.questionEvent.createMany({ data: events.map((e) => ({ questionId: q.id, ...e })) });
}

async function seedOpenQuestions(db: PrismaClient, allClear: boolean) {
  // In the all clear scenario every open question has been claimed, so nothing is over
  // the unanswered threshold and Pulse is empty (PLAN.md Q1).
  const claimIf = (claimer: string, claimedAt: Date) => (allClear ? { claimer, claimedAt } : {});

  await createQuestion(db, {
    id: "q-anonymise",
    title: "Best way to anonymise client data?",
    body: "We want to use Claude on some client spreadsheets but they contain names and account numbers. What's the safest way to strip those out first?",
    asker: "u-ben",
    topic: "Security",
    postedAt: ago(2 * HOUR + 5 * MIN),
    ...claimIf("u-louie", ago(1 * HOUR)),
  });
  await createQuestion(db, {
    id: "q-client-info",
    title: "Is Claude allowed to access client information?",
    body: "Before I start using Claude for client work, I want to check what our policy says about sharing client information with it.",
    asker: "u-priya",
    anonymous: true,
    topic: "Security",
    postedAt: ago(4 * HOUR),
    ...claimIf("u-sarah", ago(3 * HOUR)),
  });
  await createQuestion(db, {
    id: "q-status-template",
    title: "Create a template for client status reports?",
    body: "Every week I write the same status report for three clients. Could Claude help me set up a template I can reuse?",
    asker: "u-priya",
    topic: "Office",
    postedAt: ago(1 * DAY),
    ...claimIf("u-jamie", ago(20 * HOUR)),
  });

  const excelMessages: Msg[] = [
    {
      author: "u-alex",
      body: "Yes, you can.\n\nStart with one file first. Attach it and tell Claude what you want, for example ‘summarise key trends and create a table’.\n\nOnce that looks good you can add more files and ask it to compare them.",
      at: ago(1 * HOUR),
    },
    {
      author: "u-sarah",
      body: "I’ve attached a sample file. Could you also show how to compare several?",
      at: ago(18 * MIN),
      file: { name: "Sales_Data_Sample.xlsx", size: 240 * 1024 },
    },
  ];
  if (allClear) {
    excelMessages.push({
      author: "u-alex",
      body: "Great. Attach all the regional files in one message, then ask Claude to compare them in a single table with one column per region.",
      at: ago(5 * MIN),
    });
  }
  await createQuestion(db, {
    id: "q-excel",
    title: "Can Claude analyse multiple Excel files?",
    body: "Can Claude analyse multiple Excel files at once?\nI have several reports from different regions and want to compare them.\nIs that possible and what's the best way to do it?",
    asker: "u-sarah",
    topic: "Excel",
    postedAt: ago(2 * HOUR),
    claimer: "u-alex",
    claimedAt: ago(1 * HOUR),
    messages: excelMessages,
  });

  await createQuestion(db, {
    id: "q-sap-data",
    title: "How do I use Claude with SAP data?",
    body: "I export purchase orders from SAP every week. Can Claude help me make sense of them?",
    asker: "u-louie",
    topic: "SAP",
    postedAt: ago(2 * HOUR),
    claimer: "u-mia",
    claimedAt: ago(100 * MIN),
    messages: [
      { author: "u-mia", body: "Yes. Export the report to Excel, remove any supplier bank details, then attach it and ask Claude for the summary you need.", at: ago(90 * MIN) },
      { author: "u-louie", body: "Thanks. Which columns should I leave in?", at: ago(70 * MIN) },
    ],
  });
  await createQuestion(db, {
    id: "q-sap-error",
    title: "Error when connecting Claude to SAP",
    body: "I tried to connect Claude to our SAP system and got a permissions error. Is this something I can fix myself?",
    asker: "u-jamie",
    topic: "Technical",
    postedAt: ago(5 * HOUR),
    claimer: "u-alex",
    claimedAt: ago(4 * HOUR),
    messages: [
      { author: "u-alex", body: "That error means your SAP user doesn't have API access yet. I've asked IT to add it and will let you know when it's done.", at: ago(3 * HOUR + 30 * MIN) },
    ],
  });
  await createQuestion(db, {
    id: "q-meeting-email",
    title: "Turn meeting notes into a client email?",
    body: "I take rough notes in client meetings. Can Claude turn them into a follow up email that sounds like me?",
    asker: "u-mia",
    topic: "Productivity",
    postedAt: ago(1 * DAY),
    claimer: "u-louie",
    claimedAt: ago(22 * HOUR),
    messages: [
      { author: "u-louie", body: "Yes. Paste your notes and one email you've written before, and ask Claude to match its tone.", at: ago(21 * HOUR) },
    ],
  });
}

/** A small sample spreadsheet (CSV content) behind the seeded Sales_Data_Sample.xlsx attachment. */
async function writeSeedAttachment() {
  const dir = join(process.env.UPLOAD_DIR || "./uploads", "seed");
  await mkdir(dir, { recursive: true });
  const rows = ["Region,Month,Sales", "North,September,48200", "South,September,51900", "East,September,39750", "West,September,44100"];
  await writeFile(join(dir, "Sales_Data_Sample.xlsx"), rows.join("\n"));
}

async function seedResolvedQuestions(db: PrismaClient) {
  // Points per champion per month. October matches CLAUDE.md exactly.
  const plan: { year: number; month: number; days: number; counts: Record<string, number> }[] = [
    { year: 2026, month: 7, days: 31, counts: { "u-jamie": 3, "u-mia": 2, "u-sarah": 1, "u-louie": 2, "u-alex": 0 } },
    { year: 2026, month: 8, days: 31, counts: { "u-jamie": 3, "u-mia": 3, "u-sarah": 2, "u-louie": 1, "u-alex": 2 } },
    { year: 2026, month: 9, days: 30, counts: { "u-jamie": 5, "u-mia": 6, "u-sarah": 4, "u-louie": 4, "u-alex": 3 } },
    { year: 2026, month: 10, days: 6, counts: { "u-jamie": 18, "u-mia": 14, "u-sarah": 11, "u-louie": 8, "u-alex": 6 } },
  ];

  let titleIndex = 0;
  let n = 0;
  for (const period of plan) {
    for (const [claimer, count] of Object.entries(period.counts)) {
      for (let i = 0; i < count; i++) {
        const [topic, title] = RESOLVED_TITLES[titleIndex % RESOLVED_TITLES.length]!;
        titleIndex++;
        n++;
        // Spread across the month (1 to 6 Oct for October), at varied times of day.
        const day = 1 + ((i * 7 + n) % daysIn(period.year, period.month, period.days));
        const hour = 9 + ((i * 3 + n) % 8);
        const start = zonedParts(month(period.year, period.month));
        const resolvedAt = zonedTime(start.year, start.month, day, hour, (n * 13) % 60);
        const postedAt = new Date(resolvedAt.getTime() - (3 + (n % 20)) * HOUR);
        const claimedAt = new Date(postedAt.getTime() + (20 + (n % 70)) * MIN);
        const askers = USER_IDS.filter((u) => u !== claimer);
        const asker = askers[n % askers.length]!;
        await createQuestion(db, {
          id: `q-resolved-${n}`,
          title,
          body: `${title.replace(/\?$/, "")}. Any tips on how to approach this with Claude?`,
          asker,
          anonymous: n % 11 === 0,
          topic,
          postedAt,
          claimer,
          claimedAt,
          resolvedAt,
          messages: [
            { author: claimer, body: "Here's how I'd approach it, step by step. Try it and let me know how you get on.", at: new Date(claimedAt.getTime() + 15 * MIN) },
            { author: asker, body: "That worked, thank you.", at: new Date(resolvedAt.getTime() - 10 * MIN) },
          ],
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Ideas & Projects
// ---------------------------------------------------------------------------

type StepSeed = { title: string; phrase: string; assignee: string; due: string; doneAt?: string };

type ProjectSeed = {
  id: string;
  title: string;
  problem: string;
  whoBenefits: string;
  topic: string;
  buildPath: BuildPath;
  teamSize: number;
  hoursPerWeek: number;
  lengthWeeks: number;
  difficulty: Difficulty;
  targetDate: string;
  owner: string;
  stage: ProjectStage;
  createdAt: string;
  submittedAt?: string;
  autoApproveAt?: string;
  approvedAt?: string;
  approvedBy?: string | null;
  buildCompletedAt?: string;
  publisher?: string;
  publishingAssignedAt?: string;
  liveAt?: string;
  lastActivityAt: Date;
  team: [string, string][]; // [userId, joinedAt]
  review?: {
    scores: [number, string][]; // feasibility, business value, resourcing, originality
    related?: string;
    completedAt: string;
  };
  steps?: StepSeed[];
  chat?: { author: string | null; body: string; at: string }[];
  events: { type: ProjectEventType; actor: string | null; at: string; detail?: string }[];
};

const pendingRelated: [string, string][] = [];

async function linkRelated(db: PrismaClient) {
  for (const [projectId, relatedProjectId] of pendingRelated.splice(0)) {
    await db.aiReview.update({ where: { projectId }, data: { relatedProjectId } });
  }
}

async function createProject(db: PrismaClient, p: ProjectSeed) {
  await db.project.create({
    data: {
      id: p.id,
      title: p.title,
      problem: p.problem,
      whoBenefits: p.whoBenefits,
      topicId: topicId(p.topic),
      buildPath: p.buildPath,
      teamSize: p.teamSize,
      hoursPerWeek: p.hoursPerWeek,
      lengthWeeks: p.lengthWeeks,
      difficulty: p.difficulty,
      targetDate: at(p.targetDate),
      ownerId: p.owner,
      stage: p.stage,
      submittedAt: p.submittedAt ? at(p.submittedAt) : null,
      autoApproveAt: p.autoApproveAt ? at(p.autoApproveAt) : null,
      approvedAt: p.approvedAt ? at(p.approvedAt) : null,
      approvedById: p.approvedBy ?? null,
      buildCompletedAt: p.buildCompletedAt ? at(p.buildCompletedAt) : null,
      publisherId: p.publisher ?? null,
      publishingAssignedAt: p.publishingAssignedAt ? at(p.publishingAssignedAt) : null,
      liveAt: p.liveAt ? at(p.liveAt) : null,
      lastActivityAt: p.lastActivityAt,
      planStatus: p.steps?.length ? "READY" : "NONE",
      createdAt: at(p.createdAt),
    },
  });

  if (p.team.length) {
    await db.teamMember.createMany({ data: p.team.map(([userId, joinedAt]) => ({ projectId: p.id, userId, joinedAt: at(joinedAt) })) });
  }

  if (p.review) {
    const [f, b, r, o] = p.review.scores as [[number, string], [number, string], [number, string], [number, string]];
    await db.aiReview.create({
      data: {
        projectId: p.id,
        feasibility: f[0],
        feasibilityReason: f[1],
        businessValue: b[0],
        businessValueReason: b[1],
        resourcingConfidence: r[0],
        resourcingConfidenceReason: r[1],
        originality: o[0],
        originalityReason: o[1],
        // Linked after every project exists (see linkRelated).
        relatedProjectId: null,
        raisedConcerns: [f[0], b[0], r[0], o[0]].some((s) => s <= 5),
        completedAt: at(p.review.completedAt),
      },
    });
    if (p.review.related) pendingRelated.push([p.id, p.review.related]);
  }

  for (const [i, s] of (p.steps ?? []).entries()) {
    await db.planStep.create({
      data: {
        projectId: p.id,
        title: s.title,
        activePhrase: s.phrase,
        assigneeId: s.assignee,
        dueDate: at(s.due),
        done: Boolean(s.doneAt),
        doneAt: s.doneAt ? at(s.doneAt) : null,
        order: i,
        generatedFromBrief: true,
      },
    });
  }

  if (p.chat?.length) {
    await db.projectMessage.createMany({
      data: p.chat.map((m) => ({ projectId: p.id, authorId: m.author, body: m.body, sentAt: at(m.at), isSystem: m.author === null, createdAt: at(m.at) })),
    });
  }

  await db.projectEvent.createMany({
    data: p.events.map((e) => ({ projectId: p.id, type: e.type, actorId: e.actor, detail: e.detail ?? null, at: at(e.at) })),
  });
}

async function seedProjects(db: PrismaClient, allClear: boolean) {
  // Created first because other reviews point at it.
  await createProject(
    db,
    allClear
      ? {
          // All clear: auto-approved a week ago, so it no longer needs Alex (PLAN.md Q2).
          ...supplierResearch(),
          stage: "RECRUITING",
          submittedAt: "2026-09-23T16:00",
          autoApproveAt: "2026-09-30T16:00",
          approvedAt: "2026-09-30T16:00",
          approvedBy: null,
          lastActivityAt: at("2026-09-30T16:00"),
          team: [["u-louie", "2026-09-30T16:00"]],
          review: { ...supplierResearch().review!, completedAt: "2026-09-23T16:05" },
          events: [
            { type: "CREATED", actor: "u-louie", at: "2026-09-23T15:40" },
            { type: "SUBMITTED", actor: "u-louie", at: "2026-09-23T16:00" },
            { type: "AI_REVIEWED", actor: null, at: "2026-09-23T16:05" },
            { type: "AUTO_APPROVED", actor: null, at: "2026-09-30T16:00" },
          ],
        }
      : supplierResearch(),
  );

  await createProject(db, {
    id: "p-supplier-risk",
    title: "Supplier Risk Checker",
    problem:
      "We don't have a simple way to spot risk signals on our existing suppliers. The information is spread across several systems and takes ages to check. This would flag risk signals automatically and give a short summary for each supplier.",
    whoBenefits: "Procurement team",
    topic: "Procurement",
    buildPath: "APP",
    teamSize: 2,
    hoursPerWeek: 2,
    lengthWeeks: 3,
    difficulty: "MODERATE",
    targetDate: "2026-11-26T00:00",
    owner: "u-alex",
    stage: "APPROVAL",
    createdAt: "2026-10-07T09:20",
    submittedAt: "2026-10-07T09:40",
    autoApproveAt: "2026-10-14T09:40",
    lastActivityAt: at("2026-10-07T09:40"),
    team: [],
    review: {
      scores: [
        [8, "Doable with the tools available and a clear build approach."],
        [7, "Solves a real need and could improve supplier due diligence."],
        [7, "Realistic for the team size and timeframe."],
        [4, "Overlaps heavily with Supplier Research Assistant, which also gathers and summarises supplier information."],
      ],
      related: "p-supplier-research",
      completedAt: "2026-10-07T09:32",
    },
    events: [
      { type: "CREATED", actor: "u-alex", at: "2026-10-07T09:20" },
      { type: "AI_REVIEWED", actor: null, at: "2026-10-07T09:32" },
      { type: "SUBMITTED", actor: "u-alex", at: "2026-10-07T09:40" },
    ],
  });

  await createProject(db, {
    id: "p-client-brief",
    title: "Client Brief Generator",
    problem: "Account managers spend hours pulling together background before client meetings. A generator could draft a one page brief from our CRM notes and recent emails.",
    whoBenefits: "Account managers",
    topic: "Sales",
    buildPath: "COWORK_NATIVE",
    teamSize: 4,
    hoursPerWeek: 2,
    lengthWeeks: 4,
    difficulty: "EASY",
    targetDate: "2026-12-04T00:00",
    owner: "u-alex",
    stage: "RECRUITING",
    createdAt: "2026-09-24T11:00",
    submittedAt: "2026-09-24T11:30",
    lastActivityAt: ago(4 * DAY),
    team: [
      ["u-alex", "2026-09-24T11:30"],
      ["u-louie", "2026-09-28T14:10"],
      ["u-priya", "2026-10-03T10:00"],
    ],
    review: {
      scores: [
        [9, "Uses tools the team already has and a simple workflow."],
        [7, "Saves account managers preparation time before every meeting."],
        [8, "Four people at two hours a week is enough for this scope."],
        [8, "No existing project covers client briefs."],
      ],
      completedAt: "2026-09-24T11:20",
    },
    chat: [
      { author: "u-alex", body: "Thanks for joining. We need one more person before we can start.", at: "2026-09-28T14:30" },
      { author: "u-priya", body: "Happy to help with testing the brief format.", at: "2026-10-03T10:05" },
    ],
    events: [
      { type: "CREATED", actor: "u-alex", at: "2026-09-24T11:00" },
      { type: "AI_REVIEWED", actor: null, at: "2026-09-24T11:20" },
      { type: "SUBMITTED", actor: "u-alex", at: "2026-09-24T11:30" },
      { type: "JOINED", actor: "u-louie", at: "2026-09-28T14:10" },
      { type: "JOINED", actor: "u-priya", at: "2026-10-03T10:00" },
    ],
  });

  await createProject(db, {
    id: "p-meeting-summary",
    title: "Meeting Summary Bot",
    problem: "Meeting notes are inconsistent and actions get lost. A bot could turn recordings into a summary with owners and dates.",
    whoBenefits: "Operations team",
    topic: "Operations",
    buildPath: "COWORK_NATIVE",
    teamSize: 3,
    hoursPerWeek: 2,
    lengthWeeks: 3,
    difficulty: "EASY",
    targetDate: "2026-11-20T00:00",
    owner: "u-sarah",
    stage: "RECRUITING",
    createdAt: "2026-10-05T09:00",
    submittedAt: "2026-10-05T09:30",
    lastActivityAt: ago(2 * DAY),
    team: [["u-sarah", "2026-10-05T09:30"]],
    review: {
      scores: [
        [8, "Straightforward with the meeting tools we already use."],
        [7, "Fewer lost actions after operations meetings."],
        [7, "Three people is enough for a short build."],
        [6, "Similar to note taking features some teams already use."],
      ],
      completedAt: "2026-10-05T09:20",
    },
    events: [
      { type: "CREATED", actor: "u-sarah", at: "2026-10-05T09:00" },
      { type: "AI_REVIEWED", actor: null, at: "2026-10-05T09:20" },
      { type: "SUBMITTED", actor: "u-sarah", at: "2026-10-05T09:30" },
    ],
  });

  await createProject(db, {
    id: "p-ai-invoice",
    title: "AI Invoice Assistant",
    problem: "Invoices arrive in many formats and are keyed in by hand. An assistant could read each invoice, match it to the purchase order and flag anything that doesn't match.",
    whoBenefits: "Finance team",
    topic: "Finance",
    buildPath: "APP",
    // Alex joined the team so the plan is editable as Alex, matching 08 (PLAN.md Q4).
    teamSize: 4,
    hoursPerWeek: 3,
    lengthWeeks: 6,
    difficulty: "MODERATE",
    targetDate: "2026-11-19T00:00",
    owner: "u-jamie",
    stage: "BUILDING",
    createdAt: "2026-08-24T10:00",
    submittedAt: "2026-08-24T10:30",
    autoApproveAt: "2026-08-31T10:30",
    approvedAt: "2026-08-26T15:00",
    approvedBy: "u-alex",
    lastActivityAt: ago(2 * HOUR),
    team: [
      ["u-jamie", "2026-08-26T15:00"],
      ["u-mia", "2026-08-27T09:15"],
      ["u-sarah", "2026-08-28T11:40"],
      ["u-alex", "2026-09-01T10:00"],
    ],
    review: {
      scores: [
        [7, "Needs a reliable way to read different invoice layouts."],
        [9, "Saves the finance team hours of manual entry every week."],
        [7, "Four people over six weeks fits the scope."],
        [8, "No other project automates invoice matching."],
      ],
      completedAt: "2026-08-24T10:20",
    },
    steps: [
      { title: "Map the current invoice process", phrase: "mapping the invoice process", assignee: "u-jamie", due: "2026-09-08T00:00", doneAt: "2026-09-07T16:00" },
      { title: "Collect sample invoices", phrase: "collecting sample invoices", assignee: "u-sarah", due: "2026-09-11T00:00", doneAt: "2026-09-10T12:00" },
      { title: "Draft extraction prompts", phrase: "drafting extraction prompts", assignee: "u-mia", due: "2026-09-16T00:00", doneAt: "2026-09-16T10:30" },
      { title: "Build the invoice upload flow", phrase: "building the upload flow", assignee: "u-alex", due: "2026-09-22T00:00", doneAt: "2026-09-22T17:00" },
      { title: "Match invoices to purchase orders", phrase: "matching invoices to purchase orders", assignee: "u-jamie", due: "2026-09-29T00:00", doneAt: "2026-09-30T11:00" },
      { title: "Review results with the finance team", phrase: "reviewing results with finance", assignee: "u-sarah", due: "2026-10-07T00:00", doneAt: "2026-10-07T08:00" },
      { title: "Test against real supplier cases", phrase: "testing supplier cases", assignee: "u-jamie", due: "2026-10-09T00:00" },
      { title: "Fix edge cases from testing", phrase: "fixing edge cases from testing", assignee: "u-mia", due: "2026-10-14T00:00" },
      { title: "Prepare for publishing", phrase: "preparing for publishing", assignee: "u-jamie", due: "2026-10-16T00:00" },
    ],
    chat: [
      { author: null, body: "Jamie completed Map the current invoice process", at: "2026-09-07T16:00" },
      { author: "u-sarah", body: "I've uploaded 40 sample invoices to the shared folder.", at: "2026-09-10T12:05" },
      { author: null, body: "Sarah completed Collect sample invoices", at: "2026-09-10T12:00" },
      { author: null, body: "Mia completed Draft extraction prompts", at: "2026-09-16T10:30" },
      { author: null, body: "Alex completed Build the invoice upload flow", at: "2026-09-22T17:00" },
      { author: null, body: "Jamie completed Match invoices to purchase orders", at: "2026-09-30T11:00" },
      { author: "u-jamie", body: "Matching works for most invoices. I'll test real supplier cases this week.", at: "2026-10-06T15:20" },
      { author: null, body: "Sarah completed Review results with the finance team", at: "2026-10-07T08:00" },
    ],
    events: [
      { type: "CREATED", actor: "u-jamie", at: "2026-08-24T10:00" },
      { type: "AI_REVIEWED", actor: null, at: "2026-08-24T10:20" },
      { type: "SUBMITTED", actor: "u-jamie", at: "2026-08-24T10:30" },
      { type: "APPROVED", actor: "u-alex", at: "2026-08-26T15:00" },
      { type: "JOINED", actor: "u-mia", at: "2026-08-27T09:15" },
      { type: "JOINED", actor: "u-sarah", at: "2026-08-28T11:40" },
      { type: "JOINED", actor: "u-alex", at: "2026-09-01T10:00" },
      { type: "RECRUITED", actor: null, at: "2026-09-01T10:00" },
      { type: "PLAN_GENERATED", actor: null, at: "2026-09-01T10:01" },
      { type: "STEP_COMPLETED", actor: "u-jamie", at: "2026-09-07T16:00", detail: "Map the current invoice process" },
      { type: "STEP_COMPLETED", actor: "u-sarah", at: "2026-09-10T12:00", detail: "Collect sample invoices" },
      { type: "STEP_COMPLETED", actor: "u-mia", at: "2026-09-16T10:30", detail: "Draft extraction prompts" },
      { type: "STEP_COMPLETED", actor: "u-alex", at: "2026-09-22T17:00", detail: "Build the invoice upload flow" },
      { type: "STEP_COMPLETED", actor: "u-jamie", at: "2026-09-30T11:00", detail: "Match invoices to purchase orders" },
      { type: "STEP_COMPLETED", actor: "u-sarah", at: "2026-10-07T08:00", detail: "Review results with the finance team" },
    ],
  });

  await createProject(db, {
    id: "p-contract-clause",
    title: "Contract Clause Checker",
    problem: "Reviewing supplier contracts against our standard clauses is slow. A checker could highlight clauses that differ from our approved wording.",
    whoBenefits: "Legal team",
    topic: "Legal",
    buildPath: "APP",
    teamSize: 3,
    hoursPerWeek: 2,
    lengthWeeks: 6,
    difficulty: "HARD",
    targetDate: "2026-11-27T00:00",
    owner: "u-mia",
    stage: "BUILDING",
    createdAt: "2026-08-17T10:00",
    submittedAt: "2026-08-17T10:30",
    autoApproveAt: "2026-08-24T10:30",
    // Auto-approved, so it is not part of Alex's work (keeps 13 matching, PLAN.md Q2).
    approvedAt: "2026-08-24T10:30",
    approvedBy: null,
    lastActivityAt: allClear ? ago(1 * DAY) : ago(12 * DAY),
    team: [
      ["u-mia", "2026-08-24T10:30"],
      ["u-louie", "2026-08-25T13:00"],
      ["u-ben", "2026-08-26T09:00"],
    ],
    review: {
      scores: [
        [6, "Clause matching needs careful testing on real contracts."],
        [8, "Faster contract reviews for the legal team."],
        [6, "Tight for three people at two hours a week."],
        [7, "Related to general contract summaries but more specific."],
      ],
      completedAt: "2026-08-17T10:20",
    },
    steps: [
      { title: "Collect our standard clauses", phrase: "collecting standard clauses", assignee: "u-mia", due: "2026-09-01T00:00", doneAt: "2026-09-01T15:00" },
      { title: "Gather sample supplier contracts", phrase: "gathering sample contracts", assignee: "u-ben", due: "2026-09-08T00:00", doneAt: "2026-09-09T11:00" },
      { title: "Draft comparison prompts", phrase: "drafting comparison prompts", assignee: "u-louie", due: "2026-09-18T00:00", doneAt: "2026-09-25T10:00" },
      { title: "Build the contract upload screen", phrase: "building the upload screen", assignee: "u-mia", due: "2026-10-02T00:00" },
      { title: "Test against signed contracts", phrase: "testing signed contracts", assignee: "u-ben", due: "2026-10-16T00:00" },
      { title: "Review results with legal", phrase: "reviewing results with legal", assignee: "u-louie", due: "2026-11-06T00:00" },
      { title: "Prepare for publishing", phrase: "preparing for publishing", assignee: "u-mia", due: "2026-11-20T00:00" },
    ],
    chat: [
      { author: null, body: "Mia completed Collect our standard clauses", at: "2026-09-01T15:00" },
      { author: null, body: "Ben completed Gather sample supplier contracts", at: "2026-09-09T11:00" },
      { author: null, body: "Louie completed Draft comparison prompts", at: "2026-09-25T10:00" },
    ],
    events: [
      { type: "CREATED", actor: "u-mia", at: "2026-08-17T10:00" },
      { type: "AI_REVIEWED", actor: null, at: "2026-08-17T10:20" },
      { type: "SUBMITTED", actor: "u-mia", at: "2026-08-17T10:30" },
      { type: "AUTO_APPROVED", actor: null, at: "2026-08-24T10:30" },
      { type: "JOINED", actor: "u-louie", at: "2026-08-25T13:00" },
      { type: "JOINED", actor: "u-ben", at: "2026-08-26T09:00" },
      { type: "RECRUITED", actor: null, at: "2026-08-26T09:00" },
      { type: "PLAN_GENERATED", actor: null, at: "2026-08-26T09:01" },
      { type: "STEP_COMPLETED", actor: "u-mia", at: "2026-09-01T15:00", detail: "Collect our standard clauses" },
      { type: "STEP_COMPLETED", actor: "u-ben", at: "2026-09-09T11:00", detail: "Gather sample supplier contracts" },
      { type: "STEP_COMPLETED", actor: "u-louie", at: "2026-09-25T10:00", detail: "Draft comparison prompts" },
    ],
  });

  const knowledgeSearchSteps: StepSeed[] = [
    { title: "List the questions new starters ask most", phrase: "listing common questions", assignee: "u-priya", due: "2026-09-04T00:00", doneAt: "2026-09-03T14:00" },
    { title: "Collect the policy documents", phrase: "collecting policy documents", assignee: "u-ben", due: "2026-09-10T00:00", doneAt: "2026-09-10T10:00" },
    { title: "Set up the shared Claude project", phrase: "setting up the shared project", assignee: "u-jamie", due: "2026-09-16T00:00", doneAt: "2026-09-15T16:30" },
    { title: "Write the search instructions", phrase: "writing the search instructions", assignee: "u-priya", due: "2026-09-22T00:00", doneAt: "2026-09-22T11:00" },
    { title: "Test with ten real questions", phrase: "testing with real questions", assignee: "u-ben", due: "2026-09-28T00:00", doneAt: "2026-09-29T15:00" },
    { title: "Write a short how to guide", phrase: "writing the how to guide", assignee: "u-jamie", due: "2026-10-02T00:00", doneAt: "2026-10-02T12:00" },
  ];
  await createProject(db, {
    id: "p-knowledge-search",
    title: "Knowledge Search Assistant",
    problem: "People can't find the right policy or process document. A shared Claude project could answer questions from our internal documents and link to the source.",
    whoBenefits: "Everyone",
    topic: "People",
    buildPath: "COWORK_NATIVE",
    teamSize: 3,
    hoursPerWeek: 2,
    lengthWeeks: 5,
    difficulty: "MODERATE",
    targetDate: "2026-10-16T00:00",
    owner: "u-priya",
    stage: allClear ? "LIVE" : "PUBLISHING",
    createdAt: "2026-08-25T09:00",
    submittedAt: "2026-08-25T09:30",
    buildCompletedAt: "2026-10-02T12:00",
    autoApproveAt: "2026-10-09T12:00",
    approvedAt: allClear ? "2026-10-02T15:00" : "2026-10-07T08:00",
    approvedBy: "u-alex",
    publisher: "u-alex",
    publishingAssignedAt: allClear ? "2026-10-02T15:00" : "2026-10-07T08:00",
    liveAt: allClear ? "2026-10-02T16:00" : undefined,
    // All clear: went live five days ago, older than Client Brief Generator (PLAN.md Q2).
    lastActivityAt: allClear ? at("2026-10-02T16:00") : ago(2 * HOUR),
    team: [
      ["u-priya", "2026-08-25T09:30"],
      ["u-ben", "2026-08-27T10:00"],
      ["u-jamie", "2026-08-29T13:00"],
    ],
    review: {
      scores: [
        [9, "Simple to build with a shared Claude project."],
        [8, "Saves everyone time looking for documents."],
        [8, "Three people is plenty for this scope."],
        [7, "Some overlap with the Claude Onboarding Guide."],
      ],
      related: "p-onboarding-guide",
      completedAt: "2026-08-25T09:20",
    },
    steps: knowledgeSearchSteps,
    chat: [
      { author: null, body: "Jamie completed Write a short how to guide", at: "2026-10-02T12:00" },
      { author: "u-priya", body: "All steps are done. Over to leadership for approval.", at: "2026-10-02T12:10" },
    ],
    events: [
      { type: "CREATED", actor: "u-priya", at: "2026-08-25T09:00" },
      { type: "AI_REVIEWED", actor: null, at: "2026-08-25T09:20" },
      { type: "SUBMITTED", actor: "u-priya", at: "2026-08-25T09:30" },
      { type: "JOINED", actor: "u-ben", at: "2026-08-27T10:00" },
      { type: "JOINED", actor: "u-jamie", at: "2026-08-29T13:00" },
      { type: "RECRUITED", actor: null, at: "2026-08-29T13:00" },
      { type: "PLAN_GENERATED", actor: null, at: "2026-08-29T13:01" },
      { type: "BUILD_COMPLETED", actor: "u-jamie", at: "2026-10-02T12:00" },
      { type: "APPROVED", actor: "u-alex", at: allClear ? "2026-10-02T15:00" : "2026-10-07T08:00" },
      { type: "PUBLISHER_ASSIGNED", actor: null, at: allClear ? "2026-10-02T15:00" : "2026-10-07T08:00", detail: "Alex Morgan" },
      ...(allClear ? [{ type: "WENT_LIVE" as const, actor: "u-alex", at: "2026-10-02T16:00" }] : []),
    ],
  });

  await createProject(db, {
    id: "p-onboarding-guide",
    title: "Claude Onboarding Guide",
    problem: "New starters don't know how to get started with Claude. A guided set of prompts and examples would get them productive in their first week.",
    whoBenefits: "New starters",
    topic: "People",
    buildPath: "COWORK_NATIVE",
    teamSize: 3,
    hoursPerWeek: 2,
    lengthWeeks: 4,
    difficulty: "EASY",
    targetDate: "2026-07-17T00:00",
    owner: "u-priya",
    stage: "LIVE",
    createdAt: "2026-06-08T10:00",
    submittedAt: "2026-06-08T10:30",
    buildCompletedAt: "2026-07-08T16:00",
    autoApproveAt: "2026-07-15T16:00",
    approvedAt: "2026-07-10T11:00",
    approvedBy: "u-alex",
    publisher: "u-alex",
    publishingAssignedAt: "2026-07-10T11:00",
    liveAt: "2026-07-14T10:00",
    lastActivityAt: ago(1 * DAY),
    team: [
      ["u-priya", "2026-06-08T10:30"],
      ["u-sarah", "2026-06-10T09:00"],
      ["u-louie", "2026-06-11T14:00"],
    ],
    review: {
      scores: [
        [9, "Built entirely with tools we already have."],
        [8, "Helps every new starter get value from Claude sooner."],
        [8, "Achievable for three people in four weeks."],
        [9, "Nothing else covers onboarding."],
      ],
      completedAt: "2026-06-08T10:20",
    },
    steps: [
      { title: "Interview recent starters", phrase: "interviewing recent starters", assignee: "u-priya", due: "2026-06-17T00:00", doneAt: "2026-06-16T15:00" },
      { title: "Write the first week prompts", phrase: "writing first week prompts", assignee: "u-sarah", due: "2026-06-26T00:00", doneAt: "2026-06-25T12:00" },
      { title: "Record short examples", phrase: "recording examples", assignee: "u-louie", due: "2026-07-01T00:00", doneAt: "2026-07-01T16:00" },
      { title: "Pilot with two new starters", phrase: "piloting with new starters", assignee: "u-priya", due: "2026-07-08T00:00", doneAt: "2026-07-08T16:00" },
    ],
    events: [
      { type: "CREATED", actor: "u-priya", at: "2026-06-08T10:00" },
      { type: "AI_REVIEWED", actor: null, at: "2026-06-08T10:20" },
      { type: "SUBMITTED", actor: "u-priya", at: "2026-06-08T10:30" },
      { type: "JOINED", actor: "u-sarah", at: "2026-06-10T09:00" },
      { type: "JOINED", actor: "u-louie", at: "2026-06-11T14:00" },
      { type: "RECRUITED", actor: null, at: "2026-06-11T14:00" },
      { type: "BUILD_COMPLETED", actor: "u-priya", at: "2026-07-08T16:00" },
      { type: "APPROVED", actor: "u-alex", at: "2026-07-10T11:00" },
      { type: "PUBLISHER_ASSIGNED", actor: null, at: "2026-07-10T11:00", detail: "Alex Morgan" },
      { type: "WENT_LIVE", actor: "u-alex", at: "2026-07-14T10:00" },
      { type: "HOURS_LOGGED", actor: "u-priya", at: "2026-10-06T10:00", detail: "14" },
    ],
  });

  await createProject(db, {
    id: "p-expense-review",
    title: "Expense Review Assistant",
    problem: "Expense claims are checked by hand against policy. An assistant could pre-check each claim and flag the ones that need a closer look.",
    whoBenefits: "Finance team",
    topic: "Finance",
    buildPath: "APP",
    teamSize: 3,
    hoursPerWeek: 3,
    lengthWeeks: 5,
    difficulty: "MODERATE",
    targetDate: "2026-08-07T00:00",
    owner: "u-ben",
    stage: "LIVE",
    createdAt: "2026-06-15T10:00",
    submittedAt: "2026-06-15T10:30",
    autoApproveAt: "2026-06-22T10:30",
    approvedAt: "2026-06-22T10:30",
    approvedBy: null,
    publisher: "u-mia",
    publishingAssignedAt: "2026-07-30T15:00",
    liveAt: "2026-08-04T10:00",
    lastActivityAt: ago(6 * DAY),
    team: [
      ["u-ben", "2026-06-22T10:30"],
      ["u-jamie", "2026-06-23T09:00"],
      ["u-mia", "2026-06-24T11:00"],
    ],
    review: {
      scores: [
        [8, "Policy rules are clear enough to check automatically."],
        [8, "Faster expense approvals and fewer errors."],
        [7, "Three people over five weeks is realistic."],
        [8, "No existing project checks expenses."],
      ],
      completedAt: "2026-06-15T10:20",
    },
    steps: [
      { title: "Write down the expense policy rules", phrase: "writing down the rules", assignee: "u-ben", due: "2026-06-30T00:00", doneAt: "2026-06-30T12:00" },
      { title: "Build the claim check", phrase: "building the claim check", assignee: "u-jamie", due: "2026-07-14T00:00", doneAt: "2026-07-14T16:00" },
      { title: "Test with last quarter's claims", phrase: "testing last quarter's claims", assignee: "u-mia", due: "2026-07-24T00:00", doneAt: "2026-07-23T15:00" },
      { title: "Prepare for publishing", phrase: "preparing for publishing", assignee: "u-ben", due: "2026-07-30T00:00", doneAt: "2026-07-30T15:00" },
    ],
    events: [
      { type: "CREATED", actor: "u-ben", at: "2026-06-15T10:00" },
      { type: "AI_REVIEWED", actor: null, at: "2026-06-15T10:20" },
      { type: "SUBMITTED", actor: "u-ben", at: "2026-06-15T10:30" },
      { type: "AUTO_APPROVED", actor: null, at: "2026-06-22T10:30" },
      { type: "JOINED", actor: "u-jamie", at: "2026-06-23T09:00" },
      { type: "JOINED", actor: "u-mia", at: "2026-06-24T11:00" },
      { type: "RECRUITED", actor: null, at: "2026-06-24T11:00" },
      { type: "BUILD_COMPLETED", actor: "u-ben", at: "2026-07-30T15:00" },
      { type: "PUBLISHER_ASSIGNED", actor: null, at: "2026-07-30T15:00", detail: "Mia Thompson" },
      { type: "WENT_LIVE", actor: "u-mia", at: "2026-08-04T10:00" },
      { type: "HOURS_LOGGED", actor: "u-ben", at: "2026-10-01T10:00", detail: "28" },
    ],
  });

  await linkRelated(db);

  // Hours saved (CLAUDE.md section 9).
  const hours: [string, number, number, number][] = [
    ["p-onboarding-guide", 2026, 7, 6],
    ["p-onboarding-guide", 2026, 8, 10],
    ["p-onboarding-guide", 2026, 9, 12],
    ["p-onboarding-guide", 2026, 10, 14],
    ["p-expense-review", 2026, 8, 6],
    ["p-expense-review", 2026, 9, 18],
    ["p-expense-review", 2026, 10, 28],
  ];
  await db.impactLog.createMany({ data: hours.map(([projectId, y, m, h]) => ({ projectId, month: month(y, m), hoursSaved: h })) });
}

function supplierResearch(): ProjectSeed {
  return {
    id: "p-supplier-research",
    title: "Supplier Research Assistant",
    problem: "Sourcing supplier information is slow and manual, with key details spread across different websites and documents.",
    whoBenefits: "Procurement team",
    topic: "Procurement",
    buildPath: "APP",
    teamSize: 3,
    hoursPerWeek: 2,
    lengthWeeks: 4,
    difficulty: "MODERATE",
    targetDate: "2026-11-19T00:00",
    owner: "u-louie",
    stage: "APPROVAL",
    createdAt: "2026-09-30T15:40",
    submittedAt: "2026-09-30T16:00",
    autoApproveAt: "2026-10-07T16:00",
    lastActivityAt: at("2026-09-30T16:05"),
    team: [],
    review: {
      scores: [
        [7, "Doable, though supplier websites vary a lot in layout."],
        [7, "Faster sourcing for the procurement team."],
        [5, "Three people at two hours a week is tight for four weeks."],
        [7, "No existing project gathers supplier information."],
      ],
      completedAt: "2026-09-30T16:05",
    },
    events: [
      { type: "CREATED", actor: "u-louie", at: "2026-09-30T15:40" },
      { type: "SUBMITTED", actor: "u-louie", at: "2026-09-30T16:00" },
      { type: "AI_REVIEWED", actor: null, at: "2026-09-30T16:05" },
    ],
  };
}
