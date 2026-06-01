process.env.NODE_ENV = 'test';
const request = require('supertest');
const app = require('../app');
const prisma = require('../prisma');

async function main() {
  console.log('Simulating POST /api/users request in test environment...');
  const res = await request(app)
    .post('/api/users')
    .set('x-bypass-auth', 'true') // bypass authentication/admin check
    .send({
      username: "testuser1234",
      fullName: "Test User 1234",
      password: "password123",
      role: "user",
      isActive: true,
      permissions: {
        clients: { read: true, create: false, update: false, delete: false }
      }
    });

  console.log('API Response status:', res.status);
  console.log('API Response body:', res.body);

  // Query db to check what got saved
  const saved = await prisma.user.findFirst({ where: { username: "testuser1234" } });
  console.log('Saved user from DB:', saved);

  // Clean up
  if (saved) {
    await prisma.user.delete({ where: { id: saved.id } });
    console.log('Cleaned up test user.');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
