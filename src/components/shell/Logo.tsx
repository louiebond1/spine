"use client";

import { useId } from "react";

/** Spine logo: three offset rounded bars and the wordmark. `tone` follows the surface it sits on. */
export function Logo({ tone = "dark" }: { tone?: "dark" | "light" }) {
  // Unique per instance: a hidden copy (the desktop sidebar on mobile) would otherwise own the gradient.
  const gradient = `spine-logo-${useId().replace(/:/g, "")}`;
  return (
    <span className="flex items-center gap-2.5">
      <svg width="18" height="24" viewBox="0 0 36 50" aria-hidden>
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className="text-logo-light" stopColor="currentColor" />
            <stop offset="1" className="text-brand" stopColor="currentColor" />
          </linearGradient>
        </defs>
        <rect x="9" y="2" width="24" height="10" rx="5" fill={`url(#${gradient})`} />
        <rect x="2" y="20" width="32" height="10" rx="5" fill={`url(#${gradient})`} />
        <rect x="0" y="38" width="20" height="10" rx="5" fill={`url(#${gradient})`} />
      </svg>
      <span className={tone === "dark" ? "text-logo font-semibold text-nav-strong" : "text-logo font-semibold text-text"}>Spine</span>
    </span>
  );
}
