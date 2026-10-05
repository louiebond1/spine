"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "./Select";

/** Period picker on Programme and Leaderboard; the choice lives in the URL. */
export function PeriodSelect({ value, options }: { value: string; options: readonly { value: string; label: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <div className="w-56">
      <Select
        aria-label="Period"
        value={value}
        options={[...options]}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          next.set("period", e.target.value);
          router.replace(`${pathname}?${next}`, { scroll: false });
        }}
      />
    </div>
  );
}
