"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cx } from "@/lib/cx";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/TextArea";
import { Select } from "@/components/ui/Select";
import { checkIn, setCheckInCadence } from "@/server/projects/actions";

const OPTIONS = [
  { value: "ON_TRACK", label: "On track", hint: "Moving as planned" },
  { value: "AT_RISK", label: "At risk", hint: "Might slip, here's why" },
  { value: "BLOCKED", label: "Blocked", hint: "Can't move without help" },
] as const;

/** A one-minute check-in: status plus a note. Blocked check-ins reach the approver, admins and the team channel. */
export function CheckInForm({ projectId, due }: { projectId: string; due: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<(typeof OPTIONS)[number]["value"]>("ON_TRACK");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  if (saved) return <p className="rounded-container border border-border bg-surface p-4 text-meta text-text">Checked in. Thanks.</p>;
  return (
    <section className="rounded-container border border-border bg-surface p-4 sm:p-5">
      <h2 className="text-section font-semibold text-text">{due ? "Check-in due" : "Check in"}</h2>
      <p className="text-label text-text-muted">How is it going? It takes a minute.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Status">
        {OPTIONS.map((o) => (
          <label key={o.value} className={cx("cursor-pointer rounded-control border px-3 py-2.5", status === o.value ? "border-brand bg-brand-soft" : "border-border hover:border-border-strong")}>
            <input type="radio" name="status" value={o.value} checked={status === o.value} onChange={() => setStatus(o.value)} className="sr-only" />
            <span className="block text-meta font-medium text-text">{o.label}</span>
            <span className="block text-label text-text-muted">{o.hint}</span>
          </label>
        ))}
      </div>
      <TextArea
        className="mt-3"
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={status === "BLOCKED" ? "What's blocking you, and who could unblock it?" : status === "AT_RISK" ? "What's at risk?" : "Anything worth sharing? (optional)"}
        aria-label="Note"
        maxLength={2000}
      />
      {error && <p className="mt-2 text-label text-critical">{error}</p>}
      <div className="mt-3 flex justify-end">
        <Button
          variant="primary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await checkIn(projectId, { status, note });
              if (!r.ok) return setError(r.error);
              setSaved(true);
              router.refresh();
            })
          }
        >
          Check in
        </Button>
      </div>
    </section>
  );
}

export function CadenceSelect({ projectId, days }: { projectId: string; days: number | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="w-44">
      <Select
        aria-label="Check-in frequency"
        value={days ? String(days) : "off"}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            await setCheckInCadence(projectId, e.target.value === "off" ? null : Number(e.target.value));
            router.refresh();
          })
        }
        options={[
          { value: "7", label: "Every week" },
          { value: "14", label: "Every 2 weeks" },
          { value: "off", label: "Check-ins off" },
        ]}
      />
    </div>
  );
}
