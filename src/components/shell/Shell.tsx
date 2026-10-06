import { Suspense } from "react";
import { AskQuestionModal } from "@/features/help-desk/AskQuestionModal";
import { Sidebar } from "./Sidebar";
import { TopBar, type BellItem, type UpdateItem } from "./TopBar";
import type { SwitcherUser } from "./UserMenu";

type Props = {
  user: SwitcherUser;
  users: SwitcherUser[];
  isAdmin: boolean;
  pulseCount: number;
  bellItems: BellItem[];
  updates: UpdateItem[];
  appearance: { theme: string; accent: string; size: string };
  topics: { id: string; name: string }[];
  children: React.ReactNode;
};

/** Sidebar, top bar and the centred content column used by every page. */
export function Shell({ user, users, isAdmin, pulseCount, bellItems, updates, appearance, topics, children }: Props) {
  return (
    <div className="spine-app min-h-screen bg-background text-text" data-theme={appearance.theme} data-accent={appearance.accent} data-size={appearance.size}>
      <div className="print:hidden">
        <Sidebar user={user} users={users} isAdmin={isAdmin} pulseCount={pulseCount} />
      </div>
      <div className="pl-sidebar print:pl-0">
        <div className="print:hidden">
          <TopBar bellItems={bellItems} updates={updates} />
        </div>
        <main className="px-10 pb-16 pt-8 print:px-0 print:pt-0">{children}</main>
        <Suspense>
          <AskQuestionModal topics={topics} />
        </Suspense>
      </div>
    </div>
  );
}

/** Content column: centred at max-content width; narrow pages (Leaderboard) stay left-aligned inside it. */
export function Page({ children, width = "content" }: { children: React.ReactNode; width?: "content" | "narrow" }) {
  return (
    <div className="mx-auto max-w-content">
      <div className={width === "narrow" ? "max-w-narrow" : undefined}>{children}</div>
    </div>
  );
}
