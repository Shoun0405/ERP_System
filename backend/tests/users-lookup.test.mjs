import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const request = require('supertest');
const app     = require('../app');
const prisma  = require('../prisma');
const bcrypt  = require('bcryptjs');

// #3b: /api/users/lookup — har avtorizatsiyalangan foydalanuvchi id→nom yecha oladi,
// lekin /api/users (admin) hamon 403. Real cookie (x-bypass-auth: false) bilan tekshiramiz.
describe('Users lookup (#3b)', () => {
  const password = 'password123';
  const username = `lookup_user_${Date.now()}`;
  let userId;

  async function cookie() {
    const r = await request(app).post('/api/auth/login').send({ username, password });
    expect(r.status).toBe(200);
    return r.headers['set-cookie'][0];
  }

  beforeAll(async () => {
    const hash = await bcrypt.hash(password, 10);
    const u = await prisma.user.create({
      data: { username, password: hash, fullName: 'Lookup Test', role: 'user', permissions: {} },
    });
    userId = u.id;
  });
  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('oddiy foydalanuvchi GET /api/users/lookup → 200 (id + fullName)', async () => {
    const ck = await cookie();
    const res = await request(app).get('/api/users/lookup').set('x-bypass-auth', 'false').set('Cookie', ck);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const me = res.body.find(u => u.id === userId);
    expect(me).toBeTruthy();
    expect(me.fullName).toBe('Lookup Test');
  });

  it('oddiy foydalanuvchi GET /api/users (admin) → 403', async () => {
    const ck = await cookie();
    const res = await request(app).get('/api/users').set('x-bypass-auth', 'false').set('Cookie', ck);
    expect(res.status).toBe(403);
  });
});
