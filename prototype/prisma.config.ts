import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  // Prisma 7: connection URL for CLI (migrate / db push / studio) lives here.
  // The runtime client connects via the driver adapter in lib/server/db.ts.
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
