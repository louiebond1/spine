import "server-only";
import type { PlanStep, Project, User } from "@prisma/client";
import { firstName, plural } from "@/lib/format";

// CLAUDE.md section 7, Ideas & Projects rule 13: one computed sentence per project.

export type NextActionInput = Pick<Project, "stage" | "teamSize" | "publisherId"> & {
  teamCount: number;
  steps: (Pick<PlanStep, "done" | "order" | "activePhrase"> & { assignee: Pick<User, "name"> })[];
  publisher: Pick<User, "name"> | null;
  hoursThisMonth: number;
};

export type NextAction = { text: string; live: boolean } | null;

export function nextAction(p: NextActionInput, viewerId: string): NextAction {
  switch (p.stage) {
    case "IDEA":
      return null;
    case "APPROVAL":
      return { text: "Next: Waiting for leadership approval", live: false };
    case "RECRUITING": {
      const needed = Math.max(0, p.teamSize - p.teamCount);
      return { text: `Next: Recruit ${plural(needed, "more person", "more people")} to begin`, live: false };
    }
    case "BUILDING": {
      const next = [...p.steps].filter((s) => !s.done).sort((a, b) => a.order - b.order)[0];
      if (!next) return null;
      return { text: `Next: ${firstName(next.assignee.name)} is ${next.activePhrase}`, live: false };
    }
    case "PUBLISHING":
      if (!p.publisher) return null;
      return p.publisherId === viewerId
        ? { text: "You’re publishing this", live: false }
        : { text: `Next: ${firstName(p.publisher.name)} is publishing this`, live: false };
    case "LIVE":
      return { text: `Live · ${plural(p.hoursThisMonth, "hour")} saved this month`, live: true };
  }
}
