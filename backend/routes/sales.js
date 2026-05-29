const router = require('express').Router();
const prisma = require('../prisma');
const { saleSchema } = require('./_schemas');

router.get('/', async (req, res, next) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page)  || 1);
    const limit    = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const search   = (req.query.search   || '').trim();
    const from     = req.query.from      || '';
    const to       = req.query.to        || '';
    const clientId = req.query.clientId  || '';
    const contractId = req.query.contractId || '';
    const specId     = req.query.specId     || '';
    const facturaStatus = req.query.facturaStatus || '';
    const sortBy   = req.query.sortBy    || 'date';
    const sortDir  = req.query.sortDir === 'asc' ? 'asc' : 'desc';
    const offset   = (page - 1) * limit;

    const where = {
      ...(clientId ? { clientId } : {}),
      ...(contractId ? { contractId } : {}),
      ...(specId ? { specId } : {}),
      ...(facturaStatus ? { facturaStatus } : {}),
      ...(from || to ? {
        date: {
          ...(from ? { gte: new Date(from) }              : {}),
          ...(to   ? { lte: new Date(to + 'T23:59:59') } : {}),
        },
      } : {}),
      ...(search ? {
        OR: [
          { nakladnoy:  { contains: search, mode: 'insensitive' } },
          { sellerName: { contains: search, mode: 'insensitive' } },
          { client: { name: { contains: search, mode: 'insensitive' } } },
        ],
      } : {}),
    };

    let orderBy = {};
    if (sortBy === 'client') {
      orderBy = { client: { name: sortDir } };
    } else if (sortBy === 'contract') {
      orderBy = { contract: { number: sortDir } };
    } else if (sortBy === 'spec') {
      orderBy = { spec: { number: sortDir } };
    } else {
      const allowedCols = ['date', 'nakladnoy', 'sellerName', 'totalAmount', 'facturaStatus'];
      const col = allowedCols.includes(sortBy) ? sortBy : 'date';
      orderBy = { [col]: sortDir };
    }

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          client:   { select: { id: true, name: true } },
          contract: { select: { id: true, number: true } },
          spec:     { select: { id: true, number: true } },
          products: true,
        },
        orderBy,
        skip: offset,
        take: limit,
      }),
      prisma.sale.count({ where }),
    ]);

    res.json({ data: sales, total, page, limit });
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: req.params.id },
      include: {
        client:   true,
        contract: { select: { id: true, number: true } },
        spec:     { select: { id: true, number: true } },
        products: { include: { product: true } },
      },
    });
    if (!sale) return res.status(404).json({ error: 'Topilmadi' });
    res.json(sale);
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const parsed = saleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const { date, nakladnoy, sellerName, transportNum, clientId, products, facturaStatus } = parsed.data;
    let { contractId, specId } = parsed.data;
    const totalAmount = products.reduce((sum, p) => sum + p.rowAmount, 0);

    const sale = await prisma.$transaction(async (tx) => {
      // specId lookup inside transaction to avoid TOCTOU race
      if (specId) {
        const spec = await tx.specification.findUnique({
          where: { id: specId },
          select: { contractId: true },
        });
        if (!spec) {
          const err = new Error('Spetsifikatsiya topilmadi');
          err.status = 400;
          err.publicMessage = 'Spetsifikatsiya topilmadi';
          throw err;
        }
        contractId = spec.contractId;
      }

      const s = await tx.sale.create({
        data: {
          date: new Date(date),
          nakladnoy,
          sellerName,
          transportNum: transportNum || null,
          totalAmount,
          clientId,
          contractId: contractId || null,
          specId:     specId     || null,
          facturaStatus: facturaStatus || 'yuborilmagan',
        },
      });
      await tx.saleProduct.createMany({
        data: products.map(p => ({ ...p, saleId: s.id })),
      });
      return tx.sale.findUnique({
        where: { id: s.id },
        include: {
          client:   { select: { id: true, name: true } },
          contract: { select: { id: true, number: true } },
          spec:     { select: { id: true, number: true } },
          products: true,
        },
      });
    });

    res.json(sale);
  } catch (e) {
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const data = saleSchema.partial().parse(req.body);
    const sale = await prisma.sale.update({
      where: { id: req.params.id },
      data: {
        ...(data.date !== undefined ? { date: new Date(data.date) } : {}),
        ...(data.nakladnoy !== undefined ? { nakladnoy: data.nakladnoy } : {}),
        ...(data.sellerName !== undefined ? { sellerName: data.sellerName } : {}),
        ...(data.transportNum !== undefined ? { transportNum: data.transportNum || null } : {}),
        ...(data.clientId !== undefined ? { clientId: data.clientId } : {}),
        ...(data.contractId !== undefined ? { contractId: data.contractId || null } : {}),
        ...(data.specId !== undefined ? { specId: data.specId || null } : {}),
        ...(data.facturaStatus !== undefined ? { facturaStatus: data.facturaStatus } : {}),
      },
      include: {
        client:   { select: { id: true, name: true } },
        contract: { select: { id: true, number: true } },
        spec:     { select: { id: true, number: true } },
        products: true,
      },
    });
    res.json(sale);
  } catch (e) {
    next(e);
  }
});

router.post('/bulk-delete', async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids massiv bo\'lishi kerak' });
    await prisma.sale.deleteMany({
      where: { id: { in: ids } },
    });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

router.post('/bulk-factura', async (req, res, next) => {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids massiv bo\'lishi kerak' });
    if (!['yuborildi', 'yuborilmagan'].includes(status)) return res.status(400).json({ error: 'Noto\'g\'ri status' });
    await prisma.sale.updateMany({
      where: { id: { in: ids } },
      data: { facturaStatus: status },
    });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.sale.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
