"use server";

import { redirect } from "next/navigation";
import { generateSuggestedAnswer } from "../ai/answer";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { now } from "../clock";
import { db } from "../db";
import { assert, can } from "../permissions";
import { getCurrentUser } from "../session";
import { saveAttachment } from "../storage/attachments";

// CLAUDE.md section 7, Help Desk rules 1 to 5. Every action logs a QuestionEvent.

const askSchema = z.object({
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(1).max(5000),
  topicId: z.string().min(1),
  anonymous: z.boolean(),
});

export type AskResult = { ok: true; id: string } | { ok: false; error: string };

/** Rule 1: ask a question (named or anonymous). */
export async function askQuestion(input: z.input<typeof askSchema>): Promise<AskResult> {
  const user = await getCurrentUser();
  assert(can.askQuestion(user));
  const parsed = askSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Add a title, some details and a topic." };
  const topic = await db.topic.findFirst({ where: { id: parsed.data.topicId, archivedAt: null } });
  if (!topic) return { ok: false, error: "Pick a topic." };

  const t = now();
  const q = await db.question.create({
    data: {
      title: parsed.data.title,
      body: parsed.data.body,
      askerId: user.id,
      isAnonymous: parsed.data.anonymous,
      topicId: topic.id,
      postedAt: t,
      events: { create: { type: "POSTED", actorId: user.id, at: t } },
    },
  });
  // Spine's instant answer is drafted when the asker lands on the thread (runSuggestedAnswer).
  revalidatePath("/", "layout");
  return { ok: true, id: q.id };
}

/** Lazy instant answer for questions that don't have one yet (for example seeded ones). */
export async function runSuggestedAnswer(questionId: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  const q = await db.question.findUnique({ where: { id: questionId } });
  assert(!!q && can.readThread(user, q));
  if (q.aiAnswer || q.status === "RESOLVED") return { ok: true };
  try {
    await generateSuggestedAnswer(questionId);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/**
 * Rule 2: picking one of your own resolved questions reopens it with the same claimer.
 * Any new details become a message from the asker in the reopened thread.
 */
export async function reopenQuestion(questionId: string, details?: string): Promise<AskResult> {
  const user = await getCurrentUser();
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

/** Rule 3: any Champion claims an unclaimed question, then the thread opens for them. */
export async function claimQuestion(questionId: string) {
  const user = await getCurrentUser();
  const q = await db.question.findUnique({ where: { id: questionId } });
  assert(!!q && can.claimQuestion(user, q), "This question can't be claimed.");

  const t = now();
  // Conditional update so two Champions can't both claim it.
  const { count } = await db.question.updateMany({
    where: { id: q.id, status: "UNCLAIMED" },
    data: { status: "IN_PROGRESS", claimerId: user.id, claimedAt: t },
  });
  assert(count === 1, "Someone else has just claimed this question.");
  await db.questionEvent.create({ data: { questionId: q.id, type: "CLAIMED", actorId: user.id, at: t } });

  revalidatePath("/", "layout");
  redirect(`/help-desk/${q.id}`);
}

/** Rule 4: only the asker and claimer post; messages can carry attachments. */
export async function sendQuestionMessage(questionId: string, data: FormData) {
  const user = await getCurrentUser();
  const q = await db.question.findUnique({ where: { id: questionId } });
  assert(!!q && can.postInThread(user, q), "Only the asker and the Champion who claimed this can reply.");

  const body = String(data.get("body") ?? "").trim().slice(0, 5000);
  const files = data.getAll("files").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 5);
  if (!body && files.length === 0) return;

  const saved = await Promise.all(files.map(saveAttachment));
  const t = now();
  await db.$transaction([
    db.questionMessage.create({
      data: { questionId: q.id, authorId: user.id, body, sentAt: t, attachments: { create: saved } },
    }),
    db.questionEvent.create({ data: { questionId: q.id, type: saved.length ? "REPLIED_WITH_FILE" : "REPLIED", actorId: user.id, at: t } }),
  ]);
  revalidatePath("/", "layout");
}

/** Rule 5: either the asker or the claimer marks it resolved. The claimer's point is the resolvedAt. */
export async function resolveQuestion(questionId: string) {
  const user = await getCurrentUser();
  const q = await db.question.findUnique({ where: { id: questionId } });
  assert(!!q && can.resolveQuestion(user, q), "Only the asker or the Champion who claimed this can resolve it.");

  const t = now();
  await db.$transaction([
    db.question.update({ where: { id: q.id }, data: { status: "RESOLVED", resolvedAt: t } }),
    db.questionEvent.create({ data: { questionId: q.id, type: "RESOLVED", actorId: user.id, at: t } }),
  ]);
  revalidatePath("/", "layout");
}
