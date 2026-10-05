"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUp, Check, Sparkles, X } from "lucide-react";
import { cx } from "@/lib/cx";
import { Button } from "@/components/ui/Button";
import { ICON_STROKE } from "@/components/ui/icons";
import { confirmAssistantAction } from "@/server/assistant/actions";
import type { ProposedAction } from "@/server/assistant/tools";

type Msg = { id: string; role: "user" | "assistant"; text: string; actions: ProposedAction[]; activity?: string; error?: string };
type ActionState = Record<string, { status: "done" | "dismissed" | "failed"; message: string; href?: string }>;

const PROJECT_PATH = /^\/ideas\/([^/?#]+)(?:$|\?|#|\/(?!review|approve))/;

/** Renders the small subset of markdown Spine uses: links, bold and bullet lists. */
function RichText({ text }: { text: string }) {
  const inline = (line: string, key: string) =>
    line.split(/(\[[^\]]+\]\([^)\s]+\)|\*\*[^*]+\*\*)/g).map((part, i) => {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
      if (link) {
        const href = link[2]!;
        return href.startsWith("/") ? (
          <Link key={`${key}-${i}`} href={href} className="text-brand underline-offset-2 hover:underline">
            {link[1]}
          </Link>
        ) : (
          <a key={`${key}-${i}`} href={href} target="_blank" rel="noreferrer" className="text-brand underline-offset-2 hover:underline">
            {link[1]}
          </a>
        );
      }
      const bold = /^\*\*([^*]+)\*\*$/.exec(part);
      if (bold) return <strong key={`${key}-${i}`} className="font-semibold">{bold[1]}</strong>;
      return <Fragment key={`${key}-${i}`}>{part}</Fragment>;
    });

  const blocks = text.trim().split(/\n{2,}/);
  return (
    <div className="space-y-3">
      {blocks.map((block, b) => {
        const lines = block.split("\n");
        if (lines.every((l) => /^\s*([-*]|\d+\.)\s+/.test(l))) {
          return (
            <ul key={b} className="list-disc space-y-1 pl-5">
              {lines.map((l, i) => (
                <li key={i}>{inline(l.replace(/^\s*([-*]|\d+\.)\s+/, ""), `${b}-${i}`)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={b} className="whitespace-pre-line">
            {inline(block, `${b}`)}
          </p>
        );
      })}
    </div>
  );
}

function describe(a: ProposedAction) {
  if (a.kind === "add_step") return { title: `Add a step to ${a.projectTitle}`, body: `${a.title} · ${a.assigneeName} · due ${new Date(a.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` };
  if (a.kind === "post_update") return { title: `Post in ${a.projectTitle} chat`, body: a.message };
  return { title: `Ask the Help Desk (${a.topicName})`, body: `${a.title}\n\n${a.details}` };
}

function ActionCard({ action, state, onDone }: { action: ProposedAction; state?: ActionState[string]; onDone: (s: ActionState[string]) => void }) {
  const [pending, setPending] = useState(false);
  const d = describe(action);
  return (
    <div className="rounded-control border border-border bg-surface p-4">
      <p className="text-label font-semibold text-text">{d.title}</p>
      <p className="mt-1 whitespace-pre-line text-label text-text-muted">{d.body}</p>
      {state ? (
        <p className="mt-3 flex items-center gap-2 text-label text-text-muted">
          {state.status === "done" && <Check size={14} strokeWidth={ICON_STROKE} className="text-brand" aria-hidden />}
          {state.message}
          {state.href && (
            <Link href={state.href} className="text-brand hover:text-brand-hover">
              Open
            </Link>
          )}
        </p>
      ) : (
        <div className="mt-3 flex items-center gap-4">
          <Button
            disabled={pending}
            onClick={async () => {
              setPending(true);
              const r = await confirmAssistantAction(action);
              onDone({ status: r.ok ? "done" : "failed", message: r.message, href: r.href });
            }}
          >
            Confirm
          </Button>
          <Button variant="text" disabled={pending} onClick={() => onDone({ status: "dismissed", message: "Dismissed." })}>
            Dismiss
          </Button>
        </div>
      )}
    </div>
  );
}

const SUGGESTIONS = {
  project: ["What should happen next on this project?", "What's at risk here?", "Draft a friendly nudge for the team about anything overdue"],
  app: ["What should I do first today?", "What's going quiet across the company?", "How do I use Claude with Excel?"],
};

export function AskSpine({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const projectId = PROJECT_PATH.exec(pathname)?.[1] ?? null;
  const contextKey = projectId ?? "app";

  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [actionState, setActionState] = useState<ActionState>({});
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Set once the user sends something, so a slow history load can't overwrite the new chat.
  const sentRef = useRef(false);

  // Load the latest conversation for this context when the panel opens.
  useEffect(() => {
    if (!open || loadedFor === contextKey) return;
    setLoadedFor(contextKey);
    setMessages([]);
    setThreadId(null);
    sentRef.current = false;
    fetch(`/api/assistant${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { threadId: string | null; messages: Msg[] } | null) => {
        if (!data || sentRef.current) return;
        setThreadId(data.threadId);
        setMessages(data.messages.map((m) => ({ ...m, actions: (m.actions ?? []) as ProposedAction[] })));
      })
      .catch(() => {});
  }, [open, contextKey, loadedFor, projectId]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || busy) return;
      sentRef.current = true;
      setInput("");
      setBusy(true);
      const replyId = `a-${Date.now()}`;
      setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", text: message, actions: [] }, { id: replyId, role: "assistant", text: "", actions: [], activity: "Thinking" }]);
      const update = (fn: (m: Msg) => Msg) => setMessages((all) => all.map((m) => (m.id === replyId ? fn(m) : m)));

      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, threadId, projectId }),
        });
        if (!res.ok || !res.body) throw new Error();
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const e = JSON.parse(line) as
              | { type: "thread"; threadId: string }
              | { type: "text"; delta: string }
              | { type: "tool"; label: string }
              | { type: "action"; action: ProposedAction }
              | { type: "error"; message: string }
              | { type: "done" };
            if (e.type === "thread") setThreadId(e.threadId);
            if (e.type === "text") update((m) => ({ ...m, text: m.text + e.delta, activity: undefined }));
            if (e.type === "tool") update((m) => ({ ...m, activity: e.label }));
            if (e.type === "action") update((m) => ({ ...m, actions: [...m.actions, e.action] }));
            if (e.type === "error") update((m) => ({ ...m, error: e.message, activity: undefined }));
          }
        }
      } catch {
        update((m) => ({ ...m, error: "Spine couldn't answer just now. Try again." }));
      } finally {
        update((m) => ({ ...m, activity: undefined }));
        setBusy(false);
        router.refresh();
      }
    },
    [busy, threadId, projectId, router],
  );

  if (!open) return null;
  const suggestions = projectId ? SUGGESTIONS.project : SUGGESTIONS.app;

  return (
    <aside className="fixed bottom-0 right-0 top-0 z-40 flex w-panel max-w-full flex-col border-l border-border bg-surface" aria-label="Ask Spine">
      <header className="flex h-topbar shrink-0 items-center justify-between border-b border-border px-5">
        <div className="flex items-center gap-3">
          <Sparkles size={18} strokeWidth={ICON_STROKE} className="text-brand" aria-hidden />
          <div>
            <p className="text-row-title font-semibold text-text">Ask Spine</p>
            <p className="text-tiny text-text-muted">{projectId ? "About this project" : "Your AI project manager"}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {messages.length > 0 && (
            <button
              type="button"
              className="text-label text-brand hover:text-brand-hover"
              onClick={() => {
                setThreadId(null);
                setMessages([]);
                setActionState({});
              }}
            >
              New chat
            </button>
          )}
          <button type="button" onClick={onClose} className="text-text-muted hover:text-text" aria-label="Close Ask Spine">
            <X size={18} strokeWidth={ICON_STROKE} />
          </button>
        </div>
      </header>

      <div ref={listRef} className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        {messages.length === 0 && (
          <div>
            <p className="text-meta text-text">
              {projectId
                ? "I know this project's brief, plan, team and chat. Ask me what's next, what's at risk, or to draft an update."
                : "I can tell you what needs you, find projects and answers, and draft updates or questions for you to confirm."}
            </p>
            <div className="mt-4 space-y-2">
              {suggestions.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} className="block w-full rounded-control border border-border px-4 py-3 text-left text-label text-text hover:border-brand hover:text-brand">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-xs whitespace-pre-line rounded-container bg-brand-soft px-4 py-3 text-meta text-text">{m.text}</p>
            </div>
          ) : (
            <div key={m.id} className="space-y-3 text-meta text-text">
              {m.text && <RichText text={m.text} />}
              {m.activity && <p className="animate-pulse text-label text-text-muted">{m.activity}…</p>}
              {m.error && <p className="text-label text-text-muted">{m.error}</p>}
              {m.actions.map((a) => (
                <ActionCard key={a.id} action={a} state={actionState[a.id]} onDone={(s) => setActionState((all) => ({ ...all, [a.id]: s }))} />
              ))}
            </div>
          ),
        )}
      </div>

      <form
        className="shrink-0 border-t border-border p-4"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <div className={cx("flex items-end gap-2 rounded-control border bg-surface px-3 py-2", busy ? "border-border" : "border-border focus-within:border-brand")}>
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder={projectId ? "Ask about this project..." : "Ask Spine anything..."}
            className="max-h-32 flex-1 resize-none bg-transparent py-1 text-meta text-text placeholder:text-text-muted focus:outline-none"
            aria-label="Message Ask Spine"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-brand text-surface disabled:opacity-40"
            aria-label="Send"
          >
            <ArrowUp size={16} strokeWidth={2} />
          </button>
        </div>
        <p className="mt-2 text-tiny text-text-muted">Spine can make mistakes. Changes only happen when you confirm them.</p>
      </form>
    </aside>
  );
}
