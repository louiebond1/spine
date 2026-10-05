"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { ICON_STROKE } from "@/components/ui/icons";
import { RecRow, type RecommendationView } from "@/features/ideas/SpineRecommends";
import { refreshPortfolio } from "@/server/autopilot/actions";

export type PortfolioItem = RecommendationView & { projectId: string; projectTitle: string };

/** Spine's portfolio brief: the most valuable fixes across every active project, appliable here. */
export function PortfolioBrief({ items }: { items: PortfolioItem[] }) {
  const router = useRouter();
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    refreshPortfolio()
      .then((r) => r.refreshed && router.refresh())
      .catch(() => {});
  }, [router]);

  return (
    <section className="rounded-container border border-border bg-surface px-6 pb-2 pt-6">
      <p className="mb-1 flex items-center gap-2 text-eyebrow font-semibold uppercase text-text-muted">
        <Sparkles size={14} strokeWidth={ICON_STROKE} className="text-brand" aria-hidden />
        Spine&apos;s portfolio brief
      </p>
      {items.length === 0 ? (
        <p className="py-4 text-meta text-text-muted">Every active project is on track. Nothing to fix right now.</p>
      ) : (
        <div className="divide-y divide-border">
          {items.map((i) => (
            <RecRow
              key={i.id}
              rec={i}
              context={
                <Link href={`/ideas/${i.projectId}`} className="text-label text-text-muted hover:text-brand">
                  {i.projectTitle}
                </Link>
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
