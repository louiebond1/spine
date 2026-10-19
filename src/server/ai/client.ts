import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { startOfMonth } from "@/lib/tz";
import { now } from "../clock";
import type { Scope } from "../ctx";

// Anthropic API wrapper: asks Claude for JSON only and validates it with zod. Every call is
// recorded (feature, outcome, duration; never prompt text) for Admin > AI & health, and counts
// against the organisation's monthly limit. Key and model come from the environment.

export type AiErrorKind = "not_configured" | "limit_reached" | "credit" | "auth" | "rate_limit" | "overloaded" | "invalid_output" | "other";

export class AiUnavailableError extends Error {
  constructor(public kind: AiErrorKind, message?: string) {
    super(message ?? kind);
  }
}

/** Words people see when AI is unavailable. Calm, specific, and never blocking. */
export const AI_ERROR_TEXT: Record<AiErrorKind, string> = {
  not_configured: "AI isn't set up for Spine yet. An admin can add it.",
  limit_reached: "This month's AI allowance is used up. An admin can raise it in Admin.",
  credit: "AI is paused: the AI provider account needs more credit. Your admin has been shown how to fix it.",
  auth: "AI is paused: the AI provider rejected Spine's key. Your admin has been shown how to fix it.",
  rate_limit: "AI is busy right now. Try again in a minute.",
  overloaded: "AI is busy right now. Try again in a minute.",
  invalid_output: "The AI answer didn't come back in a usable shape. Try again.",
  other: "AI couldn't run just now. Try again.",
};

/** What an admin can do about each failure (Admin > AI & health). */
export const AI_ADMIN_FIX: Partial<Record<AiErrorKind, string>> = {
  credit: "Add credit to the Anthropic account behind ANTHROPIC_API_KEY (Anthropic Console, Billing). Spine tries again automatically after 5 minutes.",
  auth: "Check ANTHROPIC_API_KEY in the server's environment variables: it may have been revoked or mistyped. Spine tries again automatically after 5 minutes.",
  limit_reached: "Raise the monthly AI allowance in Admin > Settings, or wait for next month.",
  rate_limit: "The provider is limiting requests. This usually clears within minutes.",
  overloaded: "The provider is busy. This usually clears within minutes.",
};

export const lenient = {
  text: (max: number) => z.preprocess((v) => (v == null ? "" : String(v)), z.string()).transform((s) => s.trim().slice(0, max)),
  int: (min: number, max: number, fallback: number) =>
    z.preprocess((v) => {
      const n = Math.round(Number(v));
      return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
    }, z.number().int()),
  oneOf: <T extends string>(values: readonly [T, ...T[]], fallback: T) =>
    z.preprocess((v) => {
      const s = String(v ?? "").toUpperCase().replace(/[\s-]+/g, "_");
      return (values as readonly string[]).includes(s) ? s : fallback;
    }, z.enum(values)),
  date: () => z.preprocess((v) => (/^\d{4}-\d{2}-\d{2}/.test(String(v ?? "")) ? String(v).slice(0, 10) : "1970-01-01"), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
};

let client: Anthropic | null = null;
const HARD_FAILURE_COOLDOWN_MS = 5 * 60_000;

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY || !process.env.ANTHROPIC_MODEL) throw new AiUnavailableError("not_configured");
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 60_000 });
  return client;
}

/** Dev and test only: stored responses so screenshots and tests are stable. Never in production. */
export const fixturesEnabled = () => process.env.SPINE_AI_FIXTURES === "1" && process.env.NODE_ENV !== "production";

export function classify(error: unknown): AiErrorKind {
  if (error instanceof AiUnavailableError) return error.kind;
  if (error instanceof z.ZodError || error instanceof SyntaxError) return "invalid_output";
  if (error instanceof Anthropic.APIError) {
    const msg = (error.message ?? "").toLowerCase();
    if (msg.includes("credit balance")) return "credit";
    if (error.status === 401 || error.status === 403) return "auth";
    if (error.status === 429) return "rate_limit";
    if (error.status === 529 || msg.includes("overloaded")) return "overloaded";
  }
  return "other";
}

