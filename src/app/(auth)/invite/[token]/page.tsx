import Link from "next/link";
import { AcceptInviteForm } from "@/features/auth/AuthForms";
import { findOpenInvitation } from "@/server/auth/invitations";

export const metadata = { title: "Join Spine" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await findOpenInvitation(token);
  if (!inv) {
    return (
      <>
        <h1 className="text-title font-semibold text-text">This link has expired</h1>
        <p className="mt-2 text-meta text-text-muted">Invitation links work once and last 7 days. Ask your Spine admin for a new one.</p>
        <Link href="/login" className="mt-6 inline-block text-meta font-medium text-brand hover:text-brand-hover">
          Go to sign in
        </Link>
      </>
    );
  }
  return (
    <>
      <h1 className="text-title font-semibold text-text">{inv.userId ? "Set your password" : `Join ${inv.org.name} on Spine`}</h1>
      <p className="mb-6 mt-1 text-meta text-text-muted">
        {inv.userId ? "Choose a new password to get back into Spine." : "Spine is where your company asks AI questions, shares what works and runs its AI initiatives."}
      </p>
      <AcceptInviteForm token={token} name={inv.name} email={inv.email} />
    </>
  );
}
