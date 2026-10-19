# Spine

Spine is where a company runs its AI adoption. People ask AI questions privately, and the company shares what works. Ideas become owned initiatives that are checked in on until they deliver a verified outcome.

It is organised around four pillars:

| Pillar | Where | What it does |
| --- | --- | --- |
| Alignment | Playbook | The company's AI priorities, approved tools and guides, written by admins and used to ground every AI answer |
| Inspiration | Discover, shared answers | What colleagues found useful, plus answers askers chose to share from the Help Desk |
| Execution | Help Desk, Initiatives | Private question threads with Champions; ideas to approval, team, plan, launch and Live |
| Momentum | Home, Pulse, check-ins | One-minute check-ins, blockers that reach the right people, outcomes verified by someone outside the team |

## Security model

- **Nobody is signed in by default.** Email and password sign-in, scrypt-hashed passwords, random session tokens (only a hash is stored), httpOnly `SameSite=Lax` cookies, Secure in production, and a 30 day sliding expiry. Sign-in is rate limited per email and per IP.
- **Organisations are isolated.** Every person and record belongs to one organisation, and every query runs through `forOrg(orgId)` (`src/server/tenant.ts`), which adds the organisation to every read and write. The unscoped client is limited to a short allow-list of files by `scripts/guard.mjs`.
- **Nobody is automatically an admin.** The first admin of an organisation is created with `npm run bootstrap`. Everyone else joins by a single-use invitation link that expires after 7 days. Roles are changed in Admin > People, and the last admin can't be removed.
- **The Help Desk is private.** A thread, including its attachments, is visible only to the asker and the Champion who claimed it. Champions can preview unclaimed questions. Resolved questions stay private unless the asker shares a summary. An anonymous asker is never shown to anyone.
- **AI only sees what it may.** Suggested answers draw on shared answers and the Playbook, never on private threads. AI calls are logged without prompts or answers, limited per organisation per month, and back off for 5 minutes after a billing or key failure.
- Every admin action is in Admin > Audit log.

## Run locally

Needs Node 20 or newer.

```bash
npm install
cp .env.example .env          # set SPINE_ENCRYPTION_KEY; ANTHROPIC_API_KEY is optional
npm run db:local              # leave running: Postgres on localhost:5433 (or use your own)
npm run db:deploy             # apply migrations
npm run seed                  # demo data: Acme Group plus a second organisation, Northwind
npm run dev                   # http://localhost:3000
```

Sign in as any demo person with their email, `first.last@demo.spine.test`, and the password in `SPINE_DEMO_PASSWORD` (default `spine-demo-password`). For example, `alex.morgan@demo.spine.test` is an admin and Champion at Acme, `ben.carter@demo.spine.test` is a member, and `dana.reed@demo.spine.test` is the admin of Northwind.

`SPINE_TODAY` freezes the clock at Wednesday 7 October 2026, 10:00 so the demo data looks the same every time. `npm run seed:all-clear` loads the same data with nothing waiting on Alex. Both seeds wipe the database, and both refuse to run in production.

## Production access

There are no seed users and no default passwords in production.

```bash
# A new organisation and its first admin (prints a single-use set-up link)
npm run bootstrap -- --org "Acme Group" --name "Jane Doe" --email jane@acme.com

# Access for someone who already exists, for example people migrated from Spine 1
npm run bootstrap -- --access --email jane@acme.com --user-id <id> [--admin]
```

After that, admins invite everyone else from Admin > People.

## Daily job

```bash
npm run job:daily              # every organisation: auto-approvals, approval chasing, check-in
                               # reminders, the opportunity scan, last month's leadership report
                               # and the Pulse digest when it's due
npm run job:daily -- --force   # send the digest now
```

Pages never change data when they load. Auto-approval happens only in this job.

## Integrations

Admins connect a Slack incoming webhook and a Microsoft Teams Workflows webhook in Admin > Integrations. Both are encrypted at rest. Teams can paste a link to their own channel on an initiative, and every initiative's plan can be added to any calendar as an `.ics` file. Spine never reads channel history, private messages or calendars. See [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) for what's built and what would need a Slack app or Teams bot.

## Checks and tests

```bash
npm run typecheck
npm run lint                  # ESLint plus the design guard (tokens only, no rootDb outside its allow-list)
npm run test:unit             # tenant scoping, webhook validation, payloads, encryption, .ics (needs the seeded database)
```

The end-to-end tests run in a real browser against a production build. They never use AI fixtures.

```bash
npm run build && npm start                 # with .env as above
# optional, for the AI failure tests: a second server with a deliberately invalid key
ANTHROPIC_API_KEY=sk-ant-invalid ANTHROPIC_MODEL=claude-sonnet-5-5 npx next start -p 3001
npm test                                   # reseeds the database
```

They cover: sign-in, sessions, rate limits, deactivation and headers. Organisation isolation across pages, search, attachments and calendars. Help Desk privacy and anonymity. Invitations. Approvals, returns and auto-approval. Plan permissions, check-ins and blockers. AI failure states. Phone and desktop layouts. Permission tests replay a real server action with another person's session, so they prove the server refuses, not just the UI.

Set `SPINE_SCREENSHOT_DIR` to save screenshots of every main screen at phone and desktop sizes.

## Deploy

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the Railway set-up, the migration from Spine 1, backups and rollback.
