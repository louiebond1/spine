import Link from "next/link";
import { notFound } from "next/navigation";
import { Page } from "@/components/shell/Shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/Container";
import { MetaLine } from "@/components/ui/MetaLine";
import { Button } from "@/components/ui/Button";
import { ReviewRunner } from "@/features/ideas/ReviewRunner";
import { DraftPlan } from "@/features/ideas/DraftPlan";
import { ProjectBrief } from "@/features/ideas/ProjectBrief";
import { longDate, plural } from "@/lib/format";
import { db } from "@/server/db";
import { can } from "@/server/permissions";
import { submitIdea } from "@/server/projects/actions";
import { getCurrentUser } from "@/server/session";

const DIFFICULTY = { EASY: "Easy", MODERATE: "Moderate", HARD: "Hard" } as const;

function ScoreRow({ score, label, reason, link }: { score: number; label: string; reason: string; link?: { href: string; label: string } }) {
  return (
    <div className="flex items-start gap-8 py-6">
      <p className="flex w-28 shrink-0 items-baseline gap-1 pl-3">
        <span className="text-score font-semibold text-text">{score}</span>
        <span className="text-meta text-text-muted">/10</span>
      </p>
      <div>
        <p className="text-row-title font-semibold text-text">{label}</p>
        <p className="mt-1 text-meta text-text-muted">{reason}</p>
        {link && (
          <Link href={link.href} className="mt-2 inline-block text-meta text-brand underline underline-offset-4 hover:text-brand-hover">
            {link.label}
          </Link>
        )}
      </div>
    </div>
  );
}

/** AI review (05). Only the idea's owner ever sees scores. */
export default async function AiReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const p = await db.project.findUnique({
    where: { id },
    include: {
      topic: true,
      aiReview: { include: { relatedProject: { select: { id: true, title: true } } } },
      draftSteps: { orderBy: { order: "asc" }, select: { id: true, title: true } },
    },
  });
  // Not found for anyone else, so the page doesn't reveal that scores exist.
  if (!p || !can.seeScores(user, p)) notFound();
  const r = p.aiReview;
  const isDraft = p.stage === "IDEA";

  return (
    <Page>
      <PageHeader back={{ href: "/ideas", label: "Back to Ideas & Projects" }} title="AI review" />
      <div className="-mt-4 mb-6">
        <h2 className="text-section font-semibold text-text">{p.title}</h2>
        <MetaLine
          className="mt-1"
          parts={[
            p.topic.name,
            p.buildPath === "APP" ? "App" : "Cowork-native",
            plural(p.teamSize, "person", "people"),
            plural(p.lengthWeeks, "week"),
            DIFFICULTY[p.difficulty],
            `Target ${longDate(p.targetDate)}`,
          ]}
        />
      </div>

      {r ? (
        <Container>
          <ScoreRow score={r.feasibility} label="Feasibility" reason={r.feasibilityReason} />
          <ScoreRow score={r.businessValue} label="Business value" reason={r.businessValueReason} />
          <ScoreRow score={r.resourcingConfidence} label="Resourcing confidence" reason={r.resourcingConfidenceReason} />
          <ScoreRow
            score={r.originality}
            label="Originality"
            reason={r.originalityReason}
            link={r.relatedProject ? { href: `/ideas/${r.relatedProject.id}`, label: `View ${r.relatedProject.title}` } : undefined}
          />
        </Container>
      ) : (
        <ReviewRunner projectId={p.id} />
      )}

      <p className="mt-6 text-label text-text-muted">These scores are advisory. They don&apos;t decide whether your idea is approved.</p>

      <div className="mt-6">
        <ProjectBrief useCases={p.useCases} successMetric={p.successMetric} mvpScope={p.mvpScope} laterScope={p.laterScope} hoursSavedEstimate={p.hoursSavedEstimate} />
      </div>

      {r && (
        <div className="mt-6">
          <DraftPlan projectId={p.id} steps={p.draftSteps} canGenerate={["IDEA", "APPROVAL", "RECRUITING"].includes(p.stage)} />
        </div>
      )}

      {isDraft && (
        <div className="mt-5 flex justify-end gap-5">
          <Button href={`/ideas/new?from=${p.id}`}>Edit idea</Button>
          <form action={submitIdea.bind(null, p.id)}>
            <Button type="submit" variant="primary" arrow>
              {p.buildPath === "APP" ? "Submit for approval" : "Submit idea"}
            </Button>
          </form>
        </div>
      )}
    </Page>
  );
}
