import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const request = require('supertest');
const app     = require('../app');
const prisma  = require('../prisma');
const bcrypt  = require('bcryptjs');
import { makeClient, makeContract, makeProduct } from './helpers.mjs';

const TODAY = new Date().toISOString().split('T')[0];

async function makeSale(clientId, contractId, productId, nak) {
  const res = await request(app).post('/api/sales').send({
    date: TODAY, nakladnoy: nak, sellerName: 'S1',
    clientId, contractId,
    products: [{ productId, unit: 'dona', amount: 10, price: 1000 }],
  });
  expect(res.status).toBe(200);
  return res.body.id;
}

describe('Soft-delete + superAdmin (#3a)', () => {
  let client, contract, product;

  beforeAll(async () => {
    client   = await makeClient({ seller: 'S1' });
    contract = await makeContract(client.id);
    product  = await makeProduct();
  });

  afterAll(async () => {
    await prisma.saleProduct.deleteMany({ where: { sale: { clientId: client.id } } });
    await prisma.sale.deleteMany({ where: { clientId: client.id } });
    await prisma.contract.delete({ where: { id: contract.id } });
    await prisma.client.delete({ where: { id: client.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.$disconnect();
  });

  it('DELETE soft qiladi — yozuv qoladi (deletedAt set)', async () => {
    const saleId = await makeSale(client.id, contract.id, product.id, 'SD-1');
    const res = await request(app).delete(`/api/sales/${saleId}`);
    expect(res.status).toBe(200);
    const row = await prisma.sale.findUnique({ where: { id: saleId } });
    expect(row).toBeTruthy();          // hali bazada
    expect(row.deletedAt).toBeTruthy(); // o'chirilgan belgilandi
  });

  it('o\'chirilgan savdo ro\'yxatda ko\'rinadi (deletedAt bilan)', async () => {
    const res = await request(app).get('/api/sales').query({ clientId: client.id, limit: 200 });
    expect(res.status).toBe(200);
    const deleted = res.body.data.filter(s => s.deletedAt);
    expect(deleted.length).toBeGreaterThan(0);
  });

  it('o\'chirilgan savdo mijoz qarzidan CHIQARILADI', async () => {
    // Yangi faol savdo: debt = 10000
    const liveId = await makeSale(client.id, contract.id, product.id, 'SD-LIVE');
    let res = await request(app).get('/api/clients').query({ limit: 200 });
    let c = res.body.data.find(x => x.id === client.id);
    const debtBefore = c.debt;
    expect(debtBefore).toBeGreaterThanOrEqual(10000);

    // O'chiramiz → debt 10000 ga kamayadi
    await request(app).delete(`/api/sales/${liveId}`);
    res = await request(app).get('/api/clients').query({ limit: 200 });
    c = res.body.data.find(x => x.id === client.id);
    expect(c.debt).toBe(debtBefore - 10000);
  });

  // ── superAdmin: hard-delete + restore (real auth) ──────────────────────────
  describe('superAdmin huquqi', () => {
    const password = 'password123';
    const superU = `sa_${Date.now()}`;
    const adminU = `ad_${Date.now()}`;
    let superId, adminId;

    async function cookie(username) {
      const r = await request(app).post('/api/auth/login').send({ username, password });
      expect(r.status).toBe(200);
      return r.headers['set-cookie'][0];
    }

    beforeAll(async () => {
      const hash = await bcrypt.hash(password, 10);
      const sa = await prisma.user.create({ data: { username: superU, password: hash, role: 'superAdmin' } });
      const ad = await prisma.user.create({ data: { username: adminU, password: hash, role: 'admin' } });
      superId = sa.id; adminId = ad.id;
    });
    afterAll(async () => {
      await prisma.user.deleteMany({ where: { id: { in: [superId, adminId] } } });
    });

    it('admin hard-delete → 403', async () => {
      const saleId = await makeSale(client.id, contract.id, product.id, 'SD-HARD-1');
      const ck = await cookie(adminU);
      const res = await request(app).delete(`/api/sales/${saleId}/hard`).set('x-bypass-auth', 'false').set('Cookie', ck);
      expect(res.status).toBe(403);
    });

    it('superAdmin hard-delete → 200 (haqiqiy o\'chadi)', async () => {
      const saleId = await makeSale(client.id, contract.id, product.id, 'SD-HARD-2');
      const ck = await cookie(superU);
      const res = await request(app).delete(`/api/sales/${saleId}/hard`).set('x-bypass-auth', 'false').set('Cookie', ck);
      expect(res.status).toBe(200);
      const row = await prisma.sale.findUnique({ where: { id: saleId } });
      expect(row).toBeNull();
    });

    it('superAdmin restore → deletedAt null', async () => {
      const saleId = await makeSale(client.id, contract.id, product.id, 'SD-RESTORE');
      await request(app).delete(`/api/sales/${saleId}`); // soft
      const ck = await cookie(superU);
      const res = await request(app).post(`/api/sales/${saleId}/restore`).set('x-bypass-auth', 'false').set('Cookie', ck);
      expect(res.status).toBe(200);
      const row = await prisma.sale.findUnique({ where: { id: saleId } });
      expect(row.deletedAt).toBeNull();
    });
  });
});
