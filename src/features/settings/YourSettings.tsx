"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cx } from "@/lib/cx";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { TextField } from "@/components/ui/TextField";
import { NOTIFY_KINDS, type Preferences } from "@/lib/preferences";
import { savePreferences } from "@/server/settings-actions";

const THEME_LABEL = { light: "Light", dark: "Dark", system: "Match my computer" } as const;
const ACCENT_LABEL = { cobalt: "Cobalt", teal: "Teal", violet: "Violet", graphite: "Graphite" } as const;
const SIZE_LABEL = { compact: "Smaller", default: "Default", large: "Larger" } as const;

function Choice<T extends string>({ label, options, value, onChange, swatch }: { label: string; options: Record<T, string>; value: T; onChange: (v: T) => void; swatch?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-6 py-5">
      <p className="text-row-title font-medium text-text">{label}</p>
      <div className="flex gap-2" role="radiogroup" aria-label={label}>
        {(Object.keys(options) as T[]).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={value === k}
            onClick={() => onChange(k)}
            className={cx(
              "flex h-control items-center gap-2 rounded-control border px-4 text-meta",
              value === k ? "border-brand bg-brand-soft text-brand" : "border-border text-text hover:border-brand",
            )}
          >
            {swatch && (
              <span className="spine-app h-3 w-3 rounded-full" data-accent={k} aria-hidden>
                <span className="block h-3 w-3 rounded-full bg-brand" />
              </span>
            )}
            {options[k]}
          </button>
        ))}
      </div>
    </div>
  );
}

export function YourSettings({ initial }: { initial: Preferences & { address: string } }) {
  const router = useRouter();
  const [theme, setTheme] = useState(initial.theme);
  const [accent, setAccent] = useState(initial.accent);
  const [size, setSize] = useState(initial.size);
  const [address, setAddress] = useState(initial.address);
  const [kinds, setKinds] = useState<Record<string, boolean>>(() => Object.fromEntries(Object.keys(NOTIFY_KINDS).map((k) => [k, initial.email[k] !== false])));
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Preview straight away: the shell reads these attributes.
  useEffect(() => {
    const app = document.querySelector<HTMLElement>(".spine-app[data-theme]");
    if (!app) return;
    app.dataset.theme = theme;
    app.dataset.accent = accent;
    app.dataset.size = size;
  }, [theme, accent, size]);

  return (
    <div className="space-y-5">
      <section className="rounded-container border border-border bg-surface px-6">
        <div className="pt-5">
          <SectionLabel>Appearance</SectionLabel>
        </div>
        <div className="divide-y divide-border">
          <Choice label="Theme" options={THEME_LABEL} value={theme} onChange={setTheme} />
          <Choice label="Accent" options={ACCENT_LABEL} value={accent} onChange={setAccent} swatch />
          <Choice label="Text size" options={SIZE_LABEL} value={size} onChange={setSize} />
        </div>
      </section>

      <section className="rounded-container border border-border bg-surface px-6">
        <div className="pt-5">
          <SectionLabel>Notifications</SectionLabel>
          <p className="mt-2 text-meta text-text-muted">Everything shows in the bell. Add an email address to get these by email too.</p>
        </div>
        <div className="py-4">
          <TextField aria-label="Email address" type="email" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="you@company.com" />
        </div>
        <div className="divide-y divide-border border-t border-border">
          {(Object.keys(NOTIFY_KINDS) as (keyof typeof NOTIFY_KINDS)[]).map((k) => (
            <div key={k} className="py-4">
              <Checkbox checked={kinds[k] ?? true} disabled={!address} onChange={(e) => setKinds({ ...kinds, [k]: e.target.checked })} label={<span className="text-meta text-text">{NOTIFY_KINDS[k]}</span>} />
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center justify-end gap-5">
        {message && <p className="text-label text-text-muted">{message}</p>}
        <Button
          variant="primary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await savePreferences({ theme, accent, size, email: address, emailKinds: kinds });
              setMessage(r.ok ? "Saved." : r.error);
              if (r.ok) router.refresh();
            })
          }
        >
          Save changes
        </Button>
      </div>
    </div>
  );
}
