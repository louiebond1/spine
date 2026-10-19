// Production access without seed users or default passwords. Prints single-use links.
//
//   Create a new organisation and its first admin:
//     npm run bootstrap -- --org "Acme Group" --name "Jane Doe" --email jane@acme.com
//
//   Give an existing person access (for example people migrated from the single-company demo):
//     npm run bootstrap -- --access --email jane@acme.com [--user-id <id>] [--admin]
//
// The link works once and expires in 7 days. Share it privately; it is never stored in plain text.
import { rootDb } from "../src/server/db";
import { createOrganization } from "../src/server/org/setup";
import { issueInvitation } from "../src/server/auth/invitations";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

async function main() {
  const email = value("email")?.trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Give a valid --email.");

  if (flag("access")) {
    const userId = value("user-id");
    let user = userId ? await rootDb.user.findUnique({ where: { id: userId } }) : await rootDb.user.findUnique({ where: { email } });
    if (!user) throw new Error("No such person. Use --user-id to pick one, or --org to create an organisation.");
    const clash = await rootDb.user.findUnique({ where: { email } });
    if (clash && clash.id !== user.id) throw new Error("Someone else already uses that email.");
    user = await rootDb.user.update({ where: { id: user.id }, data: { email, ...(flag("admin") ? { isAdmin: true } : {}) } });
    const { link } = await issueInvitation({ orgId: user.orgId, email, name: user.name, invitedById: null, userId: user.id });
    console.log(`Access link for ${user.name} (${email}):\n${link}`);
    return;
  }

  const orgName = value("org");
  const name = value("name");
  if (!orgName || !name) throw new Error("Give --org and --name to create an organisation, or --access for an existing person.");
  if (await rootDb.user.findUnique({ where: { email } })) throw new Error("That email already has an account. Use --access instead.");
  const org = await rootDb.$transaction((tx) => createOrganization(orgName, tx));
  const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const user = await rootDb.user.create({ data: { orgId: org.id, name, initials, email, status: "INVITED", isAdmin: true, isChampion: true } });
  const { link } = await issueInvitation({ orgId: org.id, email, name, invitedById: null, userId: user.id, isAdmin: true, isChampion: true });
  console.log(`Created ${org.name} (${org.slug}). First admin: ${name} <${email}>\nSet-up link:\n${link}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => rootDb.$disconnect());
