import "dotenv/config";
import { hashPassword } from "../lib/server/auth";
import { prisma } from "../lib/server/db";

const ADMIN_EMAIL = "admin@hitopia.id";
const ADMIN_NAME = "Hitopia Admin";
const ADMIN_PASSWORD = process.env.SEED_LOGIN_PASSWORD ?? "hitopia123";

async function main(): Promise<void> {
  const password_hash = await hashPassword(ADMIN_PASSWORD);

  await prisma.appUser.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      name: ADMIN_NAME,
      password_hash,
      role: "admin",
      status: "active",
    },
    create: {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      password_hash,
      role: "admin",
      status: "active",
    },
  });

  console.log(`Seeded login admin: ${ADMIN_EMAIL}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
