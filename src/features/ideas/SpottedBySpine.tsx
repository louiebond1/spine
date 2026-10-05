"use client";

import { useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ICON_STROKE } from "@/components/ui/icons";
import { dismissOpportunity, refreshOpportunities } from "@/server/opportunities/actions";

export type OpportunityView = {
  id: string;
  title: string;
  problem: string;
  evidence: { id: string; title: string }[];
};

/** Repeated Help Desk questions that Spine thinks should become a project. */
export function SpottedBySpine({ items, isAdmin }: { items: OpportunityView[]; isAdmin: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const scanned = useRef(false);

  // Look for new patterns at most once a day; the server enforces the limit.
  useEffect(() => {
    if (scanned.current) return;
    scanned.current = true;
    refreshOpportunities()
      .then((r) => r.created && router.refresh())
      .catch(() => {});
  }, [router]);

  if (items.length === 0) return null;

  return (
    <section className="mb-6 rounded-container border border-border bg-surface px-6">
      <header className="flex items-center justify-between border-b border-border py-4">
        <p className="flex items-center gap-2 text-row-title font-semibold text-text">
          <Sparkles size={16} strokeWidth={ICON_STROKE} className="text-brand" aria-hidden />
          Spotted by Spine
        </p>
        <p className="text-label text-text-muted">Questions people keep asking that could become a project</p>
      </header>
      <div className="divide-y divide-border">
        {items.map((o) => (
          <div key={o.id} className="flex items-start gap-6 py-4">
            <div className="min-w-0 flex-1">
              <p className="text-row-title font-medium text-text">{o.title}</p>
              <p className="mt-1 text-meta text-text-muted">{o.problem}</p>
              <p className="mt-2 text-label text-text-muted">
                Asked {o.evidence.length} times, for example{" "}
                {o.evidence.slice(0, 2).map((e, i) => (
                  <span key={e.id}>
                    {i > 0 && " and "}
                    <Link href={`/help-desk/${e.id}`} className="text-brand hover:text-brand-hover">
                      {e.title}
                    </Link>
                  </span>
                ))}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-4">
              {isAdmin && (
                <Button variant="text" disabled={pending} onClick={() => start(() => dismissOpportunity(o.id))}>
                  Dismiss
                </Button>
              )}
              <Button href={`/ideas/new?opportunity=${o.id}`} arrow>
                Propose this
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
