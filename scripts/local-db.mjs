// Local development Postgres (no install needed). Railway provides Postgres in production.
// Runs until stopped. Matches DATABASE_URL in .env.example.
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";

const dataDir = "./.pgdata";
const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "spine",
  password: "spine",
  port: 5433,
  persistent: true,
});

if (!existsSync(dataDir)) await pg.initialise();
await pg.start();
try {
  await pg.createDatabase("spine");
} catch {
  // already exists
}
console.log("Local Postgres running on postgresql://spine:spine@localhost:5433/spine");

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
