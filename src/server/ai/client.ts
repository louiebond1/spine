import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

// Anthropic API wrapper: asks Claude for JSON only and validates it with zod.
// Key and model come from the environment and are never hard-coded.

export class AiUnavailableError extends Error {}

/** Lenient schema helpers for model output: trim long text, clamp numbers, normalise enums. */
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
  // An unreadable date becomes a past one, which callers replace with a sensible default.
  date: () => z.preprocess((v) => (/^\d{4}-\d{2}-\d{2}/.test(String(v ?? "")) ? String(v).slice(0, 10) : "1970-01-01"), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
};

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new AiUnavailableError("ANTHROPIC_API_KEY is not set");
  if (!process.env.ANTHROPIC_MODEL) throw new AiUnavailableError("ANTHROPIC_MODEL is not set");
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

/** Dev and test only: stored responses so screenshots and demos are stable. */
export const fixturesEnabled = () => process.env.SPINE_AI_FIXTURES === "1" && process.env.NODE_ENV !== "production";

function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.search(/[[{]/);
  return JSON.parse(start > 0 ? raw.slice(start) : raw);
}

/** One call, one retry on invalid output. Throws on failure; callers show a calm grey message. */
export async function askClaudeForJson<T>(opts: { system: string; prompt: string; schema: z.ZodType<T>; maxTokens?: number }): Promise<T> {
  const anthropic = getClient();
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const message = await anthropic.messages.create({
        model: process.env.ANTHROPIC_MODEL!,
        max_tokens: opts.maxTokens ?? 2000,
        system: `${opts.system}\n\nReply with a single JSON object and nothing else.`,
        messages: [{ role: "user", content: opts.prompt }],
      });
      const text = message.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      return opts.schema.parse(extractJson(text));
    } catch (error) {
      lastError = error;
      console.error("[ai] JSON call failed", attempt, error instanceof Error ? error.message.slice(0, 500) : error);
    }
  }
  throw lastError;
}
