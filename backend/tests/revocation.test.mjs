import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const request = require('supertest');
const app     = require('../app');
const prisma  = require('../prisma');
const bcrypt  = require('bcryptjs');

// H-4: In-memory token revocation blocklist.
// Foydalanuvchi faolsizlantirilganda mavjud token darhol 401 bo'ladi (DB so'rovsiz),
// qayta faollashtirilganda esa yana ishlaydi.
describe('H-4 — Token revocation blocklist', () => {
  const password = 'password123';
  const username = `revoke_user_${Date.now()}`;
  let userId, cookie;

  beforeAll(async () => {
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username,
        password: hash,
        role: 'user',
        isActive: true,
        permissions: { clients: { read: true, create: false, update: false, delete: false } },
      },
    });
    userId = user.id;

    const login = await request(app).post('/api/auth/login').send({ username, password });
    expect(login.status).toBe(200);
    cookie = login.headers['set-cookie'][0];
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('faol token ishlaydi → 200', async () => {
    const res = await request(app)
      .get('/api/clients').set('x-bypass-auth', 'false').set('Cookie', cookie);
    expect(res.status).toBe(200);
  });

  it('faolsizlantirilgandan keyin eski token → 401 (bekor qilingan)', async () => {
    // Admin (test bypass) foydalanuvchini faolsizlantiradi → revokeUser(id)
    const upd = await request(app)
      .put(`/api/users/${userId}`).send({ isActive: false });
    expect(upd.status).toBe(200);

    const res = await request(app)
      .get('/api/clients').set('x-bypass-auth', 'false').set('Cookie', cookie);
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('bekor');
  });

  it('qayta faollashtirilgandan keyin eski token yana ishlaydi → 200', async () => {
    const upd = await request(app)
      .put(`/api/users/${userId}`).send({ isActive: true });
    expect(upd.status).toBe(200);

    const res = await request(app)
      .get('/api/clients').set('x-bypass-auth', 'false').set('Cookie', cookie);
    expect(res.status).toBe(200);
  });
});
