# Clients Excel Import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Foydalanuvchi saytdan Excel shablon yuklab olib, mijozlarni to'ldirib, qaytadan yuklaydi; tizim tekshirib, interaktiv preview ko'rsatadi va tasdiqlangach bazaga qo'shadi.

**Architecture:** Backend'da 3 endpoint (`/import/template` GET, `/import/preview` POST raw `.xlsx`, `/import/commit` POST JSON). Parse + toifalash mantiqi `backend/lib/clientImport.js` da (pure, DB'siz) — preview va commit ikkalasida reuse. Frontend'da `ClientImportModal.jsx` per-qator tanlov bilan. Hech qachon DB ga preview'da yozilmaydi; commit tasdiqlangan qatorlarni `createMany({ skipDuplicates })` bilan qo'shadi.

**Tech Stack:** Express 5 (`express.raw`), ExcelJS, Prisma 6 (PostgreSQL), Zod, React 19, axios, react-hot-toast, react-i18next, vitest + supertest.

**Spec:** `docs/superpowers/specs/2026-06-09-clients-excel-import-design.md`

---

## Pre-work: Branch

- [ ] **Create a feature branch** (repo hozir `main` da ishlaydi):

```bash
git checkout -b feat/clients-excel-import
```

---

## File Structure

**Yangi:**
- `backend/lib/clientImport.js` — parse (`parseClientsXlsx`) + toifalash (`categorize`). Pure, DB'siz.
- `backend/lib/clientImport.test.js` — vitest unit testlar.
- `backend/routes/clients.import.test.js` — supertest integration testlar.
- `frontend/src/pages/ClientImportModal.jsx` — import modali (fayl tanlash, preview, tasdiqlash).

**O'zgartiriladi:**
- `backend/routes/clients.js` — top require'lar + 3 import endpoint.
- `frontend/src/pages/Clients.jsx` — 2 toolbar tugmasi + modal ulanishi.
- `frontend/src/i18n/locales/uz.json`, `ru.json`, `zh.json` — `clients.import.*` kalitlari.
- `TEXNIK_VAZIFA.md` — bosqich qaydi.

---

## Task 1: `clientImport.js` lib + unit tests (pure logic, DB'siz)

**Files:**
- Create: `backend/lib/clientImport.js`
- Test: `backend/lib/clientImport.test.js`

- [ ] **Step 1: Write the failing test**

Create `backend/lib/clientImport.test.js`:

```js
const { describe, it, expect } = require('vitest');
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

  it('COMPLETENESS_FIELDS phone ni o\'z ichiga olmaydi', () => {
    expect(COMPLETENESS_FIELDS).not.toContain('phone');
    expect(COMPLETENESS_FIELDS).toContain('inn');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run lib/clientImport.test.js`
Expected: FAIL — `Cannot find module './clientImport'`.

- [ ] **Step 3: Write minimal implementation**

Create `backend/lib/clientImport.js`:

