const router = require('express').Router();
const prisma = require('../prisma');
const { specSchema } = require('./_schemas');
const { calcVat, calcRowTotal } = require('../lib/vat');
const { requireRole, requirePermission } = require('../middleware/rbac');
const { logAudit } = require('../lib/audit');

// GET /api/specs?contractId=
router.get('/', requirePermission('contracts', 'read'), async (req, res, next) => {
  try {
    const { contractId } = req.query;
    if (!contractId) return res.status(400).json({ error: 'contractId majburiy' });

    const specs = await prisma.specification.findMany({
      where: { contractId },
      include: { products: { include: { product: true } } },
      orderBy: { number: 'asc' },
    });

    // Har spets uchun delivered summa
    const ids = specs.map(s => s.id);
    let deliveredMap = {};
    if (ids.length > 0) {
      const rows = await prisma.$queryRaw`
        SELECT s."specId"::text, COALESCE(SUM(sp."rowAmount"), 0)::float AS delivered
        FROM "Sale" s
        LEFT JOIN "SaleProduct" sp ON sp."saleId" = s.id
        WHERE s."specId"::text = ANY(${ids})
        GROUP BY s."specId"
      `;
      deliveredMap = Object.fromEntries(rows.map(r => [r.specId, Number(r.delivered)]));
    }

    const data = specs.map(s => ({ ...s, deliveredAmount: deliveredMap[s.id] || 0 }));
    res.json({ data });
  } catch (e) { next(e); }
});

// POST /api/specs — transaction: spec + products + contract.specCounter++
router.post('/', requirePermission('contracts', 'create'), async (req, res, next) => {
  try {
    const body = specSchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      // MAX(spec.number) + 1 — o'chirilgan raqam qayta ishlatilmaydi
      const last = await tx.specification.aggregate({
        where: { contractId: body.contractId },
        _max:  { number: true },
      });
      const number = (last._max.number || 0) + 1;

      const productsData = body.products.map(p => {
        const rowTotal  = calcRowTotal(p.quantity, p.unitPriceVat);
        const vatAmount = calcVat(rowTotal);
        return {
          productId:    p.productId,
          unit:         p.unit,
          quantity:     p.quantity,
          unitPriceVat: p.unitPriceVat,
          rowTotal,
          vatAmount,
        };
      });
      const totalValue = productsData.reduce((s, p) => s + p.rowTotal, 0);

      const spec = await tx.specification.create({
        data: {
          number,
          contractId: body.contractId,
          date:       body.date ? new Date(body.date) : new Date(),
          notes:      body.notes || null,
          totalValue,
          products:   { create: productsData },
        },
        include: { products: { include: { product: true } } },
      });

      return spec;
    });

    await logAudit(req.user.id, 'create', 'specification', result.id, body, req);

    res.json(result);
  } catch (e) { next(e); }
});

// PUT /api/specs/:id — mahsulot qatorlari to'liq almashtiriladi
router.put('/:id', requirePermission('contracts', 'update'), async (req, res, next) => {
  try {
    const body = specSchema.partial({ contractId: true, products: true }).parse(req.body);
    // partial() default'larni saqlaydi (notes → ''); faqat yuborilgan kalitlarni yangilaymiz
    const sent = (k) => Object.prototype.hasOwnProperty.call(req.body, k);

    const updated = await prisma.$transaction(async (tx) => {
      if (body.products) {
        await tx.specProduct.deleteMany({ where: { specId: req.params.id } });
        const productsData = body.products.map(p => {
          const rowTotal  = calcRowTotal(p.quantity, p.unitPriceVat);
          const vatAmount = calcVat(rowTotal);
          return {
            specId:       req.params.id,
            productId:    p.productId,
            unit:         p.unit,
            quantity:     p.quantity,
            unitPriceVat: p.unitPriceVat,
            rowTotal,
            vatAmount,
          };
        });
        await tx.specProduct.createMany({ data: productsData });
        const totalValue = productsData.reduce((s, p) => s + p.rowTotal, 0);
        await tx.specification.update({
          where: { id: req.params.id },
          data: {
            totalValue,
            ...(sent('notes') ? { notes: body.notes || null } : {}),
            ...(sent('date')  ? { date: new Date(body.date) } : {}),
          },
        });
      } else {
        await tx.specification.update({
          where: { id: req.params.id },
          data: {
            ...(sent('notes') ? { notes: body.notes || null } : {}),
            ...(sent('date')  ? { date: new Date(body.date) } : {}),
          },
        });
      }
      return tx.specification.findUnique({
        where: { id: req.params.id },
        include: { products: { include: { product: true } } },
      });
    });

    await logAudit(req.user.id, 'update', 'specification', req.params.id, body, req);

    res.json(updated);
  } catch (e) { next(e); }
});

// DELETE /api/specs/:id — bog'langan Sale bo'lsa 409 (Admin-only)
router.delete('/:id', requirePermission('contracts', 'delete'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const spec = await prisma.specification.findUnique({ where: { id } });
    if (!spec) {
      return res.status(404).json({ error: 'Spetsifikatsiya topilmadi' });
    }
    // Sale.specId FK = SET NULL — bog'langan savdo bo'lsa Prisma xato bermaydi,
    // balki savdoni jimgina uzib qo'yadi. Shuning uchun app darajasida bloklaymiz.
    const saleCount = await prisma.sale.count({ where: { specId: id } });
    if (saleCount > 0) {
      return res.status(409).json({ error: "Bu spetsifikatsiya bo'yicha savdo mavjud, avval savdoni o'chiring" });
    }
    await prisma.specification.delete({ where: { id } });
    
    await logAudit(req.user.id, 'delete', 'specification', id, { number: spec.number }, req);

    res.json({ success: true });
  } catch (e) {
    if (e.code === 'P2003') return res.status(409).json({ error: "Bu spets bo'yicha savdo mavjud, avval savdoni o'chiring" });
    next(e);
  }
});

module.exports = router;
