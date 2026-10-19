"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Container } from "@/components/ui/Container";
import { TextField } from "@/components/ui/TextField";
import { NOTIFY_KINDS } from "@/lib/preferences";
import { savePreferences } from "@/server/settings-actions";
import { changePassword } from "@/server/auth/actions";

export function YourSettings({ initial }: { initial: { name: string; email: string; slackUserId: string; emailKinds: Record<string, boolean> } }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-6">
      <div>
        <Container heading="Profile" variant="plain">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="name" label="Name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
            <TextField id="email" label="Sign-in email" value={v.email} disabled hint="Ask an admin to change it." />
            <TextField id="slack" label="Slack member ID (optional)" placeholder="U012AB3CD" value={v.slackUserId} onChange={(e) => setV({ ...v, slackUserId: e.target.value })} hint="Lets Spine @mention you in Slack posts. Slack profile > More > Copy member ID." />
          </div>
        </Container>
        <Container heading="Email me when" className="mt-4" variant="plain">
          <div className="space-y-2.5">
            {Object.entries(NOTIFY_KINDS).map(([k, label]) => (
              <Checkbox key={k} label={label} checked={v.emailKinds[k] !== false} onChange={(e) => setV({ ...v, emailKinds: { ...v.emailKinds, [k]: e.target.checked } })} />
            ))}
          </div>
          <p className="mt-3 text-tiny text-text-muted">Everything also appears under the bell in Spine.</p>
        </Container>
        <div className="mt-3 flex items-center gap-3">
          <Button
            variant="primary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await savePreferences({ name: v.name, slackUserId: v.slackUserId, emailKinds: v.emailKinds });
                setMsg(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: r.error });
                router.refresh();
              })
            }
          >
            Save changes
          </Button>
          {msg && <p className={msg.ok ? "text-label text-text-muted" : "text-label text-critical"}>{msg.text}</p>}
        </div>
      </div>
      <PasswordForm />
    </div>
  );
}

function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, {});
  return (
    <form action={action}>
      <Container heading="Password" description="Changing it signs you out everywhere else." variant="plain">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="current" name="current" type="password" label="Current password" autoComplete="current-password" required />
          <TextField id="next" name="next" type="password" label="New password" hint="At least 12 characters." autoComplete="new-password" required minLength={12} />
        </div>
      </Container>
      <div className="mt-3 flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          Change password
        </Button>
        {state.error && <p className="text-label text-critical">{state.error}</p>}
        {state.saved && <p className="text-label text-text-muted">Password changed.</p>}
      </div>
    </form>
  );
}