```js
const ExcelJS = require('exceljs');
const { clientSchema } = require('../routes/_schemas');

// Excel sarlavhasi (kichik harf) → Client maydoni
const HEADER_TO_FIELD = {
  'nomi': 'name',
  'stir': 'inn',
  'telefon': 'phone',
  'direktor': 'director',
  'manzil': 'address',
  'hisob raqami': 'account',
  'mfo': 'mfo',
  'bank': 'bank',
  'sotuvchi': 'seller',
};

// "To'liqlik" uchun tekshiriladigan maydonlar (name majburiy; phone hisobga olinmaydi)
const COMPLETENESS_FIELDS = ['inn', 'director', 'address', 'account', 'mfo', 'bank', 'seller'];

const EMPTY_RAW = () => ({
  name: '', inn: '', phone: '', director: '', address: '',
  account: '', mfo: '', bank: '', seller: '',
});

// ExcelJS katak qiymatini matnga aylantiradi. Raqam/forma/rich-text holatlarini ham qamraydi.
// Uzun raqamlar (STIR/hisob) shablonda matn formatida — shu sabab String() yetarli.
function cellText(cell) {
  const v = cell == null ? null : cell.value;
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v.text != null) return String(v.text).trim();      // rich text / hyperlink
    if (v.result != null) return String(v.result).trim();  // formula natijasi
    return String(v).trim();
  }
  return String(v).trim();
}

// Buffer (.xlsx) → { headerOk, rows: [{ rowNum, raw }] }
// headerOk=false agar 'Nomi' ustuni topilmasa.
async function parseClientsXlsx(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return { headerOk: false, rows: [] };

  const colField = {}; // colNumber → field
  ws.getRow(1).eachCell((cell, colNumber) => {
    const key = cellText(cell).toLowerCase();
    if (HEADER_TO_FIELD[key]) colField[colNumber] = HEADER_TO_FIELD[key];
  });

  if (!Object.values(colField).includes('name')) {
    return { headerOk: false, rows: [] };
  }

  const rows = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // sarlavha
    const raw = EMPTY_RAW();
    let hasAny = false;
    for (const [col, field] of Object.entries(colField)) {
      const txt = cellText(row.getCell(Number(col)));
      raw[field] = txt;
      if (txt) hasAny = true;
    }
    if (hasAny) rows.push({ rowNum: rowNumber, raw });
  });

  return { headerOk: true, rows };
}

// rows (parseClientsXlsx natijasi) + existingInns (Set) → toifalangan qatorlar.
// existingInns @unique cheklovi bo'yicha — soft-delete qilinganlar ham kiradi.
function categorize(rows, existingInns) {
  const seen = new Set(); // fayl ichidagi STIR takrorini aniqlash
  return rows.map(({ rowNum, raw }) => {
    const name = (raw.name || '').trim();
    if (!name) {
      return { rowNum, name: '', inn: raw.inn || '', category: 'error', reason: "Nomi (tashkilot nomi) bo'sh", data: null };
    }

    let data;
    try {
      data = clientSchema.parse(raw);
    } catch (e) {
      const issue = e?.issues?.[0];
      const field = issue?.path?.join('.') || '';
      const msg = issue?.message || "Qiymat noto'g'ri";
      return { rowNum, name, inn: raw.inn || '', category: 'error', reason: field ? `${field}: ${msg}` : msg, data: null };
    }

    const inn = data.inn; // null yoki string
    if (inn) {
      if (existingInns.has(inn)) {
        return { rowNum, name, inn, category: 'duplicate', reason: 'STIR bazada allaqachon mavjud', data: null };
      }
      if (seen.has(inn)) {
        return { rowNum, name, inn, category: 'error', reason: 'STIR fayl ichida takrorlangan', data: null };
      }
      seen.add(inn);
    }

    const incomplete = COMPLETENESS_FIELDS.some(f => !String(raw[f] ?? '').trim());
    return { rowNum, name, inn: inn || '', category: incomplete ? 'incomplete' : 'valid', reason: null, data };
  });
}

module.exports = { parseClientsXlsx, categorize, COMPLETENESS_FIELDS, HEADER_TO_FIELD };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run lib/clientImport.test.js`
Expected: PASS — barcha testlar yashil.

- [ ] **Step 5: Commit**

```bash
git add backend/lib/clientImport.js backend/lib/clientImport.test.js
git commit -m "feat(clients): Excel import parse+categorize lib (clientImport.js) + tests"
```

---

## Task 2: Backend endpoints (`/import/template`, `/import/preview`, `/import/commit`)

**Files:**
- Modify: `backend/routes/clients.js` (top require'lar 1-6; import block GET '/' dan keyin, ~104-qatordan keyin qo'shiladi)
- Test: `backend/routes/clients.import.test.js`

- [ ] **Step 1: Write the failing test**

Create `backend/routes/clients.import.test.js`:

```js
const { describe, it, expect, beforeAll, afterAll } = require('vitest');
const ExcelJS = require('exceljs');

// Auth bypass (middleware/auth.js M-1) — require'dan OLDIN o'rnatilishi shart
process.env.NODE_ENV = 'test';
process.env.TEST_AUTH_BYPASS = '1';

const request = require('supertest');
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

async function cleanup() {
  await prisma.client.deleteMany({ where: { inn: { startsWith: TST } } });
}

beforeAll(cleanup);
afterAll(async () => { await cleanup(); await prisma.$disconnect(); });

describe('GET /api/clients/import/template', () => {
  it('200 + xlsx mime qaytaradi', async () => {
    const res = await request(app).get('/api/clients/import/template');
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run routes/clients.import.test.js`
Expected: FAIL — `/import/template` 404 (yoki preview 404), endpointlar hali yo'q.

> **Eslatma:** Bu testlar ishlayotgan PostgreSQL (`DATABASE_URL`) ni talab qiladi. Tozalash faqat `inn LIKE 'TST900%'` qatorlarni o'chiradi — real ma'lumotga tegmaydi.

