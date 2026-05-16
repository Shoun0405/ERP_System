const router = require('express').Router();
const prisma = require('../prisma');
const { contractSchema } = require('./_schemas');

// GET /api/contracts — pagination + aggregate
router.get('/', async (req, res, next) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page)  || 1);
    const limit    = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const search   = (req.query.search   || '').trim();
    const clientId = req.query.clientId  || undefined;
    const status   = req.query.status    || undefined;
    const sortBy   = req.query.sortBy    || 'date';
    const sortDir  = (req.query.sortDir  === 'asc') ? 'asc' : 'desc';
    const skip     = (page - 1) * limit;

    const where = {
      ...(clientId ? { clientId } : {}),
      ...(status   ? { status }   : {}),
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
        orderBy: { [sortBy]: sortDir },
        skip,
        take: limit,
      }),
      prisma.contract.count({ where }),
    ]);

    // Aggregate: paidAmount + deliveredAmount — bitta SQL bilan, N+1 yo'q
    const ids = contracts.map(c => c.id);
    let aggMap = {};
    if (ids.length > 0) {
      const aggregates = await prisma.$queryRaw`
        SELECT
          c.id::text,
          COALESCE(SUM(DISTINCT p.amount), 0)::float  AS paid_amount,
          COALESCE(SUM(sp."rowAmount"), 0)::float     AS delivered_amount
        FROM "Contract" c
        LEFT JOIN "Payment"     p  ON p."contractId" = c.id
        LEFT JOIN "Sale"        s  ON s."contractId" = c.id
        LEFT JOIN "SaleProduct" sp ON sp."saleId"    = s.id
        WHERE c.id::text = ANY(${ids})
        GROUP BY c.id
      `;
      aggMap = Object.fromEntries(aggregates.map(a => [a.id, a]));
    }

    const data = contracts.map(c => ({
      ...c,
      specCount:       c._count.specifications,
      paidAmount:      Number(aggMap[c.id]?.paid_amount      || 0),
      deliveredAmount: Number(aggMap[c.id]?.delivered_amount || 0),
      invoiceAmount:   0,
      _count: undefined,
    }));

    res.json({ data, total, page, limit });
  } catch (e) { next(e); }
});

// GET /api/contracts/next-number — auto-numbering
router.get('/next-number', async (req, res, next) => {
  try {
    const year = new Date().getFullYear() % 100;
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
      FROM "Sale"        s
      LEFT JOIN "SaleProduct" sp ON sp."saleId" = s.id
      WHERE s."contractId"::text = ${req.params.id} AND s."specId" IS NOT NULL
      GROUP BY s."specId"
    `;
    const deliveredMap = Object.fromEntries(
      deliveredBySpec.map(r => [r.specId, Number(r.delivered)])
    );

    contract.specifications = contract.specifications.map(s => ({
      ...s,
      deliveredAmount: deliveredMap[s.id] || 0,
      saleCount:       s._count.sales,
      _count:          undefined,
    }));

    res.json(contract);
  } catch (e) { next(e); }
});

// POST /api/contracts — auto yoki manual numbering
router.post('/', async (req, res, next) => {
  try {
    const body = contractSchema.parse(req.body);

    const settings = await prisma.setting.findUnique({ where: { id: 'global' } });
    const cfg      = settings ? JSON.parse(settings.data) : {};
    const autoNum  = cfg.autoContractNumbering !== false;

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
      const m = /^(\d{1,2})-(\d+)$/.exec(number);
      if (!m) {
        return res.status(400).json({ error: 'Raqam formati: YY-NN (masalan 26-05)' });
      }
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
      },
      include: { client: { select: { id: true, name: true, inn: true } } },
    });
    res.json(contract);
  } catch (e) {
    if (e.code === 'P2002') {
      return res.status(409).json({ error: 'Bu raqam allaqachon mavjud' });
    }
    next(e);
  }
});

// PUT /api/contracts/:id — faqat tahrirlash mumkin bo'lgan maydonlar
router.put('/:id', async (req, res, next) => {
  try {
    const body = contractSchema.partial().parse(req.body);
    const contract = await prisma.contract.update({
      where: { id: req.params.id },
      data: {
        ...(body.date       !== undefined ? { date: new Date(body.date) } : {}),
        ...(body.totalValue !== undefined ? { totalValue: body.totalValue } : {}),
        ...(body.notes      !== undefined ? { notes: body.notes || null } : {}),
        ...(body.status     !== undefined ? { status: body.status } : {}),
        // number o'zgartirilmaydi — audit izi (PRD qoidasi #6)
      },
      include: { client: { select: { id: true, name: true, inn: true } } },
    });
    res.json(contract);
  } catch (e) { next(e); }
});

// DELETE /api/contracts/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.contract.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) {
    if (e.code === 'P2003') {
      const err = new Error();
      err.status = 409;
      err.publicMessage = "Bog'langan savdo yoki to'lov mavjud";
      return next(err);
    }
    next(e);
  }
});

module.exports = router;
