import { addMonths, startOfMonth, startOfYear } from "./tz";

export type Range = { from: Date; to: Date };

export const LEADERBOARD_PERIODS = [
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "this-year", label: "This year" },
] as const;
export type LeaderboardPeriod = (typeof LEADERBOARD_PERIODS)[number]["value"];

export function leaderboardRange(period: LeaderboardPeriod, now: Date): Range {
  const month = startOfMonth(now);
  if (period === "last-month") return { from: addMonths(month, -1), to: month };
  if (period === "this-year") return { from: startOfYear(now), to: now };
  return { from: month, to: now };
}

export const PROGRAMME_PERIODS = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "year", label: "This year" },
] as const;
export type ProgrammePeriod = (typeof PROGRAMME_PERIODS)[number]["value"];

export function programmeRange(period: ProgrammePeriod, now: Date): Range {
  if (period === "year") return { from: startOfYear(now), to: now };
  const days = period === "30d" ? 30 : 90;
  return { from: new Date(now.getTime() - days * 86_400_000), to: now };
}
