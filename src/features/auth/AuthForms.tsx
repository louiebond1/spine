"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Notice } from "@/components/ui/States";
import { acceptInvitation, login, signup, type FormState } from "@/server/auth/actions";

function ErrorLine({ state }: { state: FormState }) {
  return state.error ? <Notice tone="critical">{state.error}</Notice> : null;
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(login, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <TextField id="email" name="email" type="email" label="Work email" autoComplete="email" required defaultValue={state.values?.email} key={`e-${state.values?.email ?? ""}`} />
      <TextField id="password" name="password" type="password" label="Password" autoComplete="current-password" required />
      <ErrorLine state={state} />
      <Button type="submit" variant="primary" fullWidth disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}

export function AcceptInviteForm({ token, name, email }: { token: string; name: string; email: string }) {
  const [state, action, pending] = useActionState(acceptInvitation, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <TextField id="email" label="Work email" value={email} readOnly disabled />
      <TextField id="name" name="name" label="Your name" defaultValue={state.values?.name ?? name} key={`n-${state.values?.name ?? ""}`} autoComplete="name" required />
      <TextField id="password" name="password" type="password" label="Choose a password" hint="At least 12 characters." autoComplete="new-password" required minLength={12} />
      <ErrorLine state={state} />
      <Button type="submit" variant="primary" fullWidth disabled={pending}>
        {pending ? "Setting up..." : "Join"}
      </Button>
    </form>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState(signup, {});
  return (
    <form action={action} className="space-y-4">
      <TextField id="org" name="org" label="Organisation" autoComplete="organization" required defaultValue={state.values?.org} key={`o-${state.values?.org ?? ""}`} />
      <TextField id="name" name="name" label="Your name" autoComplete="name" required defaultValue={state.values?.name} key={`n-${state.values?.name ?? ""}`} />
      <TextField id="email" name="email" type="email" label="Work email" autoComplete="email" required defaultValue={state.values?.email} key={`e-${state.values?.email ?? ""}`} />
      <TextField id="password" name="password" type="password" label="Password" hint="At least 12 characters." autoComplete="new-password" required minLength={12} />
      <ErrorLine state={state} />
      <Button type="submit" variant="primary" fullWidth disabled={pending}>
        {pending ? "Creating..." : "Create organisation"}
      </Button>
    </form>
  );
}