- [ ] **Step 3a: Update require'lar (clients.js top, 1-6 qatorlar)**

`backend/routes/clients.js` boshini quyidagiga almashtiring:

```js
const express = require('express');
const router = express.Router();
const { z } = require('zod');
const prisma = require('../prisma');
const { Prisma } = require('@prisma/client');
const ExcelJS = require('exceljs');
const { clientSchema } = require('./_schemas');
const { requireRole, requirePermission, requireSuperAdmin } = require('../middleware/rbac');
const { logAudit } = require('../lib/audit');
const { parseClientsXlsx, categorize } = require('../lib/clientImport');

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MAX_IMPORT_ROWS = 2000;
// .xlsx binar tanasini Buffer sifatida qabul qilish. Global express.json() faqat
// application/json ni parse qiladi — shu sabab bu route'da ziddiyat yo'q.
const rawXlsx = express.raw({ type: [XLSX_MIME, 'application/octet-stream'], limit: '10mb' });
```

(Eski 1-2 qator `const router = require('express').Router(); const prisma = require('../prisma');` o'rniga yuqoridagi blok.)

- [ ] **Step 3b: Add the 3 import endpoints**

`backend/routes/clients.js` da GET `/` handler tugagandan keyin (`});` ~104-qator), `router.post('/', ...)` dan **oldin** quyidagini qo'shing:

```js
// ─── Excel import ────────────────────────────────────────────────────────
// Marshrutlar /:id dan oldin: '/import/*' ni :id deb o'qib qo'ymaslik uchun.

// GET /api/clients/import/template — to'ldirish uchun tayyor .xlsx shablon
router.get('/import/template', requirePermission('clients', 'create'), async (req, res, next) => {
  try {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'ERP System';

    const ws = wb.addWorksheet('Mijozlar');
    ws.columns = [
      { header: 'Nomi',         key: 'name',     width: 28 },
      { header: 'STIR',         key: 'inn',      width: 16 },
      { header: 'Telefon',      key: 'phone',    width: 16 },
      { header: 'Direktor',     key: 'director', width: 24 },
      { header: 'Manzil',       key: 'address',  width: 30 },
      { header: 'Hisob raqami', key: 'account',  width: 24 },
      { header: 'MFO',          key: 'mfo',      width: 10 },
      { header: 'Bank',         key: 'bank',     width: 24 },
      { header: 'Sotuvchi',     key: 'seller',   width: 20 },
    ];
    ws.getRow(1).font = { bold: true };

    // STIR/Telefon/Hisob/MFO — matn formatida (uzun raqamlar yaxlitlanmasin)
    ['B', 'C', 'F', 'G'].forEach(col => { ws.getColumn(col).numFmt = '@'; });

    ws.addRow({
      name: 'Namuna MChJ', inn: '123456789', phone: '901234567',
      director: 'Aliyev Vali', address: 'Toshkent, Chilonzor',
      account: '20208000000000000001', mfo: '00014', bank: 'Ipoteka Bank',
      seller: 'Sotuvchi ismi',
    });

    const help = wb.addWorksheet("Yo'riqnoma");
    help.getColumn(1).width = 95;
    [
      "MIJOZLARNI IMPORT QILISH — YO'RIQNOMA",
      '',
      "1. 'Mijozlar' varag'idagi sarlavha qatorini O'ZGARTIRMANG.",
      "2. 'Nomi' ustuni MAJBURIY — bo'sh qator import qilinmaydi.",
      "3. 'STIR' takrorlanmasin. Bazada mavjud STIR o'tkazib yuboriladi.",
      "4. Bir qatorda STIR/Direktor/Manzil/Hisob/MFO/Bank/Sotuvchidan biri bo'sh bo'lsa,",
      "   u 'to'liq emas' deb belgilanadi — qo'shish-qo'shmaslikni import paytida tanlaysiz.",
      "5. STIR, Telefon, Hisob raqami, MFO ustunlari MATN formatida.",
      "6. Namuna qatorni o'chirib, o'z ma'lumotlaringizni kiriting.",
      "7. Bir faylda 2000 tagacha qator bo'lishi mumkin.",
    ].forEach((line, i) => { const r = help.addRow([line]); if (i === 0) r.font = { bold: true }; });

    res.setHeader('Content-Type', XLSX_MIME);
    res.setHeader('Content-Disposition', 'attachment; filename="mijozlar-shablon.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  } catch (e) { next(e); }
});

// Mavjud STIR lar to'plami (@unique soft-delete'larni ham qamraydi → deletedAt filtri YO'Q)
async function loadExistingInns() {
  const rows = await prisma.client.findMany({ where: { inn: { not: null } }, select: { inn: true } });
  return new Set(rows.map(r => r.inn));
}

// POST /api/clients/import/preview — faylni tekshiradi va toifalaydi (DB ga YOZMAYDI)
router.post('/import/preview', requirePermission('clients', 'create'), rawXlsx, async (req, res, next) => {
  try {
    if (!req.body || !req.body.length) {
      return res.status(400).json({ error: 'Fayl yuborilmadi' });
    }

    let parsed;
    try {
      parsed = await parseClientsXlsx(req.body);
    } catch {
      return res.status(400).json({ error: "Faylni o'qib bo'lmadi. Shablon .xlsx ekanini tekshiring." });
    }

    if (!parsed.headerOk) {
      return res.status(400).json({ error: "Shablon ustunlari topilmadi. 'Nomi' ustuni bo'lishi shart." });
    }
    if (parsed.rows.length > MAX_IMPORT_ROWS) {
      return res.status(400).json({ error: `${MAX_IMPORT_ROWS} dan ortiq qator. Faylni bo'lib yuklang.` });
    }

    const existingInns = await loadExistingInns();
    const rows = categorize(parsed.rows, existingInns);

    const summary = { total: rows.length, valid: 0, incomplete: 0, duplicate: 0, error: 0 };
    rows.forEach(r => { summary[r.category] += 1; });

    res.json({ summary, rows });
  } catch (e) { next(e); }
});

