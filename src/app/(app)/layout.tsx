import { Shell } from "@/components/shell/Shell";
import { db } from "@/server/db";
import { getCurrentUser } from "@/server/session";
import { getPulseItems } from "@/server/pulse/pulse";
import { getNeedsYou } from "@/server/home/needsYou";
import { rolesLine } from "@/lib/format";
import { runDueAutoApprovals } from "@/server/projects/autoApprove";
import { readPreferences } from "@/lib/preferences";
import { timeAgo } from "@/lib/format";
import { now } from "@/server/clock";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // CLAUDE.md section 7, rule 7: auto-approve is checked whenever the app is loaded.
  await runDueAutoApprovals();
  const user = await getCurrentUser();
  const [users, pulse, needsYou, topics, notes] = await Promise.all([
    db.user.findMany({ orderBy: { createdAt: "asc" } }),
    getPulseItems(),
    getNeedsYou(user),
    db.topic.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.notification.findMany({ where: { userId: user.id }, orderBy: { at: "desc" }, take: 8 }),
  ]);
  const prefs = readPreferences(user.preferences);
  const t = now();
  const toSwitcher = (u: typeof user) => ({ id: u.id, name: u.name, initials: u.initials, roles: rolesLine(u) });

  return (
    <Shell
      user={toSwitcher(user)}
      users={users.map(toSwitcher)}
      isAdmin={user.isAdmin}
      topics={topics}
      pulseCount={pulse.length}
      appearance={{ theme: prefs.theme, accent: prefs.accent, size: prefs.size }}
      updates={notes.map((n) => ({ id: n.id, title: n.title, body: n.body, href: n.href, when: timeAgo(n.at, t), unread: !n.readAt }))}
      bellItems={needsYou.map((n) => ({ key: n.key, title: n.title, reason: [n.reason.before, n.reason.emphasis, n.reason.after].join(""), href: n.action.href }))}
    >
      {children}
    </Shell>
  );
}
