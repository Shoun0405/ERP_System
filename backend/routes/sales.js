const router = require('express').Router();
const prisma = require('../prisma');
const { saleSchema } = require('./_schemas');
const { requireRole, requirePermission } = require('../middleware/rbac');
const { logAudit } = require('../lib/audit');
const { computeSaleRow } = require('../lib/saleCalc');

// C-2: payloaddagi mahsulotlarni o'qib, har qatorni SERVER tomonda qayta hisoblaydi.
// Mahsulot topilmasa 400. Qaytaradi: { rows, totalAmount } (klient qiymatlari e'tiborsiz).
async function recalcProducts(tx, products) {
  const ids = [...new Set(products.map(p => p.productId))];
  const found = await tx.product.findMany({ where: { id: { in: ids } } });
  const map = Object.fromEntries(found.map(p => [p.id, p]));

  const rows = products.map(p => {
    const product = map[p.productId];
    if (!product) {
      const err = new Error('Mahsulot topilmadi');
      err.status = 400;
      err.publicMessage = 'Mahsulot topilmadi';
      throw err;
    }
    return computeSaleRow(p, product);
  });
  const totalAmount = rows.reduce((sum, r) => sum + r.rowAmount, 0);
  return { rows, totalAmount };
}

router.get('/', requirePermission('sales', 'read'), async (req, res, next) => {
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
          products: {
            include: {
              product: { select: { id: true, article: true } }
            }
          },
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

router.get('/:id', requirePermission('sales', 'read'), async (req, res, next) => {
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

router.post('/', requirePermission('sales', 'create'), async (req, res, next) => {
  try {
    const parsed = saleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const { date, nakladnoy, sellerName, transportNum, clientId, products, facturaStatus } = parsed.data;
    let { contractId, specId } = parsed.data;

    const sale = await prisma.$transaction(async (tx) => {
      // C-2: summalarni server qayta hisoblaydi — klient yuborgan qiymatlarga ishonmaymiz
      const { rows, totalAmount } = await recalcProducts(tx, products);
      // 🔒 Data integrity: check contract-client matching
      if (contractId) {
        const contract = await tx.contract.findUnique({
          where: { id: contractId },
          select: { clientId: true }
        });
        if (!contract) {
          const err = new Error('Shartnoma topilmadi');
          err.status = 400;
          err.publicMessage = 'Shartnoma topilmadi';
          throw err;
        }
        if (contract.clientId !== clientId) {
          const err = new Error('Kiritilgan shartnoma ushbu mijozga tegishli emas');
          err.status = 400;
          err.publicMessage = 'Kiritilgan shartnoma ushbu mijozga tegishli emas';
          throw err;
        }
      }

      // specId lookup inside transaction to avoid TOCTOU race
      if (specId) {
        const spec = await tx.specification.findUnique({
          where: { id: specId },
          select: { contractId: true, contract: { select: { clientId: true } } },
        });
        if (!spec) {
          const err = new Error('Spetsifikatsiya topilmadi');
          err.status = 400;
          err.publicMessage = 'Spetsifikatsiya topilmadi';
          throw err;
        }
        if (spec.contract.clientId !== clientId) {
          const err = new Error('Kiritilgan spetsifikatsiya ushbu mijozga tegishli emas');
          err.status = 400;
          err.publicMessage = 'Kiritilgan spetsifikatsiya ushbu mijozga tegishli emas';
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
        data: rows.map(r => ({ ...r, saleId: s.id })),
      });
      return tx.sale.findUnique({
        where: { id: s.id },
        include: {
          client:   { select: { id: true, name: true } },
          contract: { select: { id: true, number: true } },
          spec:     { select: { id: true, number: true } },
          products: { include: { product: true } },
        },
      });
    });

    await logAudit(req.user.id, 'create', 'sale', sale.id, parsed.data, req);

    res.json(sale);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.publicMessage || e.message });
    if (e.message && e.message.includes('emas')) return res.status(400).json({ error: e.message });
    next(e);
  }
});

router.put('/:id', requirePermission('sales', 'update'), async (req, res, next) => {
  try {
    const data = saleSchema.partial().parse(req.body);
    const saleId = req.params.id;

    const updatedSale = await prisma.$transaction(async (tx) => {
      // Validate that sale exists
      const existingSale = await tx.sale.findUnique({ where: { id: saleId } });
      if (!existingSale) {
        const err = new Error('Yuk xati topilmadi');
        err.status = 404;
        err.publicMessage = 'Yuk xati topilmadi';
        throw err;
      }

      // If products are provided, rewrite and recalculate (C-2: server tomonda)
      let totalAmount = existingSale.totalAmount;
      if (data.products !== undefined) {
        const recalced = await recalcProducts(tx, data.products);
        totalAmount = recalced.totalAmount;

        // Remove old sale products
        await tx.saleProduct.deleteMany({ where: { saleId } });

        // Insert new sale products (server hosil qilgan qiymatlar)
        await tx.saleProduct.createMany({
          data: recalced.rows.map(r => ({ ...r, saleId }))
        });
      }

      // Check client-contract-spec matching if clientId or contractId or specId are changing
      const finalClientId = data.clientId !== undefined ? data.clientId : existingSale.clientId;
      let finalContractId = data.contractId !== undefined ? data.contractId : existingSale.contractId;
      const finalSpecId = data.specId !== undefined ? data.specId : existingSale.specId;

      if (finalSpecId) {
        const spec = await tx.specification.findUnique({
          where: { id: finalSpecId },
          include: { contract: true }
        });
        if (!spec) {
          const err = new Error('Spetsifikatsiya topilmadi');
          err.status = 400;
          err.publicMessage = 'Spetsifikatsiya topilmadi';
          throw err;
        }
        if (spec.contract.clientId !== finalClientId) {
          const err = new Error('Kiritilgan spetsifikatsiya ushbu mijozga tegishli emas');
          err.status = 400;
          err.publicMessage = 'Kiritilgan spetsifikatsiya ushbu mijozga tegishli emas';
          throw err;
        }
        finalContractId = spec.contractId;
      } else if (finalContractId) {
        const contract = await tx.contract.findUnique({
          where: { id: finalContractId },
          select: { clientId: true }
        });
        if (!contract) {
          const err = new Error('Shartnoma topilmadi');
          err.status = 400;
          err.publicMessage = 'Shartnoma topilmadi';
          throw err;
        }
        if (contract.clientId !== finalClientId) {
          const err = new Error('Kiritilgan shartnoma ushbu mijozga tegishli emas');
          err.status = 400;
          err.publicMessage = 'Kiritilgan shartnoma ushbu mijozga tegishli emas';
          throw err;
        }
      }

      return tx.sale.update({
        where: { id: saleId },
        data: {
          ...(data.date !== undefined ? { date: new Date(data.date) } : {}),
          ...(data.nakladnoy !== undefined ? { nakladnoy: data.nakladnoy } : {}),
          ...(data.sellerName !== undefined ? { sellerName: data.sellerName } : {}),
          ...(data.transportNum !== undefined ? { transportNum: data.transportNum || null } : {}),
          ...(data.clientId !== undefined ? { clientId: data.clientId } : {}),
          ...(finalContractId !== undefined ? { contractId: finalContractId || null } : {}),
          ...(data.specId !== undefined ? { specId: data.specId || null } : {}),
          ...(data.facturaStatus !== undefined ? { facturaStatus: data.facturaStatus } : {}),
          totalAmount
        },
        include: {
          client:   { select: { id: true, name: true } },
          contract: { select: { id: true, number: true } },
          spec:     { select: { id: true, number: true } },
          products: { include: { product: true } },
        },
      });
    });

    await logAudit(req.user.id, 'update', 'sale', saleId, data, req);

    res.json(updatedSale);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.publicMessage || e.message });
    if (e.message && e.message.includes('emas')) return res.status(400).json({ error: e.message });
    next(e);
  }
});

// Admin-only bulk delete
router.post('/bulk-delete', requirePermission('sales', 'delete'), async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids massiv bo\'lishi kerak' });
    await prisma.sale.deleteMany({
      where: { id: { in: ids } },
    });
    await logAudit(req.user.id, 'delete', 'sale', null, { ids }, req);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

router.post('/bulk-factura', requirePermission('sales', 'update'), async (req, res, next) => {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids massiv bo\'lishi kerak' });
    if (!['yuborildi', 'yuborilmagan'].includes(status)) return res.status(400).json({ error: 'Noto\'g\'ri status' });
    await prisma.sale.updateMany({
      where: { id: { in: ids } },
      data: { facturaStatus: status },
    });
    await logAudit(req.user.id, 'update', 'sale', null, { ids, status }, req);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

// Admin-only single delete
router.delete('/:id', requirePermission('sales', 'delete'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const sale = await prisma.sale.findUnique({ where: { id } });
    if (!sale) {
      return res.status(404).json({ error: 'Savdo topilmadi' });
    }
    await prisma.sale.delete({ where: { id } });
    await logAudit(req.user.id, 'delete', 'sale', id, { nakladnoy: sale.nakladnoy }, req);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
