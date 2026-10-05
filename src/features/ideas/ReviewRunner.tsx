"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { ErrorState, SkeletonRows } from "@/components/ui/States";
import { runReview } from "@/server/projects/actions";

/** Runs the AI review when the page has none yet. Never blocks: failures show one grey sentence. */
export function ReviewRunner({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  const run = useCallback(() => {
    setFailed(false);
    runReview(projectId)
      .then((r) => (r.ok ? router.refresh() : setFailed(true)))
      .catch(() => setFailed(true));
  }, [projectId, router]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    run();
  }, [run]);

  return (
    <Container>
      {failed ? <ErrorState message="The AI review couldn't run." onRetry={run} /> : <SkeletonRows count={4} />}
    </Container>
  );
}
