import { Shell } from "@/components/shell/Shell";
import { requireCtx } from "@/server/ctx";
import { getNeedsYou } from "@/server/home/needsYou";
import { pulseCount } from "@/server/pulse/pulse";
import { canSeeReport } from "@/server/report/report";
import { can } from "@/server/permissions";
import { rolesLine, timeAgo } from "@/lib/format";
import { now } from "@/server/clock";

export const dynamic = "force-dynamic";

// Every page in the app is behind sign-in. Nothing here changes data: auto-approval and
// reminders run in the scheduled job, never on a page view.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireCtx();
  const { db, user } = ctx;
  const showPulse = can.seePulse(user);
  const [needsYou, count, topics, notes, leadership] = await Promise.all([
    getNeedsYou(ctx),
    showPulse ? pulseCount(ctx) : Promise.resolve(0),
    db.topic.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.notification.findMany({ where: { userId: user.id }, orderBy: { at: "desc" }, take: 8 }),
    canSeeReport(ctx, user),
  ]);
  const t = now();
  return (
    <Shell
      user={{ name: user.name, initials: user.initials, roles: rolesLine(user), orgName: ctx.org.name }}
      access={{ pulse: showPulse, leadership, admin: can.manage(user) }}
      topics={topics}
      pulseCount={count}
      updates={notes.map((n) => ({ id: n.id, title: n.title, body: n.body, href: n.href, when: timeAgo(n.at, t), unread: !n.readAt }))}
      bellItems={needsYou.map((n) => ({ key: n.key, title: n.title, reason: [n.reason.before, n.reason.emphasis, n.reason.after].join(""), href: n.action.href }))}
    >
      {children}
    </Shell>
  );
}
