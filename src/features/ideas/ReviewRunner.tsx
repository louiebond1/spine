"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { ErrorState, SkeletonRows } from "@/components/ui/States";
import { runReview } from "@/server/projects/actions";

/** Runs the AI review when there is none yet. Never blocks: a failure says why, calmly, with a retry. */
export function ReviewRunner({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const run = useCallback(() => {
    setError(null);
    runReview(projectId)
      .then((r) => (r.ok ? router.refresh() : setError(r.error)))
      .catch(() => setError("The AI review couldn't run."));
  }, [projectId, router]);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    run();
  }, [run]);
  return <Container>{error ? <ErrorState message={`${error} You can still submit without it.`} onRetry={run} /> : <SkeletonRows count={4} leading={false} />}</Container>;
}
