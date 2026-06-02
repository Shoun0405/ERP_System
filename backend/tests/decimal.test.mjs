import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const request = require('supertest');
const app     = require('../app');
const prisma  = require('../prisma');
import { makeClient } from './helpers.mjs';

// M-2: pul maydonlari Float -> Decimal(18,2). Saqlash va SQL SUM aniq bo'lishi,
// API esa string emas, number qaytarishi kerak.
describe('Decimal pul (M-2)', () => {
  let client;

  beforeAll(async () => {
    client = await makeClient();
  });

  afterAll(async () => {
    await prisma.sale.deleteMany({ where: { clientId: client.id } });
    await prisma.payment.deleteMany({ where: { clientId: client.id } });
    await prisma.client.delete({ where: { id: client.id } });
    await prisma.$disconnect();
  });

  it('0.1 + 0.2 yig\'indisi aniq 0.3 (float drift yo\'q)', async () => {
    // Float ustunda SUM(0.1, 0.2) = 0.30000000000000004 bo'lardi.
    await prisma.sale.create({ data: {
      date: new Date(), nakladnoy: 'D-1', sellerName: 'Test',
      totalAmount: 0.1, clientId: client.id,
    }});
    await prisma.sale.create({ data: {
      date: new Date(), nakladnoy: 'D-2', sellerName: 'Test',
      totalAmount: 0.2, clientId: client.id,
    }});

    const res = await request(app).get('/api/clients').query({ search: client.name });
    expect(res.status).toBe(200);
    const row = res.body.data.find(c => c.id === client.id);
    expect(row).toBeTruthy();
    // Aniq tenglik — float bo'lsa o'tmasdi
    expect(row.totalSales).toBe(0.3);
    expect(row.debt).toBe(0.3);
  });

  it('API pul maydonlari Number qaytaradi (string emas)', async () => {
    const res = await request(app).post('/api/payments').send({
      date: new Date().toISOString().split('T')[0],
      amount: 123.45,
      clientId: client.id,
    });
    expect(res.status).toBe(200);
    expect(typeof res.body.amount).toBe('number');
    expect(res.body.amount).toBe(123.45);

    const list = await request(app).get('/api/payments').query({ clientId: client.id });
    expect(list.status).toBe(200);
    expect(typeof list.body.data[0].amount).toBe('number');
  });

  it('numeric(18,2) — 2 kasrgacha qiymat aniq round-trip bo\'ladi', async () => {
    const p = await prisma.payment.create({ data: {
      date: new Date(), amount: 1000000.99, clientId: client.id,
    }});
    expect(typeof p.amount).toBe('number');
    expect(p.amount).toBe(1000000.99);
  });
});
