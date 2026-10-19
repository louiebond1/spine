import "server-only";
import type { PlanStep, Project, User } from "@prisma/client";
import { firstName, plural } from "@/lib/format";

// One computed sentence per initiative: what is happening now.

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
      return { text: "Waiting for approval", live: false };
    case "RECRUITING": {
      const needed = Math.max(0, p.teamSize - p.teamCount);
      return { text: `Needs ${plural(needed, "more person", "more people")} to start`, live: false };
    }
    case "BUILDING": {
      const next = [...p.steps].filter((s) => !s.done).sort((a, b) => a.order - b.order)[0];
      if (!next) return null;
      return { text: `${firstName(next.assignee.name)} is ${next.activePhrase}`, live: false };
    }
    case "PUBLISHING":
      if (!p.publisher) return null;
      return p.publisherId === viewerId
        ? { text: "You're launching this", live: false }
        : { text: `${firstName(p.publisher.name)} is launching this`, live: false };
    case "LIVE":
      return { text: p.hoursThisMonth ? `Live · ${plural(p.hoursThisMonth, "hour")} saved this month` : "Live", live: true };
  }
}
