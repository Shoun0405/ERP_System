const router = require('express').Router();
const prisma = require('../prisma');
const { Prisma } = require('@prisma/client');
const { clientSchema } = require('./_schemas');
const { requireRole, requirePermission, requireSuperAdmin } = require('../middleware/rbac');
const { logAudit } = require('../lib/audit');

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
