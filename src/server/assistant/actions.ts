"use server";

import { z } from "zod";
import { askQuestion } from "../questions/actions";
import { addStep, sendProjectMessage } from "../projects/actions";
import { getCurrentUser } from "../session";
import { applyChange, applyRecommendation } from "../autopilot/actions";

// Confirming an Ask Spine proposal runs the normal app action, with the normal permission
// checks, as the signed-in user. The proposal itself grants nothing.

const actionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("add_step"), projectId: z.string(), title: z.string().min(2).max(120), assigneeId: z.string(), dueDate: z.string() }),
  z.object({ kind: z.literal("post_update"), projectId: z.string(), message: z.string().min(1).max(5000) }),
  z.object({ kind: z.literal("ask_question"), title: z.string().min(3).max(200), details: z.string().min(1).max(5000), topicId: z.string() }),
  z.object({ kind: z.literal("recommendation"), recommendationId: z.string() }),
  z.object({ kind: z.literal("change"), projectId: z.string(), change: z.string(), payload: z.record(z.string(), z.unknown()), headline: z.string().max(120) }),
]);

export async function confirmAssistantAction(raw: unknown): Promise<{ ok: boolean; message: string; href?: string }> {
  await getCurrentUser();
  const parsed = actionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "That action wasn't valid." };
  const a = parsed.data;
  try {
    if (a.kind === "add_step") {
      const r = await addStep(a.projectId, { title: a.title, assigneeId: a.assigneeId, dueDate: a.dueDate });
      return r.error ? { ok: false, message: r.error } : { ok: true, message: "Step added.", href: `/ideas/${a.projectId}` };
    }
    if (a.kind === "recommendation") {
      const r = await applyRecommendation(a.recommendationId);
      return { ok: r.ok, message: r.message };
    }
    if (a.kind === "change") {
      const r = await applyChange(a.projectId, a.change, a.payload, a.headline);
      return { ok: r.ok, message: r.ok ? `${r.message} You can undo it on the project page.` : r.message, href: r.ok ? `/ideas/${a.projectId}` : undefined };
    }
    if (a.kind === "post_update") {
      const data = new FormData();
      data.set("body", a.message);
      await sendProjectMessage(a.projectId, data);
      return { ok: true, message: "Posted to the team chat.", href: `/ideas/${a.projectId}?tab=chat` };
    }
    const r = await askQuestion({ title: a.title, body: a.details, topicId: a.topicId, anonymous: false });
    return r.ok ? { ok: true, message: "Posted to the Help Desk.", href: `/help-desk/${r.id}` } : { ok: false, message: r.error };
  } catch {
    return { ok: false, message: "You don't have permission to do that." };
  }
}
