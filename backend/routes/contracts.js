const router = require('express').Router();
const prisma = require('../prisma');
const { contractSchema } = require('./_schemas');

const SORT_FIELDS = new Set(['date', 'number', 'totalValue', 'status', 'createdAt', 'client']);

// GET /api/contracts — pagination + aggregate
router.get('/', async (req, res, next) => {
  try {
    const page    = Math.max(1, parseInt(req.query.page)  || 1);
    const limit   = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const search  = (req.query.search  || '').trim();
    const clientId = req.query.clientId || undefined;
    const status  = req.query.status   || undefined;
    const sortBy  = SORT_FIELDS.has(req.query.sortBy) ? req.query.sortBy : 'date';
    const sortDir = req.query.sortDir === 'asc' ? 'asc' : 'desc';
    const skip    = (page - 1) * limit;
    const from    = req.query.from || undefined;
    const to      = req.query.to || undefined;

    const where = {
      ...(clientId ? { clientId } : {}),
      ...(status   ? { status }   : {}),
      ...(from || to ? {
        date: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        }
      } : {}),
      ...(search   ? {
        OR: [
          { number:            { contains: search, mode: 'insensitive' } },
          { client: { name: { contains: search, mode: 'insensitive' } } },
          { client: { inn:  { contains: search, mode: 'insensitive' } } },
        ],
      } : {}),
    };

    const [contracts, total] = await Promise.all([
      prisma.contract.findMany({
        where,
        include: {
          client: { select: { id: true, name: true, inn: true } },
          _count: { select: { specifications: true } },
        },
        orderBy: sortBy === 'client' ? { client: { name: sortDir } } : { [sortBy]: sortDir },
        skip,
        take: limit,
      }),
      prisma.contract.count({ where }),
    ]);

    const ids = contracts.map(c => c.id);
    let aggMap = {};
    if (ids.length > 0) {
      // Pre-aggregate in subqueries to avoid Cartesian product between Payment and SaleProduct
      const aggregates = await prisma.$queryRaw`
        SELECT
          c.id::text,
          COALESCE(p_agg.paid,      0)::float AS paid_amount,
          COALESCE(d_agg.delivered, 0)::float AS delivered_amount,
          COALESCE(s_agg.invoice,   0)::float AS invoice_amount
        FROM "Contract" c
        LEFT JOIN (
          SELECT "contractId", SUM(amount) AS paid
          FROM "Payment" GROUP BY "contractId"
        ) p_agg ON p_agg."contractId" = c.id
        LEFT JOIN (
          SELECT s."contractId", SUM(sp."rowAmount") AS delivered
          FROM "Sale" s
          JOIN "SaleProduct" sp ON sp."saleId" = s.id
          GROUP BY s."contractId"
        ) d_agg ON d_agg."contractId" = c.id
        LEFT JOIN (
          SELECT "contractId", SUM("totalValue") AS invoice
          FROM "Specification" GROUP BY "contractId"
        ) s_agg ON s_agg."contractId" = c.id
        WHERE c.id::text = ANY(${ids})
      `;
      aggMap = Object.fromEntries(aggregates.map(a => [a.id, a]));
    }

    const data = contracts.map(c => ({
      ...c,
      specCount:       c._count.specifications,
      paidAmount:      Number(aggMap[c.id]?.paid_amount      || 0),
      deliveredAmount: Number(aggMap[c.id]?.delivered_amount || 0),
      invoiceAmount:   Number(aggMap[c.id]?.invoice_amount   || 0),
      _count:          undefined,
    }));

    res.json({ data, total, page, limit });
  } catch (e) { next(e); }
});

// GET /api/contracts/next-number — auto-numbering
router.get('/next-number', async (req, res, next) => {
  try {
    const year   = new Date().getFullYear() % 100;
    const maxRow = await prisma.contract.aggregate({
      where: { yearPart: year },
      _max:  { numericPart: true },
    });
    const next   = (maxRow._max.numericPart || 0) + 1;
    const number = `${String(year).padStart(2, '0')}-${String(next).padStart(2, '0')}`;
    res.json({ number, yearPart: year, numericPart: next });
  } catch (e) { next(e); }
});