const importCommitSchema = z.object({
  clients: z.array(clientSchema).min(1).max(MAX_IMPORT_ROWS),
});

// POST /api/clients/import/commit — tasdiqlangan qatorlarni qo'shadi
router.post('/import/commit', requirePermission('clients', 'create'), async (req, res, next) => {
  try {
    const { clients } = importCommitSchema.parse(req.body);

    const existingInns = await loadExistingInns();
    const toInsert = clients.filter(c => !(c.inn && existingInns.has(c.inn)));
    const data = toInsert.map(c => ({ ...c, createdById: req.user.id }));

    const result = data.length
      ? await prisma.client.createMany({ data, skipDuplicates: true })
      : { count: 0 };

    await logAudit(req.user.id, 'import', 'client', null, { inserted: result.count, requested: clients.length }, req);

    res.json({
      inserted: result.count,
      skippedDuplicate: clients.length - result.count,
      requested: clients.length,
    });
  } catch (e) { next(e); }
});
// ─── Excel import oxiri ──────────────────────────────────────────────────
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run routes/clients.import.test.js`
Expected: PASS — barcha testlar yashil (DB ulangan bo'lishi kerak).

- [ ] **Step 5: Commit**

```bash
git add backend/routes/clients.js backend/routes/clients.import.test.js
git commit -m "feat(clients): /import template, preview, commit endpoints"
```

---

## Task 3: Frontend toolbar — Shablon + Import tugmalari (`Clients.jsx`)

**Files:**
- Modify: `frontend/src/pages/Clients.jsx`

- [ ] **Step 1: Add `Upload` icon + `ClientImportModal` import**

13-qatordagi lucide-react import'iga `Upload` qo'shing:

```js
import { Search, Plus, X, Edit2, Trash2, ChevronDown, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Download, Upload, FileText, Copy } from 'lucide-react';
```

11-qatordan keyin (boshqa import'lar yonida) qo'shing:

```js
import ClientImportModal from './ClientImportModal';
```

- [ ] **Step 2: Add `showImport` state + `handleTemplate`**

`Clients` komponenti ichida, mavjud `handleExport` yonida (252-qator atrofida) qo'shing:

```js
const [showImport, setShowImport] = useState(false);
const handleTemplate = () =>
  downloadFile('/api/clients/import/template', 'mijozlar-shablon.xlsx');
