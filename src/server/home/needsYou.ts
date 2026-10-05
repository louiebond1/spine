import "server-only";
import type { ReactNode } from "react";
import type { User } from "@prisma/client";

// Phase 2 implements the three needs-you sources (CLAUDE.md section 7, Home).
export type NeedsYouItem = {
  key: string;
  kind: "approval" | "question" | "publishing";
  title: string;
  reason: ReactNode;
  action: { label: string; href: string };
};

export async function getNeedsYou(_user: User): Promise<NeedsYouItem[]> {
  return [];
}
