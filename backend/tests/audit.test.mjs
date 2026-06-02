import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const request = require('supertest');
const app     = require('../app');
const prisma  = require('../prisma');
const bcrypt  = require('bcryptjs');
import { uid, cleanAll } from './helpers.mjs';

const { logAudit, sanitizePayload } = require('../lib/audit');

const ADMIN_ID = 'test-admin-id'; // seed-test-user.js da yaratiladi

describe('Audit Trail (M-7)', () => {
  beforeAll(() => cleanAll());

  afterAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.$disconnect();
  });

  it('(a) mutatsiya (POST /api/clients) AuditLog yozuvini yaratadi', async () => {
    const n = uid();
    const res = await request(app).post('/api/clients').send({
      name: `Audit Mijoz ${n}`,
      inn:  n.padStart(9, '0'),
    });
    expect(res.status).toBe(200);
    const clientId = res.body.id;

    const log = await prisma.auditLog.findFirst({
      where: { entityType: 'client', entityId: clientId, action: 'create' },
    });
    expect(log).not.toBeNull();
    expect(log.userId).toBe(ADMIN_ID);
  });

  it('(b) GET /api/audit — filtr + pagination ishlaydi', async () => {
    const entityType = `t_${uid()}`; // bu testga xos izolyatsiya qilingan entity turi
    // 3 ta yozuv yaratamiz
    for (let i = 0; i < 3; i++) {
      await logAudit(ADMIN_ID, 'create', entityType, `e-${i}`, { i }, null);
    }

    // Filtr: faqat shu entityType
    const filtered = await request(app)
      .get('/api/audit')
      .query({ entityType });
    expect(filtered.status).toBe(200);
    expect(filtered.body).toHaveProperty('data');
    expect(filtered.body).toHaveProperty('total');
    expect(filtered.body).toHaveProperty('page');
    expect(filtered.body).toHaveProperty('limit');
    expect(filtered.body.total).toBe(3);
    expect(filtered.body.data.length).toBe(3);
    // to-one join — user ma'lumoti bor
    expect(filtered.body.data[0].user).toHaveProperty('username');

    // Pagination: limit=2 → 1-sahifada 2 ta, jami 3
    const p1 = await request(app)
      .get('/api/audit')
      .query({ entityType, page: 1, limit: 2 });
    expect(p1.status).toBe(200);
    expect(p1.body.total).toBe(3);
    expect(p1.body.limit).toBe(2);
    expect(p1.body.data.length).toBe(2);

    const p2 = await request(app)
      .get('/api/audit')
      .query({ entityType, page: 2, limit: 2 });
    expect(p2.body.data.length).toBe(1);

    // action filtri
    const byAction = await request(app)
      .get('/api/audit')
      .query({ entityType, action: 'create' });
    expect(byAction.body.total).toBe(3);
    const byOther = await request(app)
      .get('/api/audit')
      .query({ entityType, action: 'delete' });
    expect(byOther.body.total).toBe(0);
  });

  it('(c) admin-only — non-admin foydalanuvchi → 403', async () => {
    const password = 'password123';
    const username = `audit_user_${uid()}`;
    const hash = await bcrypt.hash(password, 10);
    const u = await prisma.user.create({
      data: { username, password: hash, role: 'user', permissions: {} },
    });

    try {
      const login = await request(app).post('/api/auth/login').send({ username, password });
      expect(login.status).toBe(200);
      const cookie = login.headers['set-cookie'][0];

      const res = await request(app)
        .get('/api/audit')
        .set('x-bypass-auth', 'false')
        .set('Cookie', cookie);
      expect(res.status).toBe(403);

      // tokensiz → 401
      const noAuth = await request(app)
        .get('/api/audit')
        .set('x-bypass-auth', 'false');
      expect(noAuth.status).toBe(401);
    } finally {
      await prisma.user.delete({ where: { id: u.id } });
    }
  });

  it('(d) payload sanitizatsiya — password [REDACTED] bo\'lib saqlanadi', async () => {
    const entityType = `t_${uid()}`;
    await logAudit(
      ADMIN_ID, 'create', entityType, 'x1',
      { username: 'ali', password: 'super-secret', nested: { token: 'abc', ok: 1 } },
      null
    );

    const log = await prisma.auditLog.findFirst({
      where: { entityType, entityId: 'x1' },
    });
    expect(log).not.toBeNull();
    expect(log.payload.username).toBe('ali');
    expect(log.payload.password).toBe('[REDACTED]');
    expect(log.payload.nested.token).toBe('[REDACTED]');
    expect(log.payload.nested.ok).toBe(1);
  });

  it('(d2) sanitizePayload — case-insensitive va massiv ichida ham ishlaydi', () => {
    const out = sanitizePayload({
      Password: 'x',
      JWT: 'y',
      list: [{ secret: 's', keep: 1 }],
    });
    expect(out.Password).toBe('[REDACTED]');
    expect(out.JWT).toBe('[REDACTED]');
    expect(out.list[0].secret).toBe('[REDACTED]');
    expect(out.list[0].keep).toBe(1);
  });
});
