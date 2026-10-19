/** Spine logo: three offset rounded bars and the wordmark. `tone` follows the surface it sits on. */
export function Logo({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg width="18" height="24" viewBox="0 0 36 50" aria-hidden>
        <defs>
          <linearGradient id="spine-logo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className="text-logo-light" stopColor="currentColor" />
            <stop offset="1" className="text-brand" stopColor="currentColor" />
          </linearGradient>
        </defs>
        <rect x="9" y="2" width="24" height="10" rx="5" fill="url(#spine-logo)" />
        <rect x="2" y="20" width="32" height="10" rx="5" fill="url(#spine-logo)" />
        <rect x="0" y="38" width="20" height="10" rx="5" fill="url(#spine-logo)" />
      </svg>
      <span className={tone === "dark" ? "text-logo font-semibold text-nav-strong" : "text-logo font-semibold text-text"}>Spine</span>
    </span>
  );
}
