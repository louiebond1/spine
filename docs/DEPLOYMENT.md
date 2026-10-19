# Deploying Spine 2.0

This covers the Railway project that runs Spine today (`spine-web`, `spine-cron` and Postgres, in the `production` environment, deploying the `phase-1` branch), and how to move it to 2.0 safely.

## Before anything else: the public URL

Spine 1 has no sign-in. Anyone who opens `spine-web-production.up.railway.app` is treated as an admin. Until 2.0 is deployed, remove the public domain: spine-web → Settings → Networking → remove the Railway domain. Add it back (Generate Domain) only after the 2.0 deploy has passed the checks below.

## What changes in production

| | Spine 1 (now) | Spine 2.0 |
| --- | --- | --- |
| Start command | `npm run db:deploy && npm run seed:if-empty && npm start` | `npm run db:deploy && npm start` |
| Demo data | Loaded on an empty database | Never. The seed refuses to run in production |
| Sign-in | None (user switcher) | Email and password, invitations |
| Slack | `SLACK_WEBHOOK_URL` on spine-cron | Per organisation in Admin > Integrations, encrypted. `SLACK_WEBHOOK_URL` is no longer read |
| `SPINE_TODAY` | Freezes the clock | Ignored in production unless `SPINE_ALLOW_FIXED_CLOCK=1` |
| `SPINE_AI_FIXTURES` | Fake AI responses | Ignored in production |

`seed:if-empty` still exists in 2.0 as a script that only prints a message, so a deploy with the old start command doesn't fail. Remove it from the start command anyway.

## Variables

Set these on **spine-web** and on **spine-cron**. spine-cron can reference spine-web's values, for example `${{spine-web.SPINE_ENCRYPTION_KEY}}`.

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | `${{Postgres.DATABASE_URL}}` |
| `SPINE_APP_URL` | Yes | The public https URL. Invitation links use it |
| `SPINE_ENCRYPTION_KEY` | Yes | 32+ random characters. Generate once and never change it: changing it disconnects saved webhooks |
| `UPLOAD_DIR` | Yes (web) | On the existing `/data` volume, for example `/data/uploads` |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | No | Without them, AI features say AI isn't set up and everything else works |
| `SPINE_TIMEZONE` | No | Defaults to Europe/London |
| `RESEND_API_KEY`, `EMAIL_FROM` | No | Without them, admins copy invitation links from Admin > People |

Then delete `SPINE_TODAY`, `SPINE_AI_FIXTURES` and `SLACK_WEBHOOK_URL`. They do nothing in 2.0. Never set `SPINE_ALLOW_DEMO_SEED`, `SPINE_ALLOW_FIXED_CLOCK` or `SPINE_INSECURE_COOKIES` in production.

The AI calls in production currently fail with "credit balance too low". Admin > AI & health will show this after the deploy. Add credit in the Anthropic Console, or leave AI off. Nothing depends on it.

## The database migration

`prisma/migrations/20261019120000_spine2_organisations` is the only new migration. It runs in one transaction, so if any step fails, nothing is applied. It:

1. Lowercases every email, then **stops with an error** if two people share an email. Fix the duplicates in Spine 1 and deploy again.
2. Creates the `Organization` table and one organisation, `org_default` ("My organisation"), and puts every existing person, topic, question, project and setting in it.
3. Adds the new tables (sessions, invitations, rate limits, audit log, AI calls, check-ins, playbook, discoveries) and new columns. Every new column is nullable or has a default.
4. Schedules the first check-in for initiatives that are already building.

It deletes no rows and no columns. It was tested locally on a Spine 1 database built from the `phase-1` migrations: it applied cleanly, left no schema drift, and stopped and rolled back on duplicate emails.

## Steps

1. **Back up.** From a machine with `pg_dump` at the same or a newer major version than the Railway Postgres server:
   ```bash
   pg_dump "$DATABASE_PUBLIC_URL" -Fc --no-owner --no-acl -f spine-before-2.0.dump
   pg_restore --list spine-before-2.0.dump | head     # check the file is readable
   ```
   `DATABASE_PUBLIC_URL` is on the Postgres service's Variables tab. Keep the file somewhere private: it contains all of Spine's data. If Railway backups are enabled for this database, take one there as well. Don't rely on it alone.
2. **Rehearse** on a copy: restore the dump into a local or temporary database, run `DATABASE_URL=<copy> npx prisma migrate deploy` from the 2.0 code, and check it applies.
3. **Set the variables** above on both services, and change the start command on spine-web.
4. **Deploy** by merging the 2.0 branch into `phase-1` (Railway deploys that branch). Watch the spine-web deploy log for `All migrations have been successfully applied.`
5. **Give people access.** Spine 1 people have no passwords. From spine-web's shell (or locally, with `DATABASE_URL` pointing at production):
   ```bash
   npm run bootstrap -- --access --email you@yourcompany.com --user-id <your Spine 1 user id> --admin
   ```
   Open the printed link privately and set a password. Then rename the organisation in Admin > Settings, and invite or reset access for everyone else from Admin > People.
6. **Check** before adding the public domain back:
   - Opening any page without signing in goes to `/login`, and `/api/search` returns 401
   - A member can't open `/admin`
   - `/api/health` returns `{"ok":true}`
   - The next spine-cron run logs `[job] organisation default` and no failures (AI failures appear as a failed step until credit is added)
7. **Add the public domain back.**

## Rollback

Code and schema go back together. The Spine 1 code can't run on the migrated database, because new rows need an organisation.

1. Remove the public domain.
2. Roll back the code: redeploy the last Spine 1 deployment in Railway, or reset `phase-1` to the commit before the merge.
3. Restore the backup into the same database:
   ```bash
   psql "$DATABASE_PUBLIC_URL" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
   pg_restore --no-owner --no-acl -d "$DATABASE_PUBLIC_URL" spine-before-2.0.dump
   ```
4. Put the start command and variables back as they were.

Anything created in Spine 2.0 after the deploy is lost by a rollback. This exact cycle (Spine 1 database, back up, migrate, drop and restore, `prisma migrate status` up to date on the Spine 1 code) was tested locally on Postgres 16. It hasn't been run against Railway.

## A fresh deployment

1. Create Postgres, plus a web service from this repo: build `npm run build`, start `npm run db:deploy && npm start`, with a volume for `UPLOAD_DIR`.
2. Add a cron service from the same repo: build `npm ci && npx prisma generate`, start `npm run job:daily:prod`, schedule `*/15 * * * *`, restart policy never.
3. Set the variables, deploy, then run `npm run bootstrap -- --org "Your company" --name "Your name" --email you@yourcompany.com` and open the link.
