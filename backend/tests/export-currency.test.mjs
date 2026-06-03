import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const request = require('supertest');
const app     = require('../app');
const prisma  = require('../prisma');
import { makeClient, makeProduct } from './helpers.mjs';

const TODAY = new Date().toISOString().split('T')[0];

describe('Eksport savdosi + valyuta (#6)', () => {
  let client, usdContract, uzsContract, product;

  beforeAll(async () => {
    client  = await makeClient({ seller: 'S1' });
    product = await makeProduct();
    usdContract = await prisma.contract.create({
      data: { number: `USD-${Date.now()}`, date: new Date('2026-01-01'), totalValue: 1_000_000, clientId: client.id, currency: 'USD', seller: 'S1' },
    });
    uzsContract = await prisma.contract.create({
      data: { number: `UZS-${Date.now()}`, date: new Date('2026-01-01'), totalValue: 1_000_000, clientId: client.id, currency: 'UZS', seller: 'S1' },
    });
  });

  afterAll(async () => {
    await prisma.saleProduct.deleteMany({ where: { sale: { clientId: client.id } } });
    await prisma.sale.deleteMany({ where: { clientId: client.id } });
    await prisma.contract.deleteMany({ where: { clientId: client.id } });
    await prisma.client.delete({ where: { id: client.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.$disconnect();
  });

  it('USD shartnoma savdosi kurssiz → 400', async () => {
    const res = await request(app).post('/api/sales').send({
      date: TODAY, nakladnoy: 'EX-NORATE', sellerName: 'S1',
      clientId: client.id, contractId: usdContract.id,
      products: [{ productId: product.id, unit: 'dona', amount: 10, price: 100 }],
    });
    expect(res.status).toBe(400);
  });

  it('USD shartnoma: totalAmount UZS = USD*kurs, currency/exchangeRate saqlanadi', async () => {
    const res = await request(app).post('/api/sales').send({
      date: TODAY, nakladnoy: 'EX-1', sellerName: 'S1',
      clientId: client.id, contractId: usdContract.id, exchangeRate: 12000,
      products: [{ productId: product.id, unit: 'dona', amount: 10, price: 100 }],
    });
    expect(res.status).toBe(200);
    expect(res.body.totalAmount).toBe(10 * 100 * 12000); // 12,000,000 UZS
    expect(res.body.currency).toBe('USD');
    expect(res.body.exchangeRate).toBe(12000);
  });

  it('UZS shartnoma: kurs shart emas, rate=1', async () => {
    const res = await request(app).post('/api/sales').send({
      date: TODAY, nakladnoy: 'DOM-1', sellerName: 'S1',
      clientId: client.id, contractId: uzsContract.id,
      products: [{ productId: product.id, unit: 'dona', amount: 10, price: 1000 }],
    });
    expect(res.status).toBe(200);
    expect(res.body.totalAmount).toBe(10000);
    expect(res.body.currency).toBe('UZS');
  });

  it('?currency=USD filtri faqat eksport savdolarini qaytaradi', async () => {
    const res = await request(app).get('/api/sales').query({ clientId: client.id, currency: 'USD', limit: 200 });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every(s => s.currency === 'USD')).toBe(true);
  });

  it('mijoz debt UZS bazada (eksport savdo qo\'shiladi)', async () => {
    const res = await request(app).get('/api/clients').query({ limit: 200 });
    const c = res.body.data.find(x => x.id === client.id);
    // 12,000,000 (USD savdo, UZS) + 10,000 (UZS savdo) = 12,010,000
    expect(c.debt).toBe(12_010_000);
  });
});
