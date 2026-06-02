import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const request = require('supertest');
const app     = require('../app');
const prisma  = require('../prisma');
import { makeClient, makeContract, makeProduct } from './helpers.mjs';

// H-1: QQS stavkasi global Sozlamalardan (Setting.vatRate) olinadi, koda qotib
// yozilmaydi. Spec qatorlaridagi vatAmount = rowTotal/(1+rate)*rate (narx ichidan).
describe('QQS stavkasi Sozlamalardan (H-1)', () => {
  let client, contract, product;

  // Sozlamalarni belgilangan vatRate ga o'rnatadi (boshqa kalitlarni saqlab)
  async function setVatRate(rate) {
    const existing = await prisma.setting.findUnique({ where: { id: 'global' } });
    const data = existing ? JSON.parse(existing.data) : {};
    data.vatRate = rate;
    await prisma.setting.upsert({
      where:  { id: 'global' },
      create: { id: 'global', data: JSON.stringify(data) },
      update: { data: JSON.stringify(data) },
    });
  }

  // Sozlamalardan vatRate kalitini butunlay olib tashlaydi (default fallback testi)
  async function removeVatRate() {
    const existing = await prisma.setting.findUnique({ where: { id: 'global' } });
    if (!existing) return;
    const data = JSON.parse(existing.data);
    delete data.vatRate;
    await prisma.setting.update({
      where: { id: 'global' },
      data:  { data: JSON.stringify(data) },
    });
  }

  beforeAll(async () => {
    client   = await makeClient();
    contract = await makeContract(client.id);
    product  = await makeProduct();
  });

  afterAll(async () => {
    await prisma.specProduct.deleteMany();
    await prisma.specification.deleteMany({ where: { contractId: contract.id } });
    await prisma.contract.delete({ where: { id: contract.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.client.delete({ where: { id: client.id } });
    await prisma.$disconnect();
  });

  it('vatRate = 0.20 — QQS 20% bo\'yicha hisoblanadi', async () => {
    await setVatRate(0.20);

    const res = await request(app).post('/api/specs').send({
      contractId: contract.id,
      date:       '2026-01-15',
      products: [{
        productId:    product.id,
        unit:         'kv.m',
        quantity:     1,
        unitPriceVat: 1200,
      }],
    });

    expect(res.status).toBe(200);
    const row = res.body.products[0];
    // rowTotal = 1×1200 = 1200; QQS = 1200/(1+0.2)*0.2 = 200 (aniq)
    expect(row.rowTotal).toBe(1200);
    expect(row.vatAmount).toBe(200);
  });

  it('vatRate = 0.12 — QQS 12% bo\'yicha hisoblanadi', async () => {
    await setVatRate(0.12);

    const res = await request(app).post('/api/specs').send({
      contractId: contract.id,
      date:       '2026-01-16',
      products: [{
        productId:    product.id,
        unit:         'kv.m',
        quantity:     1,
        unitPriceVat: 1200,
      }],
    });

    expect(res.status).toBe(200);
    const row = res.body.products[0];
    // QQS = 1200/(1+0.12)*0.12 = 128.5714... → 128.57 (2 kasr)
    expect(row.rowTotal).toBe(1200);
    expect(row.vatAmount).toBe(128.57);
  });

  it('vatRate Sozlamalarda yo\'q — default 0.12 ga qaytadi', async () => {
    await removeVatRate();

    const res = await request(app).post('/api/specs').send({
      contractId: contract.id,
      date:       '2026-01-17',
      products: [{
        productId:    product.id,
        unit:         'kv.m',
        quantity:     1,
        unitPriceVat: 1200,
      }],
    });

    expect(res.status).toBe(200);
    const row = res.body.products[0];
    expect(row.vatAmount).toBe(128.57);
  });

  it('PUT /:id — yangilashda ham Sozlamadagi stavka qo\'llanadi', async () => {
    await setVatRate(0.20);

    const created = await request(app).post('/api/specs').send({
      contractId: contract.id,
      date:       '2026-01-18',
      products: [{ productId: product.id, unit: 'kv.m', quantity: 1, unitPriceVat: 1200 }],
    });
    expect(created.status).toBe(200);

    const updated = await request(app).put(`/api/specs/${created.body.id}`).send({
      products: [{ productId: product.id, unit: 'kv.m', quantity: 2, unitPriceVat: 1200 }],
    });
    expect(updated.status).toBe(200);
    const row = updated.body.products[0];
    // rowTotal = 2×1200 = 2400; QQS = 2400/1.2*0.2 = 400
    expect(row.rowTotal).toBe(2400);
    expect(row.vatAmount).toBe(400);
  });
});
