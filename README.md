# Spine

An AI adoption platform: a Help Desk for AI questions, an Ideas & Projects pipeline, and Pulse, which surfaces anything going quiet. The build brief is in [CLAUDE.md](CLAUDE.md) and the build plan in [PLAN.md](PLAN.md).

## Run locally

Needs Node 20 or newer. No Postgres install is needed: a local one runs from `node_modules`.

```bash
npm install
cp .env.example .env          # then add ANTHROPIC_API_KEY
npm run db:local              # leave running: Postgres on localhost:5433
npm run db:migrate            # in a second terminal
npm run seed                  # the data behind the mockups
npm run dev                   # http://localhost:3000
```

`SPINE_TODAY` in `.env` freezes the clock at Wednesday 7 October 2026, 10:00, so the seeded data matches the mockups. Clear it to use the real time.

Use the menu at the bottom of the sidebar to view the app as any seeded person. Alex Morgan is the default.

### Seeds

| Command | Loads |
| --- | --- |
| `npm run seed` | The default scenario. As Alex, Home shows 3 things that need you (01-home.png). |
| `npm run seed:all-clear` | The same data with nothing waiting on Alex and an empty Pulse (13-home-all-clear.png). |

Both seeds wipe the database first.

### Checks

```bash
npm run typecheck
npm run lint                  # ESLint plus the design guard (no off-token colours, arbitrary values, italics, em dashes)
```

Visual check helper (screenshots at the mockup size, 1536 x 971):

```bash
node scripts/screenshot.mjs http://localhost:3000 help-desk screenshots/help-desk.png u-alex
```

A gallery of every shared component is at `/dev/components` in development.

## Environment

Every variable is listed and explained in [.env.example](.env.example).

## Deploy (Railway)

1. Create a Railway project with a Postgres database and a service from this repo.
2. Set the variables from `.env.example` on the service (`DATABASE_URL` comes from the Postgres plugin; leave `SPINE_TODAY` empty in production).
3. Build command `npm run build`, start command `npm run db:deploy && npm start`.
4. Attach a volume and point `UPLOAD_DIR` at it so attachments survive redeploys.
5. Add a cron service running `npm run job:daily` every 15 minutes for auto-approvals and the Slack digest.
