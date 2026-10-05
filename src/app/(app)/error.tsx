"use client";

import { Page } from "@/components/shell/Shell";
import { ErrorState } from "@/components/ui/States";

/** Errors are one calm grey sentence with a retry text link. */
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Page>
      <ErrorState message="This page couldn't load." onRetry={reset} />
    </Page>
  );
}
