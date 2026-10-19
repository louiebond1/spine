"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ICON_STROKE } from "@/components/ui/icons";
import { resolveQuestion, runSuggestedAnswer } from "@/server/questions/actions";

type Suggested = { text: string; sources: { id: string; title: string; href: string }[] } | null;

/** Spine's first answer, from the company's playbook and shared answers. A Champion still follows up. */
export function SuggestedAnswer({ questionId, suggested, askerCanAccept, generate }: { questionId: string; suggested: Suggested; askerCanAccept: boolean; generate: boolean }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  const started = useRef(false);
  useEffect(() => {
    if (suggested || !generate || started.current) return;
    started.current = true;
    runSuggestedAnswer(questionId)
      .then((r) => (r.ok ? router.refresh() : setFailed(true)))
      .catch(() => setFailed(true));
  }, [suggested, generate, questionId, router]);

  if (!suggested && !generate) return null;
  if (!suggested && failed) return <p className="text-label text-text-muted sm:ml-11">Spine couldn't draft a first answer just now. A Champion will reply.</p>;

  return (
    <section className="rounded-container border border-border bg-surface px-4 py-3 sm:ml-11">
      <p className="mb-1.5 flex items-center gap-1.5 text-label font-medium text-text-muted">
        <Sparkles size={13} strokeWidth={ICON_STROKE} aria-hidden />
        First answer from Spine
      </p>
      {suggested ? (
        <>
          <p className="whitespace-pre-line text-meta text-text">{suggested.text}</p>
          {suggested.sources.length > 0 && (
            <p className="mt-2 text-label text-text-muted">
              Based on{" "}
              {suggested.sources.map((s, i) => (
                <span key={s.id}>
                  {i > 0 && ", "}
                  <Link href={s.href} className="text-brand hover:text-brand-hover">
                    {s.title}
                  </Link>
                </span>
              ))}
            </p>
          )}
          {askerCanAccept ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button size="sm" disabled={pending} onClick={() => start(() => resolveQuestion(questionId))}>
                This answered it
              </Button>
              <span className="text-label text-text-muted">Otherwise a Champion will pick it up.</span>
            </div>
          ) : (
            <p className="mt-2 text-tiny text-text-faint">Drafted by AI from your playbook and shared answers. A Champion confirms anything specific.</p>
          )}
        </>
      ) : (
        <p className="animate-pulse text-label text-text-muted">Checking the playbook and shared answers...</p>
      )}
    </section>
  );
}
