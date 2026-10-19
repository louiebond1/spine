import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/AuthForms";
import { getSessionUser } from "@/server/auth/session";
import { signupEnabled } from "@/server/auth/actions";

export const metadata = { title: "Sign in · Spine" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getSessionUser()) redirect("/");
  const { next } = await searchParams;
  return (
    <>
      <h1 className="text-title font-semibold text-text">Sign in to Spine</h1>
      <p className="mb-6 mt-1 text-meta text-text-muted">Your company's AI questions, ideas and initiatives in one place.</p>
      <LoginForm next={next} />
      <p className="mt-6 text-label text-text-muted">
        New here? Ask your Spine admin for an invitation.
        {(await signupEnabled()) && (
          <>
            {" "}
            Or{" "}
            <Link href="/signup" className="font-medium text-brand hover:text-brand-hover">
              set up a new organisation
            </Link>
            .
          </>
        )}
      </p>
    </>
  );
}
