import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const request = require('supertest');
const app     = require('../app');
const prisma  = require('../prisma');
import { makeClient, makeContract, makeProduct } from './helpers.mjs';

// Supertest/superagent binar (xlsx/zip) javobni Buffer ga yig'adi.
// Aks holda res.body Buffer bo'lmaydi va magic-bytes tekshiruvi ishlamaydi.
function binaryParser(res, cb) {
  const chunks = [];
  res.on('data', c => chunks.push(Buffer.from(c)));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
}

// H-6: Batch ZIP eksport + frontend xlsx → backend exceljs ko'chirish.
describe('Export API (H-6)', () => {
  let client, contract, product, sale1, sale2;

  beforeAll(async () => {
    client   = await makeClient();
    contract = await makeContract(client.id);
    product  = await makeProduct();

    sale1 = await prisma.sale.create({ data: {
      date: new Date('2026-01-10T10:00:00Z'), nakladnoy: 'ZIP-1', sellerName: 'Sotuvchi A',
      totalAmount: 1_000_000, clientId: client.id, contractId: contract.id,
      products: { create: [{
        productId: product.id, packType: 1, totalPieces: 10,
        totalCbm: 0.3, totalKg: 27.6, totalSqm: 28.8, priceCbm: product.priceCbm, rowAmount: 1_000_000,
      }] },
    }});
    sale2 = await prisma.sale.create({ data: {
      date: new Date('2026-01-12T10:00:00Z'), nakladnoy: 'ZIP-2', sellerName: 'Sotuvchi B',
      totalAmount: 500_000, clientId: client.id, contractId: contract.id,
    }});
  });

  afterAll(async () => {
    await prisma.saleProduct.deleteMany({ where: { sale: { clientId: client.id } } });
    await prisma.sale.deleteMany({ where: { clientId: client.id } });
    await prisma.contract.delete({ where: { id: contract.id } });
    await prisma.client.delete({ where: { id: client.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.$disconnect();
  });

  // ── sales/zip ──────────────────────────────────────────────────────────────
  it('sales/zip — ids bilan 200 + application/zip', async () => {
    const res = await request(app)
      .get('/api/export/sales/zip')
      .query({ ids: `${sale1.id},${sale2.id}` })
      .buffer(true)
      .parse(binaryParser);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/zip');
    expect(res.headers['content-disposition']).toContain('savdolar.zip');
    // ZIP magic bytes "PK"
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.slice(0, 2).toString('latin1')).toBe('PK');
  });

  it('sales/zip — bo\'sh ids → 400', async () => {
    const res = await request(app).get('/api/export/sales/zip');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('sales/zip — ids > 500 → 400', async () => {
    const ids = Array.from({ length: 501 }, (_, i) => `id-${i}`).join(',');
    const res = await request(app).get('/api/export/sales/zip').query({ ids });
    expect(res.status).toBe(400);
  });

  // ── contracts/zip ────────────────────────────────────────────────────────────
  it('contracts/zip — ids bilan 200 + application/zip', async () => {
    const res = await request(app)
      .get('/api/export/contracts/zip')
      .query({ ids: contract.id })
      .buffer(true)
      .parse(binaryParser);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/zip');
    expect(res.headers['content-disposition']).toContain('shartnomalar.zip');
    expect(res.body.slice(0, 2).toString('latin1')).toBe('PK');
  });

  it('contracts/zip — ids > 500 → 400', async () => {
    const ids = Array.from({ length: 501 }, (_, i) => `id-${i}`).join(',');
    const res = await request(app).get('/api/export/contracts/zip').query({ ids });
    expect(res.status).toBe(400);
  });

  // ── clients/excel ────────────────────────────────────────────────────────────
  it('clients/excel — 200 + xlsx content-type', async () => {
    const res = await request(app)
      .get('/api/export/clients/excel')
      .query({ search: client.name })
      .buffer(true)
      .parse(binaryParser);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.headers['content-disposition']).toContain('.xlsx');
    // XLSX is a ZIP archive → starts with "PK"
    expect(res.body.slice(0, 2).toString('latin1')).toBe('PK');
  });

  it('clients/excel — debtFilter=qarzdorlar 200', async () => {
    const res = await request(app)
      .get('/api/export/clients/excel')
      .query({ debtFilter: 'qarzdorlar', sortBy: 'debt', sortDir: 'desc' })
      .buffer(true)
      .parse(binaryParser);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
  });

  // ── dashboard/monthly-excel ──────────────────────────────────────────────────
  it('dashboard/monthly-excel — 200 + xlsx content-type', async () => {
    const res = await request(app)
      .get('/api/export/dashboard/monthly-excel')
      .buffer(true)
      .parse(binaryParser);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.headers['content-disposition']).toContain('.xlsx');
    expect(res.body.slice(0, 2).toString('latin1')).toBe('PK');
  });
});
