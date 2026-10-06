"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { firstName, shortDate } from "@/lib/format";
import { parseZoned, zonedParts } from "@/lib/tz";
import { now } from "../clock";
import { db } from "../db";
import { assert, can } from "../permissions";
import { getCurrentUser } from "../session";
import { logEvent, onStepsChanged, systemMessage, touch } from "../projects/lifecycle";
import { stepAssigned } from "../notify/events";
import { askClaudeForJson, fixturesEnabled, lenient as L } from "./client";

// Meeting notes to plan: Spine reads pasted notes against the live plan and proposes the
// exact updates (finished steps, new actions with owners, reassignments, new dates). The
// team ticks what's right and applies it in one go.

const iso = (d: Date) => {
  const p = zonedParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
};

const parsedSchema = z.object({
  summary: L.text(800),
  changes: z
    .array(
      z.object({
        type: z.enum(["complete", "add", "reassign", "due"]),
        stepTitle: L.text(160).optional(),
        title: L.text(120).optional(),
        person: L.text(80).optional(),
        due: z.preprocess((v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : undefined), z.string().optional()),
        evidence: L.text(200).default(""),
      }),
    )
    .default([])
    .transform((a) => a.slice(0, 15)),
});

export type MeetingChange =
  | { id: string; type: "complete"; stepId: string; label: string; evidence: string }
  | { id: string; type: "add"; title: string; assigneeId: string; due: string; label: string; evidence: string }
  | { id: string; type: "reassign"; stepId: string; assigneeId: string; label: string; evidence: string }
  | { id: string; type: "due"; stepId: string; due: string; label: string; evidence: string };

const SYSTEM = `You read a project team's meeting notes and turn them into updates to their build plan.
Only include changes the notes clearly support:
- "complete": an existing step was finished (stepTitle = the plan step's title)
- "add": a new action someone took on (title: short imperative task; person: who; due: yyyy-mm-dd if a date is mentioned)
- "reassign": an existing step moved to someone else (stepTitle, person)
- "due": an existing step got a new date (stepTitle, due yyyy-mm-dd)
evidence: the short phrase from the notes that justifies it. summary: 2 to 3 sentences on what was decided, written for the team chat.
Use only people on the team and steps on the plan. No em dashes. JSON shape: {"summary":"","changes":[{"type":"","stepTitle":"","title":"","person":"","due":"","evidence":""}]}`;

const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3));
function bestStep<T extends { title: string }>(steps: T[], title: string | undefined): T | undefined {
  if (!title) return undefined;
  const want = words(title);
  return steps
    .map((s) => ({ s, score: [...words(s.title)].filter((w) => want.has(w)).length + (s.title.toLowerCase() === title.toLowerCase() ? 10 : 0) }))
    .filter((x) => x.score >= 1)
    .sort((a, b) => b.score - a.score)[0]?.s;
}

export async function readMeetingNotes(projectId: string, notes: string): Promise<{ ok: true; summary: string; changes: MeetingChange[] } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  const p = await db.project.findUnique({ where: { id: projectId }, include: { team: { include: { user: true } }, steps: { include: { assignee: true }, orderBy: { order: "asc" } } } });
  assert(!!p && can.editPlan(user, p, p.team), "Only the team can update the plan.");
  const text = notes.trim().slice(0, 8000);
  if (text.length < 20) return { ok: false, error: "Paste the meeting notes first." };

  const open = p.steps.filter((s) => !s.done);
  const findPerson = (name?: string) => {
    if (!name) return undefined;
    const n = name.toLowerCase();
    return p.team.find((m) => m.user.name.toLowerCase() === n || firstName(m.user.name).toLowerCase() === n.split(" ")[0]);
  };

  let parsed: z.infer<typeof parsedSchema>;
  try {
    parsed = fixturesEnabled()
      ? fixtureParse(text, open.map((s) => s.title), p.team.map((m) => m.user.name))
      : await askClaudeForJson({
          system: SYSTEM,
          schema: parsedSchema,
          maxTokens: 3000,
          prompt: [
            `Project: ${p.title}. Today is ${iso(now())}. Target ${iso(p.targetDate)}.`,
            `Team: ${p.team.map((m) => m.user.name).join(", ")}`,
            "Open plan steps:",
            ...open.map((s) => `- ${s.title} (${s.assignee.name}, due ${iso(s.dueDate)})`),
            "",
            "Meeting notes:",
            text,
          ].join("\n"),
        });
  } catch (error) {
    console.error("[meeting] read failed", error);
    return { ok: false, error: "Spine couldn't read those notes just now. Try again." };
  }

  const changes: MeetingChange[] = [];
  for (const c of parsed.changes) {
    const id = crypto.randomUUID();
    if (c.type === "complete") {
      const s = bestStep(open, c.stepTitle);
      if (s && !changes.some((x) => "stepId" in x && x.stepId === s.id && x.type === "complete")) changes.push({ id, type: "complete", stepId: s.id, label: `Mark "${s.title}" done`, evidence: c.evidence });
    } else if (c.type === "add" && c.title) {
      const who = findPerson(c.person) ?? p.team.find((m) => m.userId === user.id) ?? p.team[0];
      if (!who) continue;
      const due = c.due ?? iso(new Date(Math.min(p.targetDate.getTime(), now().getTime() + 7 * 86_400_000)));
      changes.push({ id, type: "add", title: c.title, assigneeId: who.userId, due, label: `Add "${c.title}" for ${firstName(who.user.name)}, due ${shortDate(parseZoned(due))}`, evidence: c.evidence });
    } else if (c.type === "reassign") {
      const s = bestStep(open, c.stepTitle);
      const who = findPerson(c.person);
      if (s && who && who.userId !== s.assigneeId) changes.push({ id, type: "reassign", stepId: s.id, assigneeId: who.userId, label: `Move "${s.title}" to ${firstName(who.user.name)}`, evidence: c.evidence });
    } else if (c.type === "due" && c.due) {
      const s = bestStep(open, c.stepTitle);
      if (s) changes.push({ id, type: "due", stepId: s.id, due: c.due, label: `Move "${s.title}" to ${shortDate(parseZoned(c.due))}`, evidence: c.evidence });
    }
  }
  return { ok: true, summary: parsed.summary, changes };
}

