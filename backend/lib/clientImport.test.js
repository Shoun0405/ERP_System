// vitest `globals: true` (vitest.config.mjs) — describe/it/expect global.
// CommonJS modulda `require('vitest')` ishlamaydi, shuning uchun importsiz.
const ExcelJS = require('exceljs');
const { parseClientsXlsx, categorize, COMPLETENESS_FIELDS } = require('./clientImport');

// Sarlavha + qatorlardan xotirada .xlsx buffer yasaydi.
// headers: ustun sarlavhalari massivi; rows: har biri massiv (ustun tartibida).
async function buildXlsx(headers, rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Mijozlar');
  ws.addRow(headers);
  rows.forEach(r => ws.addRow(r));
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

const HEADERS = ['Nomi', 'STIR', 'Telefon', 'Direktor', 'Manzil', 'Hisob raqami', 'MFO', 'Bank', 'Sotuvchi'];
const FULL = ['Alfa MChJ', '111111111', '901112233', 'Aliyev', 'Toshkent', '20208000000000000001', '00014', 'Ipoteka', 'Vali'];

describe('parseClientsXlsx', () => {
  it("'Nomi' sarlavhasi bo'lmasa headerOk=false", async () => {
    const buf = await buildXlsx(['STIR', 'Telefon'], [['111', '901']]);
    const { headerOk } = await parseClientsXlsx(buf);
    expect(headerOk).toBe(false);
  });

  it("sarlavha tartibi muhim emas — maydonlarni to'g'ri o'qiydi", async () => {
    const buf = await buildXlsx(['STIR', 'Nomi'], [['222', 'Beta MChJ']]);
    const { headerOk, rows } = await parseClientsXlsx(buf);
    expect(headerOk).toBe(true);
    expect(rows[0].raw.name).toBe('Beta MChJ');
    expect(rows[0].raw.inn).toBe('222');
    expect(rows[0].rowNum).toBe(2);
  });

  it("butunlay bo'sh qatorlarni o'tkazib yuboradi", async () => {
    const buf = await buildXlsx(HEADERS, [FULL, ['', '', '', '', '', '', '', '', ''], ['Gamma', '', '', '', '', '', '', '', '']]);
    const { rows } = await parseClientsXlsx(buf);
    expect(rows).toHaveLength(2);
  });

  it("birinchi varaq o'qiladi (qo'shimcha varaqlar bo'lsa ham)", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Mijozlar');
    ws.addRow(HEADERS);
    ws.addRow(FULL);
    wb.addWorksheet("Yo'riqnoma").addRow(['Yordam matni']);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const { headerOk, rows } = await parseClientsXlsx(buf);
    expect(headerOk).toBe(true);
    expect(rows).toHaveLength(1);
    expect(rows[0].raw.name).toBe('Alfa MChJ');
  });

  it("sarlavhada ortiqcha bo'shliq bo'lsa ham ustun topiladi", async () => {
    const buf = await buildXlsx([' Nomi ', '  STIR'], [['Beta', '222']]);
    const { headerOk, rows } = await parseClientsXlsx(buf);
    expect(headerOk).toBe(true);
    expect(rows[0].raw.name).toBe('Beta');
    expect(rows[0].raw.inn).toBe('222');
  });
});