```

- [ ] **Step 3: Add toolbar buttons (canCreate bilan gate)**

`Clients.jsx` da Export tugmasi turgan `<div className="flex gap-2">` (336-340 qatorlar) ni quyidagiga almashtiring:

```jsx
        <div className="flex gap-2">
          {canCreate && (
            <button onClick={handleTemplate} className="px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-2)] text-[var(--text-2)] rounded-lg text-xs font-medium transition flex items-center gap-2 shadow-sm">
              <Download size={16} strokeWidth={2.2}/> {t('clients.import.templateBtn')}
            </button>
          )}
          {canCreate && (
            <button onClick={() => setShowImport(true)} className="px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-2)] text-[var(--text-2)] rounded-lg text-xs font-medium transition flex items-center gap-2 shadow-sm">
              <Upload size={16} strokeWidth={2.2}/> {t('clients.import.importBtn')}
            </button>
          )}
          <button onClick={handleExport} className="px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-2)] text-[var(--text-2)] rounded-lg text-xs font-medium transition flex items-center gap-2 shadow-sm">
            <Download size={16} strokeWidth={2.2}/> {t('common.excel')}
          </button>
        </div>
```

- [ ] **Step 4: Render the modal**

`Clients.jsx` ning return'i ichida, eng tashqi wrapper yopilishidan oldin (boshqa modallar qatorida) qo'shing:

```jsx
      {showImport && (
        <ClientImportModal
          onClose={() => setShowImport(false)}
          onDone={() => { setShowImport(false); fetchClients(); }}
        />
      )}
```

> `fetchClients` — Clients.jsx da mavjud (177-qatordagi yuklash funksiyasi). Agar nomi boshqacha bo'lsa, mavjud ro'yxat-yangilash funksiyasini chaqiring.

- [ ] **Step 5: Verify lint passes**

Run: `cd frontend && npm run lint`
Expected: `ClientImportModal` topilmasligi haqida xato bo'lishi mumkin — Task 4 da yaratiladi. Task 4 dan keyin lint qayta ishlatiladi. Hozircha syntax xatosi bo'lmasligini tekshiring.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Clients.jsx
git commit -m "feat(clients): import/template toolbar buttons + modal mount"
```

---

## Task 4: `ClientImportModal.jsx` — fayl tanlash, preview, tasdiqlash

**Files:**
- Create: `frontend/src/pages/ClientImportModal.jsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/pages/ClientImportModal.jsx`:

