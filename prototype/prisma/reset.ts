/**
 * Hard database reset (dev): DROP SCHEMA public CASCADE → recreate → re-apply
 * migrations → (optional) seed. Use when you want a clean slate.
 *
 *   npm run db:reset            # drop + recreate empty tables
 *   npm run db:reset:seed       # drop + recreate + demo seed
 *   SEED_DEMO=false npm run db:reset:seed   # drop + recreate + infra-only seed
 *
 * Destructive — wipes ALL data in the target database.
 */
import "dotenv/config";
import { Client } from "pg";
import { execSync } from "node:child_process";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set — refusing to run.");

  // pg doesn't understand Prisma's ?schema= param — strip the query string.
  const pgUrl = url.split("?")[0];
  const dbName = pgUrl.split("/").pop();
  console.log(`Resetting database "${dbName}" …`);

  const client = new Client({ connectionString: pgUrl });
  await client.connect();
  console.log("  • DROP SCHEMA public CASCADE");
  await client.query("DROP SCHEMA IF EXISTS public CASCADE;");
  console.log("  • CREATE SCHEMA public");
  await client.query("CREATE SCHEMA public;");
  await client.end();

  console.log("  • prisma migrate deploy (recreate tables)");
  execSync("npx prisma migrate deploy", { stdio: "inherit" });

  if (process.argv.includes("--seed")) {
    console.log("  • seeding");
    execSync("npm run db:seed", { stdio: "inherit", env: process.env });
  }

  console.log("Database reset complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
