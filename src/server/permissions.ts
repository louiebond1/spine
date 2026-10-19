import "server-only";
import type { Project, Question, User } from "@prisma/client";

// One predicate per permission. Server actions call assert(); pages call the same predicates
// to decide what to render. Organisation boundaries are enforced separately and always: every
// record reaches these checks through the organisation-scoped client (src/server/tenant.ts).

export class ForbiddenError extends Error {
  constructor(message = "You can't do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function assert(allowed: boolean, message?: string): asserts allowed {
  if (!allowed) throw new ForbiddenError(message);
}

type QuestionLike = Pick<Question, "askerId" | "claimerId" | "status">;
type ProjectLike = Pick<Project, "ownerId" | "stage" | "publisherId">;
type Team = { userId: string }[];

const isParticipant = (user: User, q: Pick<Question, "askerId" | "claimerId">) => q.askerId === user.id || (q.claimerId !== null && q.claimerId === user.id);

export const can = {
  askQuestion: (_user: User) => true,

  /** Champions (and admins) see the queue of open questions so they can claim them. */
  seeQueue: (user: User) => user.isChampion || user.isAdmin,

  claimQuestion: (user: User, q: QuestionLike) => user.isChampion && q.status === "UNCLAIMED" && q.askerId !== user.id,

  /** Threads are private to the asker and the claimer, before and after they're resolved. */
  readThread: (user: User, q: QuestionLike) => isParticipant(user, q),

  /** An unclaimed question's title and details are visible to Champions so they can decide to claim. */
  previewQuestion: (user: User, q: QuestionLike) => isParticipant(user, q) || (q.status === "UNCLAIMED" && (user.isChampion || user.isAdmin)),

  postInThread: (user: User, q: QuestionLike) => q.status !== "RESOLVED" && isParticipant(user, q),

  resolveQuestion: (user: User, q: QuestionLike) =>
    (q.status === "IN_PROGRESS" && isParticipant(user, q)) || (q.status === "UNCLAIMED" && q.askerId === user.id),

  /** Only the asker can agree to share an answer with the company. */
  shareAnswer: (user: User, q: QuestionLike) => q.status === "RESOLVED" && q.askerId === user.id,

  /** The Champion who answered can suggest a summary for the asker to approve. */
  suggestShare: (user: User, q: QuestionLike) => q.status === "RESOLVED" && q.claimerId === user.id,

  proposeIdea: (_user: User) => true,

  editIdea: (user: User, p: ProjectLike) => p.ownerId === user.id && p.stage === "IDEA",

  seeScores: (user: User, p: Pick<Project, "ownerId">) => p.ownerId === user.id,

  joinProject: (user: User, p: ProjectLike, team: Team, teamSize: number) =>
    (p.stage === "RECRUITING" || p.stage === "BUILDING") && team.length < teamSize && !team.some((m) => m.userId === user.id),

  onTeam: (user: User, team: Team) => team.some((m) => m.userId === user.id),

  editPlan: (user: User, p: Pick<Project, "stage">, team: Team) => p.stage === "BUILDING" && team.some((m) => m.userId === user.id),

  /** The owner and team check in while the work is active. */
  checkIn: (user: User, p: Pick<Project, "stage" | "ownerId">, team: Team) =>
    (p.stage === "BUILDING" || p.stage === "PUBLISHING") && (p.ownerId === user.id || team.some((m) => m.userId === user.id)),

  /** Team links its Teams or Slack channel. */
  linkChannel: (user: User, p: Pick<Project, "ownerId" | "stage">, team: Team) => p.stage !== "IDEA" && (p.ownerId === user.id || team.some((m) => m.userId === user.id) || user.isAdmin),

  publish: (user: User, p: ProjectLike) => user.isPublishingSpecialist && p.stage === "PUBLISHING" && p.publisherId === user.id,

  /** Approvers come from the matching approval rule; with none named, any admin approves. */
  approve: (user: User, p: ProjectLike & Pick<Project, "approverIds" | "escalatedAt">) =>
    p.stage === "APPROVAL" &&
    p.ownerId !== user.id &&
    (p.approverIds.length > 0 ? p.approverIds.includes(user.id) || (!!p.escalatedAt && user.isAdmin) : user.isAdmin),

  /** Outcomes are verified by someone outside the team: the approver or an admin. */
  verifyOutcome: (user: User, p: Pick<Project, "approvedById">, team: Team, reportedById: string | null) =>
    !team.some((m) => m.userId === user.id) && reportedById !== user.id && (user.isAdmin || p.approvedById === user.id),

  /** Pulse is for the people who keep things moving. */
  seePulse: (user: User) => user.isChampion || user.isAdmin,

  editPlaybook: (user: User) => user.isAdmin,

  manage: (user: User) => user.isAdmin,
};
