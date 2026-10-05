import "server-only";
import type { Prisma, QuestionEventType, User } from "@prisma/client";
import { db } from "../db";
import { can } from "../permissions";
import { formatSize } from "../storage/attachments";

// All question data leaves the server through these DTOs. When a question is anonymous the
// asker's id and name are never included, for every viewer (CLAUDE.md section 5).

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
  /** True only for the asker themselves. */
  askedByViewer: boolean;
  claimer: (Person & { isViewer: boolean }) | null;
  postedAt: Date;
  resolvedAt: Date | null;
  replyCount: number;
  canClaim: boolean;
  canOpen: boolean;
};

function person(u: Pick<User, "name" | "initials">): Person {
  return { name: u.name, initials: u.initials };
}

export function toQuestionDTO(q: QuestionRow, viewer: User): QuestionDTO {
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
    replyCount: q._count.messages,
    canClaim: can.claimQuestion(viewer, q),
    canOpen: can.readThread(viewer, q),
  };
}

export type HelpDeskTab = "open" | "mine" | "resolved" | "all";

export async function listQuestions(tab: HelpDeskTab, search: string, viewer: User) {
  const where: Prisma.QuestionWhereInput = {};
  if (tab === "open") where.status = { not: "RESOLVED" };
  if (tab === "resolved") where.status = "RESOLVED";
  if (tab === "mine") {
    where.status = { not: "RESOLVED" };
    where.OR = [{ askerId: viewer.id }, { claimerId: viewer.id }];
  }
  if (search.trim()) where.title = { contains: search.trim(), mode: "insensitive" };

  const rows = await db.question.findMany({
    where,
    include: questionInclude,
    orderBy: tab === "resolved" ? { resolvedAt: "desc" } : { postedAt: "desc" },
  });
  const dtos = rows.map((q) => toQuestionDTO(q, viewer));
  return {
    unclaimed: dtos.filter((q) => q.status === "UNCLAIMED"),
    inProgress: dtos.filter((q) => q.status === "IN_PROGRESS"),
    resolved: dtos.filter((q) => q.status === "RESOLVED"),
  };
}

/** Count shown on the Mine tab: open questions the viewer asked or claimed. */
export function countMine(viewer: User) {
  return db.question.count({
    where: { status: { not: "RESOLVED" }, OR: [{ askerId: viewer.id }, { claimerId: viewer.id }] },
  });
}

const EVENT_TEXT: Record<QuestionEventType, string> = {
  POSTED: "posted the question",
  CLAIMED: "claimed it",
  REPLIED: "replied",
  REPLIED_WITH_FILE: "replied with a file",
  RESOLVED: "marked it resolved",
  REOPENED: "reopened it",
};

export async function getThread(id: string, viewer: User) {
  const q = await db.question.findUnique({
    where: { id },
    include: {
      ...questionInclude,
      messages: { orderBy: [{ sentAt: "asc" }, { createdAt: "asc" }], include: { author: true, attachments: true } },
      events: { orderBy: [{ at: "asc" }, { createdAt: "asc" }], include: { actor: true } },
    },
  });
  if (!q) return null;

  const dto = toQuestionDTO({ ...q, messages: q.messages.slice(-1) }, viewer);
  const displayAuthor = (u: User): Person => (q.isAnonymous && u.id === q.askerId ? ANONYMOUS : person(u));

  const sources = q.aiAnswerSources.length
    ? await db.question.findMany({ where: { id: { in: q.aiAnswerSources } }, select: { id: true, title: true } })
    : [];

  return {
    question: dto,
    body: q.body,
    suggested: q.aiAnswer ? { text: q.aiAnswer, sources: sources.map((s) => ({ id: s.id, title: s.title, href: `/help-desk/${s.id}` })) } : null,
    askerCanAccept: q.status === "UNCLAIMED" && q.askerId === viewer.id,
    bestMatch: q.status === "UNCLAIMED" ? await bestChampionFor(q) : null,
    readable: can.readThread(viewer, q),
    canPost: can.postInThread(viewer, q),
    canResolve: can.resolveQuestion(viewer, q),
    messages: q.messages.map((m) => ({
      id: m.id,
      author: displayAuthor(m.author),
      mine: m.authorId === viewer.id,
      body: m.body,
      sentAt: m.sentAt,
      attachments: m.attachments.map((a) => ({ id: a.id, fileName: a.fileName, size: formatSize(a.sizeBytes), href: `/api/attachments/${a.id}` })),
    })),
    history: q.events.map((e) => ({
      id: e.id,
      text: `${e.actorId === viewer.id ? "You" : displayAuthor(e.actor).name} ${EVENT_TEXT[e.type]}`,
      at: e.at,
    })),
  };
}

/** Rule 1: up to three similar resolved questions for "Already answered?". */
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

export async function findSimilarResolved(title: string, viewer: User) {
  const query = tokens(title);
  if (query.size === 0) return [];
  const resolved = await db.question.findMany({
    where: { status: "RESOLVED" },
    select: { id: true, title: true, askerId: true, claimer: { select: { name: true } } },
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
    .map(({ q }) => ({ id: q.id, title: q.title, isMine: q.askerId === viewer.id, resolvedBy: q.claimer?.name ?? null }));
}

/**
 * Best Champion match for an unclaimed question: the Champion who has resolved the most
 * questions in the same topic (ties go to recent activity). Never the asker.
 */
export async function bestChampionFor(q: { id: string; topicId: string; askerId: string }) {
  const counts = await db.question.groupBy({
    by: ["claimerId"],
    where: { status: "RESOLVED", topicId: q.topicId, claimerId: { not: null }, NOT: { claimerId: q.askerId } },
    _count: { _all: true },
    _max: { resolvedAt: true },
  });
  const champions = await db.user.findMany({ where: { isChampion: true, id: { in: counts.map((c) => c.claimerId!).filter(Boolean) } } });
  const best = counts
    .filter((c) => champions.some((u) => u.id === c.claimerId))
    .sort((a, b) => b._count._all - a._count._all || (b._max.resolvedAt?.getTime() ?? 0) - (a._max.resolvedAt?.getTime() ?? 0))[0];
  if (!best) return null;
  const user = champions.find((u) => u.id === best.claimerId)!;
  return { id: user.id, name: user.name, answered: best._count._all };
}