```jsx
import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useModalKeys } from '../hooks/useModalKeys';
import { X, Upload, CheckCircle2, AlertTriangle, Copy, Ban } from 'lucide-react';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const CAT_STYLE = {
  valid:      { cls: 'text-emerald-600',  Icon: CheckCircle2 },
  incomplete: { cls: 'text-blue-600',     Icon: AlertTriangle },
  duplicate:  { cls: 'text-amber-600',    Icon: Copy },
  error:      { cls: 'text-red-600',      Icon: Ban },
};

export default function ClientImportModal({ onClose, onDone }) {
  const { t } = useTranslation();
  const [preview, setPreview]       = useState(null);   // { summary, rows }
  const [selected, setSelected]     = useState(() => new Set()); // tanlangan rowNum'lar
  const [loading, setLoading]       = useState(false);
  const [committing, setCommitting] = useState(false);

  const importable = preview ? preview.rows.filter(r => r.category === 'valid' || r.category === 'incomplete') : [];

  const onConfirm = useCallback(async () => {
    if (!preview || selected.size === 0) {
      toast.error(t('clients.import.nothingSelected'));
      return;
    }
    setCommitting(true);
    try {
      const clients = preview.rows.filter(r => selected.has(r.rowNum)).map(r => r.data);
      const { data } = await api.post('/api/clients/import/commit', { clients });
      toast.success(t('clients.import.done', { inserted: data.inserted, skipped: data.skippedDuplicate }));
      onDone();
    } catch {
      /* api interceptor toast ko'rsatadi */
    } finally {
      setCommitting(false);
    }
  }, [preview, selected, t, onDone]);

  useModalKeys(onConfirm, onClose);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setPreview(null);
    try {
      const buf = await file.arrayBuffer();
      const { data } = await api.post('/api/clients/import/preview', buf, {
        headers: { 'Content-Type': XLSX_MIME },
      });
      setPreview(data);
      // Default: faqat 'valid' belgilangan
      setSelected(new Set(data.rows.filter(r => r.category === 'valid').map(r => r.rowNum)));
    } catch {
      /* api interceptor toast ko'rsatadi */
    } finally {
      setLoading(false);
      e.target.value = ''; // bir faylni qayta tanlash mumkin bo'lsin
    }
  }

  function toggleRow(row) {
    if (row.category !== 'valid' && row.category !== 'incomplete') return;
    setSelected(prev => {
      const next = new Set(prev);
      next.has(row.rowNum) ? next.delete(row.rowNum) : next.add(row.rowNum);
      return next;
    });
  }

  function toggleAll() {
    setSelected(prev =>
      prev.size === importable.length ? new Set() : new Set(importable.map(r => r.rowNum))
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <div
        className="bg-[var(--surface)] rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col"
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center border-b border-[var(--border)] px-5 py-3">
          <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
            <Upload size={18} strokeWidth={2.2} className="text-[var(--accent)]" />
            {t('clients.import.title')}
          </h3>
          <button onClick={onClose} className="text-[var(--text-3)] hover:text-[var(--text)] p-1 rounded-md hover:bg-[var(--surface-2)]">
            <X size={18} strokeWidth={2.2} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1">
          {!preview && (
            <div className="space-y-3">
              <p className="text-xs text-[var(--text-2)]">{t('clients.import.downloadTemplateHint')}</p>
              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[var(--border)] rounded-lg py-10 cursor-pointer hover:bg-[var(--surface-2)] transition">
                <Upload size={28} className="text-[var(--text-3)]" />
                <span className="text-xs font-medium text-[var(--text-2)]">{t('clients.import.selectFile')}</span>
                <input type="file" accept=".xlsx" className="hidden" onChange={handleFile} disabled={loading} />
              </label>
              {loading && <p className="text-xs text-center text-[var(--text-3)]">{t('clients.import.parsing')}</p>}
            </div>
          )}

          {preview && (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-4 gap-2">
                {['valid', 'incomplete', 'duplicate', 'error'].map(cat => {
                  const { cls } = CAT_STYLE[cat];
                  return (
                    <div key={cat} className="rounded-lg border border-[var(--border)] p-2 text-center">
                      <div className={`text-lg font-bold ${cls}`}>{preview.summary[cat]}</div>
                      <div className="text-[10px] text-[var(--text-3)]">{t(`clients.import.summary.${cat}`)}</div>
                    </div>
                  );
                })}
              </div>

              {/* Rows table */}
              <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-[var(--surface-2)] text-[var(--text-3)]">
                    <tr>
                      <th className="p-2 w-8 text-center">
                        <input
                          type="checkbox"
                          checked={importable.length > 0 && selected.size === importable.length}
                          onChange={toggleAll}
                          style={{ accentColor: 'var(--accent)' }}
                        />
                      </th>
                      <th className="p-2 text-left w-10">{t('clients.import.th.row')}</th>
                      <th className="p-2 text-left">{t('clients.import.th.name')}</th>
                      <th className="p-2 text-left">{t('clients.import.th.inn')}</th>
                      <th className="p-2 text-left">{t('clients.import.th.status')}</th>
                      <th className="p-2 text-left">{t('clients.import.th.reason')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map(row => {
                      const { cls, Icon } = CAT_STYLE[row.category];
                      const canPick = row.category === 'valid' || row.category === 'incomplete';
                      return (
                        <tr key={row.rowNum} className="border-t border-[var(--border)]">
                          <td className="p-2 text-center">
                            <input
                              type="checkbox"
                              checked={selected.has(row.rowNum)}
                              disabled={!canPick}
                              onChange={() => toggleRow(row)}
                              style={{ accentColor: 'var(--accent)' }}
                            />
                          </td>
                          <td className="p-2 text-[var(--text-3)]">{row.rowNum}</td>
                          <td className="p-2 text-[var(--text)]">{row.name || '—'}</td>
                          <td className="p-2 text-[var(--text-2)]">{row.inn || '—'}</td>
                          <td className={`p-2 ${cls}`}>
                            <span className="inline-flex items-center gap-1">
                              <Icon size={13} /> {t(`clients.import.cat.${row.category}`)}
                            </span>
                          </td>
                          <td className="p-2 text-[var(--text-3)]">{row.reason || ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {preview && (
          <div className="border-t border-[var(--border)] px-5 py-3 flex justify-between items-center">
            <span className="text-xs text-[var(--text-2)]">
              {t('clients.import.willImport', { count: selected.size })}
            </span>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-3 py-1.5 text-xs font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] rounded-lg border border-[var(--border)] transition">
                {t('common.cancel')}
              </button>
              <button
                onClick={onConfirm}
                disabled={committing || selected.size === 0}
                className="px-4 py-1.5 bg-[var(--accent)] hover:opacity-90 disabled:opacity-60 text-[var(--accent-text)] text-xs font-medium rounded-lg transition shadow-sm"
              >
                {committing ? t('common.saving') : t('clients.import.confirm')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

> **Tekshiruv:** `useModalKeys` imzosi `(onSave, onClose)` ekanini tasdiqlang (`frontend/src/hooks/useModalKeys.js`). Agar boshqacha bo'lsa, moslang. Lucide ikonkalari (`CheckCircle2`, `Ban` h.k.) `lucide-react` da mavjudligini lint/build tekshiradi — yo'q bo'lsa, mavjud muqobil bilan almashtiring.

- [ ] **Step 2: Verify lint + build**

Run: `cd frontend && npm run lint`
Expected: PASS (xatosiz).

Run: `cd frontend && npm run build`
Expected: PASS — build muvaffaqiyatli.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ClientImportModal.jsx
git commit -m "feat(clients): ClientImportModal — preview + per-row select + commit"
```

