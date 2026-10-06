"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { rewriteReport } from "@/server/report/actions";

export function ReportActions({ month, canRewrite }: { month: string; canRewrite: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div className="flex items-center gap-4 print:hidden">
      {error && <p className="text-label text-text-muted">Spine couldn&apos;t rewrite it just now.</p>}
      {canRewrite && (
        <Button
          variant="text"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await rewriteReport(month);
              setError(!r.ok);
              router.refresh();
            })
          }
        >
          {pending ? "Rewriting…" : "Rewrite"}
        </Button>
      )}
      <Button
        variant="text"
        onClick={() => {
          void navigator.clipboard?.writeText(window.location.href);
          setCopied(true);
        }}
      >
        {copied ? "Link copied" : "Copy link"}
      </Button>
      <Button onClick={() => window.print()}>Download PDF</Button>
    </div>
  );
}