// GET /api/contracts/:id — bitta shartnoma + spetslar + delivered aggregate
router.get('/:id', async (req, res, next) => {
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: req.params.id },
      include: {
        client: true,
        specifications: {
          include: {
            products: { include: { product: true } },
            _count:   { select: { sales: true } },
          },
          orderBy: { number: 'asc' },
        },
      },
    });
    if (!contract) return res.status(404).json({ error: 'Topilmadi' });

    const deliveredBySpec = await prisma.$queryRaw`
      SELECT s."specId"::text, COALESCE(SUM(sp."rowAmount"), 0)::float AS delivered
      FROM "Sale" s
      LEFT JOIN "SaleProduct" sp ON sp."saleId" = s.id
      WHERE s."contractId"::text = ${req.params.id} AND s."specId" IS NOT NULL
      GROUP BY s."specId"
    `;
    const deliveredMap = Object.fromEntries(
      deliveredBySpec.map(r => [r.specId, Number(r.delivered)])
    );

    res.json({
      ...contract,
      specifications: contract.specifications.map(s => ({
        ...s,
        deliveredAmount: deliveredMap[s.id] || 0,
        saleCount:       s._count.sales,
        _count:          undefined,
      })),
    });
  } catch (e) { next(e); }
});

// POST /api/contracts — auto yoki manual numbering
router.post('/', async (req, res, next) => {
  try {
    const body    = contractSchema.parse(req.body);
    const settings = await prisma.setting.findUnique({ where: { id: 'global' } });
    const cfg     = settings ? JSON.parse(settings.data) : {};
    const autoNum = cfg.autoContractNumbering !== false;

    let { number } = body;
    const year = new Date(body.date).getFullYear() % 100;
    let numericPart;

    if (autoNum || !number) {
      const maxRow = await prisma.contract.aggregate({
        where: { yearPart: year },
        _max:  { numericPart: true },
      });
      numericPart = (maxRow._max.numericPart || 0) + 1;
      number = `${String(year).padStart(2, '0')}-${String(numericPart).padStart(2, '0')}`;
    } else {
      const m = /^(\d{2})-(\d+)$/.exec(number);
      if (!m) return res.status(400).json({ error: 'Raqam formati: YY-NN (masalan 26-05)' });
      numericPart = parseInt(m[2], 10);
    }

    const contract = await prisma.contract.create({
      data: {
        number,
        yearPart:   year,
        numericPart,
        date:       new Date(body.date),
        totalValue: body.totalValue,
        clientId:   body.clientId,
        notes:      body.notes || null,
        status:     body.status || 'yangi',
        seller:     body.seller || null,
      },
      include: { client: { select: { id: true, name: true, inn: true } } },
    });
    res.json(contract);
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'Bu raqam allaqachon mavjud' });
    next(e);
  }
});

// PUT /api/contracts/:id — faqat tahrirlash mumkin bo'lgan maydonlar
router.put('/:id', async (req, res, next) => {
  try {
    const body     = contractSchema.partial().parse(req.body);
    const contract = await prisma.contract.update({
      where: { id: req.params.id },
      data: {
        ...(body.date       !== undefined ? { date: new Date(body.date) } : {}),
        ...(body.totalValue !== undefined ? { totalValue: body.totalValue } : {}),
        ...(body.notes      !== undefined ? { notes: body.notes || null } : {}),
        ...(body.status     !== undefined ? { status: body.status } : {}),
        ...(body.seller     !== undefined ? { seller: body.seller || null } : {}),
        // number o'zgartirilmaydi — audit izi
      },
      include: { client: { select: { id: true, name: true, inn: true } } },
    });
    res.json(contract);
  } catch (e) { next(e); }
});

// DELETE /api/contracts/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const contractId = req.params.id;
    const [linkedSales, linkedPayments] = await Promise.all([
      prisma.sale.count({ where: { contractId } }),
      prisma.payment.count({ where: { contractId } }),
    ]);
    if (linkedSales > 0 || linkedPayments > 0) {
      return res.status(409).json({ error: "Bog'langan savdo yoki to'lov mavjud" });
    }
    await prisma.contract.delete({ where: { id: contractId } });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
