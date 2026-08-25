import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const username = process.env.SEED_ADMIN_USERNAME || "admin";
  const password = process.env.SEED_ADMIN_PASSWORD || "changeme123";

  const existing = await prisma.adminUser.findUnique({ where: { username } });
  if (existing) {
    console.log(`admin user "${username}" already exists, skipping`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.adminUser.create({ data: { username, passwordHash } });
  console.log(`created admin user "${username}" — change the password after first login`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
