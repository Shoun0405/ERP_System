const request = require('supertest');
const app = require('../app');
const prisma = require('../prisma');
const bcrypt = require('bcryptjs');

describe('Auth API', () => {
  const username = 'test_auth_user';
  const password = 'password123';
  let userId;

  beforeAll(async () => {
    // Clean and seed a test user
    await prisma.user.deleteMany({ where: { username } });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, password: hashedPassword, role: 'user' }
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('POST /api/auth/login — Muvaffaqiyatli kirish (JWT cookie)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username, password });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.username).toBe(username);
    expect(res.body.user.role).toBe('user');
    
    // Cookie checks
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toContain('token=');
  });

  it('POST /api/auth/login — Noto\'g\'ri parol bilan', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username, password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('noto\'g\'ri');
  });

  it('GET /api/auth/me — Kirgan foydalanuvchini tekshirish', async () => {
    // 1. Log in to get the cookie
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username, password });
    
    const cookie = loginRes.headers['set-cookie'][0];

    // 2. Call /me with the cookie
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('x-bypass-auth', 'false')
      .set('Cookie', cookie);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.username).toBe(username);
  });

  it('GET /api/auth/me — Tokensiz so\'rov (401)', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('x-bypass-auth', 'false');
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('topilmadi');
  });

  it('GET /api/clients — Himoyalangan endpoint tokensiz (401)', async () => {
    const res = await request(app)
      .get('/api/clients')
      .set('x-bypass-auth', 'false');
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('topilmadi');
  });

  it('POST /api/auth/logout — Tizimdan chiqish', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
