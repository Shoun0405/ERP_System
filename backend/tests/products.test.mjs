import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const request = require('supertest');
const app     = require('../app');
const prisma  = require('../prisma');
import { uid } from './helpers.mjs';

const PRODUCT = (n) => ({
  article:   `Art-${n}`,
  density:   80,
  length:    2400,
  width:     1200,
  thickness: 12,
  sqmPerPce: 2.88,
  cbmPerPce: 0.034560,
  kgPerPce:  2.765,
  priceCbm:  5_000_000,
  priceTon:  0,
  priceSqm:  0,
});

describe('Products API', () => {
  let id;
  const n = uid();

  afterAll(() => prisma.$disconnect());

  it('POST / — yaratish', async () => {
    const res = await request(app).post('/api/products').send(PRODUCT(n));
    expect(res.status).toBe(200);
    expect(res.body.article).toBe(`Art-${n}`);
    id = res.body.id;
  });

  it('GET / — sahifalangan ro\'yxat', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('PUT /bulk-price — tranzaksiya bilan', async () => {
    const res = await request(app).put('/api/products/bulk-price').send({
      updates: [{ id, priceTon: 70_000_000, priceCbm: 5_600_000, priceSqm: 67_200 }],
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('PUT /:id — yangilash', async () => {
    const n2 = uid();
    const res = await request(app).put(`/api/products/${id}`).send({ article: `Art-${n2}`, density: 90 });
    expect(res.status).toBe(200);
    expect(res.body.density).toBe(90);
  });

  it('POST / — manfiy density → 400', async () => {
    const bad = { ...PRODUCT(uid()), density: -5 };
    const res  = await request(app).post('/api/products').send(bad);
    expect(res.status).toBe(400);
  });

  it('DELETE /:id', async () => {
    const res = await request(app).delete(`/api/products/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
