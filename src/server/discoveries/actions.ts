"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { now } from "../clock";
import { requireCtx } from "../ctx";
import { assert, can } from "../permissions";

// Discoveries (Inspiration): short, public write-ups of something an employee tried with AI and
// what happened, so colleagues can copy what works.

const schema = z.object({
  title: z.string().trim().min(5, "Give it a title people will recognise.").max(120),
  body: z.string().trim().min(30, "Say what you tried and what happened, in a few sentences.").max(3000),
  toolName: z.string().trim().max(80).default(""),
  topicId: z.string().default(""),
  projectId: z.string().default(""),
});

export async function shareDiscovery(raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireCtx();
  const d = schema.safeParse(raw);
  if (!d.success) return { ok: false, error: d.error.issues[0]?.message ?? "Check the form." };
  const topic = d.data.topicId ? await ctx.db.topic.findFirst({ where: { id: d.data.topicId } }) : null;
  const project = d.data.projectId ? await ctx.db.project.findFirst({ where: { id: d.data.projectId, stage: { not: "IDEA" } } }) : null;
  await ctx.db.discovery.create({
    data: { orgId: ctx.org.id, authorId: ctx.user.id, title: d.data.title, body: d.data.body, toolName: d.data.toolName || null, topicId: topic?.id ?? null, projectId: project?.id ?? null, at: now() },
  });
  revalidatePath("/discover");
  return { ok: true };
}

export async function removeDiscovery(id: string) {
  const ctx = await requireCtx();
  const d = await ctx.db.discovery.findUnique({ where: { id } });
  assert(!!d && (d.authorId === ctx.user.id || can.manage(ctx.user)), "You can't remove this.");
  await ctx.db.discovery.delete({ where: { id } });
  revalidatePath("/discover");
}
