// Fails the lint step on anything the design rules forbid.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const roots = ["src", "prisma/seed"];
const rules = [
  { re: /#[0-9a-fA-F]{3,8}\b(?![\w-])/, msg: "hex colour (use a token)" },
  { re: /\brgba?\((?!var\(--)/, msg: "rgb() colour (use a token)" },
  { re: /\b[\w:-]+-\[[^\]]+\]/, msg: "arbitrary Tailwind value (add a token)" },
  { re: /\bitalic\b/, msg: "italics are not allowed" },
  { re: /—/, msg: "em dash" },
  { re: /⋮/, msg: "vertical ellipsis menu" },
];

// Only these files may use the unscoped database client; everything else goes through forOrg().
const rootDbAllowed = [
  "src/server/db.ts",
  "src/server/tenant.ts",
  "src/server/auth/",
  "src/server/org/",
  "src/server/people/actions.ts",
  "src/app/api/health/route.ts",
  "prisma/seed/",
];

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|css)$/.test(name)) files.push(p);
  }
};
roots.forEach(walk);

let failures = 0;
for (const file of files) {
  const text = readFileSync(file, "utf8");
  if (/\brootDb\b/.test(text) && !rootDbAllowed.some((p) => file.replaceAll("\\", "/").startsWith(p))) {
    console.error(`${file}  uses rootDb (the unscoped client); use the organisation-scoped ctx.db instead`);
    failures++;
  }
  text
    .split("\n")
    .forEach((line, i) => {
      if (line.includes("guard-ignore")) return;
      for (const { re, msg } of rules) {
        if (re.test(line)) {
          console.error(`${file}:${i + 1}  ${msg}\n    ${line.trim()}`);
          failures++;
        }
      }
    });
}
if (failures) {
  console.error(`\n${failures} design rule violation(s).`);
  process.exit(1);
}
console.log(`Design guard: ${files.length} files clean.`);
