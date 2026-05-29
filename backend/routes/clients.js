const router = require('express').Router();
const prisma = require('../prisma');
const { Prisma } = require('@prisma/client');
const { clientSchema } = require('./_schemas');

const SORT_COLS = {
  name:      'c.name',
  inn:       'c.inn',
  phone:     'c.phone',
  seller:    'c.seller',
  status:    'c.status',
  debt:      'debt',
  createdAt: 'c."createdAt"',
};

router.get('/', async (req, res, next) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page)  || 1);
    const limit    = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const search   = (req.query.search  || '').trim();
    const sortBy   = req.query.sortBy   || 'createdAt';
    const sortDir  = req.query.sortDir === 'asc' ? 'ASC' : 'DESC';
    const offset   = (page - 1) * limit;
    const orderCol = SORT_COLS[sortBy] || 'c."createdAt"';

    const where = search
      ? Prisma.sql`WHERE (
          c.name   ILIKE ${`%${search}%`} OR
          c.inn    ILIKE ${`%${search}%`} OR
          c.phone  ILIKE ${`%${search}%`} OR
          c.seller ILIKE ${`%${search}%`}
        )`
      : Prisma.empty;

    const [rows, countResult] = await Promise.all([
      // Pre-aggregate in subqueries to avoid Cartesian product between Sale and Payment
      prisma.$queryRaw(Prisma.sql`
        SELECT
          c.id, c.name, c.inn, c.phone, c.director, c.address,
          c.category, c.status, c.account, c.mfo, c.seller,
          c."createdAt",
          COALESCE(s_agg.total, 0)::float                               AS "totalSales",
          COALESCE(p_agg.total, 0)::float                               AS "totalPayments",
          (COALESCE(s_agg.total, 0) - COALESCE(p_agg.total, 0))::float  AS debt
        FROM "Client" c
        LEFT JOIN (
          SELECT "clientId", SUM("totalAmount") AS total FROM "Sale" GROUP BY "clientId"
        ) s_agg ON s_agg."clientId" = c.id
        LEFT JOIN (
          SELECT "clientId", SUM(amount) AS total FROM "Payment" GROUP BY "clientId"
        ) p_agg ON p_agg."clientId" = c.id
        ${where}
        ORDER BY ${Prisma.raw(orderCol)} ${Prisma.raw(sortDir)}
        LIMIT ${limit} OFFSET ${offset}
      `),
      prisma.client.count({
        where: search ? {
          OR: [
            { name:   { contains: search, mode: 'insensitive' } },
            { inn:    { contains: search, mode: 'insensitive' } },
            { phone:  { contains: search, mode: 'insensitive' } },
            { seller: { contains: search, mode: 'insensitive' } },
          ],
        } : undefined,
      }),
    ]);

    const data = rows.map(r => ({
      ...r,
      totalSales:    Number(r.totalSales),
      totalPayments: Number(r.totalPayments),
      debt:          Number(r.debt),
    }));

    res.json({ data, total: countResult, page, limit });
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const data = clientSchema.parse(req.body);
    const client = await prisma.client.create({ data });
    res.json(client);
  } catch (e) {
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = clientSchema.partial().parse(req.body);
    const client = await prisma.client.update({ where: { id }, data });
    res.json(client);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.client.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) {
    if (e.code === 'P2003') return res.status(409).json({ error: "Bog'langan shartnoma, savdo yoki to'lov mavjud" });
    next(e);
  }
});

module.exports = router;
