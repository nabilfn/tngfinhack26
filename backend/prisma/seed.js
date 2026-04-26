const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function upsertUser({ name, email, password, passcode, walletBalance, faceEnrollmentStatus = 'NOT_ENROLLED' }) {
  return prisma.user.upsert({
    where: { email },
    update: { name, walletBalance, faceEnrollmentStatus },
    create: {
      name,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      passcodeHash: await bcrypt.hash(passcode, 12),
      walletBalance,
      faceEnrollmentStatus,
    },
  });
}

async function main() {
  if (process.env.SEED_DEMO_USERS === 'true') {
    await upsertUser({ name: 'User B Receiver', email: 'receiver@test.com', password: 'password123', passcode: '111111', walletBalance: 0 });
    await upsertUser({ name: 'User A Payer', email: 'payer@test.com', password: 'password123', passcode: '123456', walletBalance: 200 });
    await upsertUser({ name: 'User A No Face', email: 'payer2@test.com', password: 'password123', passcode: '654321', walletBalance: 100 });
    return;
  }

  if (!process.env.SEED_USER_EMAIL) return;
  await upsertUser({
    name: process.env.SEED_USER_NAME || 'Seed User',
    email: process.env.SEED_USER_EMAIL,
    password: process.env.SEED_USER_PASSWORD || 'change_me_now',
    passcode: process.env.SEED_USER_PASSCODE || '000000',
    walletBalance: Number(process.env.SEED_USER_BALANCE || 0),
  });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
