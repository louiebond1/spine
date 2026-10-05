import Link from "next/link";
import { Page } from "@/components/shell/Shell";

export default function NotFound() {
  return (
    <Page>
      <p className="py-6 text-meta text-text-muted">
        There&apos;s nothing here.{" "}
        <Link href="/" className="text-brand hover:text-brand-hover">
          Go to Home
        </Link>
      </p>
    </Page>
  );
}
