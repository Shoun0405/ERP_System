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

  it('POST / — savdo yaratish (tranzaksiya)', async () => {
    const res = await request(app).post('/api/sales').send({
      date:         new Date().toISOString().split('T')[0],
      nakladnoy:    'T-001',
      sellerName:   'Test Sotuvchi',
      transportNum: '',
      clientId:     client.id,
      contractId:   contract.id,
      products:     [{
        productId:   product.id,
        packType:    1,
        totalPieces: 10,
        totalCbm:    +(10 * product.cbmPerPce).toFixed(6),
        totalKg:     +(10 * product.kgPerPce).toFixed(3),
        totalSqm:    +(10 * product.sqmPerPce).toFixed(4),
        priceCbm:    product.priceCbm,
        rowAmount:   +(10 * product.cbmPerPce * product.priceCbm).toFixed(0),
      }],
    });
    expect(res.status).toBe(200);
    expect(res.body.clientId).toBe(client.id);
    saleId = res.body.id;
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

  it('POST / — priceCbm=0 → 400', async () => {
    const res = await request(app).post('/api/sales').send({
      date: new Date().toISOString().split('T')[0],
      nakladnoy: 'T-002', sellerName: 'Test',
      clientId: client.id, contractId: contract.id,
      products: [{ productId: product.id, packType: 1, totalPieces: 1,
        totalCbm: 0.03, totalKg: 2.76, totalSqm: 2.88, priceCbm: 0, rowAmount: 0 }],
    });
    expect(res.status).toBe(400);
  });

  it('DELETE /:id', async () => {
    const res = await request(app).delete(`/api/sales/${saleId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
