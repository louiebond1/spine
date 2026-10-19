import { z } from "zod";

// How each person hears about things. Stored on User.preferences; missing keys mean "on".

export const NOTIFY_KINDS = {
  approval: "An idea needs your approval",
  decision: "Your idea is approved or returned",
  invite: "Someone invites you to an initiative",
  reply: "A reply on your question",
  step: "A plan step is assigned to you",
  checkin: "A check-in is due on your initiative",
  nudge: "Reminders about things waiting on you",
  report: "The monthly leadership report is ready",
} as const;
export type NotifyKind = keyof typeof NOTIFY_KINDS;

export const preferencesSchema = z.object({
  email: z.record(z.string(), z.boolean()).catch({}),
});
export type Preferences = z.infer<typeof preferencesSchema>;

export function readPreferences(raw: unknown): Preferences {
  return preferencesSchema.parse(raw && typeof raw === "object" ? raw : {});
}

/** Email is on for everything unless the person switched a kind off. */
export const wantsEmail = (p: Preferences, kind: NotifyKind) => p.email[kind] !== false;
