"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { TextArea } from "@/components/ui/TextArea";
import { Select } from "@/components/ui/Select";
import { shareDiscovery } from "@/server/discoveries/actions";

export function ShareDiscovery({ open, topics, tools }: { open: boolean; topics: { id: string; name: string }[]; tools: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [v, setV] = useState({ title: "", body: "", toolName: "", topicId: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!open)
    return (
      <Button variant="primary" href={`${pathname}?share=1`}>
        Share a discovery
      </Button>
    );
  return (
    <section className="w-full rounded-container border border-border bg-surface p-4 sm:p-5">
      <h2 className="text-section font-semibold text-text">Share what worked</h2>
      <p className="text-label text-text-muted">A prompt, a workflow, a shortcut. Colleagues can copy it. Don't include client or personal data.</p>
      <div className="mt-3 space-y-3">
        <TextField label="What did you do?" placeholder="Turned 40 supplier emails into a comparison table in 5 minutes" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} maxLength={120} />
        <TextArea label="How, and what happened" rows={5} value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} placeholder="What you tried, the prompt or steps, and the result. Include what didn't work too." maxLength={3000} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Tool (optional)" value={v.toolName} onChange={(e) => setV({ ...v, toolName: e.target.value })} options={[{ value: "", label: "Choose a tool" }, ...tools.map((t) => ({ value: t, label: t }))]} />
          <Select label="Topic (optional)" value={v.topicId} onChange={(e) => setV({ ...v, topicId: e.target.value })} options={[{ value: "", label: "Choose a topic" }, ...topics.map((t) => ({ value: t.id, label: t.name }))]} />
        </div>
      </div>
      {error && <p className="mt-2 text-label text-critical">{error}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" href={pathname}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await shareDiscovery(v);
              if (!r.ok) return setError(r.error);
              router.replace(pathname);
              router.refresh();
            })
          }
        >
          Share
        </Button>
      </div>
    </section>
  );
}
