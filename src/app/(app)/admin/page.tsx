import { notFound } from "next/navigation";
import { Page } from "@/components/shell/Shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { Container } from "@/components/ui/Container";
import { EmptyState, Notice } from "@/components/ui/States";
import { IntegrationsTab, PeopleTab, SettingsTab, TopicsTab } from "@/features/admin/AdminTabs";
import { ApprovalRules } from "@/features/admin/ApprovalRules";
import { describeRule } from "@/server/approvals/rules";
import { aiHealth } from "@/server/ai/client";
import { encryptionReady } from "@/server/crypto";
import { dayAtTime, shortDate, timeAgo } from "@/lib/format";
import { now } from "@/server/clock";
import { requireCtx } from "@/server/ctx";
import { can } from "@/server/permissions";
import { getSettings } from "@/server/settings";

const TABS = [
  { key: "people", label: "People" },
  { key: "settings", label: "Settings" },
  { key: "approvals", label: "Approval rules" },
  { key: "topics", label: "Topics" },
  { key: "integrations", label: "Integrations" },
  { key: "health", label: "AI & health" },
  { key: "audit", label: "Audit log" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const FEATURE: Record<string, string> = {
  idea_review: "Idea reviews",
  idea_draft: "Idea drafts",
  build_plan: "Build plans",
  draft_plan: "Suggested plans",
  step_phrase: "Step wording",
  instant_answer: "Help Desk first answers",
  approval_brief: "Approval briefs",
  approval_rule_draft: "Rule drafting",
  meeting_notes: "Meeting notes",
  opportunity_scan: "Spotted in the Help Desk",
  leadership_report: "Leadership report",
};

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const ctx = await requireCtx();
  if (!can.manage(ctx.user)) notFound();
  const { db } = ctx;
  const { tab: raw } = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === raw) ? (raw as TabKey) : "people";
  const settings = await getSettings(ctx);
  const t = now();
  const health = await aiHealth(ctx);

  return (
    <Page>
      <PageHeader title="Admin" subtitle={`Manage who's in Spine at ${ctx.org.name}, how it nudges people, and what it connects to.`} />
      {health.status === "failing" && tab !== "health" && (
        <Notice tone="critical" className="mb-4">
          AI features are failing: {health.lastFailureText}{" "}
          <a href="/admin?tab=health" className="font-medium underline">
            See AI &amp; health
          </a>
        </Notice>
      )}
      <Tabs className="mb-5" active={tab} tabs={TABS.map((x) => ({ key: x.key, label: x.label, href: `/admin?tab=${x.key}` }))} />

      {tab === "people" &&
        (async () => {
          const [people, invitations] = await Promise.all([
            db.user.findMany({ orderBy: [{ status: "asc" }, { name: "asc" }], include: { projectsPublishing: { where: { stage: "PUBLISHING" }, select: { id: true } } } }),
            db.invitation.findMany({ where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() }, userId: null }, orderBy: { createdAt: "desc" } }),
          ]);
          return (
            <PeopleTab
              invitations={invitations.map((i) => ({ id: i.id, name: i.name, email: i.email, expires: shortDate(i.expiresAt) }))}
              people={people.map((u) => ({
                id: u.id,
                name: u.name,
                initials: u.initials,
                email: u.email,
                status: u.status,
                hasPassword: !!u.passwordHash,
                lastLogin: u.lastLoginAt ? timeAgo(u.lastLoginAt, new Date()) : null,
                isChampion: u.isChampion,
                isAdmin: u.isAdmin,
                isPublishingSpecialist: u.isPublishingSpecialist,
                launching: u.projectsPublishing.length,
                isYou: u.id === ctx.user.id,
              }))}
            />
          );
        })()}

      {tab === "settings" && (
        <SettingsTab
          org={{ name: ctx.org.name, allowedEmailDomain: settings.allowedEmailDomain ?? "", aiMonthlyLimit: settings.aiMonthlyLimit }}
          rules={{
            approvalTimeoutDays: settings.approvalTimeoutDays,
            approvalNudgeDays: settings.approvalNudgeDays,
            approvalEscalateDays: settings.approvalEscalateDays,
            stalledBuildDays: settings.stalledBuildDays,
            unclaimedQuestionHours: settings.unclaimedQuestionHours,
            digestTime: settings.digestTime,
            digestWeekdaysOnly: settings.digestWeekdaysOnly,
          }}
          impact={{ hourlyCost: settings.hourlyCost ? String(settings.hourlyCost) : "", programmeCost: settings.programmeCost ? String(settings.programmeCost) : "" }}
        />
      )}

      {tab === "approvals" &&
        (async () => {
          const [rules, topics, people] = await Promise.all([
            db.approvalRule.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
            db.topic.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
            db.user.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
          ]);
          const names = { topics: new Map(topics.map((x) => [x.id, x.name])), users: new Map(people.map((u) => [u.id, u.name])) };
          return (
            <ApprovalRules
              topics={topics}
              people={people}
              defaultDays={settings.approvalTimeoutDays}
              rules={rules.map((r) => ({
                id: r.id,
                name: r.name,
                active: r.active,
                sentence: describeRule(r, names),
                input: {
                  name: r.name,
                  topicIds: r.topicIds,
                  buildPaths: [],
                  difficulties: r.difficulties as ("EASY" | "MODERATE" | "HARD")[],
                  minTotalHours: r.minTotalHours,
                  maxTotalHours: r.maxTotalHours,
                  onlyWithConcerns: r.onlyWithConcerns,
                  approverIds: r.approverIds,
                  requireAll: r.requireAll,
                  autoApproveDays: r.autoApproveDays,
                  fastTrack: r.fastTrack,
                },
              }))}
            />
          );
        })()}

      {tab === "topics" && <TopicsTab topics={await db.topic.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } })} />}

      {tab === "integrations" && (
        <IntegrationsTab
          encryptionReady={encryptionReady()}
          slack={{ connected: !!settings.slackWebhookEnc, lastAt: settings.slackLastAt ? dayAtTime(settings.slackLastAt, t) : null, lastStatus: settings.slackLastStatus }}
          teams={{ connected: !!settings.teamsWebhookEnc, lastAt: settings.teamsLastAt ? dayAtTime(settings.teamsLastAt, t) : null, lastStatus: settings.teamsLastStatus }}
        />
      )}

      {tab === "health" &&
        (async () => {
          const since = new Date(Date.now() - 7 * 86_400_000);
          const byFeature = await db.aiCall.groupBy({ by: ["feature", "ok"], where: { at: { gte: since } }, _count: { _all: true } });
          const features = [...new Set(byFeature.map((f) => f.feature))];
          return (
            <div className="space-y-4">
              {health.status === "failing" && <Notice tone="critical">{health.lastFailureText} Last failure {health.lastFailure ? dayAtTime(health.lastFailure.at, new Date()) : ""}.</Notice>}
              {health.status === "off" && <Notice tone="warning">{health.configured ? "AI is turned off for your organisation (monthly allowance is 0)." : "AI isn't configured on this server (ANTHROPIC_API_KEY and ANTHROPIC_MODEL). Everything else in Spine works without it."}</Notice>}
              <section className="grid grid-cols-2 gap-px overflow-hidden rounded-container border border-border bg-border sm:grid-cols-4">
                {(
                  [
                    ["Status", { ok: "Working", failing: "Failing", off: "Off", unused: "Not used yet" }[health.status]],
                    ["Used this month", `${health.usedThisMonth} of ${health.monthlyLimit}`],
                    ["Last 7 days", `${health.week.ok} ok · ${health.week.failed} failed`],
                    ["Last request", health.lastCall ? timeAgo(health.lastCall.at, new Date()) : "Never"],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="bg-surface px-4 py-3">
                    <p className="text-label text-text-muted">{label}</p>
                    <p className="mt-0.5 text-section font-semibold text-text">{value}</p>
                  </div>
                ))}
              </section>
              <Container heading="By feature, last 7 days" description="Spine records the feature, the outcome and the time taken. It never stores prompts or answers here.">
                {features.length === 0 ? (
                  <EmptyState>No AI requests in the last 7 days.</EmptyState>
                ) : (
                  features.map((f) => {
                    const ok = byFeature.find((x) => x.feature === f && x.ok)?._count._all ?? 0;
                    const failed = byFeature.find((x) => x.feature === f && !x.ok)?._count._all ?? 0;
                    return (
                      <div key={f} className="flex items-center justify-between py-2.5 text-meta">
                        <span className="text-text">{FEATURE[f] ?? f}</span>
                        <span className={failed ? "text-critical" : "text-text-muted"}>
                          {ok} ok{failed ? ` · ${failed} failed` : ""}
                        </span>
                      </div>
                    );
                  })
                )}
              </Container>
              <p className="text-label text-text-muted">When AI fails, people see one calm sentence and carry on: nothing in Spine depends on AI to work.</p>
            </div>
          );
        })()}

      {tab === "audit" &&
        (async () => {
          const rows = await db.auditLog.findMany({ orderBy: { at: "desc" }, take: 100 });
          const actors = await db.user.findMany({ where: { id: { in: rows.map((r) => r.actorId).filter((x): x is string => !!x) } }, select: { id: true, name: true } });
          return (
            <Container heading="Audit log" description="Administrative changes in the last 100 entries.">
              {rows.length === 0 ? (
                <EmptyState>No administrative changes yet.</EmptyState>
              ) : (
                rows.map((r) => (
                  <div key={r.id} className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:gap-4">
                    <span className="w-36 shrink-0 text-label text-text-faint">{dayAtTime(r.at, new Date())}</span>
                    <span className="text-label text-text">
                      <span className="font-medium">{actors.find((a) => a.id === r.actorId)?.name ?? "Spine"}</span> {r.action.replace(/[._]/g, " ")}
                      {r.detail && <span className="text-text-muted"> · {r.detail}</span>}
                    </span>
                  </div>
                ))
              )}
            </Container>
          );
        })()}
    </Page>
  );
}
