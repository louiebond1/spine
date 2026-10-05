"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ICON_STROKE } from "@/components/ui/icons";
import { resolveQuestion, runSuggestedAnswer } from "@/server/questions/actions";

type Suggested = { text: string; sources: { id: string; title: string; href: string }[] } | null;

/** Spine's instant answer, drafted from the company's own resolved threads. */
export function SuggestedAnswer({
  questionId,
  suggested,
  askerCanAccept,
  generate,
}: {
  questionId: string;
  suggested: Suggested;
  askerCanAccept: boolean;
  generate: boolean;
}) {
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

  if (!suggested && (!generate || failed)) return null;

  return (
    <section className="ml-14 rounded-container border border-brand-soft bg-surface px-5 py-4">
      <p className="mb-2 flex items-center gap-2 text-label font-semibold text-brand">
        <Sparkles size={14} strokeWidth={ICON_STROKE} aria-hidden />
        Spine&apos;s suggested answer
      </p>
      {suggested ? (
        <>
          <p className="whitespace-pre-line text-meta text-text">{suggested.text}</p>
          {suggested.sources.length > 0 && (
            <p className="mt-3 text-label text-text-muted">
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
            <div className="mt-4 flex items-center gap-4">
              <Button disabled={pending} onClick={() => start(() => resolveQuestion(questionId))}>
                This answered it
              </Button>
              <span className="text-label text-text-muted">Otherwise a Champion will pick it up.</span>
            </div>
          ) : (
            <p className="mt-3 text-tiny text-text-muted">Drafted by Spine. A Champion confirms anything specific to your work.</p>
          )}
        </>
      ) : (
        <p className="animate-pulse text-label text-text-muted">Looking through answered questions…</p>
      )}
    </section>
  );
}