const applySchema = z.array(
  z.discriminatedUnion("type", [
    z.object({ type: z.literal("complete"), stepId: z.string() }),
    z.object({ type: z.literal("add"), title: z.string().min(2).max(120), assigneeId: z.string(), due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
    z.object({ type: z.literal("reassign"), stepId: z.string(), assigneeId: z.string() }),
    z.object({ type: z.literal("due"), stepId: z.string(), due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  ]),
);

export async function applyMeetingChanges(projectId: string, rawChanges: unknown, summary: string): Promise<{ ok: boolean; message: string }> {
  const user = await getCurrentUser();
  const p = await db.project.findUnique({ where: { id: projectId }, include: { team: true, steps: true } });
  assert(!!p && can.editPlan(user, p, p.team), "Only the team can update the plan.");
  const parsed = applySchema.safeParse(rawChanges);
  if (!parsed.success || parsed.data.length === 0) return { ok: false, message: "Nothing selected to apply." };
  const onTeam = (id: string) => p.team.some((m) => m.userId === id);
  const stepOf = (id: string) => p.steps.find((s) => s.id === id && !s.done);
  let applied = 0;
  const assigned: string[] = [];

  await db.$transaction(async (tx) => {
    let order = Math.max(-1, ...p.steps.map((s) => s.order)) + 1;
    for (const c of parsed.data) {
      if (c.type === "complete" && stepOf(c.stepId)) {
        await tx.planStep.update({ where: { id: c.stepId }, data: { done: true, doneAt: now() } });
        await logEvent(tx, p.id, "STEP_COMPLETED", user.id, stepOf(c.stepId)!.title);
        applied++;
      }
      if (c.type === "add" && onTeam(c.assigneeId)) {
        const created = await tx.planStep.create({
          data: { projectId: p.id, title: c.title, activePhrase: `working on ${c.title.charAt(0).toLowerCase()}${c.title.slice(1)}`, assigneeId: c.assigneeId, dueDate: parseZoned(c.due), order: order++ },
        });
        assigned.push(created.id);
        await logEvent(tx, p.id, "STEP_ADDED", user.id, c.title);
        applied++;
      }
      if (c.type === "reassign" && stepOf(c.stepId) && onTeam(c.assigneeId)) {
        await tx.planStep.update({ where: { id: c.stepId }, data: { assigneeId: c.assigneeId } });
        assigned.push(c.stepId);
        applied++;
      }
      if (c.type === "due" && stepOf(c.stepId)) {
        await tx.planStep.update({ where: { id: c.stepId }, data: { dueDate: parseZoned(c.due) } });
        applied++;
      }
    }
    const clean = summary.replace(new RegExp(String.fromCharCode(0x2014), "g"), ",").trim().slice(0, 1500);
    if (clean) await tx.projectMessage.create({ data: { projectId: p.id, authorId: user.id, body: `Meeting summary: ${clean}`, sentAt: now() } });
    await systemMessage(tx, p.id, `${firstName(user.name)} updated the plan from meeting notes (${applied} ${applied === 1 ? "change" : "changes"})`);
    await touch(tx, p.id);
  });
  await onStepsChanged(p.id);
  await stepAssigned(assigned, user.id);
  revalidatePath("/", "layout");
  return { ok: true, message: `Applied ${applied} ${applied === 1 ? "change" : "changes"} and posted the summary to Chat.` };
}

/** Local development without an API key: simple pattern reading of the notes. */
function fixtureParse(notes: string, openTitles: string[], team: string[]): z.infer<typeof parsedSchema> {
  const changes: z.infer<typeof parsedSchema>["changes"] = [];
  for (const line of notes.split(/\n+/).map((l) => l.replace(/^[-*\s]+/, "").trim()).filter(Boolean)) {
    const person = team.find((n) => line.toLowerCase().includes(firstName(n).toLowerCase()));
    const step = openTitles.find((t) => [...words(t)].some((w) => line.toLowerCase().includes(w)));
    if (/\b(done|finished|complete[d]?|wrapped up)\b/i.test(line) && step) changes.push({ type: "complete", stepTitle: step, evidence: line.slice(0, 120) });
    else if (/\b(will|to do|action|by)\b/i.test(line) && person) {
      const task = line.replace(new RegExp(`^${firstName(person)}\\s+(will\\s+)?`, "i"), "").replace(/\bby\b.*$/i, "").trim();
      changes.push({ type: "add", title: task.charAt(0).toUpperCase() + task.slice(1, 80), person, evidence: line.slice(0, 120) });
    }
  }
  return { summary: `The team reviewed progress and agreed ${changes.length} updates to the plan.`, changes };
}
