import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const request = require('supertest');
const app     = require('../app');
const prisma  = require('../prisma');
import { makeClient, makeContract, makeProduct, cleanAll } from './helpers.mjs';

describe('ERP System End-to-End Business Integration Suite', () => {
  let clientA, clientB;
  let contractA, contractB;
  let product;

  beforeAll(async () => {
    await cleanAll();
    clientA = await makeClient({ name: 'Client A' });
    clientB = await makeClient({ name: 'Client B' });
    
    contractA = await makeContract(clientA.id);
    contractB = await makeContract(clientB.id);
    
    product = await makeProduct({ priceCbm: 100_000 });
  });

  afterAll(async () => {
    await cleanAll();
    await prisma.$disconnect();
  });

  it('1. Verify initial client debts are 0', async () => {
    const res = await request(app).get('/api/clients');
    expect(res.status).toBe(200);
    const dbClientA = res.body.data.find(c => c.id === clientA.id);
    expect(dbClientA.debt).toBe(0);
    expect(dbClientA.totalSales).toBe(0);
    expect(dbClientA.totalPayments).toBe(0);
  });

  it('2. Prevent Cross-Client Sale Mismatch (Client A with Contract B)', async () => {
    const res = await request(app).post('/api/sales').send({
      date: new Date().toISOString().split('T')[0],
      nakladnoy: 'N-ERR-1',
      sellerName: 'System Auditor',
      clientId: clientA.id,
      contractId: contractB.id, // Mismatch!
      products: [{ productId: product.id, unit: 'dona', amount: 10, price: 25_000, packType: 1 }],
    });
    // Expected behavior: API blocks mismatch
    expect(res.status).toBe(400);
  });

  it('3. Prevent Cross-Client Payment Mismatch (Client A with Contract B)', async () => {
    const res = await request(app).post('/api/payments').send({
      date: new Date().toISOString().split('T')[0],
      amount: 150_000,
      clientId: clientA.id,
      contractId: contractB.id, // Mismatch!
      note: 'Auditing security mismatch',
    });
    // Expected behavior: API blocks mismatch
    expect(res.status).toBe(400);
  });

  it('4. Correctly record Sale for Client A and check Contract A delivered amount', async () => {
    // Record valid sale for Client A
    const saleRes = await request(app).post('/api/sales').send({
      date: new Date().toISOString().split('T')[0],
      nakladnoy: 'N-VALID-1',
      sellerName: 'System Auditor',
      clientId: clientA.id,
      contractId: contractA.id, // Correct alignment
      // Narx 1 tonna uchun: 10 dona × 2.765 kg = 27.65 kg → (27.65/1000) × 20000 = 553
      products: [{ productId: product.id, unit: 'dona', amount: 10, price: 20_000, packType: 1 }],
    });
    expect(saleRes.status).toBe(200);

    // Verify Contract A aggregations
    const contractRes = await request(app).get('/api/contracts');
    const dbContractA = contractRes.body.data.find(c => c.id === contractA.id);
    expect(dbContractA.deliveredAmount).toBe(553);

    // Verify Client A debt is now 553
    const clientRes = await request(app).get('/api/clients');
    const dbClientA = clientRes.body.data.find(c => c.id === clientA.id);
    expect(dbClientA.totalSales).toBe(553);
    expect(dbClientA.debt).toBe(553);
  });

  it('5. Correctly record Payment for Client A and verify Contract A paid amount', async () => {
    // Record valid payment for Client A on Contract A
    const payRes = await request(app).post('/api/payments').send({
      date: new Date().toISOString().split('T')[0],
      amount: 200,
      clientId: clientA.id,
      contractId: contractA.id, // Correct alignment
      note: 'Client payment'
    });
    expect(payRes.status).toBe(200);

    // Verify Contract A aggregations
    const contractRes = await request(app).get('/api/contracts');
    const dbContractA = contractRes.body.data.find(c => c.id === contractA.id);
    expect(dbContractA.paidAmount).toBe(200);

    // Verify Client A debt is reduced to 353
    const clientRes = await request(app).get('/api/clients');
    const dbClientA = clientRes.body.data.find(c => c.id === clientA.id);
    expect(dbClientA.totalPayments).toBe(200);
    expect(dbClientA.debt).toBe(353); // 553 - 200
  });

  it('6. Block Contract Deletion when Sales are linked', async () => {
    const res = await request(app).delete(`/api/contracts/${contractA.id}`);
    expect(res.status).toBe(409); // Correctly blocked
  });
});
