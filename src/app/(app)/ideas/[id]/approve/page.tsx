import { notFound, redirect } from "next/navigation";
import { Flag } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetaLine } from "@/components/ui/MetaLine";
import { Timeline } from "@/components/ui/Timeline";
import { ICON_STROKE } from "@/components/ui/icons";
import { ApprovalActions } from "@/features/ideas/ApprovalActions";
import { dayAtTime, hoursUntil, longDate, plural } from "@/lib/format";
import { now } from "@/server/clock";
import { db } from "@/server/db";
import { can } from "@/server/permissions";
import { runDueAutoApprovals } from "@/server/projects/autoApprove";
import { getCurrentUser } from "@/server/session";

const DIFFICULTY = { EASY: "Easy", MODERATE: "Moderate", HARD: "Hard" } as const;

/** Admin approval (06). Admins see the neutral concern flag, never the scores. */
export default async function ApprovalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user.isAdmin) notFound();
  await runDueAutoApprovals();

  const p = await db.project.findUnique({
    where: { id },
    include: {
      owner: true,
      topic: true,
      // Only the neutral flag and completion time are read; scores never leave the database here.
      aiReview: { select: { raisedConcerns: true, completedAt: true } },
    },
  });
  if (!p) notFound();
  if (!can.approve(user, p)) redirect(`/ideas/${p.id}`);

  const t = now();
  const path = p.buildPath === "APP" ? "App" : "Cowork-native";
  const details: [string, string][] = [
    ["Problem", p.problem],
    ["Who benefits", p.whoBenefits],
    ["Build path", path],
    ["Team size", plural(p.teamSize, "person", "people")],
    ["Hours per week", `${p.hoursPerWeek} per person`],
    ["Length", plural(p.lengthWeeks, "week")],
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
    <div className="mx-auto flex max-w-content items-start gap-6">
      <div className="min-w-0 flex-1">
        <PageHeader
          back={{ href: "/ideas", label: "Back to Ideas & Projects" }}
          eyebrow="Awaiting your approval"
          title={p.title}
          meta={<MetaLine parts={[p.owner.name, p.topic.name, path]} />}
        />
        {p.aiReview?.raisedConcerns && (
          <div className="mb-5 flex items-center gap-4 rounded-control bg-neutral-soft px-6 py-4">
            <Flag size={18} strokeWidth={ICON_STROKE} className="text-text" aria-hidden />
            <p className="text-meta text-text">AI review raised concerns</p>
          </div>
        )}
        <section className="rounded-container border border-border bg-surface px-6">
          <dl className="divide-y divide-border">
            {details.map(([label, value]) => (
              <div key={label} className="flex gap-6 py-4">
                <dt className="w-56 shrink-0 text-meta text-text-muted">{label}</dt>
                <dd className="text-meta text-text">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
      <aside className="mt-6 w-rail shrink-0 rounded-container border border-border bg-surface px-6 py-6">
        {p.autoApproveAt && <h2 className="mb-7 text-section font-semibold text-text">Auto-approves in {hoursUntil(p.autoApproveAt, t)}h</h2>}
        <div className="mb-8">
          <Timeline items={timeline.map((i) => ({ key: i.key, text: i.text, time: i.time || undefined }))} />
        </div>
        <ApprovalActions projectId={p.id} />
      </aside>
    </div>
  );
}
