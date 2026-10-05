import { Shell } from "@/components/shell/Shell";
import { db } from "@/server/db";
import { getCurrentUser } from "@/server/session";
import { getPulseItems } from "@/server/pulse/pulse";
import { getNeedsYou } from "@/server/home/needsYou";
import { rolesLine } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const [users, pulse, needsYou, topics] = await Promise.all([
    db.user.findMany({ orderBy: { createdAt: "asc" } }),
    getPulseItems(),
    getNeedsYou(user),
    db.topic.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const toSwitcher = (u: typeof user) => ({ id: u.id, name: u.name, initials: u.initials, roles: rolesLine(u) });

  return (
    <Shell
      user={toSwitcher(user)}
      users={users.map(toSwitcher)}
      isAdmin={user.isAdmin}
      topics={topics}
      pulseCount={pulse.length}
      bellItems={needsYou.map((n) => ({ key: n.key, title: n.title, reason: [n.reason.before, n.reason.emphasis, n.reason.after].join(""), href: n.action.href }))}
    >
      {children}
    </Shell>
  );
}
