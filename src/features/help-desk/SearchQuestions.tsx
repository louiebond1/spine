"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TextField } from "@/components/ui/TextField";

/** Filters the Help Desk by title as you type. */
export function SearchQuestions() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");
      if (next.toString() !== params.toString()) router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    }, 200);
    return () => clearTimeout(t);
  }, [value, params, pathname, router]);

  return (
    <div className="w-80">
      <TextField search placeholder="Search questions..." value={value} onChange={(e) => setValue(e.target.value)} aria-label="Search questions" />
    </div>
  );
}
