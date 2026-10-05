import { notFound } from "next/navigation";
import { Page } from "@/components/shell/Shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/States";
import { ImpactTab, PeopleTab, RulesTab, TopicsTab } from "@/features/admin/AdminTabs";
import { pageDate, plural } from "@/lib/format";
import { now } from "@/server/clock";
import { db } from "@/server/db";
import { can } from "@/server/permissions";
import { publishingLoads } from "@/server/projects/publishing";
import { getSettings } from "@/server/settings";
import { getCurrentUser } from "@/server/session";

const TABS = [
  { key: "people", label: "People & roles" },
  { key: "topics", label: "Topics" },
  { key: "rules", label: "Rules" },
  { key: "publishers", label: "Publishing specialists" },
  { key: "impact", label: "Impact assumptions" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

/** Admin (12). Admins only; Rules is the default tab. */
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await getCurrentUser();
  if (!can.manage(user)) notFound();
  const { tab: raw } = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === raw) ? (raw as TabKey) : "rules";
  const settings = await getSettings();

  return (
    <Page>
      <PageHeader date={pageDate(now())} title="Admin" />
      <Tabs bordered className="-mt-3 mb-7" active={tab} tabs={TABS.map((t) => ({ key: t.key, label: t.label, href: `/admin?tab=${t.key}` }))} />

      {tab === "rules" && (
        <RulesTab
          initial={{
            approvalTimeoutDays: settings.approvalTimeoutDays,
            stalledBuildDays: settings.stalledBuildDays,
            unclaimedQuestionHours: settings.unclaimedQuestionHours,
            digestTime: settings.digestTime,
            digestWeekdaysOnly: settings.digestWeekdaysOnly,
          }}
        />
      )}

      {tab === "people" && (
        <PeopleTab
          people={(await db.user.findMany({ orderBy: { name: "asc" } })).map((u) => ({
            id: u.id,
            name: u.name,
            initials: u.initials,
            isChampion: u.isChampion,
            isAdmin: u.isAdmin,
            isPublishingSpecialist: u.isPublishingSpecialist,
          }))}
        />
      )}

      {tab === "topics" && (
        <TopicsTab topics={await db.topic.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } })} />
      )}

      {tab === "publishers" &&
        (async () => {
          const loads = await publishingLoads(db);
          return (
            <section className="divide-y divide-border rounded-container border border-border bg-surface px-6">
              {loads.length === 0 && <EmptyState>No publishing specialists yet. Add one in People &amp; roles.</EmptyState>}
              {loads.map((s) => (
                <div key={s.id} className="flex items-center gap-6 py-4">
                  <Avatar initials={s.initials} />
                  <div className="flex-1">
                    <p className="text-meta text-text">{s.name}</p>
                    {s.projects.length > 0 && <p className="text-label text-text-muted">{s.projects.map((p) => p.title).join(" · ")}</p>}
                  </div>
                  <span className="text-meta text-text-muted">{plural(s.projects.length, "project")} in Publishing</span>
                </div>
              ))}
            </section>
          );
        })()}

      {tab === "impact" && (
        <ImpactTab
          initial={{
            hourlyCost: settings.hourlyCost ? String(settings.hourlyCost) : "",
            programmeCost: settings.programmeCost ? String(settings.programmeCost) : "",
          }}
        />
      )}
    </Page>
  );
}