---

## Task 5: i18n kalitlari (uz / ru / zh)

**Files:**
- Modify: `frontend/src/i18n/locales/uz.json`
- Modify: `frontend/src/i18n/locales/ru.json`
- Modify: `frontend/src/i18n/locales/zh.json`

Har uchala faylda `"clients"` obyekti ichiga (mas. `"export": {...}` bloki yonига) `"import"` blokini qo'shing. Kalitlar uchala tilda BIR XIL bo'lishi shart (`npm run i18n:check`).

- [ ] **Step 1: uz.json — `clients` ichiga qo'shing**

```json
    "import": {
      "templateBtn": "Shablon",
      "importBtn": "Import",
      "title": "Mijozlarni Excel'dan import qilish",
      "selectFile": "Excel faylni tanlang (.xlsx)",
      "downloadTemplateHint": "Avval 'Shablon' tugmasi orqali shablonni yuklab oling, to'ldiring va shu yerga yuklang.",
      "parsing": "Fayl tekshirilmoqda...",
      "summary": {
        "valid": "To'g'ri",
        "incomplete": "To'liq emas",
        "duplicate": "Dublikat",
        "error": "Xato"
      },
      "cat": {
        "valid": "To'g'ri",
        "incomplete": "To'liq emas",
        "duplicate": "Dublikat",
        "error": "Xato"
      },
      "th": {
        "row": "№",
        "name": "Nomi",
        "inn": "STIR",
        "status": "Holat",
        "reason": "Izoh"
      },
      "willImport": "{{count}} qator import qilinadi",
      "confirm": "Tasdiqlash va import",
      "done": "{{inserted}} mijoz qo'shildi, {{skipped}} ta o'tkazib yuborildi",
      "nothingSelected": "Import uchun qator tanlanmagan"
    }
```

- [ ] **Step 2: ru.json — `clients` ichiga qo'shing**

```json
    "import": {
      "templateBtn": "Шаблон",
      "importBtn": "Импорт",
      "title": "Импорт клиентов из Excel",
      "selectFile": "Выберите файл Excel (.xlsx)",
      "downloadTemplateHint": "Сначала скачайте шаблон кнопкой «Шаблон», заполните и загрузите сюда.",
      "parsing": "Проверка файла...",
      "summary": {
        "valid": "Корректные",
        "incomplete": "Неполные",
        "duplicate": "Дубликат",
        "error": "Ошибка"
      },
      "cat": {
        "valid": "Корректно",
        "incomplete": "Неполно",
        "duplicate": "Дубликат",
        "error": "Ошибка"
      },
      "th": {
        "row": "№",
        "name": "Название",
        "inn": "ИНН",
        "status": "Статус",
        "reason": "Примечание"
      },
      "willImport": "Будет импортировано строк: {{count}}",
      "confirm": "Подтвердить и импортировать",
      "done": "Добавлено клиентов: {{inserted}}, пропущено: {{skipped}}",
      "nothingSelected": "Не выбрано ни одной строки для импорта"
    }
```

- [ ] **Step 3: zh.json — `clients` ichiga qo'shing**

```json
    "import": {
      "templateBtn": "模板",
      "importBtn": "导入",
      "title": "从 Excel 导入客户",
      "selectFile": "选择 Excel 文件 (.xlsx)",
      "downloadTemplateHint": "请先用「模板」按钮下载模板，填写后上传到此处。",
      "parsing": "正在检查文件...",
      "summary": {
        "valid": "有效",
        "incomplete": "不完整",
        "duplicate": "重复",
        "error": "错误"
      },
      "cat": {
        "valid": "有效",
        "incomplete": "不完整",
        "duplicate": "重复",
        "error": "错误"
      },
      "th": {
        "row": "№",
        "name": "名称",
        "inn": "税号",
        "status": "状态",
        "reason": "说明"
      },
      "willImport": "将导入 {{count}} 行",
      "confirm": "确认并导入",
      "done": "已添加 {{inserted}} 个客户，跳过 {{skipped}} 个",
      "nothingSelected": "未选择要导入的行"
    }
```

