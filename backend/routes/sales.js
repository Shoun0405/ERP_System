const router = require('express').Router();
const prisma = require('../prisma');
const { saleSchema } = require('./_schemas');
const { requireRole, requirePermission, requireSuperAdmin } = require('../middleware/rbac');
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

// #7: yuk xati sanasi bog'langan shartnoma sanasidan oldin bo'lishi mumkin emas.
// Faqat KUN bo'yicha solishtiriladi (soat hisobga olinmaydi) — shartnoma sanasi
// vaqt komponenti bilan saqlangan bo'lsa ham bir kunlik savdo rad etilmaydi.
function dayUTC(d) {
  const x = new Date(d);
  return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
}
function assertSaleDateNotBeforeContract(saleDateStr, contractDate) {
  if (saleDateStr && contractDate && dayUTC(saleDateStr) < dayUTC(contractDate)) {
    const err = new Error('Yuk xati sanasi shartnoma sanasidan oldin bo\'lishi mumkin emas');
    err.status = 400;
    err.publicMessage = err.message;
    throw err;
  }
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

    // createdAt ikkilamchi tartib — bir kunda yaratilgan yozuvlar soat bo'yicha tartiblanadi
    let orderBy;
    if (sortBy === 'client') {
      orderBy = [{ client: { name: sortDir } }, { createdAt: sortDir }];
    } else if (sortBy === 'contract') {
      orderBy = [{ contract: { number: sortDir } }, { createdAt: sortDir }];
    } else if (sortBy === 'spec') {
      orderBy = [{ spec: { number: sortDir } }, { createdAt: sortDir }];
    } else {
      const allowedCols = ['date', 'nakladnoy', 'sellerName', 'totalAmount', 'facturaStatus'];
      const col = allowedCols.includes(sortBy) ? sortBy : 'date';
      orderBy = col === 'createdAt' ? [{ createdAt: sortDir }] : [{ [col]: sortDir }, { createdAt: sortDir }];
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
          select: { clientId: true, date: true }
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
        assertSaleDateNotBeforeContract(date, contract.date);
      }

      // specId lookup inside transaction to avoid TOCTOU race
      if (specId) {
        const spec = await tx.specification.findUnique({
          where: { id: specId },
          select: { contractId: true, contract: { select: { clientId: true, date: true } } },
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
        assertSaleDateNotBeforeContract(date, spec.contract.date);
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
          createdById: req.user.id,
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
      const finalDate = data.date !== undefined ? data.date : existingSale.date;

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
        assertSaleDateNotBeforeContract(finalDate, spec.contract.date);
        finalContractId = spec.contractId;
      } else if (finalContractId) {
        const contract = await tx.contract.findUnique({
          where: { id: finalContractId },
          select: { clientId: true, date: true }
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
        assertSaleDateNotBeforeContract(finalDate, contract.date);
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
          totalAmount,
          updatedById: req.user.id,
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

// Bulk soft-delete
router.post('/bulk-delete', requirePermission('sales', 'delete'), async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids massiv bo\'lishi kerak' });
    await prisma.sale.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data:  { deletedAt: new Date(), deletedById: req.user.id },
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

// Soft-delete (o'chirilgan holatga o'tkazadi — qaytarib bo'ladi)
router.delete('/:id', requirePermission('sales', 'delete'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const sale = await prisma.sale.findUnique({ where: { id } });
    if (!sale) {
      return res.status(404).json({ error: 'Savdo topilmadi' });
    }
    await prisma.sale.update({ where: { id }, data: { deletedAt: new Date(), deletedById: req.user.id } });
    await logAudit(req.user.id, 'delete', 'sale', id, { nakladnoy: sale.nakladnoy }, req);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

// superAdmin: butunlay (hard) o'chirish
router.delete('/:id/hard', requireSuperAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const sale = await prisma.sale.findUnique({ where: { id } });
    if (!sale) return res.status(404).json({ error: 'Savdo topilmadi' });
    await prisma.sale.delete({ where: { id } });
    await logAudit(req.user.id, 'hard-delete', 'sale', id, { nakladnoy: sale.nakladnoy }, req);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

// superAdmin: tiklash (restore)
router.post('/:id/restore', requireSuperAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const sale = await prisma.sale.findUnique({ where: { id } });
    if (!sale) return res.status(404).json({ error: 'Savdo topilmadi' });
    await prisma.sale.update({ where: { id }, data: { deletedAt: null, deletedById: null } });
    await logAudit(req.user.id, 'restore', 'sale', id, { nakladnoy: sale.nakladnoy }, req);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
