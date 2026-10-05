// Timezone helpers. Every date shown or bucketed uses SPINE_TIMEZONE.

export const TIMEZONE = process.env.SPINE_TIMEZONE || "Europe/London";

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: number };

const partsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Wall-clock parts of `date` in the app timezone. */
export function zonedParts(date: Date): Parts {
  const map: Record<string, string> = {};
  for (const p of partsFormatter.formatToParts(date)) map[p.type] = p.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: WEEKDAYS.indexOf(map.weekday ?? "Sun"),
  };
}

/** The instant at which the app timezone's wall clock reads the given time. */
export function zonedTime(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  // Two passes handle the offset changing across a DST boundary.
  let ts = guess;
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(ts));
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    ts += guess - asUtc;
  }
  return new Date(ts);
}

/** Parses "2026-10-07T10:00:00" as wall-clock time in the app timezone. */
export function parseZoned(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(value.trim());
  if (!m) return new Date(value);
  return zonedTime(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0));
}

export function startOfDay(date: Date): Date {
  const p = zonedParts(date);
  return zonedTime(p.year, p.month, p.day);
}

export function startOfMonth(date: Date): Date {
  const p = zonedParts(date);
  return zonedTime(p.year, p.month, 1);
}

export function addMonths(monthStart: Date, n: number): Date {
  const p = zonedParts(monthStart);
  const m = p.month - 1 + n;
  return zonedTime(p.year + Math.floor(m / 12), (((m % 12) + 12) % 12) + 1, 1);
}

export function startOfYear(date: Date): Date {
  return zonedTime(zonedParts(date).year, 1, 1);
}
