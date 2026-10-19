import { startOfYear } from "./tz";

export type Range = { from: Date; to: Date };

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
