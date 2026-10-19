"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AskQuestionModal } from "@/features/help-desk/AskQuestionModal";
import { SidebarNav, type NavAccess, type NavUser } from "./Sidebar";
import { TopBar, type BellItem, type UpdateItem } from "./TopBar";

type Props = {
  user: NavUser;
  access: NavAccess;
  pulseCount: number;
  bellItems: BellItem[];
  updates: UpdateItem[];
  topics: { id: string; name: string }[];
  children: React.ReactNode;
};

/** Navy sidebar (a drawer on smaller screens), the top bar and the content column. */
export function Shell({ user, access, pulseCount, bellItems, updates, topics, children }: Props) {
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();
  useEffect(() => setDrawer(false), [pathname]);
  return (
    <div className="flex min-h-screen bg-background text-text">
      {/* The navy column runs the page's full height; the nav inside it stays in view while the page scrolls. */}
      <div className="hidden w-sidebar shrink-0 bg-nav print:hidden lg:block">
        <aside className="sticky top-0 h-screen">
          <SidebarNav user={user} access={access} pulseCount={pulseCount} />
        </aside>
      </div>
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" className="absolute inset-0 bg-scrim/50" aria-label="Close navigation" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-drawer">
            <SidebarNav user={user} access={access} pulseCount={pulseCount} onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-30 print:hidden">
          <TopBar bellItems={bellItems} updates={updates} onMenu={() => setDrawer(true)} />
        </div>
        <main className="px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-8 print:px-0 print:pt-0">{children}</main>
        <Suspense>
          <AskQuestionModal topics={topics} />
        </Suspense>
      </div>
    </div>
  );
}

/** Content column: centred at max width; narrow pages are a readable measure. */
export function Page({ children, width = "content" }: { children: React.ReactNode; width?: "content" | "narrow" }) {
  return <div className={width === "narrow" ? "mx-auto max-w-narrow" : "mx-auto max-w-content"}>{children}</div>;
}
