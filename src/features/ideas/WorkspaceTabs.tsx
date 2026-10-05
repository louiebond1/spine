"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Composer } from "@/components/ui/Composer";
import { joinProject, markLive, sendProjectMessage } from "@/server/projects/actions";

export function ProjectComposer({ projectId }: { projectId: string }) {
  return <Composer onSend={(data) => sendProjectMessage(projectId, data)} />;
}

export function JoinButton({ projectId }: { projectId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button disabled={pending} onClick={() => start(() => joinProject(projectId))}>
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
