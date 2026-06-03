import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const request = require('supertest');
const app     = require('../app');
const prisma  = require('../prisma');
import { uid, makeClient, makeContract, makeProduct } from './helpers.mjs';

describe('Contracts API', () => {
  let clientId, contractId, linkedContractId;
  const n = uid();

  beforeAll(async () => {
    const client = await makeClient();
    clientId = client.id;
    // Turn off autoContractNumbering in settings for this test suite
    await prisma.setting.upsert({
      where: { id: 'global' },
      create: { id: 'global', data: JSON.stringify({ autoContractNumbering: false }) },
      update: { data: JSON.stringify({ autoContractNumbering: false }) },
    });
  });
  afterAll(() => prisma.$disconnect());

  it('POST / — yangi shartnoma yaratish', async () => {
    const res = await request(app).post('/api/contracts').send({
      number:     `26-${n.slice(-4)}`,
      date:       '2026-01-15',
      totalValue: 5_000_000,
      clientId,
    });
    expect(res.status).toBe(200);
    expect(res.body.number).toBe(`26-${n.slice(-4)}`);
    contractId = res.body.id;
  });

  it('PUT /:id — totalValue yangilash', async () => {
    const res = await request(app).put(`/api/contracts/${contractId}`).send({
      totalValue: 8_000_000,
    });
    expect(res.status).toBe(200);
    expect(res.body.totalValue).toBe(8_000_000);
  });

  it('DELETE /:id linked savdo bilan — 409', async () => {
    const product = await makeProduct();
    const linked  = await makeContract(clientId);
    linkedContractId = linked.id;

    await prisma.sale.create({
      data: {
        date: new Date(), nakladnoy: `NK-${n}`, sellerName: 'Test',
        transportNum: '', totalAmount: 1_000_000,
        clientId, contractId: linkedContractId,
        products: {
          create: [{
            productId: product.id, packType: 1, totalPieces: 1,
            totalCbm: 0.034, totalKg: 2.7, totalSqm: 2.88,
            priceCbm: 5_000_000, rowAmount: 170_000,
          }],
        },
      },
    });

    const res = await request(app).delete(`/api/contracts/${linkedContractId}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/bog'langan/i);
  });

  it('DELETE /:id bog\'lanmagan shartnoma — 200', async () => {
    const res = await request(app).delete(`/api/contracts/${contractId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // H-2: auto-raqamlash ketma-ket va takrorlanmas bo'lishi kerak
  it('H-2 — auto-raqamlash ketma-ket (advisory lock)', async () => {
    await prisma.setting.upsert({
      where: { id: 'global' },
      create: { id: 'global', data: JSON.stringify({ autoContractNumbering: true }) },
      update: { data: JSON.stringify({ autoContractNumbering: true }) },
    });
    const c = await makeClient();
    const body = { date: '2031-03-10', totalValue: 1_000_000, clientId: c.id };

    const r1 = await request(app).post('/api/contracts').send(body);
    const r2 = await request(app).post('/api/contracts').send(body);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r2.body.numericPart).toBe(r1.body.numericPart + 1);
    expect(r1.body.number).not.toBe(r2.body.number);

    // tozalash
    await prisma.contract.deleteMany({ where: { clientId: c.id } });
    await prisma.client.delete({ where: { id: c.id } });
    await prisma.setting.update({
      where: { id: 'global' },
      data: { data: JSON.stringify({ autoContractNumbering: false }) },
    });
  });
});
