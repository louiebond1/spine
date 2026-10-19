"use client";

import { useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { dismissOpportunity, refreshOpportunities } from "@/server/opportunities/actions";

export type OpportunityView = { id: string; title: string; problem: string; evidence: { id: string; title: string }[] };

/** Questions people keep asking that could become an initiative (Champions and admins). */
export function Opportunities({ items }: { items: OpportunityView[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const scanned = useRef(false);
  useEffect(() => {
    if (scanned.current) return;
    scanned.current = true;
    refreshOpportunities()
      .then((r) => r.created && router.refresh())
      .catch(() => {});
  }, [router]);
  if (items.length === 0) return null;
  return (
    <Container heading="Spotted in the Help Desk" description="Repeated questions that could become an initiative. Drafted by AI from open and shared questions only.">
      {items.map((o) => (
        <div key={o.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <p className="text-meta font-medium text-text">{o.title}</p>
            <p className="text-label text-text-muted">{o.problem}</p>
            {o.evidence.length > 0 && (
              <p className="mt-1 text-label text-text-muted">
                {o.evidence.length} related {o.evidence.length === 1 ? "question" : "questions"}, for example{" "}
                {o.evidence.slice(0, 2).map((e, i) => (
                  <span key={e.id}>
                    {i > 0 && " and "}
                    <Link href={`/help-desk/${e.id}`} className="text-brand hover:text-brand-hover">
                      {e.title}
                    </Link>
                  </span>
                ))}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(() => dismissOpportunity(o.id))}>
              Dismiss
            </Button>
            <Button size="sm" href={`/ideas/new?opportunity=${o.id}`}>
              Propose this
            </Button>
          </div>
        </div>
      ))}
    </Container>
  );
}
