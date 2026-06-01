// E2E uchun ma'lum login/parolga ega admin foydalanuvchini dev bazaga (erp_db) qo'shadi.
// Idempotent (upsert) — qayta ishlatilganda xato bermaydi.
// Playwright auth setup shu foydalanuvchi bilan login qilib cookie oladi.
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const USERNAME = process.env.E2E_USER || 'e2e-admin';
const PASSWORD = process.env.E2E_PASS || 'e2e-password-123';

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 10);
  await prisma.user.upsert({
    where:  { username: USERNAME },
    update: { password: hash, role: 'admin', isActive: true },
    create: { username: USERNAME, password: hash, role: 'admin', fullName: 'E2E Admin', isActive: true },
  });
  console.log(`[e2e] seed user "${USERNAME}" tayyor.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
