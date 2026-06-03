import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const request = require('supertest');
const app     = require('../app');
const prisma  = require('../prisma');
import { makeClient, makeContract } from './helpers.mjs';

describe('Settings API — sotuvchi o\'chirish cheklovi (#1)', () => {
  let client, contract;
  const usedSeller = 'Ishlatilgan Sotuvchi';
  const freeSeller = 'Bo\'sh Sotuvchi';

  beforeAll(async () => {
    client = await makeClient({ seller: usedSeller });
    contract = await makeContract(client.id);
    await prisma.contract.update({ where: { id: contract.id }, data: { seller: usedSeller } });
    await prisma.setting.upsert({
      where:  { id: 'global' },
      create: { id: 'global', data: JSON.stringify({ sellers: [usedSeller, freeSeller], autoContractNumbering: false, vatRate: 0.12 }) },
      update: { data: JSON.stringify({ sellers: [usedSeller, freeSeller], autoContractNumbering: false, vatRate: 0.12 }) },
    });
  });

  afterAll(async () => {
    await prisma.contract.deleteMany({ where: { clientId: client.id } });
    await prisma.client.delete({ where: { id: client.id } });
    await prisma.$disconnect();
  });

  it('nomida shartnoma bor sotuvchini olib tashlash → 400', async () => {
    const res = await request(app).put('/api/settings').send({ sellers: [freeSeller] });
    expect(res.status).toBe(400);
  });

  it('bog\'lanmagan sotuvchini olib tashlash → 200', async () => {
    const res = await request(app).put('/api/settings').send({ sellers: [usedSeller] });
    expect(res.status).toBe(200);
  });
});