describe('categorize', () => {
  it("to'liq to'g'ri qator → valid", async () => {
    const { rows } = await parseClientsXlsx(await buildXlsx(HEADERS, [FULL]));
    const out = categorize(rows, new Set());
    expect(out[0].category).toBe('valid');
    expect(out[0].data.name).toBe('Alfa MChJ');
    expect(out[0].data.status).toBe('Yangi');
  });

  it("to'liqlik maydoni bo'sh → incomplete", async () => {
    const noDirector = ['Alfa MChJ', '111111111', '901112233', '', 'Toshkent', '20208000000000000001', '00014', 'Ipoteka', 'Vali'];
    const { rows } = await parseClientsXlsx(await buildXlsx(HEADERS, [noDirector]));
    const out = categorize(rows, new Set());
    expect(out[0].category).toBe('incomplete');
  });

  it("nomi bo'sh → error", async () => {
    const noName = ['', '111111111', '', '', '', '', '', '', ''];
    const { rows } = await parseClientsXlsx(await buildXlsx(HEADERS, [noName]));
    const out = categorize(rows, new Set());
    expect(out[0].category).toBe('error');
  });

  it("STIR bazada mavjud → duplicate", async () => {
    const { rows } = await parseClientsXlsx(await buildXlsx(HEADERS, [FULL]));
    const out = categorize(rows, new Set(['111111111']));
    expect(out[0].category).toBe('duplicate');
    expect(out[0].reason).toMatch(/STIR/);
  });

  it("fayl ichida takror STIR → birinchisi o'tadi, ikkinchisi error", async () => {
    const a = ['Alfa', '333', '', 'D', 'A', 'ACC', '00014', 'B', 'S'];
    const b = ['Beta', '333', '', 'D', 'A', 'ACC', '00014', 'B', 'S'];
    const { rows } = await parseClientsXlsx(await buildXlsx(HEADERS, [a, b]));
    const out = categorize(rows, new Set());
    expect(out[0].category).toBe('valid');
    expect(out[1].category).toBe('error');
    expect(out[1].reason).toMatch(/fayl/i);
  });

  it("MFO 5 belgidan uzun → error", async () => {
    const badMfo = ['Alfa', '444', '', 'D', 'A', 'ACC', '123456', 'B', 'S'];
    const { rows } = await parseClientsXlsx(await buildXlsx(HEADERS, [badMfo]));
    const out = categorize(rows, new Set());
    expect(out[0].category).toBe('error');
  });

  it("hisob raqami 20 belgidan uzun → error (account)", async () => {
    const longAcc = ['Alfa', '555', '', 'D', 'A', '123456789012345678901', '00014', 'B', 'S']; // 21 belgi
    const { rows } = await parseClientsXlsx(await buildXlsx(HEADERS, [longAcc]));
    const out = categorize(rows, new Set());
    expect(out[0].category).toBe('error');
    expect(out[0].reason).toMatch(/account/i);
  });

  it("STIR 30 belgidan uzun → error (inn)", async () => {
    const longInn = ['Alfa', '1234567890123456789012345678901', '', 'D', 'A', 'ACC', '00014', 'B', 'S']; // 31 belgi
    const { rows } = await parseClientsXlsx(await buildXlsx(HEADERS, [longInn]));
    const out = categorize(rows, new Set());
    expect(out[0].category).toBe('error');
    expect(out[0].reason).toMatch(/inn/i);
  });

  it("raqamli (matn emas) uzun hisob raqami aniqligini yo'qotsa → error", async () => {
    // 20 xonali hisob raqamini SON sifatida kiritish — JS float aniqligini yo'qotadi
    const numericAcc = ['Alfa MChJ', '111111111', '901112233', 'Aliyev', 'Toshkent', 20208000000000000001, '00014', 'Ipoteka', 'Vali'];
    const { rows } = await parseClientsXlsx(await buildXlsx(HEADERS, [numericAcc]));
    const out = categorize(rows, new Set());
    expect(out[0].category).toBe('error');
    expect(out[0].reason).toMatch(/MATN formatida/i);
  });

  it("qisqa raqamli STIR (xavfsiz butun son) → buzilmaydi, normal toifalanadi", async () => {
    // 9 xonali STIR son sifatida — Number.isSafeInteger → aniqlik yo'qolmaydi
    const numericInn = ['Alfa MChJ', 123456789, '901112233', 'Aliyev', 'Toshkent', '20208000000000000001', '00014', 'Ipoteka', 'Vali'];
    const { rows } = await parseClientsXlsx(await buildXlsx(HEADERS, [numericInn]));
    const out = categorize(rows, new Set());
    expect(out[0].category).toBe('valid');
    expect(out[0].data.inn).toBe('123456789');
  });

  it('COMPLETENESS_FIELDS phone ni o\'z ichiga olmaydi', () => {
    expect(COMPLETENESS_FIELDS).not.toContain('phone');
    expect(COMPLETENESS_FIELDS).toContain('inn');
  });
});
