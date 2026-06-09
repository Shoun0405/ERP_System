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

const SORT_COLS = {
  name:      'name',
  inn:       'inn',
  phone:     'phone',
  seller:    'seller',
  status:    'status',
  debt:      'debt',
  createdAt: '"createdAt"',
};

router.get('/', requirePermission('clients', 'read'), async (req, res, next) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page)  || 1);
    const limit    = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const search   = (req.query.search  || '').trim();
    const sortBy   = req.query.sortBy   || 'createdAt';
    const sortDir  = req.query.sortDir === 'asc' ? 'ASC' : 'DESC';
    const offset   = (page - 1) * limit;
    const orderCol = SORT_COLS[sortBy] || '"createdAt"';

    const where = search
      ? Prisma.sql`WHERE (
          c.name   ILIKE ${`%${search}%`} OR
          c.inn    ILIKE ${`%${search}%`} OR
          c.phone  ILIKE ${`%${search}%`} OR
          c.seller ILIKE ${`%${search}%`}
        )`
      : Prisma.empty;

    const debtFilter = req.query.debtFilter || 'barchasi';
    let debtCondition = Prisma.empty;
    if (debtFilter === 'qarzdorlar') {
      debtCondition = Prisma.sql`WHERE debt > 0`;
    } else if (debtFilter === 'haqdorlar') {
      debtCondition = Prisma.sql`WHERE debt < 0`;
    } else if (debtFilter === 'yangi') {
      debtCondition = Prisma.sql`WHERE debt = 0`;
    }

    const [rows, countResult] = await Promise.all([
      // Pre-aggregate in subqueries to avoid Cartesian product between Sale and Payment
      prisma.$queryRaw(Prisma.sql`
        WITH client_debts AS (
          SELECT
            c.id, c.name, c.inn, c.phone, c.director, c.address,
            c.category, c.status, c.account, c.mfo, c.seller, c.country,
            c."createdAt", c."deletedAt", c."createdById", c."updatedById", c."updatedAt",
            COALESCE(s_agg.total, 0)::float                               AS "totalSales",
            COALESCE(p_agg.total, 0)::float                               AS "totalPayments",
            (COALESCE(s_agg.total, 0) - COALESCE(p_agg.total, 0))::float  AS debt
          FROM "Client" c
          LEFT JOIN (
            SELECT "clientId", SUM("totalAmount") AS total FROM "Sale" WHERE "deletedAt" IS NULL GROUP BY "clientId"
          ) s_agg ON s_agg."clientId" = c.id
          LEFT JOIN (
            SELECT "clientId", SUM(amount) AS total FROM "Payment" WHERE "deletedAt" IS NULL GROUP BY "clientId"
          ) p_agg ON p_agg."clientId" = c.id
          ${where}
        )
        SELECT * FROM client_debts
        ${debtCondition}
        ORDER BY ${Prisma.raw(orderCol)} ${Prisma.raw(sortDir)}
        LIMIT ${limit} OFFSET ${offset}
      `),
      prisma.$queryRaw(Prisma.sql`
        WITH client_debts AS (
          SELECT
            c.id,
            (COALESCE(s_agg.total, 0) - COALESCE(p_agg.total, 0))::float  AS debt
          FROM "Client" c
          LEFT JOIN (
            SELECT "clientId", SUM("totalAmount") AS total FROM "Sale" WHERE "deletedAt" IS NULL GROUP BY "clientId"
          ) s_agg ON s_agg."clientId" = c.id
          LEFT JOIN (
            SELECT "clientId", SUM(amount) AS total FROM "Payment" WHERE "deletedAt" IS NULL GROUP BY "clientId"
          ) p_agg ON p_agg."clientId" = c.id
          ${where}
        )
        SELECT COUNT(*)::int AS count FROM client_debts
        ${debtCondition}
      `),
    ]);

    const data = rows.map(r => ({
      ...r,
      totalSales:    Number(r.totalSales),
      totalPayments: Number(r.totalPayments),
      debt:          Number(r.debt),
    }));

    const total = Number(countResult[0]?.count || 0);

    res.json({ data, total, page, limit });
  } catch (e) {
    next(e);
  }
});

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
    // express.raw faqat mos Content-Type da Buffer beradi. Boshqa turdagi tana
    // (mas. JSON, multipart) kelsa req.body Buffer bo'lmaydi — buni "fayl yo'q" deb
    // emas, "noto'g'ri format" deb aniq aytamiz.
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      const wrongType = req.body && !Buffer.isBuffer(req.body);
      return res.status(400).json({
        error: wrongType ? "Noto'g'ri format. .xlsx fayl yuboring." : 'Fayl yuborilmadi',
      });
    }

    let parsed;
    try {
      parsed = await parseClientsXlsx(req.body);
    } catch (e) {
      // Foydalanuvchiga do'stona 400, lekin haqiqiy sabab (buzilgan zip, OOM, ExcelJS bug)
      // log/Sentry da ko'rinsin — sokin yutmaymiz.
      console.error('[clients/import/preview] parse failed:', e);
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

router.post('/', requirePermission('clients', 'create'), async (req, res, next) => {
  try {
    const data = clientSchema.parse(req.body);
    const client = await prisma.client.create({ data: { ...data, createdById: req.user.id } });
    await logAudit(req.user.id, 'create', 'client', client.id, data, req);
    res.json(client);
  } catch (e) {
    next(e);
  }
});

router.put('/:id', requirePermission('clients', 'update'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = clientSchema.partial().parse(req.body);
    const client = await prisma.client.update({ where: { id }, data: { ...data, updatedById: req.user.id } });
    await logAudit(req.user.id, 'update', 'client', id, data, req);
    res.json(client);
  } catch (e) {
    next(e);
  }
});

// Soft-delete
router.delete('/:id', requirePermission('clients', 'delete'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) {
      return res.status(404).json({ error: 'Mijoz topilmadi' });
    }
    await prisma.client.update({ where: { id }, data: { deletedAt: new Date(), deletedById: req.user.id } });
    await logAudit(req.user.id, 'delete', 'client', id, { name: client.name }, req);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

// superAdmin: butunlay o'chirish
router.delete('/:id/hard', requireSuperAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) return res.status(404).json({ error: 'Mijoz topilmadi' });
    await prisma.client.delete({ where: { id } });
    await logAudit(req.user.id, 'hard-delete', 'client', id, { name: client.name }, req);
    res.json({ success: true });
  } catch (e) {
    if (e.code === 'P2003') return res.status(409).json({ error: "Bog'langan shartnoma, savdo yoki to'lov mavjud" });
    next(e);
  }
});

// superAdmin: tiklash
router.post('/:id/restore', requireSuperAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) return res.status(404).json({ error: 'Mijoz topilmadi' });
    await prisma.client.update({ where: { id }, data: { deletedAt: null, deletedById: null } });
    await logAudit(req.user.id, 'restore', 'client', id, { name: client.name }, req);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
