import { Page } from "@/components/shell/Shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { StartWithSpine } from "@/features/ideas/StartWithSpine";
import { firstName } from "@/lib/format";
import { getCurrentUser } from "@/server/session";

/** Start with Spine: one sentence to a full idea, or a short coaching conversation. */
export default async function StartWithSpinePage() {
  const user = await getCurrentUser();
  return (
    <Page>
      <PageHeader back={{ href: "/ideas", label: "Back to Ideas & Projects" }} title="Start with Spine" />
      <StartWithSpine firstName={firstName(user.name)} />
    </Page>
  );
}
