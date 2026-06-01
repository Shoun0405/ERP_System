const router = require('express').Router();
const prisma = require('../prisma');
const { productSchema, bulkPriceSchema } = require('./_schemas');
const { requirePermission } = require('../middleware/rbac');
const { logAudit } = require('../lib/audit');

router.get('/', async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const search = (req.query.search || '').trim();
    const offset = (page - 1) * limit;

    const where = search
      ? { article: { contains: search, mode: 'insensitive' } }
      : undefined;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    res.json({ data: products, total, page, limit });
  } catch (e) {
    next(e);
  }
});

// Dynamic permissions write actions below
router.post('/', requirePermission('products', 'create'), async (req, res, next) => {
  try {
    const data = productSchema.parse(req.body);
    const product = await prisma.product.create({ data });
    await logAudit(req.user.id, 'create', 'product', product.id, data, req);
    res.json(product);
  } catch (e) {
    next(e);
  }
});

router.put('/bulk-price', requirePermission('products', 'update'), async (req, res, next) => {
  try {
    const { updates } = bulkPriceSchema.parse(req.body);
    await prisma.$transaction(
      updates.map(u =>
        prisma.product.update({
          where: { id: u.id },
          data: { priceTon: u.priceTon, priceCbm: u.priceCbm, priceSqm: u.priceSqm },
        })
      )
    );
    await logAudit(req.user.id, 'update', 'product', null, { updates }, req);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

router.put('/:id', requirePermission('products', 'update'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = productSchema.partial().parse(req.body);
    const product = await prisma.product.update({ where: { id }, data });
    await logAudit(req.user.id, 'update', 'product', id, data, req);
    res.json(product);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', requirePermission('products', 'delete'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return res.status(404).json({ error: 'Mahsulot topilmadi' });
    }
    await prisma.product.delete({ where: { id } });
    await logAudit(req.user.id, 'delete', 'product', id, { article: product.article }, req);
    res.json({ success: true });
  } catch (e) {
    if (e.code === 'P2003') return res.status(409).json({ error: 'Mahsulot savdo yoki spetsifikatsiyada ishlatilgan' });
    next(e);
  }
});

module.exports = router;
