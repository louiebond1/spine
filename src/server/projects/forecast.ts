import "server-only";
import { now } from "../clock";

// Delivery forecast: plain arithmetic on the initiative's own history (steps finished per week
// since building started), so it's grounded rather than guessed.

const DAY = 86_400_000;
const WEEK = 7 * DAY;

export type Forecast = { pacePerWeek: number; finishDate: Date; daysLate: number } | null;

type ForecastInput = {
  stage: string;
  targetDate: Date;
  createdAt: Date;
  approvedAt: Date | null;
  steps: { done: boolean; createdAt: Date }[];
  events: { type: string; at: Date }[];
};

function buildStart(p: ForecastInput): Date {
  return (
    p.events.find((e) => e.type === "RECRUITED")?.at ??
    p.approvedAt ??
    p.steps.reduce<Date | null>((min, s) => (!min || s.createdAt < min ? s.createdAt : min), null) ??
    p.createdAt
  );
}

export function forecast(p: ForecastInput): Forecast {
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
