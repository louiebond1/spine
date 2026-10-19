"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { joinProject, markLive } from "@/server/projects/actions";
import { respondToInvite } from "@/server/ideas/start-actions";

export function JoinButton({ projectId }: { projectId: string }) {
  const [pending, start] = useTransition();
  const [missed, setMissed] = useState(false);
  const router = useRouter();
  if (missed) return <p className="text-label text-text-muted">The team filled up just before you joined.</p>;
  return (
    <Button
      size="sm"
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
      Join the team
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

export function InviteAnswer({ projectId, inviter }: { projectId: string; inviter: string }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const answer = (accept: boolean) =>
    start(async () => {
      const r = await respondToInvite(projectId, accept);
      setMessage(r.message);
      router.refresh();
    });
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-container border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-meta text-text">{message ?? `${inviter} invited you to join this initiative.`}</p>
      {!message && (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => answer(false)}>
            Decline
          </Button>
          <Button size="sm" disabled={pending} onClick={() => answer(true)}>
            Accept
          </Button>
        </div>
      )}
    </div>
  );
}
