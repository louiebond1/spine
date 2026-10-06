import { Page } from "@/components/shell/Shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { YourSettings } from "@/features/settings/YourSettings";
import { readPreferences } from "@/lib/preferences";
import { getCurrentUser } from "@/server/session";

/** Your settings: how Spine looks for you and how it tells you things. */
export default async function SettingsPage() {
  const user = await getCurrentUser();
  return (
    <Page width="narrow">
      <PageHeader title="Your settings" />
      <YourSettings initial={{ ...readPreferences(user.preferences), address: user.email ?? "" }} />
    </Page>
  );
}
