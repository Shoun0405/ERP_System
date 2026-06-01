import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const request = require('supertest');
const app     = require('../app');
const prisma  = require('../prisma');
const bcrypt  = require('bcryptjs');

// C-3: GET (o'qish) endpointlari endi `requirePermission(module,'read')` bilan himoyalangan.
// Bu yerda real token (x-bypass-auth: false) bilan tekshiramiz — test bypass ishlamaydi.
describe('RBAC — GET endpointlarida read huquqi (C-3)', () => {
  const password = 'password123';
  const denyUsername  = `rbac_deny_${Date.now()}`;
  const allowUsername = `rbac_allow_${Date.now()}`;
  let denyId, allowId;

  // read:false bo'lgan foydalanuvchi uchun cookie olish
  async function loginCookie(username) {
    const res = await request(app).post('/api/auth/login').send({ username, password });
    expect(res.status).toBe(200);
    return res.headers['set-cookie'][0];
  }

  beforeAll(async () => {
    const hash = await bcrypt.hash(password, 10);
    const denyPerms = {
      clients: { read: false, create: false, update: false, delete: false },
      sales:   { read: false, create: false, update: false, delete: false },
    };
    const allowPerms = {
      clients: { read: true, create: false, update: false, delete: false },
    };
    const deny = await prisma.user.create({
      data: { username: denyUsername, password: hash, role: 'user', permissions: denyPerms },
    });
    const allow = await prisma.user.create({
      data: { username: allowUsername, password: hash, role: 'user', permissions: allowPerms },
    });
    denyId = deny.id;
    allowId = allow.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [denyId, allowId] } } });
    await prisma.$disconnect();
  });

  it('read:false foydalanuvchi GET /api/clients → 403', async () => {
    const cookie = await loginCookie(denyUsername);
    const res = await request(app)
      .get('/api/clients')
      .set('x-bypass-auth', 'false')
      .set('Cookie', cookie);
    expect(res.status).toBe(403);
  });

  it('read:false foydalanuvchi GET /api/sales → 403', async () => {
    const cookie = await loginCookie(denyUsername);
    const res = await request(app)
      .get('/api/sales')
      .set('x-bypass-auth', 'false')
      .set('Cookie', cookie);
    expect(res.status).toBe(403);
  });

  it('read:true foydalanuvchi GET /api/clients → 200', async () => {
    const cookie = await loginCookie(allowUsername);
    const res = await request(app)
      .get('/api/clients')
      .set('x-bypass-auth', 'false')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('tokensiz GET /api/clients → 401', async () => {
    const res = await request(app)
      .get('/api/clients')
      .set('x-bypass-auth', 'false');
    expect(res.status).toBe(401);
  });
});
