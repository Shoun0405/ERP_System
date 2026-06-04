import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const request = require('supertest');
const app     = require('../app');
const prisma  = require('../prisma');
import { makeClient, makeContract, makeProduct } from './helpers.mjs';

describe('Sales API', () => {
  let client, contract, product, saleId;

  beforeAll(async () => {
    client   = await makeClient();
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

  it('POST / — savdo yaratish (server summani hisoblaydi)', async () => {
    const res = await request(app).post('/api/sales').send({
      date:         new Date().toISOString().split('T')[0],
      nakladnoy:    'T-001',
      sellerName:   'Test Sotuvchi',
      transportNum: '',
      clientId:     client.id,
      contractId:   contract.id,
      products:     [{ productId: product.id, unit: 'dona', amount: 10, price: 1000, packType: 1 }],
    });
    expect(res.status).toBe(200);
    expect(res.body.clientId).toBe(client.id);
    // Narx 1 tonna uchun: 10 dona × 2.765 kg = 27.65 kg → (27.65/1000) × 1000 = 28
    expect(res.body.totalAmount).toBe(28);
    expect(res.body.products[0].totalPieces).toBe(10);
    expect(res.body.products[0].rowAmount).toBe(28);
    saleId = res.body.id;
  });

  // ─── C-2: moliyaviy butunlik ──────────────────────────────────────────────
  it('C-2 — klient soxta rowAmount yuborsa, server e\'tiborsiz qoldiradi', async () => {
    const res = await request(app).post('/api/sales').send({
      date:       new Date().toISOString().split('T')[0],
      nakladnoy:  'T-C2',
      sellerName: 'Test',
      clientId:   client.id,
      contractId: contract.id,
      // rowAmount/priceCbm/totalCbm — klient soxtalashtirmoqchi; server tashlab yuboradi
      products:   [{
        productId: product.id, unit: 'dona', amount: 5, price: 2000, packType: 1,
        rowAmount: 999999999, priceCbm: 1, totalCbm: 1, totalPieces: 1,
      }],
    });
    expect(res.status).toBe(200);
    // Server haqiqiy: 5 dona × 2.765 kg = 13.825 kg → (13.825/1000) × 2000 = 28 (soxta 999999999 emas)
    expect(res.body.totalAmount).toBe(28);
    expect(res.body.products[0].rowAmount).toBe(28);
    expect(res.body.products[0].totalPieces).toBe(5);
    await request(app).delete(`/api/sales/${res.body.id}`);
  });

  it('C-2 — bir nechta qator: totalAmount = server yig\'indisi', async () => {
    const res = await request(app).post('/api/sales').send({
      date:       new Date().toISOString().split('T')[0],
      nakladnoy:  'T-MULTI',
      sellerName: 'Test',
      clientId:   client.id,
      contractId: contract.id,
      products:   [
        { productId: product.id, unit: 'dona', amount: 3, price: 1000, packType: 1 },
        { productId: product.id, unit: 'dona', amount: 2, price: 5000, packType: 1 },
      ],
    });
    expect(res.status).toBe(200);
    // qator1: 3 dona×2.765=8.295kg → round(8.295)=8; qator2: 2×2.765=5.53kg → round(5.53×5)=28
    expect(res.body.totalAmount).toBe(8 + 28); // 36
    await request(app).delete(`/api/sales/${res.body.id}`);
  });

  it('C-2 — noma\'lum productId → 400', async () => {
    const res = await request(app).post('/api/sales').send({
      date:       new Date().toISOString().split('T')[0],
      nakladnoy:  'T-BADPROD',
      sellerName: 'Test',
      clientId:   client.id,
      products:   [{ productId: '00000000-0000-0000-0000-000000000000', unit: 'dona', amount: 1, price: 100 }],
    });
    expect(res.status).toBe(400);
  });

  it('POST / — amount<=0 → 400', async () => {
    const res = await request(app).post('/api/sales').send({
      date: new Date().toISOString().split('T')[0],
      nakladnoy: 'T-002', sellerName: 'Test',
      clientId: client.id, contractId: contract.id,
      products: [{ productId: product.id, unit: 'dona', amount: 0, price: 100 }],
    });
    expect(res.status).toBe(400);
  });

  it('POST / — price manfiy → 400', async () => {
    const res = await request(app).post('/api/sales').send({
      date: new Date().toISOString().split('T')[0],
      nakladnoy: 'T-003', sellerName: 'Test',
      clientId: client.id, contractId: contract.id,
      products: [{ productId: product.id, unit: 'dona', amount: 1, price: -10 }],
    });
    expect(res.status).toBe(400);
  });

  // #7: yuk xati sanasi shartnoma sanasidan oldin bo'lmasligi
  it('#7 — savdo sanasi shartnoma sanasidan oldin → 400', async () => {
    const c = await prisma.contract.create({
      data: { number: `T-DATE-${Date.now()}`, date: new Date('2026-06-10'), totalValue: 1_000_000, clientId: client.id },
    });
    const bad = await request(app).post('/api/sales').send({
      date: '2026-06-05', nakladnoy: 'T-DT-BAD', sellerName: 'Test',
      clientId: client.id, contractId: c.id,
      products: [{ productId: product.id, unit: 'dona', amount: 1, price: 1000 }],
    });
    expect(bad.status).toBe(400);

    const ok = await request(app).post('/api/sales').send({
      date: '2026-06-10', nakladnoy: 'T-DT-OK', sellerName: 'Test',
      clientId: client.id, contractId: c.id,
      products: [{ productId: product.id, unit: 'dona', amount: 1, price: 1000 }],
    });
    expect(ok.status).toBe(200);

    await request(app).delete(`/api/sales/${ok.body.id}`);
    await prisma.contract.delete({ where: { id: c.id } });
  });

  it('GET / — ro\'yxat', async () => {
    const res = await request(app).get('/api/sales');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /:id — mahsulot artikuli bilan', async () => {
    const res = await request(app).get(`/api/sales/${saleId}`);
    expect(res.status).toBe(200);
    expect(res.body.products[0]).toHaveProperty('product');
    expect(res.body.products[0].product.article).toBe(product.article);
  });

  it('GET /?clientId= — mijoz bo\'yicha filtr', async () => {
    const res = await request(app).get('/api/sales').query({ clientId: client.id });
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
  });

  it('PUT /:id — savdoni tahrirlash (server qayta hisoblaydi)', async () => {
    const createRes = await request(app).post('/api/sales').send({
      date:       new Date().toISOString().split('T')[0],
      nakladnoy:  'T-EDIT-TEST',
      sellerName: 'Test Seller',
      clientId:   client.id,
      contractId: contract.id,
      products:   [{ productId: product.id, unit: 'dona', amount: 10, price: 1000, packType: 1 }],
    });
    expect(createRes.status).toBe(200);
    const tempSaleId = createRes.body.id;

    const editRes = await request(app).put(`/api/sales/${tempSaleId}`).send({
      nakladnoy: 'T-EDITED',
      products:  [{ productId: product.id, unit: 'dona', amount: 20, price: 2000, packType: 2 }],
    });
    expect(editRes.status).toBe(200);
    expect(editRes.body.nakladnoy).toBe('T-EDITED');
    expect(editRes.body.totalAmount).toBe(111); // 20 dona × 2.765 = 55.3 kg → (55.3/1000) × 2000 = 110.6 → 111
    expect(editRes.body.products.length).toBe(1);
    expect(editRes.body.products[0].packType).toBe(2);

    await request(app).delete(`/api/sales/${tempSaleId}`);
  });

  it('DELETE /:id', async () => {
    const res = await request(app).delete(`/api/sales/${saleId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
