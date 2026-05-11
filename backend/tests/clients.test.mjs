import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const request = require('supertest');
const app     = require('../app');
const prisma  = require('../prisma');
import { uid, cleanAll } from './helpers.mjs';

describe('Clients API', () => {
  let id;
  const n = uid();

  beforeAll(() => cleanAll());
  afterAll(() => prisma.$disconnect());

  it('POST / — yaratish', async () => {
    const res = await request(app).post('/api/clients').send({
      name: `Test Mijoz ${n}`,
      inn:  n.padStart(9, '0'),
    });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe(`Test Mijoz ${n}`);
    id = res.body.id;
  });

  it('GET / — sahifalangan ro\'yxat', async () => {
    const res = await request(app).get('/api/clients');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /?search= — qidiruv', async () => {
    const res = await request(app).get('/api/clients').query({ search: `Test Mijoz ${n}` });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('PUT /:id — yangilash', async () => {
    const res = await request(app).put(`/api/clients/${id}`).send({ name: 'Yangilangan' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Yangilangan');
  });

  it('POST / — nom yo\'q → 400', async () => {
    const res = await request(app).post('/api/clients').send({ inn: '111222333' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('DELETE /:id', async () => {
    const res = await request(app).delete(`/api/clients/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET / noto\'g\'ri UUID → hech narsa qaytarmaydi (404 emas, list empty)', async () => {
    const res = await request(app).get('/api/clients').query({ search: 'mavjud_emas_xyz_99999' });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });
});
