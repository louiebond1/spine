"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { TextArea } from "@/components/ui/TextArea";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { askQuestion, reopenQuestion } from "@/server/questions/actions";
import { suggestSimilar } from "@/server/questions/similar-actions";

type Suggestion = { id: string; title: string; isMine: boolean; resolvedBy: string | null };

/** Opened by "?ask=1" from + New or the command palette. */
export function AskQuestionModal({ topics }: { topics: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const open = params.get("ask") === "1";

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [topicId, setTopicId] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [similar, setSimilar] = useState<Suggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const close = () => {
    const next = new URLSearchParams(params.toString());
    next.delete("ask");
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
    setTitle("");
    setBody("");
    setTopicId("");
    setAnonymous(false);
    setSimilar([]);
    setError(null);
  };

  useEffect(() => {
    if (!open || title.trim().length < 4) {
      setSimilar([]);
      return;
    }
    let live = true;
    const t = setTimeout(() => {
      suggestSimilar(title)
        .then((s) => live && setSimilar(s))
        .catch(() => {});
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [open, title]);

  const submit = () =>
    start(async () => {
      const result = await askQuestion({ title, body, topicId, anonymous });
      if (!result.ok) return setError(result.error);
      close();
      router.push(`/help-desk/${result.id}`);
    });

  const reopen = (id: string) =>
    start(async () => {
      const result = await reopenQuestion(id, body);
      if (!result.ok) return setError(result.error);
      close();
      router.push(`/help-desk/${result.id}`);
    });

  return (
    <Modal
      open={open}
      onClose={close}
      title="Ask a question"
      footer={
        <Button variant="primary" onClick={submit} disabled={pending}>
          Ask
        </Button>
      }
    >
      <div className="space-y-5">
        <div>
          <TextField id="ask-title" label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          {similar.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-label font-medium text-text-muted">Already answered?</p>
              <ul className="space-y-1">
                {similar.map((s) => (
                  <li key={s.id} className="flex items-baseline justify-between gap-4 text-label">
                    <Link href={`/help-desk/${s.id}`} onClick={close} className="text-brand hover:text-brand-hover">
                      {s.title}
                    </Link>
                    {s.isMine && (
                      <button type="button" onClick={() => reopen(s.id)} disabled={pending} className="shrink-0 text-brand hover:text-brand-hover">
                        Reopen this
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <TextArea id="ask-body" label="Details" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
        <Select
          id="ask-topic"
          label="Topic"
          value={topicId}
          onChange={(e) => setTopicId(e.target.value)}
          options={[{ value: "", label: "Choose a topic" }, ...topics.map((t) => ({ value: t.id, label: t.name }))]}
        />
        <Checkbox label="Ask anonymously" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
        {error && <p className="text-label text-text-muted">{error}</p>}
      </div>
    </Modal>
  );
}
