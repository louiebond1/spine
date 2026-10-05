import { TIMEZONE, startOfDay, zonedParts } from "./tz";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "18m ago", "2h ago", "1d ago" as on 02 and 03. */
export function timeAgo(date: Date, now: Date): string {
  const diff = Math.max(0, now.getTime() - date.getTime());
  if (diff < HOUR) return `${Math.max(1, Math.floor(diff / MINUTE))}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  return `${Math.floor(diff / DAY)}d ago`;
}

/** Whole days, rounded to the nearest day ("Waiting 7 days"). */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY);
}

/** Whole hours remaining, rounded up so "5h 10m" reads "6h". */
export function hoursUntil(date: Date, now: Date): number {
  return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / HOUR));
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

function fmt(date: Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, ...options }).format(date);
}

/** "Wednesday, 7 October" (page date line). */
export function pageDate(date: Date): string {
  const weekday = fmt(date, { weekday: "long" });
  return `${weekday}, ${fmt(date, { day: "numeric", month: "long" })}`;
}

/** "19 November 2026" */
export function longDate(date: Date): string {
  return fmt(date, { day: "numeric", month: "long", year: "numeric" });
}

/** "19 November" */
export function dayMonth(date: Date): string {
  return fmt(date, { day: "numeric", month: "long" });
}

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "9 Oct", "30 Sep" (fixed abbreviations; some ICU builds say "Sept"). */
export function shortDate(date: Date): string {
  const p = zonedParts(date);
  return `${p.day} ${SHORT_MONTHS[p.month - 1]}`;
}

/** "16:00" */
export function clockTime(date: Date): string {
  return fmt(date, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

/** "30 Sep at 16:00", or "today at 16:00" when on the same day as now. */
export function dayAtTime(date: Date, now: Date): string {
  const sameDay = startOfDay(date).getTime() === startOfDay(now).getTime();
  return `${sameDay ? "today" : shortDate(date)} at ${clockTime(date)}`;
}

/** "July", "October" */
export function monthName(date: Date): string {
  return fmt(date, { month: "long" });
}

export function firstName(name: string): string {
  return name.split(" ")[0] ?? name;
}

/** "Champion · Admin" (sidebar). Publishing specialist is left out, as in every mockup. */
export function rolesLine(user: { isChampion: boolean; isAdmin: boolean }): string {
  const roles = [user.isChampion && "Champion", user.isAdmin && "Admin"].filter(Boolean);
  return roles.length ? roles.join(" · ") : "Member";
}
