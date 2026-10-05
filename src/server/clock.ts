import "server-only";
import { parseZoned } from "@/lib/tz";

/**
 * The only source of "now" in the app. When SPINE_TODAY is set the clock is
 * frozen at that instant (in SPINE_TIMEZONE) so seeded data and mockups line up.
 */
export function now(): Date {
  const fixed = process.env.SPINE_TODAY;
  if (fixed) return parseZoned(fixed);
  return new Date();
}
