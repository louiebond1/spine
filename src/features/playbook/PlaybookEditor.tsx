"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { TextArea } from "@/components/ui/TextArea";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { ICON_STROKE } from "@/components/ui/icons";
import { removePlaybookItem, saveGuide, savePriority, saveTool } from "@/server/playbook/actions";

type Kind = "priority" | "tool" | "guide";
type Values = Record<string, string | boolean>;

const BLANK: Record<Kind, Values> = {
  priority: { title: "", description: "", active: true },
  tool: { name: "", purpose: "", status: "APPROVED", dataGuidance: "", url: "" },
  guide: { title: "", body: "" },
};

/** Inline add/edit for one playbook item. Only rendered for admins; the server checks again. */
export function PlaybookItemEditor({ kind, id, initial, label }: { kind: Kind; id?: string; initial?: Values; label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<Values>(initial ?? BLANK[kind]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: string, val: string | boolean) => setV({ ...v, [k]: val });

  if (!open)
    return id ? (
      <button type="button" onClick={() => setOpen(true)} className="rounded-sm p-1 text-text-faint hover:bg-subtle hover:text-text" aria-label={`Edit ${label ?? "item"}`}>
        <Pencil size={14} strokeWidth={ICON_STROKE} />
      </button>
    ) : (
      <Button size="sm" variant="ghost" icon={Plus} onClick={() => setOpen(true)}>
        {label ?? "Add"}
      </Button>
    );

  const save = () =>
    start(async () => {
      setError(null);
      const r = kind === "priority" ? await savePriority(id ?? null, v) : kind === "tool" ? await saveTool(id ?? null, v) : await saveGuide(id ?? null, v);
      if (!r.ok) return setError(r.error);
      setOpen(false);
      if (!id) setV(BLANK[kind]);
      router.refresh();
    });
  const remove = () =>
    start(async () => {
      if (!id) return;
      await removePlaybookItem(kind, id);
      setOpen(false);
      router.refresh();
    });

  return (
    <div className="mt-2 w-full space-y-3 rounded-control border border-border bg-subtle p-3">
      {kind === "priority" && (
        <>
          <TextField label="Priority" value={String(v.title)} onChange={(e) => set("title", e.target.value)} maxLength={100} />
          <TextArea label="Why it matters" rows={2} value={String(v.description)} onChange={(e) => set("description", e.target.value)} maxLength={600} />
          <Checkbox label="Show on Home" checked={!!v.active} onChange={(e) => set("active", e.target.checked)} />
        </>
      )}
      {kind === "tool" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Tool" value={String(v.name)} onChange={(e) => set("name", e.target.value)} maxLength={80} />
            <Select label="Status" value={String(v.status)} onChange={(e) => set("status", e.target.value)} options={[{ value: "APPROVED", label: "Approved" }, { value: "LIMITED", label: "Approved with limits" }, { value: "NOT_APPROVED", label: "Not approved" }]} />
          </div>
          <TextField label="What it's for" value={String(v.purpose)} onChange={(e) => set("purpose", e.target.value)} maxLength={400} />
          <TextArea label="Data rule" hint="What can and can't go into it, in plain words." rows={2} value={String(v.dataGuidance)} onChange={(e) => set("dataGuidance", e.target.value)} maxLength={800} />
          <TextField label="Link (optional)" value={String(v.url)} onChange={(e) => set("url", e.target.value)} placeholder="https://" maxLength={300} />
        </>
      )}
      {kind === "guide" && (
        <>
          <TextField label="Title" value={String(v.title)} onChange={(e) => set("title", e.target.value)} maxLength={120} />
          <TextArea label="Guidance" rows={6} value={String(v.body)} onChange={(e) => set("body", e.target.value)} maxLength={6000} />
        </>
      )}
      {error && <p className="text-label text-critical">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {id ? (
          <Button size="sm" variant="danger" disabled={pending} onClick={remove}>
            Remove
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={pending} onClick={save}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
