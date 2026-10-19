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
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      {error && <p className="text-label text-text-muted">AI couldn't rewrite it just now, so it uses plain wording.</p>}
      {canRewrite && (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await rewriteReport(month);
              setError(!r.ok);
              router.refresh();
            })
          }
        >
          {pending ? "Rewriting..." : "Rewrite"}
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          void navigator.clipboard?.writeText(window.location.href);
          setCopied(true);
        }}
      >
        {copied ? "Link copied" : "Copy link"}
      </Button>
      <Button size="sm" onClick={() => window.print()}>Download PDF</Button>
    </div>
  );
}
