// vitest `globals: true` (vitest.config.mjs) — describe/it/expect/beforeAll/afterAll global.
// CommonJS modulda `require('vitest')` ishlamaydi, shuning uchun importsiz.
const ExcelJS = require('exceljs');

// Auth bypass (middleware/auth.js M-1) — require'dan OLDIN o'rnatilishi shart.
// (tests/env-setup.mjs ham o'rnatadi; bu yerda ortiqcha himoya uchun.)
process.env.NODE_ENV = 'test';
process.env.TEST_AUTH_BYPASS = '1';

const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../app');
const prisma = require('../prisma');

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const HEADERS = ['Nomi', 'STIR', 'Telefon', 'Direktor', 'Manzil', 'Hisob raqami', 'MFO', 'Bank', 'Sotuvchi'];
// Test STIR prefiksi — tozalash uchun (real ma'lumotga tegmaymiz)
const TST = 'TST900';

async function xlsx(headers, rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Mijozlar');
  ws.addRow(headers);
  rows.forEach(r => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// Binar (.xlsx) javobni Buffer ga yig'ish — supertest standart parser .xlsx ni
// tushunmaydi, shu sabab res.body ni o'zimiz Buffer qilamiz.
function bufferBinary(res, cb) {
  const chunks = [];
  res.on('data', c => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
}

async function cleanup() {
  await prisma.client.deleteMany({ where: { inn: { startsWith: TST } } });
}

beforeAll(cleanup);
afterAll(async () => { await cleanup(); await prisma.$disconnect(); });

describe('GET /api/clients/import/template', () => {
  it('200 + xlsx mime qaytaradi', async () => {
    const res = await request(app).get('/api/clients/import/template').buffer(true).parse(bufferBinary);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.body.length).toBeGreaterThan(0);
  });
});

describe('POST /api/clients/import/preview', () => {
  it("yaroqsiz fayl → 400", async () => {
    const res = await request(app)
      .post('/api/clients/import/preview')
      .set('Content-Type', XLSX_MIME)
      .send(Buffer.from('not an excel file'));
    expect(res.status).toBe(400);
  });

  it("'Nomi' ustuni yo'q → 400", async () => {
    const buf = await xlsx(['STIR', 'Telefon'], [['111', '901']]);
    const res = await request(app)
      .post('/api/clients/import/preview')
      .set('Content-Type', XLSX_MIME)
      .send(buf);
    expect(res.status).toBe(400);
  });

  it("noto'g'ri Content-Type (JSON) → 400", async () => {
    const res = await request(app)
      .post('/api/clients/import/preview')
      .send({ not: 'a file' }); // application/json
    expect(res.status).toBe(400);
  });

  it("sarlavha bor, ma'lumot yo'q → 200, summary.total 0", async () => {
    const buf = await xlsx(HEADERS, []);
    const res = await request(app)
      .post('/api/clients/import/preview')
      .set('Content-Type', XLSX_MIME)
      .send(buf);
    expect(res.status).toBe(200);
    expect(res.body.summary.total).toBe(0);
  });

  it("to'g'ri faylni toifalaydi", async () => {
    const buf = await xlsx(HEADERS, [
      ['Alfa MChJ', `${TST}001`, '901112233', 'Aliyev', 'Toshkent', '20208000000000000001', '00014', 'Ipoteka', 'Vali'],
      ['', `${TST}002`, '', '', '', '', '', '', ''], // nomi yo'q → error
    ]);
    const res = await request(app)
      .post('/api/clients/import/preview')
      .set('Content-Type', XLSX_MIME)
      .send(buf);
    expect(res.status).toBe(200);
    expect(res.body.summary.valid).toBe(1);
    expect(res.body.summary.error).toBe(1);
  });
});

describe('POST /api/clients/import/commit', () => {
  it("yangi mijozlarni qo'shadi", async () => {
    const clients = [{ name: 'Commit Test MChJ', inn: `${TST}050` }];
    const res = await request(app)
      .post('/api/clients/import/commit')
      .send({ clients });
    expect(res.status).toBe(200);
    expect(res.body.inserted).toBe(1);

    const found = await prisma.client.findUnique({ where: { inn: `${TST}050` } });
    expect(found).not.toBeNull();
    expect(found.name).toBe('Commit Test MChJ');
  });

  it("mavjud STIR ni o'tkazib yuboradi (skip)", async () => {
    await prisma.client.create({ data: { name: 'Mavjud', inn: `${TST}060` } });
    const res = await request(app)
      .post('/api/clients/import/commit')
      .send({ clients: [{ name: 'Takror', inn: `${TST}060` }] });
    expect(res.status).toBe(200);
    expect(res.body.inserted).toBe(0);
    expect(res.body.skippedDuplicate).toBe(1);
  });

  it("bitta payload ichida takror STIR → faqat bittasi qo'shiladi", async () => {
    const res = await request(app)
      .post('/api/clients/import/commit')
      .send({ clients: [
        { name: 'Dup A', inn: `${TST}070` },
        { name: 'Dup B', inn: `${TST}070` },
      ] });
    expect(res.status).toBe(200);
    expect(res.body.inserted).toBe(1);
    expect(res.body.skippedDuplicate).toBe(1);
    const count = await prisma.client.count({ where: { inn: `${TST}070` } });
    expect(count).toBe(1);
  });

  it("bo'sh clients massivi → 400", async () => {
    const res = await request(app).post('/api/clients/import/commit').send({ clients: [] });
    expect(res.status).toBe(400);
  });
});

// requirePermission('clients','create') guardini real token bilan tekshiramiz
// (TEST_AUTH_BYPASS ni x-bypass-auth: false bilan o'chiramiz — rbac.test.mjs naqshi).
describe('Import RBAC — clients:create huquqi', () => {
  const password = 'password123';
  const denyUsername = `imp_deny_${Date.now()}`;
  let denyId, denyCookie;

  beforeAll(async () => {
    const hash = await bcrypt.hash(password, 10);
    const deny = await prisma.user.create({
      data: {
        username: denyUsername, password: hash, role: 'user',
        permissions: { clients: { read: true, create: false, update: false, delete: false } },
      },
    });
    denyId = deny.id;
    const res = await request(app).post('/api/auth/login').send({ username: denyUsername, password });
    denyCookie = res.headers['set-cookie'][0];
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: denyId } });
  });

  it('create:false → GET /import/template 403', async () => {
    const res = await request(app).get('/api/clients/import/template')
      .set('x-bypass-auth', 'false').set('Cookie', denyCookie);
    expect(res.status).toBe(403);
  });

  it('create:false → POST /import/preview 403', async () => {
    const buf = await xlsx(HEADERS, [['Alfa', `${TST}900`, '', '', '', '', '', '', '']]);
    const res = await request(app).post('/api/clients/import/preview')
      .set('x-bypass-auth', 'false').set('Cookie', denyCookie)
      .set('Content-Type', XLSX_MIME).send(buf);
    expect(res.status).toBe(403);
  });

  it('create:false → POST /import/commit 403', async () => {
    const res = await request(app).post('/api/clients/import/commit')
      .set('x-bypass-auth', 'false').set('Cookie', denyCookie)
      .send({ clients: [{ name: 'X', inn: `${TST}901` }] });
    expect(res.status).toBe(403);
  });
});
