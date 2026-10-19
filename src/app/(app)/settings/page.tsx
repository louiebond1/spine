import { Page } from "@/components/shell/Shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { YourSettings } from "@/features/settings/YourSettings";
import { readPreferences } from "@/lib/preferences";
import { requireCtx } from "@/server/ctx";

export default async function SettingsPage() {
  const { user } = await requireCtx();
  const prefs = readPreferences(user.preferences);
  return (
    <Page width="narrow">
      <PageHeader title="Settings" />
      <YourSettings initial={{ name: user.name, email: user.email ?? "", slackUserId: user.slackUserId ?? "", emailKinds: prefs.email }} />
    </Page>
  );
}
