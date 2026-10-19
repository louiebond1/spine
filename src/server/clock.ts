import "server-only";
import { parseZoned } from "@/lib/tz";

/**
 * The only source of "now" in the app. SPINE_TODAY freezes the clock for demos and tests.
 * Production ignores it unless SPINE_ALLOW_FIXED_CLOCK=1, because a frozen clock there stops
 * auto-approvals, Pulse and the digest from ever moving on.
 */
export function now(): Date {
  const fixed = process.env.SPINE_TODAY;
  if (fixed && (process.env.NODE_ENV !== "production" || process.env.SPINE_ALLOW_FIXED_CLOCK === "1")) return parseZoned(fixed);
  return new Date();
}
