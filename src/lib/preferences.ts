import { z } from "zod";

// Per-person choices: how Spine looks for them, and how they hear about things.
// Stored on User.preferences; anything missing falls back to the defaults below.

export const NOTIFY_KINDS = {
  approval: "An idea needs your approval",
  decision: "Your idea is approved or returned",
  invite: "Someone invites you to a project",
  reply: "A reply on your question",
  step: "A plan step is assigned to you",
  nudge: "Reminders about things waiting on you",
  report: "The monthly leadership report is ready",
} as const;
export type NotifyKind = keyof typeof NOTIFY_KINDS;

export const THEMES = ["light", "dark", "system"] as const;
export const ACCENTS = ["cobalt", "teal", "violet", "graphite"] as const;
export const SIZES = ["compact", "default", "large"] as const;

export const preferencesSchema = z.object({
  theme: z.enum(THEMES).catch("light"),
  accent: z.enum(ACCENTS).catch("cobalt"),
  size: z.enum(SIZES).catch("default"),
  email: z.record(z.string(), z.boolean()).catch({}),
});
export type Preferences = z.infer<typeof preferencesSchema>;

export function readPreferences(raw: unknown): Preferences {
  return preferencesSchema.parse(raw && typeof raw === "object" ? raw : {});
}

/** Email is on for everything unless the person switched a kind off. */
export const wantsEmail = (p: Preferences, kind: NotifyKind) => p.email[kind] !== false;
