import Link from "next/link";
import { notFound } from "next/navigation";
import { Page } from "@/components/shell/Shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProposeForm, type IdeaDraft } from "@/features/ideas/ProposeForm";
import { zonedParts } from "@/lib/tz";
import { db } from "@/server/db";
import { can } from "@/server/permissions";
import { getCurrentUser } from "@/server/session";

const isoDay = (d: Date) => {
  const p = zonedParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
};

/** Propose an idea (04). `?from=<id>` edits the owner's own draft, with any return note at the top. */
export default async function ProposeIdeaPage({ searchParams }: { searchParams: Promise<{ from?: string; opportunity?: string }> }) {
  const { from, opportunity } = await searchParams;
  const user = await getCurrentUser();
  const topics = await db.topic.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } });

  let draft: IdeaDraft = {
    title: "",
    problem: "",
    whoBenefits: "",
    topicId: "",
    buildPath: "APP",
    teamSize: 2,
    hoursPerWeek: 2,
    lengthWeeks: 4,
    difficulty: "MODERATE",
    targetDate: "",
  };
  if (!from && opportunity) {
    const o = await db.opportunity.findUnique({ where: { id: opportunity } });
    if (o && o.status === "OPEN") {
      draft = { ...draft, title: o.title, problem: o.problem, whoBenefits: o.whoBenefits, topicId: o.topicId ?? "", opportunityId: o.id };
    }
  }
  if (from) {
    const p = await db.project.findUnique({ where: { id: from } });
    if (!p || !can.editIdea(user, p)) notFound();
    draft = {
      id: p.id,
      title: p.title,
      problem: p.problem,
      whoBenefits: p.whoBenefits,
      topicId: p.topicId,
      buildPath: p.buildPath,
      teamSize: p.teamSize,
      hoursPerWeek: p.hoursPerWeek,
      lengthWeeks: p.lengthWeeks,
      difficulty: p.difficulty,
      targetDate: isoDay(p.targetDate),
      returnNote: p.returnNote,
    };
  }

  return (
    <Page>
      <PageHeader back={{ href: "/ideas", label: "Back to Ideas & Projects" }} title="Propose an idea" />
      {!from && !opportunity && (
        <p className="-mt-3 mb-5 text-meta text-text-muted">
          Rather talk it through?{" "}
          <Link href="/ideas/start" className="text-brand hover:text-brand-hover">
            Start with Spine
          </Link>{" "}
          and it fills this in for you.
        </p>
      )}
      <ProposeForm draft={draft} topics={topics} />
    </Page>
  );
}