function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.search(/[[{]/);
  return JSON.parse(start > 0 ? raw.slice(start) : raw);
}

async function record(scope: Pick<Scope, "db" | "org">, feature: string, ok: boolean, errorKind: AiErrorKind | null, startedAt: number) {
  await scope.db.aiCall
    .create({ data: { orgId: scope.org.id, feature, ok, errorKind, durationMs: Date.now() - startedAt } })
    .catch((e: unknown) => console.error("[ai] could not record call", e instanceof Error ? e.message : e));
}

/** Calls this month for the organisation (successful or not). */
export async function aiCallsThisMonth(scope: Pick<Scope, "db" | "org">) {
  return scope.db.aiCall.count({ where: { orgId: scope.org.id, at: { gte: startOfMonth(now()) }, errorKind: { not: "limit_reached" } } });
}

/**
 * One call, one retry on unusable output. Throws AiUnavailableError on failure; callers show
 * AI_ERROR_TEXT[kind] and carry on, so AI never blocks anyone.
 */
export async function askClaudeForJson<T>(opts: {
  scope: Pick<Scope, "db" | "org">;
  feature: string;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
}): Promise<T> {
  const started = Date.now();
  const settings = await opts.scope.db.settings.findUnique({ where: { orgId: opts.scope.org.id } });
  const limit = settings?.aiMonthlyLimit ?? 1000;
  if (limit <= 0 || (await aiCallsThisMonth(opts.scope)) >= limit) {
    await record(opts.scope, opts.feature, false, "limit_reached", started);
    throw new AiUnavailableError("limit_reached");
  }
  // Not recorded: health already reports a missing key, and every page view would add a row.
  const anthropic = getClient();
  // Billing and key failures won't fix themselves within minutes, so don't call again on every page view.
  const recentHardFailure = await opts.scope.db.aiCall.findFirst({
    where: { orgId: opts.scope.org.id, at: { gte: new Date(Date.now() - HARD_FAILURE_COOLDOWN_MS) } },
    orderBy: { at: "desc" },
  });
  if (recentHardFailure && !recentHardFailure.ok && (recentHardFailure.errorKind === "credit" || recentHardFailure.errorKind === "auth")) {
    throw new AiUnavailableError(recentHardFailure.errorKind);
  }
  let lastKind: AiErrorKind = "other";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const message = await anthropic.messages.create({
        model: process.env.ANTHROPIC_MODEL!,
        max_tokens: opts.maxTokens ?? 2000,
        system: `${opts.system}\n\nReply with a single JSON object and nothing else.`,
        messages: [{ role: "user", content: opts.prompt }],
      });
      const text = message.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      const parsed = opts.schema.parse(extractJson(text));
      await record(opts.scope, opts.feature, true, null, started);
      return parsed;
    } catch (error) {
      lastKind = classify(error);
      console.error(`[ai] ${opts.feature} failed (${lastKind})`, error instanceof Error ? error.message.slice(0, 300) : "");
      // Only unusable output is worth an immediate retry; billing and key problems won't fix themselves.
      if (lastKind !== "invalid_output") break;
    }
  }
  await record(opts.scope, opts.feature, false, lastKind, started);
  throw new AiUnavailableError(lastKind);
}

/** Admin > AI & health: what happened recently and whether AI is working right now. */
export async function aiHealth(scope: Pick<Scope, "db" | "org">) {
  const since = new Date(now().getTime() - 7 * 86_400_000);
  const [recent, last, lastFailure, used, settings] = await Promise.all([
    scope.db.aiCall.groupBy({ by: ["ok"], where: { at: { gte: since } }, _count: { _all: true } }),
    scope.db.aiCall.findFirst({ orderBy: { at: "desc" } }),
    scope.db.aiCall.findFirst({ where: { ok: false }, orderBy: { at: "desc" } }),
    aiCallsThisMonth(scope),
    scope.db.settings.findUnique({ where: { orgId: scope.org.id } }),
  ]);
  const ok = recent.find((r) => r.ok)?._count._all ?? 0;
  const failed = recent.find((r) => !r.ok)?._count._all ?? 0;
  const configured = !!process.env.ANTHROPIC_API_KEY && !!process.env.ANTHROPIC_MODEL;
  const status: "ok" | "failing" | "off" | "unused" = !configured || (settings?.aiMonthlyLimit ?? 1) <= 0 ? "off" : !last ? "unused" : last.ok ? "ok" : "failing";
  return {
    configured,
    status,
    lastCall: last,
    lastFailure,
    lastFailureText: lastFailure?.errorKind ? AI_ERROR_TEXT[lastFailure.errorKind as AiErrorKind] ?? AI_ERROR_TEXT.other : null,
    lastFailureFix: lastFailure?.errorKind ? AI_ADMIN_FIX[lastFailure.errorKind as AiErrorKind] ?? null : null,
    week: { ok, failed },
    usedThisMonth: used,
    monthlyLimit: settings?.aiMonthlyLimit ?? 1000,
  };
}
