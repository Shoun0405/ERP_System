import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const request = require('supertest');
const app     = require('../app');
const prisma  = require('../prisma');
import { makeClient, makeContract } from './helpers.mjs';

describe('Payments API', () => {
  let client, contract, paymentId;

  beforeAll(async () => {
    client   = await makeClient();
    contract = await makeContract(client.id);
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { clientId: client.id } });
    await prisma.contract.delete({ where: { id: contract.id } });
    await prisma.client.delete({ where: { id: client.id } });
    await prisma.$disconnect();
  });

  it('POST / — to\'lov kiritish', async () => {
    const res = await request(app).post('/api/payments').send({
      date:       new Date().toISOString().split('T')[0],
      amount:     500_000,
      note:       'Test to\'lov',
      clientId:   client.id,
      contractId: contract.id,
    });
    expect(res.status).toBe(200);
    expect(res.body.amount).toBe(500_000);
    paymentId = res.body.id;
  });

  it('GET / — ro\'yxat', async () => {
    const res = await request(app).get('/api/payments');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /?clientId= — mijoz filtri', async () => {
    const res = await request(app).get('/api/payments').query({ clientId: client.id });
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
  });

  it('POST / — manfiy summa → 400', async () => {
    const res = await request(app).post('/api/payments').send({
      date: new Date().toISOString().split('T')[0],
      amount: -100, clientId: client.id, contractId: contract.id,
    });
    expect(res.status).toBe(400);
  });

  it('DELETE /:id', async () => {
    const res = await request(app).delete(`/api/payments/${paymentId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
