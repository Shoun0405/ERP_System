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
    const page    = Math.max(1, parseInt(req.query.page)  || 1);
    const limit   = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const search  = (req.query.search  || '').trim();
    const sortBy  = req.query.sortBy   || 'createdAt';
    const sortDir = req.query.sortDir === 'asc' ? 'ASC' : 'DESC';
    const offset  = (page - 1) * limit;
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
      prisma.$queryRaw(Prisma.sql`
        SELECT
          c.id, c.name, c.inn, c.phone, c.director, c.address,
          c.category, c.status, c.account, c.mfo, c.seller,
          c."createdAt",
          COALESCE(SUM(s."totalAmount"), 0) AS "totalSales",
          COALESCE(SUM(p.amount),        0) AS "totalPayments",
          COALESCE(SUM(s."totalAmount"), 0) - COALESCE(SUM(p.amount), 0) AS debt
        FROM "Client" c
        LEFT JOIN "Sale"    s ON s."clientId" = c.id
        LEFT JOIN "Payment" p ON p."clientId" = c.id
        ${where}
        GROUP BY c.id, c.name, c.inn, c.phone, c.director, c.address,
                 c.category, c.status, c.account, c.mfo, c.seller, c."createdAt"
        ORDER BY ${Prisma.raw(orderCol)} ${Prisma.raw(sortDir)}
        LIMIT ${limit} OFFSET ${offset}
      `),
      prisma.client.count({
        where: search ? {
          OR: [
            { name:   { contains: search, mode: 'insensitive' } },
            { inn:    { contains: search } },
            { phone:  { contains: search } },
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
    next(e);
  }
});

module.exports = router;
