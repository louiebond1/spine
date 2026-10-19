# Teams, Slack and calendars

Spine only uses integration capabilities that work without special tenant permissions and that could be tested here. Everything else on this page is a proposal. None of it is built.

## Principles

- **Organisation level.** An admin connects each channel once in Admin > Integrations. Individual people connect nothing.
- **Write only.** Spine posts to channels it has been given. It never reads channel history, private messages, chats or calendars.
- **No channel sprawl.** Spine does not create a channel per initiative. A team can paste a link to the channel where they already work, and Spine shows it on the initiative.
- **Links back to Spine.** Every message links to the item in Spine, where permissions apply. Messages hold titles and short reasons, never Help Desk content.

## Built and tested

| Capability | How | Tested |
| --- | --- | --- |
| Slack channel posts | A Slack incoming webhook URL, pasted by an admin | Unit tests: only `https://hooks.slack.com/services/...` is accepted, text is escaped so a title can't trigger `@channel`, and mentions are limited to valid member IDs. A real Slack workspace hasn't been tested |
| Teams channel posts | The URL of a Teams Workflows flow ("When a Teams webhook request is received", then post to a channel), which receives an Adaptive Card message | Unit tests: only Azure Logic Apps or Power Platform hosts are accepted, and the payload is an Adaptive Card. A real Teams tenant hasn't been tested |
| Secrets at rest | Webhook URLs encrypted with AES-256-GCM using `SPINE_ENCRYPTION_KEY`, never shown again after saving | Unit tests: round trip, a random IV, and tampering or a wrong key rejected |
| What gets posted | The daily Pulse digest, approvals that need a decision, newly approved initiatives looking for a team (with the first 300 characters of the problem), and blocked initiatives (with the blocker note) | The send path is exercised. Delivery to real channels hasn't been tested |
| Delivery status | The time and result of the last post for each channel, shown in Admin > Integrations, with a Test button | By code inspection |
| Slack mentions | People add their Slack member ID in Settings, and Spine mentions them as `<@U…>` | Unit test on the payload |
| Channel links | An initiative's team pastes a Teams or Slack channel link, accepted from `teams.microsoft.com`, `teams.cloud.microsoft` and `*.slack.com` only | Unit tests |
| Calendar | Each initiative's plan downloads as an `.ics` file (RFC 5545: steps on their due dates, plus the target date) that Outlook, Google and Apple calendars can import | Unit tests on escaping and line folding. An end-to-end test confirms another organisation gets a 404. Importing into each calendar app hasn't been tested |

Microsoft has retired Office 365 connectors (incoming webhooks) in Teams in favour of Workflows. Spine therefore only accepts Workflows URLs.

## Not built: what each would need

These come from web searches of Microsoft and Slack documentation. The official pages couldn't be opened from this environment, so check each against the current documentation before building.

| Capability | What it needs | Notes |
| --- | --- | --- |
| Slack direct messages, scheduled check-ins, interactive buttons | A Slack app installed to the workspace with OAuth bot scopes (for example `chat:write`, `im:write`, `users:read.email` to match people by email). `chat.scheduleMessage` can schedule posts up to 120 days ahead | Matching Slack users by email would replace the manual member ID. Reading history isn't needed, and Slack limits `conversations.history` for apps not in its Marketplace |
| Teams personal messages and check-ins in chat | A Teams app with a bot (Azure Bot registration). The app has to be installed for each person (or by an admin through Graph `TeamsAppInstallation` permissions, which need admin consent) before the bot can message them proactively | Graph's application permission for posting channel messages is limited to migration scenarios, so ordinary posts go through a bot or Workflows |
| Creating a channel for an initiative | Graph `Channel.Create` (application, admin consent), or the Slack `conversations.create` scope | Only on request for a specific initiative, never by default |
| Calendar events in people's calendars | Graph `Calendars.ReadWrite` (admin consent; Exchange RBAC for Applications can limit which mailboxes), or Google Calendar API scopes | The `.ics` export covers the need without any of this |
| Teams @mentions | Adaptive Card mention entities with each person's Teams or Entra ID | Not verified to work through a Workflows webhook, so not built |

## Privacy

- Help Desk questions, answers and attachments are never posted anywhere. Pulse items about questions say only that a question is waiting, with its title, and link to Spine.
- An anonymous question's title is posted without any name, as everywhere else.
- Removing a webhook in Admin deletes the stored URL.
