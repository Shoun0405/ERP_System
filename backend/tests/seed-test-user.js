const { PrismaClient } = require('@prisma/client');
const TEST_DB_URL = 'postgresql://postgres:postgres@localhost:5432/erp_test_db?connection_limit=5&pool_timeout=10';
const prisma = new PrismaClient({
  datasources: { db: { url: TEST_DB_URL } }
});

async function main() {
  await prisma.user.upsert({
    where: { id: 'test-admin-id' },
    update: {},
    create: {
      id: 'test-admin-id',
      username: 'test-admin',
      password: 'hashed',
      role: 'admin',
      fullName: 'Test Admin',
      isActive: true
    }
  });
  console.log('[test] Seeded test-admin-id user successfully.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
