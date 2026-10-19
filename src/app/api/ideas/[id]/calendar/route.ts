import { getCtx } from "@/server/ctx";
import { now } from "@/server/clock";
import { appUrl } from "@/server/auth/invitations";
import { buildIcs } from "@/server/integrations/ics";

/** The initiative's target date, open step due dates and next check-in as an .ics file. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getCtx();
  if (!ctx) return new Response("Sign in required", { status: 401 });
  const { id } = await params;
  const p = await ctx.db.project.findUnique({ where: { id }, include: { steps: { where: { done: false }, include: { assignee: { select: { name: true } } } } } });
  // Drafts are private to their owner; everything else is visible within the organisation.
  if (!p || (p.stage === "IDEA" && p.ownerId !== ctx.user.id)) return new Response("Not found", { status: 404 });
  const url = `${appUrl()}/ideas/${p.id}`;
  const events = [
    { uid: `${p.id}-target@spine`, date: p.targetDate, title: `${p.title}: target date`, url },
    ...p.steps.map((s) => ({ uid: `${s.id}@spine`, date: s.dueDate, title: `${p.title}: ${s.title}`, description: `Assigned to ${s.assignee.name}`, url })),
    ...(p.stage === "BUILDING" && p.nextCheckInAt ? [{ uid: `${p.id}-checkin@spine`, date: p.nextCheckInAt, title: `${p.title}: check-in due`, url: `${url}?tab=checkins` }] : []),
  ];
  const body = buildIcs(`Spine: ${p.title}`, events, now());
  const name = p.title.replace(/[^\w -]/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "initiative";
  return new Response(body, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.ics"`, "Cache-Control": "private, no-store" },
  });
}
