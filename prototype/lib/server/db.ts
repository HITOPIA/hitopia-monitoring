/**
 * Prisma client singleton (Postgres via driver adapter, Prisma 7).
 * Relative import to the generated client so this module also works under tsx
 * (seed/worker scripts), which does not resolve tsconfig "@/" path aliases.
 */
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — refusing to start (fail-closed, R8).");
  }
  // SSL: Supabase (and most managed Postgres) require SSL but use self-signed
  // certificate chains. `pg` rejects self-signed certs by default, so we set
  // `rejectUnauthorized: false` for those. Local Docker Postgres has no SSL
  // layer — the `pg` client treats this as a no-op when the server doesn't
  // negotiate TLS. So one config works for both dev (localhost) and prod
  // (Supabase).
  const adapter = new PrismaPg({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = globalForPrisma.__prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prisma = prisma;
}
