import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import type { User } from "@prisma/client";
import { z } from "zod";
import { firstName, longDate, shortDate } from "@/lib/format";
import { now } from "../clock";
import { db } from "../db";
import { getNeedsYou } from "../home/needsYou";
import { can } from "../permissions";
import { STAGE_LABEL } from "../projects/lifecycle";
import { getYourWork, involvesUser, projectSummaryInclude, summarise } from "../projects/queries";
import { getPulseItems } from "../pulse/pulse";

// Ask Spine tools. Every read runs as the signed-in user with the same permission rules as
// the app: no drafts that aren't theirs, no AI scores except on their own ideas, and no
// anonymous askers. Write tools never act: they return a proposal the user must confirm.

export type ProposedAction =
  | { id: string; kind: "add_step"; projectId: string; projectTitle: string; title: string; assigneeId: string; assigneeName: string; dueDate: string }
  | { id: string; kind: "post_update"; projectId: string; projectTitle: string; message: string }
  | { id: string; kind: "ask_question"; title: string; details: string; topicId: string; topicName: string };

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

const schemas = {
  get_my_overview: z.object({}),
  search_projects: z.object({ query: z.string().max(100).default("") }),
  get_project: z.object({ projectId: z.string().min(1) }),
  search_knowledge: z.object({ query: z.string().min(2).max(200) }),
  get_pulse: z.object({}),
  propose_add_step: z.object({
    projectId: z.string().min(1),
    title: z.string().min(3).max(120),
    assigneeName: z.string().max(80).optional(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
  propose_post_update: z.object({ projectId: z.string().min(1), message: z.string().min(3).max(2000) }),
  propose_ask_question: z.object({ title: z.string().min(5).max(200), details: z.string().min(5).max(3000), topic: z.string().min(2).max(40) }),
};

type ToolName = keyof typeof schemas;

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object" as const,
  properties,
  required,
  additionalProperties: false,
});

export const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "get_my_overview",
    description: "What needs the user right now (approvals, questions waiting on them, projects to publish) and their most active projects with each one's next action. Use first for 'what should I do' questions.",
    input_schema: obj({}),
  },
  {
    name: "search_projects",
    description: "Find projects by words in the title or problem. Empty query lists all projects. Returns id, stage, owner and next action.",
    input_schema: obj({ query: { type: "string" } }),
  },
  {
    name: "get_project",
    description: "Full detail of one project: brief, stage, team, build plan steps with assignees and due dates (and which are overdue), recent team chat, and the next action.",
    input_schema: obj({ projectId: { type: "string" } }, ["projectId"]),
  },
  {
    name: "search_knowledge",
    description: "Search answered Help Desk questions (the company's own AI knowledge) and return the answers Champions gave. Use for 'how do I' questions before answering from general knowledge.",
    input_schema: obj({ query: { type: "string" } }, ["query"]),
  },
  {
    name: "get_pulse",
    description: "Things going quiet across the company: approvals near timeout, unanswered questions, stalled builds.",
    input_schema: obj({}),
  },
  {
    name: "propose_add_step",
    description: "Propose adding a step to a project's build plan. Nothing changes until the user confirms. Only for projects in Building where the user is on the team.",
    input_schema: obj(
      {
        projectId: { type: "string" },
        title: { type: "string", description: "Short imperative task, sentence case" },
        assigneeName: { type: "string", description: "A team member's name; defaults to the user" },
        dueDate: { type: "string", description: "yyyy-mm-dd" },
      },
      ["projectId", "title"],
    ),
  },
  {
    name: "propose_post_update",
    description: "Propose posting a message in a project's team chat (for example a status update the user asked you to write). Nothing is posted until the user confirms. Only for projects the user is on the team of.",
    input_schema: obj({ projectId: { type: "string" }, message: { type: "string" } }, ["projectId", "message"]),
  },
  {
    name: "propose_ask_question",
    description: "Propose posting a question to the Help Desk for a Champion to answer, when the knowledge base doesn't cover it. Nothing is posted until the user confirms.",
    input_schema: obj(
      { title: { type: "string" }, details: { type: "string" }, topic: { type: "string", description: "One of the company's Help Desk topics" } },
      ["title", "details", "topic"],
    ),
  },
];

