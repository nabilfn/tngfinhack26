const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  // Optional environment-driven seed for local testing only.
  // No demo users are created unless SEED_USER_EMAIL is explicitly provided.
  if (!process.env.SEED_USER_EMAIL) return;

  await prisma.user.upsert({
    where: { email: process.env.SEED_USER_EMAIL },
    update: {},
    create: {
      name: process.env.SEED_USER_NAME || 'Seed User',
      email: process.env.SEED_USER_EMAIL,
      passwordHash: await bcrypt.hash(process.env.SEED_USER_PASSWORD || 'change_me_now', 12),
      passcodeHash: await bcrypt.hash(process.env.SEED_USER_PASSCODE || '000000', 12),
      walletBalance: Number(process.env.SEED_USER_BALANCE || 0),
      faceEnrollmentStatus: 'NOT_ENROLLED',
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
