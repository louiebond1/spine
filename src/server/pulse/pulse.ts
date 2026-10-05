import "server-only";

// Phase 2 implements the three checks (CLAUDE.md section 7, Pulse).
export type PulseItem = {
  key: string;
  check: "approval" | "question" | "build";
  title: string;
  reason: string;
  action: { label: string; href: string };
  crossedAt: Date;
};

export async function getPulseItems(): Promise<PulseItem[]> {
  return [];
}