/** Projects the viewer may see: everything submitted, plus their own drafts. */
async function visibleProject(projectId: string, viewer: User) {
  const p = await db.project.findUnique({ where: { id: projectId } });
  if (!p || (p.stage === "IDEA" && p.ownerId !== viewer.id)) return null;
  return p;
}

export async function runTool(
  name: string,
  rawInput: unknown,
  viewer: User,
  propose: (action: ProposedAction) => void,
): Promise<string> {
  if (!(name in schemas)) return `Unknown tool ${name}.`;
  const parsed = schemas[name as ToolName].safeParse(rawInput ?? {});
  if (!parsed.success) return `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`;
  const input = parsed.data as Record<string, string | undefined>;
  const t = now();

  switch (name as ToolName) {
    case "get_my_overview": {
      const needs = await getNeedsYou(viewer);
      const work = await getYourWork(viewer, []);
      return JSON.stringify({
        today: longDate(t),
        needsYou: needs.map((n) => ({ kind: n.kind, title: n.title, reason: [n.reason.before, n.reason.emphasis, n.reason.after].join(""), link: n.action.href })),
        yourProjects: work.map((p) => ({ id: p.id, title: p.title, stage: STAGE_LABEL[p.stage], next: p.next?.text ?? null })),
      });
    }

    case "search_projects": {
      const q = (input.query ?? "").trim();
      const rows = await db.project.findMany({
        where: {
          AND: [
            { OR: [{ stage: { not: "IDEA" } }, { ownerId: viewer.id }] },
            ...(q ? [{ OR: [{ title: { contains: q, mode: "insensitive" as const } }, { problem: { contains: q, mode: "insensitive" as const } }] }] : []),
          ],
        },
        include: projectSummaryInclude,
        orderBy: { lastActivityAt: "desc" },
        take: 15,
      });
      return JSON.stringify(
        rows.map((r) => {
          const s = summarise(r, viewer);
          return { id: s.id, title: s.title, stage: STAGE_LABEL[s.stage], owner: s.owner.name, next: s.next?.text ?? null };
        }),
      );
    }

    case "get_project": {
      const base = await visibleProject(input.projectId!, viewer);
      if (!base) return "No project with that id is visible to this user.";
      const p = await db.project.findUniqueOrThrow({
        where: { id: base.id },
        include: {
          ...projectSummaryInclude,
          topic: true,
          team: { include: { user: true } },
          steps: { include: { assignee: true }, orderBy: { order: "asc" } },
          draftSteps: { orderBy: { order: "asc" } },
          messages: { include: { author: true }, orderBy: { sentAt: "desc" }, take: 12 },
          aiReview: true,
        },
      });
      const s = summarise({ ...p, team: p.team.map((m) => ({ userId: m.userId })) }, viewer);
      const isOwner = p.ownerId === viewer.id;
      return JSON.stringify({
        id: p.id,
        title: p.title,
        stage: STAGE_LABEL[p.stage],
        buildPath: p.buildPath === "APP" ? "App" : "Cowork-native",
        owner: p.owner.name,
        problem: p.problem,
        whoBenefits: p.whoBenefits,
        topic: p.topic.name,
        targetDate: iso(p.targetDate),
        teamSize: p.teamSize,
        team: p.team.map((m) => ({ name: m.user.name, role: m.userId === p.ownerId ? "Owner" : "Member" })),
        viewerIsOnTeam: can.onTeam(viewer, p.team),
        next: s.next?.text ?? null,
        lastActivity: iso(p.lastActivityAt),
        plan: p.steps.map((st) => ({
          title: st.title,
          assignee: st.assignee.name,
          due: iso(st.dueDate),
          done: st.done,
          overdue: !st.done && st.dueDate.getTime() < t.getTime() - DAY,
        })),
        draftPlan: p.steps.length ? undefined : p.draftSteps.map((d) => d.title),
        recentChat: p.messages.reverse().map((m) => (m.isSystem || !m.author ? `[update] ${m.body}` : `${m.author.name}: ${m.body}`)),
        // AI scores are only ever shown to the idea's owner.
        aiReview:
          isOwner && p.aiReview
            ? {
                feasibility: p.aiReview.feasibility,
                businessValue: p.aiReview.businessValue,
                resourcingConfidence: p.aiReview.resourcingConfidence,
                originality: p.aiReview.originality,
              }
            : undefined,
      });
    }

    case "search_knowledge": {
      const words = (input.query ?? "")
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 3);
      if (!words.length) return "[]";
      const rows = await db.question.findMany({
        where: { status: "RESOLVED", OR: words.map((w) => ({ OR: [{ title: { contains: w, mode: "insensitive" as const } }, { body: { contains: w, mode: "insensitive" as const } }] })) },
        include: { topic: true, claimer: true, messages: { orderBy: { sentAt: "asc" } } },
        take: 30,
      });
      const scored = rows
        .map((q) => ({ q, score: words.filter((w) => `${q.title} ${q.body}`.toLowerCase().includes(w)).length }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      // Only the Champion's answers are returned, never who asked.
      return JSON.stringify(
        scored.map(({ q }) => ({
          id: q.id,
          question: q.title,
          topic: q.topic.name,
          answeredBy: q.claimer?.name ?? null,
          answer: q.messages.filter((m) => m.authorId === q.claimerId).map((m) => m.body).join("\n\n") || null,
          link: `/help-desk/${q.id}`,
        })),
      );
    }

    case "get_pulse": {
      const items = await getPulseItems();
      return JSON.stringify(items.map((i) => ({ title: i.title, reason: i.reason, link: i.action.href })));
    }

    case "propose_add_step": {
      const p = await db.project.findUnique({ where: { id: input.projectId! }, include: { team: { include: { user: true } } } });
      if (!p || !can.editPlan(viewer, p, p.team)) return "The user can't add steps to that project (it must be in Building and they must be on the team).";
      const wanted = input.assigneeName?.toLowerCase();
      const member =
        (wanted && p.team.find((m) => m.user.name.toLowerCase().includes(wanted) || firstName(m.user.name).toLowerCase() === wanted)) ||
        p.team.find((m) => m.userId === viewer.id) ||
        p.team[0]!;
      const due = input.dueDate ?? iso(new Date(Math.min(p.targetDate.getTime(), t.getTime() + 7 * DAY)));
      propose({ id: crypto.randomUUID(), kind: "add_step", projectId: p.id, projectTitle: p.title, title: input.title!, assigneeId: member.userId, assigneeName: member.user.name, dueDate: due });
      return `Proposed: add "${input.title}" for ${member.user.name}, due ${shortDate(new Date(due))}. Waiting for the user to confirm.`;
    }

    case "propose_post_update": {
      const p = await db.project.findUnique({ where: { id: input.projectId! }, include: { team: true } });
      if (!p || !can.onTeam(viewer, p.team)) return "The user isn't on that project's team, so they can't post in its chat.";
      propose({ id: crypto.randomUUID(), kind: "post_update", projectId: p.id, projectTitle: p.title, message: input.message! });
      return "Proposed the update. Waiting for the user to confirm before it's posted.";
    }

    case "propose_ask_question": {
      const topics = await db.topic.findMany({ where: { archivedAt: null } });
      const topic = topics.find((x) => x.name.toLowerCase() === input.topic!.toLowerCase()) ?? topics.find((x) => x.name === "Technical") ?? topics[0];
      if (!topic) return "There are no Help Desk topics set up.";
      propose({ id: crypto.randomUUID(), kind: "ask_question", title: input.title!, details: input.details!, topicId: topic.id, topicName: topic.name });
      return `Proposed a Help Desk question under ${topic.name}. Waiting for the user to confirm.`;
    }
  }
}

/** Projects the viewer is involved in, for the system prompt. */
export async function involvedProjectTitles(viewer: User) {
  const rows = await db.project.findMany({ where: involvesUser(viewer.id), select: { id: true, title: true }, take: 20 });
  return rows;
}
