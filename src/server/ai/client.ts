import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";

// Anthropic API wrapper: asks Claude for JSON only and validates it with zod.
// Key and model come from the environment and are never hard-coded.

export class AiUnavailableError extends Error {}

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
    }
  }
  throw lastError;
}