- [ ] **Step 4: Verify i18n key parity + build**

Run: `cd frontend && npm run i18n:check`
Expected: PASS — uz/ru/zh kalitlari mos.

Run: `cd frontend && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/i18n/locales/uz.json frontend/src/i18n/locales/ru.json frontend/src/i18n/locales/zh.json
git commit -m "feat(i18n): clients.import.* kalitlari (uz/ru/zh)"
```

---

## Task 6: Final verification + TEXNIK_VAZIFA.md

**Files:**
- Modify: `TEXNIK_VAZIFA.md`

- [ ] **Step 1: Run all backend tests**

Run: `cd backend && npx vitest run`
Expected: PASS — `clientImport.test.js` va `clients.import.test.js` yashil.

- [ ] **Step 2: Manual smoke test (ikkala server ishlab turibdi)**

```bash
# Backend
cd backend && node server.js
# Frontend (boshqa terminalda)
cd frontend && npm run dev
```

Brauzerda Clients sahifasi:
1. **Shablon** tugmasi → `mijozlar-shablon.xlsx` yuklab olinadi, 9 ustun + Yo'riqnoma varag'i bor.
2. Shablonni to'ldir (1-2 to'g'ri qator, 1 nomi bo'sh, 1 mavjud STIR) → **Import** tugmasi → fayl tanla.
3. Preview: hisob kartalari va toifalangan qatorlar ko'rinadi; nomi bo'sh → 🔴 error, mavjud STIR → 🟡 duplicate.
4. Qatorlarni belgilab/olib tashlab, **Tasdiqlash va import** → toast "X mijoz qo'shildi", ro'yxat yangilanadi.

- [ ] **Step 3: Update TEXNIK_VAZIFA.md**

`TEXNIK_VAZIFA.md` da "Joriy holat" sanasini `2026-06-09` ga yangilang va yangi bosqich qaydini qo'shing (mavjud format bo'yicha):

```markdown
### Mijozlarni Excel orqali import — DONE ✅ (2026-06-09)
- Shablon yuklab olish (`GET /api/clients/import/template`), interaktiv preview
  (`/import/preview`), tasdiqlangan import (`/import/commit`).
- `backend/lib/clientImport.js` (parse+toifalash, unit testlar bilan).
- `ClientImportModal.jsx` — per-qator tanlov; dublikat STIR o'tkaziladi; xato qatorlar bloklanadi.
- i18n: uz/ru/zh `clients.import.*`.
```

- [ ] **Step 4: Commit**

```bash
git add TEXNIK_VAZIFA.md
git commit -m "docs: TEXNIK_VAZIFA — mijozlarni Excel import bajarildi (2026-06-09)"
```

---

## Self-Review (plan muallifi tomonidan bajarildi)

**1. Spec coverage:**
- Shablon (9 ustun, Yo'riqnoma, matn formatli ustunlar) → Task 2 template route ✅
- Preview (raw .xlsx, DB'siz, toifalash) → Task 1 (categorize) + Task 2 preview ✅
- Commit (JSON, Zod re-validate, dublikat skip, audit) → Task 2 commit ✅
- 4 toifa (valid/incomplete/duplicate/error) → Task 1 categorize + testlar ✅
- Interaktiv per-qator olib tashlash → Task 4 modal ✅
- RBAC (clients:create), frontend canCreate gate → Task 2 + Task 3 ✅
- i18n uz/ru/zh → Task 5 ✅
- Limit 2000 / 10MB → Task 2 (MAX_IMPORT_ROWS, raw limit) ✅
- Testlar (vitest unit + supertest) → Task 1 + Task 2 ✅
- @unique soft-delete bilan → `loadExistingInns` deletedAt filtri yo'q ✅

**2. Placeholder scan:** Yo'q — har bir kod qadami to'liq.

**3. Type consistency:** `parseClientsXlsx` → `{ headerOk, rows:[{rowNum, raw}] }`; `categorize(rows, Set)` → `[{rowNum, name, inn, category, reason, data}]`. Preview javobi `{summary, rows}`. Commit body `{clients:[clientSchema]}`. Modal `row.data`, `row.rowNum`, `row.category` ishlatadi — barchasi mos ✅
