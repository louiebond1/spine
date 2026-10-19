"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCtx, type Ctx } from "../ctx";
import { assert, can } from "../permissions";
import { audit } from "../audit";

// The company AI playbook (Alignment): priorities, tools and their data rules, and guidance.
// Everyone reads it; admins edit it.

async function editor(): Promise<Ctx> {
  const ctx = await requireCtx();
  assert(can.editPlaybook(ctx.user), "Only admins can edit the playbook.");
  return ctx;
}

type Result = { ok: true } | { ok: false; error: string };
const fail = (e: z.ZodError): Result => ({ ok: false, error: e.issues[0]?.message ?? "Check the form." });
const done = (): Result => {
  revalidatePath("/playbook");
  revalidatePath("/");
  return { ok: true };
};

const prioritySchema = z.object({ title: z.string().trim().min(3, "Give it a short title.").max(100), description: z.string().trim().min(10, "Add a sentence on why it matters.").max(600), active: z.boolean().default(true) });

export async function savePriority(id: string | null, raw: unknown): Promise<Result> {
  const ctx = await editor();
  const p = prioritySchema.safeParse(raw);
  if (!p.success) return fail(p.error);
  if (id) await ctx.db.priority.update({ where: { id }, data: p.data });
  else {
    const last = await ctx.db.priority.findFirst({ orderBy: { position: "desc" } });
    await ctx.db.priority.create({ data: { orgId: ctx.org.id, ...p.data, position: (last?.position ?? -1) + 1 } });
  }
  await audit(ctx, id ? "playbook.priority_updated" : "playbook.priority_added", "Priority", id, p.data.title);
  return done();
}

const toolSchema = z.object({
  name: z.string().trim().min(2, "Name the tool.").max(80),
  purpose: z.string().trim().min(5, "Say what it's for.").max(400),
  status: z.enum(["APPROVED", "LIMITED", "NOT_APPROVED"]),
  dataGuidance: z.string().trim().min(5, "Say what data can and can't go in.").max(800),
  url: z.string().trim().max(300).refine((u) => u === "" || /^https:\/\//.test(u), "Links start with https://").default(""),
});

export async function saveTool(id: string | null, raw: unknown): Promise<Result> {
  const ctx = await editor();
  const t = toolSchema.safeParse(raw);
  if (!t.success) return fail(t.error);
  const data = { ...t.data, url: t.data.url || null };
  if (id) await ctx.db.tool.update({ where: { id }, data });
  else {
    const last = await ctx.db.tool.findFirst({ orderBy: { position: "desc" } });
    await ctx.db.tool.create({ data: { orgId: ctx.org.id, ...data, position: (last?.position ?? -1) + 1 } });
  }
  await audit(ctx, id ? "playbook.tool_updated" : "playbook.tool_added", "Tool", id, `${t.data.name} (${t.data.status})`);
  return done();
}

const guideSchema = z.object({ title: z.string().trim().min(3, "Give it a title.").max(120), body: z.string().trim().min(20, "Write at least a couple of sentences.").max(6000) });

export async function saveGuide(id: string | null, raw: unknown): Promise<Result> {
  const ctx = await editor();
  const g = guideSchema.safeParse(raw);
  if (!g.success) return fail(g.error);
  if (id) await ctx.db.guide.update({ where: { id }, data: { ...g.data, updatedById: ctx.user.id } });
  else {
    const last = await ctx.db.guide.findFirst({ orderBy: { position: "desc" } });
    await ctx.db.guide.create({ data: { orgId: ctx.org.id, ...g.data, updatedById: ctx.user.id, position: (last?.position ?? -1) + 1 } });
  }
  await audit(ctx, id ? "playbook.guide_updated" : "playbook.guide_added", "Guide", id, g.data.title);
  return done();
}

export async function removePlaybookItem(kind: "priority" | "tool" | "guide", id: string): Promise<Result> {
  const ctx = await editor();
  if (kind === "priority") await ctx.db.priority.delete({ where: { id } });
  if (kind === "tool") await ctx.db.tool.delete({ where: { id } });
  if (kind === "guide") await ctx.db.guide.delete({ where: { id } });
  await audit(ctx, `playbook.${kind}_removed`, kind, id);
  return done();
}
