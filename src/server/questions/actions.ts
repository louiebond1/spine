"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generateSuggestedAnswer } from "../ai/answer";
import { now } from "../clock";
import { requireCtx } from "../ctx";
import { assert, can } from "../permissions";
import { saveAttachment } from "../storage/attachments";
import { audit } from "../audit";
import * as tell from "../notify/events";
import { findSimilarResolved } from "./queries";

// Help Desk actions. Every one runs as the signed-in person, inside their organisation, and logs
// a QuestionEvent for the thread's history.

const askSchema = z.object({
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(1).max(5000),
  topicId: z.string().min(1),
  anonymous: z.boolean(),
});

export type AskResult = { ok: true; id: string } | { ok: false; error: string };

export async function suggestSimilar(title: string) {
  const ctx = await requireCtx();
  return findSimilarResolved(ctx, title.slice(0, 200));
}

export async function askQuestion(input: z.input<typeof askSchema>): Promise<AskResult> {
  const ctx = await requireCtx();
  const { db, user } = ctx;
  const parsed = askSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Add a title, some details and a topic." };
  const topic = await db.topic.findFirst({ where: { id: parsed.data.topicId, archivedAt: null } });
  if (!topic) return { ok: false, error: "Pick a topic." };
  const t = now();
  const q = await db.question.create({
    data: {
      orgId: ctx.org.id,
      title: parsed.data.title,
      body: parsed.data.body,
      askerId: user.id,
      isAnonymous: parsed.data.anonymous,
      topicId: topic.id,
      postedAt: t,
      events: { create: { type: "POSTED", actorId: user.id, at: t } },
    },
  });
  revalidatePath("/", "layout");
  return { ok: true, id: q.id };
}

/** The instant answer, drafted when the asker first opens the thread. Never blocks. */
export async function runSuggestedAnswer(questionId: string): Promise<{ ok: boolean }> {
  const ctx = await requireCtx();
  const q = await ctx.db.question.findUnique({ where: { id: questionId } });
  assert(!!q && can.readThread(ctx.user, q));
  if (q.aiAnswer || q.status === "RESOLVED") return { ok: true };
  try {
    await generateSuggestedAnswer(ctx, questionId);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Picking one of your own resolved questions reopens it with the same Champion. */
export async function reopenQuestion(questionId: string, details?: string): Promise<AskResult> {
  const ctx = await requireCtx();
  const { db, user } = ctx;
  const q = await db.question.findUnique({ where: { id: questionId } });
  assert(!!q && q.askerId === user.id && q.status === "RESOLVED" && !!q.claimerId, "Only the asker can reopen a resolved question.");
  const t = now();
  const body = details?.trim();
  await db.$transaction([
    db.question.update({ where: { id: q.id }, data: { status: "IN_PROGRESS", resolvedAt: null } }),
    db.questionEvent.create({ data: { questionId: q.id, type: "REOPENED", actorId: user.id, at: t } }),
    ...(body ? [db.questionMessage.create({ data: { questionId: q.id, authorId: user.id, body: body.slice(0, 5000), sentAt: t } })] : []),
  ]);
  revalidatePath("/", "layout");
  return { ok: true, id: q.id };
}

export async function claimQuestion(questionId: string) {
  const ctx = await requireCtx();
  const { db, user } = ctx;
  const q = await db.question.findUnique({ where: { id: questionId } });
  assert(!!q && can.claimQuestion(user, q), "This question can't be claimed.");
  const t = now();
  // Conditional update so two Champions can't both claim it.
  const { count } = await db.question.updateMany({ where: { id: q.id, status: "UNCLAIMED" }, data: { status: "IN_PROGRESS", claimerId: user.id, claimedAt: t } });
  assert(count === 1, "Someone else has just claimed this question.");
  await db.questionEvent.create({ data: { questionId: q.id, type: "CLAIMED", actorId: user.id, at: t } });
  await tell.questionClaimed(ctx, q.id, user.id);
  revalidatePath("/", "layout");
  redirect(`/help-desk/${q.id}`);
}

export async function sendQuestionMessage(questionId: string, data: FormData) {
  const ctx = await requireCtx();
  const { db, user } = ctx;
  const q = await db.question.findUnique({ where: { id: questionId } });
  assert(!!q && can.postInThread(user, q), "Only the asker and the Champion who claimed this can reply.");
  const body = String(data.get("body") ?? "").trim().slice(0, 5000);
  const files = data.getAll("files").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 5);
  if (!body && files.length === 0) return;
  const saved = await Promise.all(files.map(saveAttachment));
  const t = now();
  await db.$transaction([
    db.questionMessage.create({ data: { questionId: q.id, authorId: user.id, body, sentAt: t, attachments: { create: saved } } }),
    db.questionEvent.create({ data: { questionId: q.id, type: saved.length ? "REPLIED_WITH_FILE" : "REPLIED", actorId: user.id, at: t } }),
  ]);
  await tell.questionReply(ctx, q.id, user.id);
  revalidatePath("/", "layout");
}

export async function resolveQuestion(questionId: string) {
  const ctx = await requireCtx();
  const { db, user } = ctx;
  const q = await db.question.findUnique({ where: { id: questionId } });
  assert(!!q && can.resolveQuestion(user, q), "Only the asker or the Champion who claimed this can resolve it.");
  const t = now();
  await db.$transaction([
    db.question.update({ where: { id: q.id }, data: { status: "RESOLVED", resolvedAt: t } }),
    db.questionEvent.create({ data: { questionId: q.id, type: "RESOLVED", actorId: user.id, at: t } }),
  ]);
  revalidatePath("/", "layout");
}

const summarySchema = z.string().trim().min(20, "Write at least a sentence or two.").max(2000);

/** The Champion drafts a short, name-free summary and asks the asker whether to share it. */
export async function suggestShare(questionId: string, summary: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireCtx();
  const q = await ctx.db.question.findUnique({ where: { id: questionId } });
  assert(!!q && can.suggestShare(ctx.user, q), "Only the Champion who answered can suggest sharing.");
  const parsed = summarySchema.safeParse(summary);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  await ctx.db.question.update({ where: { id: q.id }, data: { answerSummary: parsed.data } });
  await tell.shareRequested(ctx, q.id, ctx.user.id);
  revalidatePath(`/help-desk/${q.id}`);
  return { ok: true };
}

/** Only the asker can publish the summary as company knowledge. They can edit it first. */
export async function shareAnswer(questionId: string, summary: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireCtx();
  const q = await ctx.db.question.findUnique({ where: { id: questionId } });
  assert(!!q && can.shareAnswer(ctx.user, q), "Only the person who asked can share this answer.");
  const parsed = summarySchema.safeParse(summary);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  await ctx.db.question.update({ where: { id: q.id }, data: { answerSummary: parsed.data, sharedAt: now(), sharedById: ctx.user.id } });
  revalidatePath("/help-desk");
  return { ok: true };
}

/** The asker can withdraw a shared answer at any time; admins can too (moderation). */
export async function unshareAnswer(questionId: string) {
  const ctx = await requireCtx();
  const q = await ctx.db.question.findUnique({ where: { id: questionId } });
  assert(!!q && (q.askerId === ctx.user.id || can.manage(ctx.user)), "You can't change this answer.");
  await ctx.db.question.update({ where: { id: q.id }, data: { sharedAt: null, sharedById: null } });
  if (q.askerId !== ctx.user.id) await audit(ctx, "answer.unshared", "Question", q.id, q.title);
  revalidatePath("/help-desk");
}
