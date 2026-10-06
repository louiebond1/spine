"use server";

import { revalidatePath } from "next/cache";
import { now } from "../clock";
import { db } from "../db";
import { currentApprovers } from "../notify/events";
import { notify } from "../notify/notify";
import { assert } from "../permissions";
import { logEvent } from "../projects/lifecycle";
import { getCurrentUser } from "../session";

const DAY = 86_400_000;

/** The owner (or team) sends one reminder to whoever still has to approve, at most once a day. */
export async function nudgeApprovers(projectId: string): Promise<{ ok: boolean; message: string }> {
  const user = await getCurrentUser();
  const p = await db.project.findUnique({
    where: { id: projectId },
    include: { team: true, events: { where: { type: "APPROVAL_NUDGED" }, orderBy: { at: "desc" }, take: 1 } },
  });
  assert(!!p && (p.ownerId === user.id || p.team.some((m) => m.userId === user.id)), "Only the owner or team can nudge the approvers.");
  if (p.stage !== "APPROVAL") return { ok: false, message: "This idea isn't waiting for approval." };
  const last = p.events[0]?.at;
  if (last && now().getTime() - last.getTime() < DAY) return { ok: false, message: "The approvers were reminded in the last day. Give them a little time." };
  const ids = await currentApprovers(p.id);
  if (ids.length === 0) return { ok: false, message: "Everyone named has already approved." };
  await notify(ids, { kind: "nudge", title: `${user.name} is waiting on ${p.title}`, body: "A quick decision would unblock the team.", href: `/ideas/${p.id}/approve` }, user.id);
  await db.$transaction((tx) => logEvent(tx, p.id, "APPROVAL_NUDGED", user.id));
  revalidatePath(`/ideas/${p.id}`);
  const names = (await db.user.findMany({ where: { id: { in: ids } }, select: { name: true } })).map((u) => u.name);
  return { ok: true, message: `Reminded ${names.join(" and ")}.` };
}
