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
    const offset   = (page - 1) * limit;

    const where = {
      ...(clientId ? { clientId } : {}),
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

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          client:   { select: { id: true, name: true } },
          contract: { select: { id: true, number: true } },
          spec:     { select: { id: true, number: true } },
          products: true,
        },
        orderBy: { date: 'desc' },
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
  const parsed = saleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }

  const { date, nakladnoy, sellerName, transportNum, clientId, products } = parsed.data;
  let { contractId, specId } = parsed.data;

  // specId bo'lsa — contractId ni Spec dan avtomatik olamiz
  if (specId) {
    const spec = await prisma.specification.findUnique({
      where: { id: specId },
      select: { contractId: true },
    });
    if (!spec) return res.status(400).json({ error: 'Spetsifikatsiya topilmadi' });
    contractId = spec.contractId;
  }

  const totalAmount = products.reduce((sum, p) => sum + p.rowAmount, 0);

  try {
    const sale = await prisma.$transaction(async (tx) => {
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

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.sale.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
