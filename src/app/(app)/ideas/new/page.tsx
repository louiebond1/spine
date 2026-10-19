import { notFound } from "next/navigation";
import { Page } from "@/components/shell/Shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProposeForm, type IdeaDraft } from "@/features/ideas/ProposeForm";
import { zonedParts } from "@/lib/tz";
import { requireCtx } from "@/server/ctx";
import { can } from "@/server/permissions";

const isoDay = (d: Date) => {
  const p = zonedParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
};

/** The one way to propose an idea. `?from=<id>` edits your own draft (with any return note). */
export default async function ProposeIdeaPage({ searchParams }: { searchParams: Promise<{ from?: string; opportunity?: string }> }) {
  const { from, opportunity } = await searchParams;
  const ctx = await requireCtx();
  const topics = await ctx.db.topic.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  let draft: IdeaDraft = { title: "", problem: "", whoBenefits: "", topicId: "", teamSize: 2, hoursPerWeek: 2, lengthWeeks: 4, difficulty: "MODERATE", targetDate: "" };
  if (!from && opportunity) {
    const o = await ctx.db.opportunity.findUnique({ where: { id: opportunity } });
    if (o && o.status === "OPEN") draft = { ...draft, title: o.title, problem: o.problem, whoBenefits: o.whoBenefits, topicId: o.topicId ?? "", opportunityId: o.id };
  }
  if (from) {
    const p = await ctx.db.project.findUnique({ where: { id: from } });
    if (!p || !can.editIdea(ctx.user, p)) notFound();
    draft = { id: p.id, title: p.title, problem: p.problem, whoBenefits: p.whoBenefits, topicId: p.topicId, teamSize: p.teamSize, hoursPerWeek: p.hoursPerWeek, lengthWeeks: p.lengthWeeks, difficulty: p.difficulty, targetDate: isoDay(p.targetDate), successMetric: p.successMetric ?? "", mvpScope: p.mvpScope ?? "", returnNote: p.returnNote };
  }
  return (
    <Page width="narrow">
      <PageHeader
        back={{ href: "/ideas", label: "Initiatives" }}
        title={from ? "Edit your idea" : "Propose an idea"}
        subtitle="Next, an AI review gives you private, advisory feedback. Then you submit it for approval."
      />
      <ProposeForm draft={draft} topics={topics} allowDraft={!from && !opportunity} />
    </Page>
  );
}
