import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { Page } from "@/components/shell/Shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/Container";
import { MetaLine } from "@/components/ui/MetaLine";
import { Button } from "@/components/ui/Button";
import { ReviewRunner } from "@/features/ideas/ReviewRunner";
import { DraftPlan } from "@/features/ideas/DraftPlan";
import { ProjectBrief } from "@/features/ideas/ProjectBrief";
import { longDate, plural } from "@/lib/format";
import { requireCtx } from "@/server/ctx";
import { can } from "@/server/permissions";
import { submitIdea } from "@/server/projects/actions";

const DIFFICULTY = { EASY: "Easy", MODERATE: "Moderate", HARD: "Hard" } as const;

function ScoreRow({ score, label, reason, link }: { score: number; label: string; reason: string; link?: { href: string; label: string } }) {
  return (
    <div className="flex items-start gap-4 py-4 sm:gap-6">
      <p className="flex w-16 shrink-0 items-baseline gap-0.5">
        <span className="text-score font-semibold text-text">{score}</span>
        <span className="text-label text-text-faint">/10</span>
      </p>
      <div className="min-w-0">
        <p className="text-meta font-semibold text-text">{label}</p>
        <p className="mt-0.5 text-meta text-text-muted">{reason}</p>
        {link && (
          <Link href={link.href} className="mt-1 inline-block text-label font-medium text-brand hover:text-brand-hover">
            {link.label}
          </Link>
        )}
      </div>
    </div>
  );
}

/** The advisory AI review. Only the idea's owner ever sees scores. */
export default async function AiReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx();
  const p = await ctx.db.project.findUnique({
    where: { id },
    include: { topic: true, aiReview: { include: { relatedProject: { select: { id: true, title: true } } } }, draftSteps: { orderBy: { order: "asc" }, select: { id: true, title: true } } },
  });
  // Not found for anyone else, so the page doesn't even reveal that scores exist.
  if (!p || !can.seeScores(ctx.user, p)) notFound();
  const r = p.aiReview;
  const isDraft = p.stage === "IDEA";

  return (
    <Page width="narrow">
      <PageHeader
        back={{ href: isDraft ? `/ideas/new?from=${p.id}` : `/ideas/${p.id}`, label: isDraft ? "Edit idea" : p.title }}
        title={`Review: ${p.title}`}
        meta={<MetaLine size="label" parts={[p.topic.name, plural(p.teamSize, "person", "people"), plural(p.lengthWeeks, "week"), DIFFICULTY[p.difficulty], `Target ${longDate(p.targetDate)}`]} />}
      />
      <p className="mb-3 flex items-center gap-1.5 text-label text-text-muted">
        <Lock size={13} aria-hidden />
        Only you see these scores. They're advice from AI, checked against your company's playbook, and never decide approval.
      </p>
      {r ? (
        <Container>
          <ScoreRow score={r.feasibility} label="Feasibility" reason={r.feasibilityReason} />
          <ScoreRow score={r.businessValue} label="Business value" reason={r.businessValueReason} />
          <ScoreRow score={r.resourcingConfidence} label="Resourcing confidence" reason={r.resourcingConfidenceReason} />
          <ScoreRow score={r.originality} label="Originality" reason={r.originalityReason} link={r.relatedProject ? { href: `/ideas/${r.relatedProject.id}`, label: `View ${r.relatedProject.title}` } : undefined} />
        </Container>
      ) : (
        <ReviewRunner projectId={p.id} />
      )}
      <div className="mt-4 space-y-4">
        <ProjectBrief useCases={p.useCases} successMetric={p.successMetric} mvpScope={p.mvpScope} laterScope={p.laterScope} hoursSavedEstimate={p.hoursSavedEstimate} />
        {r && <DraftPlan projectId={p.id} steps={p.draftSteps} canGenerate={["IDEA", "APPROVAL", "RECRUITING"].includes(p.stage)} />}
      </div>
      {isDraft && (
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button href={`/ideas/new?from=${p.id}`}>Edit idea</Button>
          <form action={submitIdea.bind(null, p.id)}>
            <Button type="submit" variant="primary" arrow fullWidth>
              Submit for approval
            </Button>
          </form>
        </div>
      )}
    </Page>
  );
}
