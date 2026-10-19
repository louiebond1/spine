import { notFound, redirect } from "next/navigation";
import { Flag } from "lucide-react";
import { Page } from "@/components/shell/Shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetaLine } from "@/components/ui/MetaLine";
import { Timeline } from "@/components/ui/Timeline";
import { Container } from "@/components/ui/Container";
import { ICON_STROKE } from "@/components/ui/icons";
import { ApprovalActions } from "@/features/ideas/ApprovalActions";
import { ApprovalBriefPanel } from "@/features/ideas/ApprovalBriefPanel";
import { aiConfigured } from "@/server/ai/client";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Avatar } from "@/components/ui/Avatar";
import { describeRule, totalHours } from "@/server/approvals/rules";
import { dayAtTime, hoursUntil, longDate, plural } from "@/lib/format";
import { now } from "@/server/clock";
import { requireCtx } from "@/server/ctx";
import { can } from "@/server/permissions";

const DIFFICULTY = { EASY: "Easy", MODERATE: "Moderate", HARD: "Hard" } as const;

/** The approval decision. Approvers see the neutral concern flag, never the owner's scores. */
export default async function ApprovalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx();
  const { db, user } = ctx;
  const p = await db.project.findUnique({
    where: { id },
    include: { owner: true, topic: true, aiReview: { select: { raisedConcerns: true, completedAt: true } }, approvals: { orderBy: { at: "asc" } } },
  });
  if (!p) notFound();
  if (!can.approve(user, p)) redirect(`/ideas/${p.id}`);

  const t = now();
  const mine = p.approvals.find((a) => a.userId === user.id);
  const rule = p.approvalRuleId ? await db.approvalRule.findUnique({ where: { id: p.approvalRuleId } }) : null;
  const [topics, users] = await Promise.all([db.topic.findMany({ select: { id: true, name: true } }), db.user.findMany({ select: { id: true, name: true, initials: true } })]);
  const ruleSentence = rule ? describeRule(rule, { topics: new Map(topics.map((x) => [x.id, x.name])), users: new Map(users.map((u) => [u.id, u.name])) }) : null;
  const named = p.approverIds.map((id) => users.find((u) => u.id === id)).filter((u): u is NonNullable<typeof u> => !!u);
  const details: [string, string][] = [
    ["Problem", p.problem],
    ["Who benefits", p.whoBenefits],
    ...(p.successMetric ? ([["Success measure", p.successMetric]] as [string, string][]) : []),
    ["Team", `${plural(p.teamSize, "person", "people")}, ${p.hoursPerWeek} hours a week each, ${plural(p.lengthWeeks, "week")}`],
    ["Total effort", `About ${totalHours(p)} hours`],
    ["Difficulty", DIFFICULTY[p.difficulty]],
    ["Target date", longDate(p.targetDate)],
  ];
  const timeline = [
    p.submittedAt && { key: "submitted", at: p.submittedAt, text: `Submitted by ${p.owner.name}`, time: dayAtTime(p.submittedAt, t) },
    p.aiReview && { key: "review", at: p.aiReview.completedAt, text: "AI review completed", time: dayAtTime(p.aiReview.completedAt, t) },
    p.buildCompletedAt && { key: "built", at: p.buildCompletedAt, text: "Build completed", time: dayAtTime(p.buildCompletedAt, t) },
  ]
    .filter((x): x is { key: string; at: Date; text: string; time: string } => Boolean(x))
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map(({ key, text, time }) => ({ key, text, time }));
  if (p.autoApproveAt) timeline.push({ key: "auto", text: `Auto-approves ${dayAtTime(p.autoApproveAt, t)}`, time: "" });

  return (
    <Page>
      <PageHeader back={{ href: "/ideas", label: "Initiatives" }} eyebrow="Waiting for your decision" title={p.title} meta={<MetaLine size="label" parts={[p.owner.name, p.topic.name]} />} />
      <div className="grid gap-6 lg:grid-cols-main-rail">
        <div className="min-w-0 space-y-4">
          {p.aiReview?.raisedConcerns && (
            <div className="flex items-center gap-2.5 rounded-control border border-border bg-subtle px-4 py-3">
              <Flag size={15} strokeWidth={ICON_STROKE} className="text-text-muted" aria-hidden />
              <p className="text-meta text-text">The AI review raised concerns. The owner has seen the details.</p>
            </div>
          )}
          <Container>
            <dl className="divide-y divide-border">
              {details.map(([label, value]) => (
                <div key={label} className="flex flex-col gap-0.5 py-3 sm:flex-row sm:gap-6">
                  <dt className="w-40 shrink-0 text-label text-text-muted">{label}</dt>
                  <dd className="text-meta text-text">{value}</dd>
                </div>
              ))}
            </dl>
          </Container>
          {aiConfigured() && <ApprovalBriefPanel projectId={p.id} />}
        </div>
        <aside>
          <div className="space-y-5 rounded-container border border-border bg-surface p-4 sm:p-5 lg:sticky lg:top-20">
            <h2 className="text-section font-semibold text-text">{p.autoApproveAt ? `Auto-approves in ${hoursUntil(p.autoApproveAt, t)}h` : "Waiting for sign-off"}</h2>
            {(named.length > 0 || p.approvalsNeeded > 1) && (
              <div>
                <SectionLabel>{p.approvalsNeeded > 1 ? `${p.approvals.length} of ${p.approvalsNeeded} approvals` : "Approvers"}</SectionLabel>
                <ul className="mt-2 space-y-2">
                  {named.map((u) => {
                    const done = p.approvals.find((a) => a.userId === u.id);
                    return (
                      <li key={u.id} className="flex items-center gap-2.5">
                        <Avatar initials={u.initials} size="sm" />
                        <span className="flex-1 text-meta text-text">{u.id === user.id ? "You" : u.name}</span>
                        <span className={done ? "text-label font-medium text-positive" : "text-label text-text-muted"}>{done ? "Approved" : "Waiting"}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {p.escalatedAt && <p className="text-label font-medium text-text">Escalated: any admin can decide now.</p>}
            {ruleSentence && (
              <p className="text-label text-text-muted">
                Rule "{rule!.name}": {ruleSentence}
              </p>
            )}
            <Timeline items={timeline.map((i) => ({ key: i.key, text: i.text, time: i.time || undefined }))} />
            {mine ? <p className="text-meta text-text-muted">You approved this. It moves on once the others sign off.</p> : <ApprovalActions projectId={p.id} />}
          </div>
        </aside>
      </div>
    </Page>
  );
}
