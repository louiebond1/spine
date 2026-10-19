import "server-only";
import type { Prisma, QuestionEventType, User } from "@prisma/client";
import type { Ctx } from "../ctx";
import { can } from "../permissions";
import { formatSize } from "../storage/attachments";

// All question data leaves the server through these DTOs.
// Privacy: a thread (messages, files, history) is visible only to its asker and claimer.
// Champions see the queue of open questions so they can claim them. Everyone else only ever
// sees answers the asker chose to share, as a short summary with no names or files.
// Anonymous askers are never identified to anyone, in any view.

const questionInclude = {
  asker: true,
  claimer: true,
  topic: true,
  _count: { select: { messages: true } },
  messages: { orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }], take: 1, select: { authorId: true, sentAt: true } },
} satisfies Prisma.QuestionInclude;

type QuestionRow = Prisma.QuestionGetPayload<{ include: typeof questionInclude }>;

export type Person = { name: string; initials: string | null };
const ANONYMOUS: Person = { name: "Anonymous", initials: null };

export type QuestionDTO = {
  id: string;
  title: string;
  status: "UNCLAIMED" | "IN_PROGRESS" | "RESOLVED";
  topic: string;
  asker: Person;
  askedByViewer: boolean;
  claimer: (Person & { isViewer: boolean }) | null;
  postedAt: Date;
  resolvedAt: Date | null;
  sharedAt: Date | null;
  replyCount: number;
  canClaim: boolean;
  canOpen: boolean;
  waitingOnViewer: boolean;
};

const person = (u: Pick<User, "name" | "initials">): Person => ({ name: u.name, initials: u.initials });

export function toQuestionDTO(q: QuestionRow, viewer: User): QuestionDTO {
  const last = q.messages[0];
  const waitingOnViewer = q.status === "IN_PROGRESS" && q.claimerId === viewer.id && (!last || last.authorId === q.askerId);
  return {
    id: q.id,
    title: q.title,
    status: q.status,
    topic: q.topic.name,
    asker: q.isAnonymous ? ANONYMOUS : person(q.asker),
    askedByViewer: q.askerId === viewer.id,
    claimer: q.claimer ? { ...person(q.claimer), isViewer: q.claimer.id === viewer.id } : null,
    postedAt: q.postedAt,
    resolvedAt: q.resolvedAt,
    sharedAt: q.sharedAt,
    replyCount: q._count.messages,
    canClaim: can.claimQuestion(viewer, q),
    canOpen: can.previewQuestion(viewer, q),
    waitingOnViewer,
  };
}

export type HelpDeskTab = "queue" | "mine" | "answers";

export function defaultTab(viewer: User): HelpDeskTab {
  return can.seeQueue(viewer) ? "queue" : "mine";
}

export async function listQuestions(ctx: Ctx, tab: HelpDeskTab, search: string) {
  const { db, user } = ctx;
  const where: Prisma.QuestionWhereInput = {};
  if (tab === "queue") {
    if (!can.seeQueue(user)) return { groups: [] };
    where.status = { not: "RESOLVED" };
  }
  if (tab === "mine") where.OR = [{ askerId: user.id }, { claimerId: user.id }];
  if (tab === "answers") where.sharedAt = { not: null };
  if (search.trim()) where.title = { contains: search.trim(), mode: "insensitive" };

  const rows = await db.question.findMany({
    where,
    include: questionInclude,
    orderBy: tab === "answers" ? { sharedAt: "desc" } : { postedAt: "desc" },
    take: 200,
  });
  const dtos = rows.map((q) => toQuestionDTO(q, user));
  if (tab === "answers") return { groups: [{ heading: "Shared answers", items: dtos }] };
  if (tab === "queue") {
    return {
      groups: [
        { heading: "Unclaimed", items: dtos.filter((q) => q.status === "UNCLAIMED") },
        { heading: "In progress", items: dtos.filter((q) => q.status === "IN_PROGRESS") },
      ],
    };
  }
  return {
    groups: [
      { heading: "Open", items: dtos.filter((q) => q.status !== "RESOLVED") },
      { heading: "Resolved", items: dtos.filter((q) => q.status === "RESOLVED") },
    ],
  };
}

/** Count of open questions the viewer asked or claimed. */
export function countMine(ctx: Ctx) {
  return ctx.db.question.count({ where: { status: { not: "RESOLVED" }, OR: [{ askerId: ctx.user.id }, { claimerId: ctx.user.id }] } });
}

const EVENT_TEXT: Record<QuestionEventType, string> = {
  POSTED: "posted the question",
  CLAIMED: "claimed it",
  REPLIED: "replied",
  REPLIED_WITH_FILE: "replied with a file",
  RESOLVED: "marked it resolved",
  REOPENED: "reopened it",
};

/** A shared answer as everyone sees it: the summary only, never the thread, the files or the asker. */
export async function getSharedAnswer(ctx: Ctx, id: string) {
  const q = await ctx.db.question.findUnique({ where: { id }, include: { topic: true, claimer: { select: { name: true } } } });
  if (!q || !q.sharedAt || !q.answerSummary) return null;
  return { id: q.id, title: q.title, topic: q.topic.name, answer: q.answerSummary, answeredBy: q.claimer?.name ?? null, sharedAt: q.sharedAt };
}

