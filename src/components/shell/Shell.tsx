import { Suspense } from "react";
import { AskQuestionModal } from "@/features/help-desk/AskQuestionModal";
import { Sidebar } from "./Sidebar";
import { TopBar, type BellItem } from "./TopBar";
import type { SwitcherUser } from "./UserMenu";

type Props = {
  user: SwitcherUser;
  users: SwitcherUser[];
  isAdmin: boolean;
  pulseCount: number;
  bellItems: BellItem[];
  topics: { id: string; name: string }[];
  children: React.ReactNode;
};

/** Sidebar, top bar and the centred content column used by every page. */
export function Shell({ user, users, isAdmin, pulseCount, bellItems, topics, children }: Props) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar user={user} users={users} isAdmin={isAdmin} pulseCount={pulseCount} />
      <div className="pl-sidebar">
        <TopBar bellItems={bellItems} />
        <main className="px-10 pb-16 pt-8">{children}</main>
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
