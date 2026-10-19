"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { TextArea } from "@/components/ui/TextArea";
import { reportOutcome, verifyOutcome } from "@/server/projects/actions";

/** The team reports this month's hours saved and how they measured it. */
export function ReportOutcomeForm({ projectId, current }: { projectId: string; current: { hours: number; evidence: string } | null }) {
  const router = useRouter();
  const [hours, setHours] = useState(current ? String(current.hours) : "");
  const [evidence, setEvidence] = useState(current?.evidence ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="rounded-container border border-border bg-surface p-4 sm:p-5">
      <h2 className="text-section font-semibold text-text">Report this month's outcome</h2>
      <p className="text-label text-text-muted">An approver or admin outside the team checks it before it counts in leadership reports. Reporting again replaces this month's figure and needs re-checking.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-main-rail">
        <TextArea id="evidence" label="How did you measure it?" rows={3} value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="For example: 14 people ran it twice a week; each run replaces about 30 minutes of manual work (timed in October)." maxLength={1000} />
        <TextField id="hours" label="Hours saved this month" type="number" min={0} inputMode="numeric" value={hours} onChange={(e) => setHours(e.target.value)} />
      </div>
      {error && <p className="mt-2 text-label text-critical">{error}</p>}
      <div className="mt-3 flex justify-end">
        <Button
          disabled={pending || hours === ""}
          onClick={() =>
            start(async () => {
              const r = await reportOutcome(projectId, { hours: Number(hours), evidence });
              if (!r.ok) return setError(r.error);
              setError(null);
              router.refresh();
            })
          }
        >
          {current ? "Update report" : "Report"}
        </Button>
      </div>
    </section>
  );
}

export function VerifyButton({ impactId }: { impactId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="flex items-center gap-2">
      {error && <span className="text-label text-critical">{error}</span>}
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await verifyOutcome(impactId);
            if (!r.ok) return setError(r.error);
            router.refresh();
          })
        }
      >
        Verify
      </Button>
    </span>
  );
}