export async function getThread(ctx: Ctx, id: string) {
  const viewer = ctx.user;
  const q = await ctx.db.question.findUnique({
    where: { id },
    include: {
      ...questionInclude,
      messages: { orderBy: [{ sentAt: "asc" }, { createdAt: "asc" }], include: { author: true, attachments: true } },
      events: { orderBy: [{ at: "asc" }, { createdAt: "asc" }], include: { actor: true } },
    },
  });
  if (!q || !can.previewQuestion(viewer, q)) return null;
  const participant = can.readThread(viewer, q);

  const dto = toQuestionDTO({ ...q, messages: q.messages.slice(-1) }, viewer);
  const displayAuthor = (u: User): Person => (q.isAnonymous && u.id === q.askerId ? ANONYMOUS : person(u));

  const sources = q.aiAnswerSources.length
    ? await ctx.db.question.findMany({ where: { id: { in: q.aiAnswerSources }, sharedAt: { not: null } }, select: { id: true, title: true } })
    : [];

  return {
    question: dto,
    participant,
    body: q.body,
    suggested: participant && q.aiAnswer ? { text: q.aiAnswer, sources: sources.map((s) => ({ id: s.id, title: s.title, href: `/help-desk/${s.id}` })) } : null,
    askerCanAccept: q.status === "UNCLAIMED" && q.askerId === viewer.id,
    bestMatch: q.status === "UNCLAIMED" && participant ? await bestChampionFor(ctx, q) : null,
    canPost: can.postInThread(viewer, q),
    canResolve: can.resolveQuestion(viewer, q),
    share: {
      summary: q.answerSummary,
      sharedAt: q.sharedAt,
      canShare: can.shareAnswer(viewer, q),
      canSuggest: can.suggestShare(viewer, q) && !q.sharedAt,
    },
    // Champions previewing an unclaimed question see the question, not other people's files.
    messages: (participant ? q.messages : []).map((m) => ({
      id: m.id,
      author: displayAuthor(m.author),
      mine: m.authorId === viewer.id,
      body: m.body,
      sentAt: m.sentAt,
      attachments: m.attachments.map((a) => ({ id: a.id, fileName: a.fileName, size: formatSize(a.sizeBytes), href: `/api/attachments/${a.id}` })),
    })),
    history: participant
      ? q.events.map((e) => ({ id: e.id, text: `${e.actorId === viewer.id ? "You" : displayAuthor(e.actor).name} ${EVENT_TEXT[e.type]}`, at: e.at }))
      : [],
  };
}

const STOP = new Set(["a", "an", "the", "to", "of", "for", "and", "or", "in", "on", "with", "is", "it", "can", "how", "do", "i", "my", "we", "our", "what", "best", "way", "use", "using", "claude", "into", "from", "be", "are", "should"]);

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
      .map((w) => w.replace(/(ing|es|s)$/, "")),
  );
}

/** "Already answered?": shared answers, plus the viewer's own resolved questions (which they can reopen). */
export async function findSimilarResolved(ctx: Ctx, title: string) {
  const query = tokens(title);
  if (query.size === 0) return [];
  const resolved = await ctx.db.question.findMany({
    where: { status: "RESOLVED", OR: [{ sharedAt: { not: null } }, { askerId: ctx.user.id }] },
    select: { id: true, title: true, askerId: true, claimerId: true, claimer: { select: { name: true } } },
    take: 500,
    orderBy: { resolvedAt: "desc" },
  });
  return resolved
    .map((q) => {
      const t = tokens(q.title);
      const overlap = [...query].filter((w) => t.has(w)).length;
      return { q, score: overlap / Math.max(query.size, 1) };
    })
    .filter((x) => x.score >= 0.34)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ q }) => ({ id: q.id, title: q.title, isMine: q.askerId === ctx.user.id && !!q.claimerId, resolvedBy: q.claimer?.name ?? null }));
}

/** The Champion who has resolved the most questions in the topic. Never the asker. */
export async function bestChampionFor(ctx: Ctx, q: { id: string; topicId: string; askerId: string }) {
  const counts = await ctx.db.question.groupBy({
    by: ["claimerId"],
    where: { status: "RESOLVED", topicId: q.topicId, claimerId: { not: null }, NOT: { claimerId: q.askerId } },
    _count: { _all: true },
    _max: { resolvedAt: true },
  });
  const champions = await ctx.db.user.findMany({ where: { isChampion: true, status: "ACTIVE", id: { in: counts.map((c) => c.claimerId!).filter(Boolean) } } });
  const best = counts
    .filter((c) => champions.some((u) => u.id === c.claimerId))
    .sort((a, b) => b._count._all - a._count._all || (b._max.resolvedAt?.getTime() ?? 0) - (a._max.resolvedAt?.getTime() ?? 0))[0];
  if (!best) return null;
  const user = champions.find((u) => u.id === best.claimerId)!;
  return { id: user.id, name: user.name, answered: best._count._all };
}

/** Champions recognised for answering this month (replaces the separate Leaderboard page). */
export async function championsThisMonth(ctx: Ctx, since: Date) {
  const counts = await ctx.db.question.groupBy({ by: ["claimerId"], where: { status: "RESOLVED", resolvedAt: { gte: since }, claimerId: { not: null } }, _count: { _all: true } });
  const users = await ctx.db.user.findMany({ where: { id: { in: counts.map((c) => c.claimerId!) } }, select: { id: true, name: true, initials: true } });
  return counts
    .map((c) => ({ user: users.find((u) => u.id === c.claimerId), answered: c._count._all }))
    .filter((r): r is { user: { id: string; name: string; initials: string }; answered: number } => !!r.user)
    .sort((a, b) => b.answered - a.answered || a.user.name.localeCompare(b.user.name))
    .slice(0, 5);
}
