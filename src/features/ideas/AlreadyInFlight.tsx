"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { findInFlight, joinInstead, type InFlight } from "@/server/ideas/merge-actions";

/** "Already in flight": similar projects, with Join instead when there's a spot. */
export function AlreadyInFlight({ title, problem, draftId }: { title: string; problem: string; draftId?: string | null }) {
  const router = useRouter();
  const [matches, setMatches] = useState<InFlight[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      findInFlight(title, problem, draftId)
        .then((m) => live && setMatches(m))
        .catch(() => {});
    }, 400);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [title, problem, draftId]);

  if (matches.length === 0) return null;
  return (
    <div className="rounded-control bg-neutral-soft px-5 py-4">
      <p className="text-label font-semibold text-text">Already in flight</p>
      <p className="text-label text-text-muted">Joining an existing project gets this built sooner than starting a new one.</p>
      <ul className="mt-2 divide-y divide-border">
        {matches.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <Link href={`/ideas/${m.id}`} className="text-meta font-medium text-text hover:text-brand">
                {m.title}
              </Link>
              <p className="text-label text-text-muted">{m.detail}</p>
            </div>
            {m.canJoin && (
              <Button
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await joinInstead(m.id, { title, problem, draftId });
                    if (!r.ok) return setError(r.error);
                    router.push(r.href);
                  })
                }
              >
                Join instead
              </Button>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="text-label text-text-muted">{error}</p>}
    </div>
  );
}
