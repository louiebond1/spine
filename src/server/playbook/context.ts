import "server-only";
import type { Scope } from "../ctx";

const STATUS: Record<string, string> = { APPROVED: "approved", LIMITED: "approved with limits", NOT_APPROVED: "not approved" };

/**
 * The company's AI playbook as plain text for prompts, so reviews and answers are grounded in
 * what this company has actually decided (priorities, approved tools and data rules).
 */
export async function playbookContext(scope: Pick<Scope, "db">): Promise<string | null> {
  const [priorities, tools, guides] = await Promise.all([
    scope.db.priority.findMany({ where: { active: true }, orderBy: { position: "asc" }, take: 10 }),
    scope.db.tool.findMany({ orderBy: { position: "asc" }, take: 30 }),
    scope.db.guide.findMany({ orderBy: { position: "asc" }, take: 10, select: { title: true, body: true } }),
  ]);
  if (!priorities.length && !tools.length && !guides.length) return null;
  return [
    priorities.length ? "Company AI priorities:" : "",
    ...priorities.map((p) => `- ${p.title}: ${p.description.slice(0, 300)}`),
    tools.length ? "AI tools and whether they are approved:" : "",
    ...tools.map((t) => `- ${t.name} (${STATUS[t.status] ?? t.status}): ${t.purpose.slice(0, 200)}. Data rule: ${t.dataGuidance.slice(0, 300)}`),
    guides.length ? "Company guidance:" : "",
    ...guides.map((g) => `- ${g.title}: ${g.body.slice(0, 600)}`),
  ]
    .filter(Boolean)
    .join("\n");
}
