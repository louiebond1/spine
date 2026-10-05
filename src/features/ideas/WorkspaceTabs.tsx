"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Composer } from "@/components/ui/Composer";
import { joinProject, markLive, sendProjectMessage } from "@/server/projects/actions";
import { respondToInvite } from "@/server/ideas/start-actions";

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
    <div className="mb-5 flex items-center justify-between gap-6 rounded-container border border-brand-soft bg-surface px-6 py-4">
      <p className="text-meta text-text">{message ?? `${inviter} invited you to join this project.`}</p>
      {!message && (
        <div className="flex items-center gap-4">
          <Button variant="text" disabled={pending} onClick={() => answer(false)}>
            Decline
          </Button>
          <Button disabled={pending} onClick={() => answer(true)}>
            Accept
          </Button>
        </div>
      )}
    </div>
  );
}
