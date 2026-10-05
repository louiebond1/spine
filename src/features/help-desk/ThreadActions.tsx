"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Composer } from "@/components/ui/Composer";
import { resolveQuestion, sendQuestionMessage } from "@/server/questions/actions";

/** Composer with Send (primary) and, when allowed, the outline Mark resolved. */
export function ThreadComposer({ questionId, canPost, canResolve }: { questionId: string; canPost: boolean; canResolve: boolean }) {
  const [resolving, start] = useTransition();
  const resolve = canResolve ? (
    <Button disabled={resolving} onClick={() => start(() => resolveQuestion(questionId))}>
      Mark resolved
    </Button>
  ) : null;

  if (!canPost) return resolve ? <div className="flex justify-end">{resolve}</div> : null;
  return <Composer allowAttach onSend={(data) => sendQuestionMessage(questionId, data)} trailing={resolve} />;
}
