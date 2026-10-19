import { notFound } from "next/navigation";
import { SignupForm } from "@/features/auth/AuthForms";
import { signupEnabled } from "@/server/auth/actions";

export const metadata = { title: "Set up Spine" };

export default async function SignupPage() {
  if (!(await signupEnabled())) notFound();
  return (
    <>
      <h1 className="text-title font-semibold text-text">Set up Spine</h1>
      <p className="mb-6 mt-1 text-meta text-text-muted">You'll be the first admin. You can invite your colleagues next.</p>
      <SignupForm />
    </>
  );
}
