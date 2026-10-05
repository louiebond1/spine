"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Composer } from "@/components/ui/Composer";
import { joinProject, markLive, sendProjectMessage } from "@/server/projects/actions";

export function ProjectComposer({ projectId }: { projectId: string }) {
  return <Composer onSend={(data) => sendProjectMessage(projectId, data)} />;
}

export function JoinButton({ projectId }: { projectId: string }) {
  const [pending, start] = useTransition();
  const [missed, setMissed] = useState(false);
  const router = useRouter();
  if (missed) return <p className="text-label text-text-muted">The team filled up just before you joined.</p>;
  return (
    <Button
      disabled={pending}
      onClick={() =>
        start(async () => {
          try {
            await joinProject(projectId);
          } catch {
            setMissed(true);
            router.refresh();
          }
        })
      }
    >
      Join project
    </Button>
  );
}

export function MarkLiveButton({ projectId }: { projectId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="primary" arrow disabled={pending} onClick={() => start(() => markLive(projectId))}>
      Mark Live
    </Button>
  );
}
