import "server-only";
import { now } from "../clock";
import { db } from "../db";

// Spine Autopilot, part 1: measure. Everything here is arithmetic on the project's real
// history (pace, ownership, dates), so recommendations are grounded, not guessed.

const DAY = 86_400_000;
const WEEK = 7 * DAY;

export type Forecast = {
  /** Steps finished per week since building started. */
  pacePerWeek: number;
  finishDate: Date;
  /** Positive means late against the target date. */
  daysLate: number;
} | null;

export async function loadAutopilotProject(projectId: string) {
  return db.project.findUnique({
    where: { id: projectId },
    include: {
      owner: true,
      team: { include: { user: true }, orderBy: { joinedAt: "asc" } },
      steps: { include: { assignee: true }, orderBy: { order: "asc" } },
      events: { where: { type: { in: ["RECRUITED", "APPROVED", "AUTO_APPROVED", "JOINED", "SUBMITTED"] } }, orderBy: { at: "asc" } },
    },
  });
}
export type AutopilotProject = NonNullable<Awaited<ReturnType<typeof loadAutopilotProject>>>;

/** When building started: the "team complete" event, else approval, else the first step. */
function buildStart(p: AutopilotProject): Date {
  return (
    p.events.find((e) => e.type === "RECRUITED")?.at ??
    p.approvedAt ??
    p.steps.reduce<Date | null>((min, s) => (!min || s.createdAt < min ? s.createdAt : min), null) ??
    p.createdAt
  );
}

export function forecast(p: AutopilotProject): Forecast {
  if (p.stage !== "BUILDING" || p.steps.length === 0) return null;
  const t = now().getTime();
  const done = p.steps.filter((s) => s.done).length;
  const open = p.steps.length - done;
  const weeks = Math.max(1, (t - buildStart(p).getTime()) / WEEK);
  const pace = done / weeks;
  if (open === 0 || pace === 0) return null;
  const finish = new Date(t + (open / pace) * WEEK);
  return { pacePerWeek: Math.round(pace * 10) / 10, finishDate: finish, daysLate: Math.round((finish.getTime() - p.targetDate.getTime()) / DAY) };
}

export function signals(p: AutopilotProject, stalledBuildDays: number) {
  const t = now().getTime();
  const open = p.steps.filter((s) => !s.done);
  const load = new Map<string, number>(p.team.map((m) => [m.userId, 0]));
  for (const s of open) load.set(s.assigneeId, (load.get(s.assigneeId) ?? 0) + 1);
  const ranked = [...load.entries()].sort((a, b) => b[1] - a[1]);
  const busiest = ranked[0];
  const idlest = ranked[ranked.length - 1];
  const lastJoin = [...p.events].reverse().find((e) => e.type === "JOINED" || e.type === "SUBMITTED" || e.type === "APPROVED" || e.type === "AUTO_APPROVED");

  return {
    forecast: forecast(p),
    overdue: open.filter((s) => s.dueDate.getTime() < t - DAY),
    quietDays: Math.floor((t - p.lastActivityAt.getTime()) / DAY),
    stalled: p.stage === "BUILDING" && t - p.lastActivityAt.getTime() > stalledBuildDays * DAY,
    // Overloaded: one person holds over half the open work and at least two more steps than the lightest.
    overloaded:
      busiest && idlest && open.length >= 3 && busiest[1] > open.length / 2 && busiest[1] - idlest[1] >= 2
        ? { fromId: busiest[0], toId: idlest[0], count: busiest[1], of: open.length }
        : null,
    recruitingQuietDays: p.stage === "RECRUITING" && lastJoin ? Math.floor((t - lastJoin.at.getTime()) / DAY) : 0,
    openSpots: Math.max(0, p.teamSize - p.team.length),
  };
}
