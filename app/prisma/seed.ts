import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function seedAdmin(username: string, password: string, role: "SUPER_ADMIN" | "CHECKIN_STAFF" | "MERCH_STAFF") {
  const existing = await prisma.adminUser.findUnique({ where: { username } });
  if (existing) {
    console.log(`admin user "${username}" already exists, skipping`);
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.adminUser.create({ data: { username, passwordHash, role } });
  console.log(`created ${role} admin user "${username}" — change the password after first login`);
}

async function main() {
  const username = process.env.SEED_ADMIN_USERNAME || "admin";
  const password = process.env.SEED_ADMIN_PASSWORD || "changeme123";
  await seedAdmin(username, password, "SUPER_ADMIN");

  // Optional extra staff accounts, e.g. for a merch/check-in team — only
  // created if these env vars are set, so existing deployments are unaffected.
  if (process.env.SEED_CHECKIN_USERNAME && process.env.SEED_CHECKIN_PASSWORD) {
    await seedAdmin(process.env.SEED_CHECKIN_USERNAME, process.env.SEED_CHECKIN_PASSWORD, "CHECKIN_STAFF");
  }
  if (process.env.SEED_MERCH_USERNAME && process.env.SEED_MERCH_PASSWORD) {
    await seedAdmin(process.env.SEED_MERCH_USERNAME, process.env.SEED_MERCH_PASSWORD, "MERCH_STAFF");
  }

  // Seed merch products idempotently. Runs every time regardless of whether
  // the admin user already existed, so re-running seed on an already-seeded
  // production DB still adds the merch products.
  const merchSeeds = [
    { name: "Souvenir Shirt", price: 250, requiresSize: true },
    { name: "Vishnu Coin", price: 199, requiresSize: false },
    { name: "Yeti Tumbler", price: 350, requiresSize: false },
  ];
  for (const seedProduct of merchSeeds) {
    const existingProduct = await prisma.merchProduct.findFirst({ where: { name: seedProduct.name } });
    if (existingProduct) {
      console.log(`merch product "${seedProduct.name}" already exists, skipping`);
      continue;
    }
    await prisma.merchProduct.create({ data: seedProduct });
    console.log(`created merch product "${seedProduct.name}"`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());