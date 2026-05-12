import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const request = require('supertest');
const app     = require('../app');
const prisma  = require('../prisma');
import { uid, makeClient } from './helpers.mjs';

describe('Interactions API', () => {
  let clientId, interactionId;
  const n = uid();

  beforeAll(async () => {
    const client = await makeClient();
    clientId = client.id;
  });
  afterAll(() => prisma.$disconnect());

  it('POST / — muloqot yaratish', async () => {
    const res = await request(app).post('/api/interactions').send({
      date:     '2026-01-10',
      type:     "Qo'ng'iroq",
      note:     `Test muloqot ${n}`,
      nextDate: null,
      clientId,
    });
    expect(res.status).toBe(200);
    expect(res.body.note).toBe(`Test muloqot ${n}`);
    interactionId = res.body.id;
  });

  it('GET / — sahifalangan javob', async () => {
    const res = await request(app).get('/api/interactions').query({ page: 1, limit: 2 });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('limit');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('PUT /:id — note yangilash', async () => {
    const updated = `Yangilangan izoh ${n}`;
    const res = await request(app).put(`/api/interactions/${interactionId}`).send({
      note: updated,
    });
    expect(res.status).toBe(200);
    expect(res.body.note).toBe(updated);
  });

  it('DELETE /:id — o\'chirish', async () => {
    const res = await request(app).delete(`/api/interactions/${interactionId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
