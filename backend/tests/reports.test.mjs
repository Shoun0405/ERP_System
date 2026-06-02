import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const request = require('supertest');
const app     = require('../app');
const prisma  = require('../prisma');
import { makeClient, makeContract } from './helpers.mjs';

// H-5: hisobot optimizatsiyasi + yangi hisobotlar (vat-report, sales-by-seller).
// Running balance SQL window funksiyada (SUM(signed) OVER ORDER BY date,...).
describe('Reports API (H-5)', () => {
  let client, contract;

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

  beforeAll(async () => {
    client   = await makeClient();
    contract = await makeContract(client.id);

    // Xronologik aniq ketma-ketlik (running balance tekshirish uchun):
    //   01-10 Savdo  1,000,000  → balans 1,000,000
    //   01-15 To'lov   400,000  → balans   600,000
    //   01-20 Savdo    500,000  → balans 1,100,000
    //   01-25 To'lov   600,000  → balans   500,000
    await prisma.sale.create({ data: {
      date: new Date('2026-01-10T10:00:00Z'), nakladnoy: 'R-1', sellerName: 'Sotuvchi A',
      totalAmount: 1_000_000, clientId: client.id, contractId: contract.id,
    }});
    await prisma.payment.create({ data: {
      date: new Date('2026-01-15T10:00:00Z'), amount: 400_000,
      clientId: client.id, contractId: contract.id,
    }});
    await prisma.sale.create({ data: {
      date: new Date('2026-01-20T10:00:00Z'), nakladnoy: 'R-2', sellerName: 'Sotuvchi B',
      totalAmount: 500_000, clientId: client.id, contractId: contract.id,
    }});
    await prisma.payment.create({ data: {
      date: new Date('2026-01-25T10:00:00Z'), amount: 600_000,
      clientId: client.id, contractId: contract.id,
    }});
  });

  afterAll(async () => {
    await prisma.sale.deleteMany({ where: { clientId: client.id } });
    await prisma.payment.deleteMany({ where: { clientId: client.id } });
    await prisma.contract.delete({ where: { id: contract.id } });
    await prisma.client.delete({ where: { id: client.id } });
    await prisma.$disconnect();
  });

  // ── Running balance (window funksiya) ───────────────────────────────────────
  it('client-statement — running balance savdo+to\'lov ketma-ketligida to\'g\'ri', async () => {
    const res = await request(app).get(`/api/reports/client-statement/${client.id}`);
    expect(res.status).toBe(200);

    const st = res.body.statement;
    expect(st.length).toBe(4);

    // Xronologik tartib va kümülativ balans
    expect(st[0].debit).toBe(1_000_000);
    expect(st[0].balance).toBe(1_000_000);

    expect(st[1].credit).toBe(400_000);
    expect(st[1].balance).toBe(600_000);

    expect(st[2].debit).toBe(500_000);
    expect(st[2].balance).toBe(1_100_000);

    expect(st[3].credit).toBe(600_000);
    expect(st[3].balance).toBe(500_000);

    // Yakuniy saldo = jami savdo − jami to'lov
    expect(res.body.finalBalance).toBe(500_000);
  });

  it('client-statement — ?from=&to= oraliq harakatlarni filtrlaydi', async () => {
    // Faqat 01-14 .. 01-21 oralig'i → 01-15 to'lov va 01-20 savdo (2 ta yozuv)
    const res = await request(app)
      .get(`/api/reports/client-statement/${client.id}`)
      .query({ from: '2026-01-14', to: '2026-01-21' });
    expect(res.status).toBe(200);
    expect(res.body.statement.length).toBe(2);
    // Oraliq ichida balans nolldan boshlanadi: −400,000 keyin +100,000
    expect(res.body.statement[0].balance).toBe(-400_000);
    expect(res.body.statement[1].balance).toBe(100_000);
  });

  it('client-statement — mavjud bo\'lmagan mijoz → 404', async () => {
    const res = await request(app).get('/api/reports/client-statement/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  it('client-by-contracts — shartnoma bo\'yicha running balance', async () => {
    const res = await request(app).get(`/api/reports/client-by-contracts/${client.id}`);
    expect(res.status).toBe(200);
    expect(res.body.groups.length).toBe(1);
    const g = res.body.groups[0];
    expect(g.contract.number).toBe(contract.number);
    expect(g.statement.length).toBe(4);
    expect(g.finalBalance).toBe(500_000);
    expect(res.body.totalBalance).toBe(500_000);
  });

  // ── VAT report ──────────────────────────────────────────────────────────────
  it('vat-report — QQS summasi 0.12 stavkada to\'g\'ri', async () => {
    await setVatRate(0.12);
    const res = await request(app)
      .get('/api/reports/vat-report')
      .query({ from: '2026-01-01', to: '2026-01-31' });
    expect(res.status).toBe(200);

    // Jami savdo = 1,000,000 + 500,000 = 1,500,000 (QQS ichida)
    expect(res.body.vatRate).toBe(0.12);
    expect(res.body.totalAmount).toBe(1_500_000);
    expect(res.body.salesCount).toBe(2);

    // QQS = 1,500,000 / 1.12 * 0.12 = 160714.2857... → 160714.29
    expect(res.body.vatAmount).toBeCloseTo(160714.29, 2);
    // QQS siz = total − QQS
    expect(res.body.netAmount).toBeCloseTo(1_500_000 - 160714.29, 2);

    // Oylik breakdown: 2026-01 bo'lishi kerak
    const jan = res.body.byMonth.find(m => m.month === '2026-01');
    expect(jan).toBeTruthy();
    expect(jan.totalAmount).toBe(1_500_000);
    expect(jan.vatAmount).toBeCloseTo(160714.29, 2);
  });

  // ── Sales by seller ─────────────────────────────────────────────────────────
  it('sales-by-seller — sotuvchi bo\'yicha guruhlash, oborot kamayishi', async () => {
    const res = await request(app)
      .get('/api/reports/sales-by-seller')
      .query({ from: '2026-01-01', to: '2026-01-31' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const a = res.body.find(r => r.sellerName === 'Sotuvchi A');
    const b = res.body.find(r => r.sellerName === 'Sotuvchi B');
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a.salesCount).toBe(1);
    expect(a.totalAmount).toBe(1_000_000);
    expect(b.totalAmount).toBe(500_000);

    // Oborot kamayish tartibida: A (1M) B dan (500K) oldin
    const idxA = res.body.findIndex(r => r.sellerName === 'Sotuvchi A');
    const idxB = res.body.findIndex(r => r.sellerName === 'Sotuvchi B');
    expect(idxA).toBeLessThan(idxB);
  });

  // ── Export ids cheklash ─────────────────────────────────────────────────────
  it('export sales/pdf — ids > 500 → 400', async () => {
    const ids = Array.from({ length: 501 }, (_, i) => `id-${i}`).join(',');
    const res = await request(app).get('/api/export/sales/pdf').query({ ids });
    expect(res.status).toBe(400);
  });

  it('export sales/excel — ids > 500 → 400', async () => {
    const ids = Array.from({ length: 501 }, (_, i) => `id-${i}`).join(',');
    const res = await request(app).get('/api/export/sales/excel').query({ ids });
    expect(res.status).toBe(400);
  });
});
