const router = require('express').Router();
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const { VAT_RATE } = require('../lib/vat');

// Require authentication and read permission for all reports
router.use(authMiddleware);
router.use(requirePermission('reports', 'read'));

// Ixtiyoriy from/to ni Date ga aylantiradi (yaroqsiz sana → null = filtrsiz).
// `to` shu kun oxirigacha (23:59:59.999) qamrab oladi.
function parseRange(query) {
  let from = query.from ? new Date(query.from) : null;
  let to   = query.to   ? new Date(query.to)   : null;
  if (from && isNaN(from)) from = null;
  if (to && isNaN(to)) to = null;
  if (to) to.setHours(23, 59, 59, 999);
  return { from, to };
}

// Global Sozlamalardan QQS stavkasi (specs.js bilan bir xil pattern); default VAT_RATE.
async function getVatRate() {
  const setting = await prisma.setting.findUnique({ where: { id: 'global' } });
  if (!setting) return VAT_RATE;
  try {
    const rate = JSON.parse(setting.data)?.vatRate;
    return typeof rate === 'number' && rate >= 0 && rate <= 1 ? rate : VAT_RATE;
  } catch {
    return VAT_RATE;
  }
}

// GET /api/reports/sales-by-period?from=&to=
router.get('/sales-by-period', async (req, res, next) => {
  try {
    const fromDate = req.query.from ? new Date(req.query.from) : new Date(new Date().setDate(new Date().getDate() - 30));
    const toDate = req.query.to ? new Date(req.query.to) : new Date();

    // End of toDate to include transactions on that day
    toDate.setHours(23, 59, 59, 999);

    const aggregate = await prisma.sale.aggregate({
      where: {
        date: {
          gte: fromDate,
          lte: toDate
        }
      },
      _sum: {
        totalAmount: true
      },
      _count: {
        id: true
      }
    });

    const salesByDay = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('day', date) as day, 
        SUM("totalAmount")::float as amount,
        COUNT(id)::int as count
      FROM "Sale"
      WHERE date >= ${fromDate} AND date <= ${toDate}
      GROUP BY day
      ORDER BY day ASC
    `;

    res.json({
      totalAmount: aggregate._sum.totalAmount || 0,
      salesCount: aggregate._count.id || 0,
      salesByDay: salesByDay.map(row => ({
        day: row.day,
        amount: parseFloat(row.amount || 0),
        count: parseInt(row.count || 0)
      }))
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/client-by-contracts/:clientId?from=&to=
// Har bir shartnoma bo'yicha alohida saldo. Running balance SQL window funksiyada
// (SUM(signed) OVER ...) — butun harakatlar JS ga yuklanmaydi.
router.get('/client-by-contracts/:clientId', async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const { from, to } = parseRange(req.query);
    // KELAJAK: from/to berilmasa to'liq tarix qaytadi. Agar harakatlar soni juda
    // ko'paysa, default oraliq (masalan oxirgi 12 oy) qo'yib, "to'liq tarix" tugmasi
    // qo'shilishi mumkin (frontend hozir oraliqsiz to'liq kartani kutadi).

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) return res.status(404).json({ error: 'Mijoz topilmadi' });

    // Savdo (debit +) va to'lov (credit −) ni bitta signed-amount jadvalga birlashtirib,
    // shartnoma bo'yicha (contractId; NULL = shartnomasiz) running balance hisoblanadi.
    // Deterministik tartib: date, keyin createdAt, keyin id (bir xil sanada barqaror).
    const rows = await prisma.$queryRaw`
      SELECT
        id, "contractId", date, type, debit, credit, amount, "desc",
        SUM(amount) OVER (
          PARTITION BY "contractId"
          ORDER BY date, "createdAt", id
          ROWS UNBOUNDED PRECEDING
        )::float AS balance
      FROM (
        SELECT
          s.id, s."contractId", s.date, s."createdAt",
          'sale'::text AS type,
          s."totalAmount"::float AS debit,
          0::float               AS credit,
          s."totalAmount"::float AS amount,
          'Savdo (Nakladnoy № ' || s.nakladnoy || ')' AS "desc"
        FROM "Sale" s
        WHERE s."clientId" = ${clientId}
          AND (${from}::timestamp IS NULL OR s.date >= ${from})
          AND (${to}::timestamp   IS NULL OR s.date <= ${to})
        UNION ALL
        SELECT
          p.id, p."contractId", p.date, p."createdAt",
          'payment'::text AS type,
          0::float            AS debit,
          p.amount::float     AS credit,
          (-p.amount)::float  AS amount,
          'To''lov' || COALESCE(' (' || p.note || ')', '') AS "desc"
        FROM "Payment" p
        WHERE p."clientId" = ${clientId}
          AND (${from}::timestamp IS NULL OR p.date >= ${from})
          AND (${to}::timestamp   IS NULL OR p.date <= ${to})
      ) movements
      ORDER BY "contractId" NULLS LAST, date, "createdAt", id
    `;

    // Shartnoma meta (number, date, status) — guruh sarlavhasi va tartibi uchun.
    const contracts = await prisma.contract.findMany({
      where: { clientId },
      select: { id: true, number: true, date: true, status: true },
      orderBy: { date: 'asc' }
    });
    const contractMeta = new Map(contracts.map(c => [c.id, c]));
    const contractOrder = new Map(contracts.map((c, i) => [c.id, i]));

    // Harakatlarni contractId bo'yicha guruhlash (qator tartibi SQL dan kelgan).
    const byContract = new Map();
    for (const r of rows) {
      const key = r.contractId || null;
      if (!byContract.has(key)) byContract.set(key, []);
      byContract.get(key).push({
        id: r.id, date: r.date, type: r.type,
        debit: r.debit, credit: r.credit, amount: r.amount,
        desc: r.desc, balance: r.balance
      });
    }

    const groups = [];
    for (const [key, statement] of byContract) {
      if (statement.length === 0) continue;
      const meta = key ? contractMeta.get(key) : null;
      groups.push({
        contract: meta ? { id: meta.id, number: meta.number, date: meta.date, status: meta.status } : null,
        statement,
        finalBalance: statement.at(-1)?.balance ?? 0
      });
    }

    // Shartnomalar sana bo'yicha, shartnomasiz guruh oxirida.
    groups.sort((a, b) => {
      const oa = a.contract ? contractOrder.get(a.contract.id) : Infinity;
      const ob = b.contract ? contractOrder.get(b.contract.id) : Infinity;
      return oa - ob;
    });

    res.json({
      client: { id: client.id, name: client.name, phone: client.phone },
      groups,
      totalBalance: groups.reduce((s, g) => s + g.finalBalance, 0)
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/client-statement/:clientId?from=&to=
// Xronologik aylanma karta. Running balance SQL window funksiyada
// (SUM(signed) OVER ORDER BY date,createdAt,id) — JS da hisoblanmaydi.
router.get('/client-statement/:clientId', async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const { from, to } = parseRange(req.query);
    // KELAJAK: from/to berilmasa to'liq tarix qaytadi (frontend hozir shuni kutadi).
    // Aylanmalar juda ko'paysa default oraliq (oxirgi 12 oy) qo'shilishi mumkin.

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return res.status(404).json({ error: 'Mijoz topilmadi' });
    }

    // Savdo (debit +) va to'lov (credit −) signed-amount jadvalga UNION ALL bilan
    // birlashtirilib, deterministik tartibda (date, createdAt, id) running balance.
    const statement = await prisma.$queryRaw`
      SELECT
        id, date, type, doc, debit, credit, amount, "desc",
        SUM(amount) OVER (
          ORDER BY date, "createdAt", id
          ROWS UNBOUNDED PRECEDING
        )::float AS balance
      FROM (
        SELECT
          s.id, s.date, s."createdAt",
          'sale'::text AS type,
          s.nakladnoy  AS doc,
          s."totalAmount"::float AS debit,
          0::float               AS credit,
          s."totalAmount"::float AS amount,
          'Savdo (Nakladnoy № ' || s.nakladnoy || ')' AS "desc"
        FROM "Sale" s
        WHERE s."clientId" = ${clientId}
          AND (${from}::timestamp IS NULL OR s.date >= ${from})
          AND (${to}::timestamp   IS NULL OR s.date <= ${to})
        UNION ALL
        SELECT
          p.id, p.date, p."createdAt",
          'payment'::text AS type,
          ''::text        AS doc,
          0::float            AS debit,
          p.amount::float     AS credit,
          (-p.amount)::float  AS amount,
          'To''lov' || COALESCE(' (' || p.note || ')', '') AS "desc"
        FROM "Payment" p
        WHERE p."clientId" = ${clientId}
          AND (${from}::timestamp IS NULL OR p.date >= ${from})
          AND (${to}::timestamp   IS NULL OR p.date <= ${to})
      ) movements
      ORDER BY date, "createdAt", id
    `;

    res.json({
      client: { id: client.id, name: client.name, phone: client.phone },
      statement,
      finalBalance: statement.at(-1)?.balance ?? 0
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/debtors
router.get('/debtors', async (req, res, next) => {
  try {
    const debtors = await prisma.$queryRaw`
      SELECT 
        c.id, 
        c.name, 
        c.phone,
        COALESCE(s.total_sales, 0)::float as "totalSales",
        COALESCE(p.total_payments, 0)::float as "totalPayments",
        (COALESCE(s.total_sales, 0) - COALESCE(p.total_payments, 0))::float as debt
      FROM "Client" c
      LEFT JOIN (
        SELECT "clientId", SUM("totalAmount") as total_sales
        FROM "Sale"
        GROUP BY "clientId"
      ) s ON s."clientId" = c.id
      LEFT JOIN (
        SELECT "clientId", SUM(amount) as total_payments
        FROM "Payment"
        GROUP BY "clientId"
      ) p ON p."clientId" = c.id
      WHERE (COALESCE(s.total_sales, 0) - COALESCE(p.total_payments, 0)) > 0.01
      ORDER BY debt DESC
    `;

    res.json(debtors.map(row => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      totalSales: parseFloat(row.totalSales || 0),
      totalPayments: parseFloat(row.totalPayments || 0),
      debt: parseFloat(row.debt || 0)
    })));
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/products-top?limit=10&from=&to=
router.get('/products-top', async (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
    const fromDate = req.query.from ? new Date(req.query.from) : null;
    const toDate = req.query.to ? new Date(req.query.to) : null;
    if (toDate) toDate.setHours(23, 59, 59, 999);

    let topProducts;
    if (fromDate && toDate) {
      topProducts = await prisma.$queryRaw`
        SELECT
          p.id, p.article,
          SUM(sp."totalPieces")::float as "totalPieces",
          SUM(sp."totalCbm")::float   as "totalCbm",
          SUM(sp."rowAmount")::float  as "totalAmount"
        FROM "SaleProduct" sp
        JOIN "Product" p ON p.id = sp."productId"
        JOIN "Sale" s    ON s.id = sp."saleId"
        WHERE s.date >= ${fromDate} AND s.date <= ${toDate}
        GROUP BY p.id, p.article
        ORDER BY "totalPieces" DESC
        LIMIT ${limit}
      `;
    } else {
      topProducts = await prisma.$queryRaw`
        SELECT
          p.id, p.article,
          SUM(sp."totalPieces")::float as "totalPieces",
          SUM(sp."totalCbm")::float   as "totalCbm",
          SUM(sp."rowAmount")::float  as "totalAmount"
        FROM "SaleProduct" sp
        JOIN "Product" p ON p.id = sp."productId"
        GROUP BY p.id, p.article
        ORDER BY "totalPieces" DESC
        LIMIT ${limit}
      `;
    }

    res.json(topProducts.map(row => ({
      id: row.id,
      article: row.article,
      totalPieces: parseFloat(row.totalPieces || 0),
      totalCbm: parseFloat(row.totalCbm || 0),
      totalAmount: parseFloat(row.totalAmount || 0)
    })));
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/sales-by-client?from=&to=
router.get('/sales-by-client', async (req, res, next) => {
  try {
    const fromDate = req.query.from
      ? new Date(req.query.from)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = req.query.to ? new Date(req.query.to) : new Date();
    toDate.setHours(23, 59, 59, 999);

    const rows = await prisma.$queryRaw`
      SELECT
        c.id, c.name, c.phone,
        COUNT(s.id)::int         as sales_count,
        SUM(s."totalAmount")::float as total_amount
      FROM "Client" c
      JOIN "Sale" s ON s."clientId" = c.id
      WHERE s.date >= ${fromDate} AND s.date <= ${toDate}
      GROUP BY c.id, c.name, c.phone
      ORDER BY total_amount DESC
    `;

    res.json(rows.map(r => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      salesCount: parseInt(r.sales_count || 0),
      totalAmount: parseFloat(r.total_amount || 0)
    })));
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/payments-by-period?from=&to=
router.get('/payments-by-period', async (req, res, next) => {
  try {
    const fromDate = req.query.from
      ? new Date(req.query.from)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = req.query.to ? new Date(req.query.to) : new Date();
    toDate.setHours(23, 59, 59, 999);

    const [aggregate, paymentsByDay] = await Promise.all([
      prisma.payment.aggregate({
        where: { date: { gte: fromDate, lte: toDate } },
        _sum: { amount: true },
        _count: { id: true }
      }),
      prisma.$queryRaw`
        SELECT
          DATE_TRUNC('day', date) as day,
          SUM(amount)::float      as amount,
          COUNT(id)::int          as count
        FROM "Payment"
        WHERE date >= ${fromDate} AND date <= ${toDate}
        GROUP BY day
        ORDER BY day ASC
      `
    ]);

    res.json({
      totalAmount: aggregate._sum.amount || 0,
      paymentsCount: aggregate._count.id || 0,
      paymentsByDay: paymentsByDay.map(r => ({
        day: r.day,
        amount: parseFloat(r.amount || 0),
        count: parseInt(r.count || 0)
      }))
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/vat-report?from=&to=
// QQS (soliq deklaratsiyasi) hisoboti. Savdo totalAmount QQS-ichida deb hisoblanadi:
//   QQS = total / (1 + rate) * rate;  QQS siz = total − QQS.
// Stavka global Sozlamalardan (vatRate, default VAT_RATE). Oylik breakdown ham qaytadi.
router.get('/vat-report', async (req, res, next) => {
  try {
    const { from, to } = parseRange(req.query);
    const rate = await getVatRate();

    // Jami va oylik summalar SQL da (SUM), QQS hisoblash JS da — bitta stavka uchun
    // aniqligi muhim (Math.round 2 kasr, spec.js calcVat bilan bir xil mantiq).
    const [totalRow, byMonth] = await Promise.all([
      prisma.$queryRaw`
        SELECT
          COALESCE(SUM("totalAmount"), 0)::float AS total,
          COUNT(id)::int                         AS count
        FROM "Sale"
        WHERE (${from}::timestamp IS NULL OR date >= ${from})
          AND (${to}::timestamp   IS NULL OR date <= ${to})
      `,
      prisma.$queryRaw`
        SELECT
          TO_CHAR(date, 'YYYY-MM')      AS month,
          SUM("totalAmount")::float     AS total,
          COUNT(id)::int                AS count
        FROM "Sale"
        WHERE (${from}::timestamp IS NULL OR date >= ${from})
          AND (${to}::timestamp   IS NULL OR date <= ${to})
        GROUP BY month
        ORDER BY month ASC
      `,
    ]);

    const splitVat = (total) => {
      const vatAmount = Math.round(total / (1 + rate) * rate * 100) / 100;
      return { vatAmount, netAmount: Math.round((total - vatAmount) * 100) / 100 };
    };

    const total = parseFloat(totalRow[0]?.total || 0);
    const { vatAmount, netAmount } = splitVat(total);

    res.json({
      vatRate: rate,
      totalAmount: total,
      vatAmount,
      netAmount,
      salesCount: parseInt(totalRow[0]?.count || 0),
      byMonth: byMonth.map(r => {
        const mTotal = parseFloat(r.total || 0);
        const split = splitVat(mTotal);
        return {
          month: r.month,
          totalAmount: mTotal,
          vatAmount: split.vatAmount,
          netAmount: split.netAmount,
          count: parseInt(r.count || 0),
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/sales-by-seller?from=&to=
// Sotuvchi (Sale.sellerName) bo'yicha oborot: savdolar soni va jami summa,
// oborot kamayish tartibida.
router.get('/sales-by-seller', async (req, res, next) => {
  try {
    const { from, to } = parseRange(req.query);

    const rows = await prisma.$queryRaw`
      SELECT
        "sellerName"               AS seller,
        COUNT(id)::int             AS sales_count,
        SUM("totalAmount")::float  AS total_amount
      FROM "Sale"
      WHERE (${from}::timestamp IS NULL OR date >= ${from})
        AND (${to}::timestamp   IS NULL OR date <= ${to})
      GROUP BY "sellerName"
      ORDER BY total_amount DESC
    `;

    res.json(rows.map(r => ({
      sellerName: r.seller || '',
      salesCount: parseInt(r.sales_count || 0),
      totalAmount: parseFloat(r.total_amount || 0),
    })));
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/sellers-summary?from=&to=
// Sotuvchi (Contract.seller) bo'yicha qarz/haq: delivered (shartnoma savdolari),
// paid (shartnoma to'lovlari), balance = delivered − paid. To'lovda sotuvchi maydoni
// yo'q — shuning uchun attribution shartnoma orqali. Subquery agregatlar (Kartezian yo'q).
router.get('/sellers-summary', async (req, res, next) => {
  try {
    const { from, to } = parseRange(req.query);
    const rows = await prisma.$queryRaw`
      SELECT
        ct.seller AS seller,
        COALESCE(SUM(d.delivered), 0)::float AS delivered,
        COALESCE(SUM(p.paid), 0)::float      AS paid
      FROM "Contract" ct
      LEFT JOIN (
        SELECT "contractId", SUM("totalAmount") AS delivered
        FROM "Sale"
        WHERE (${from}::timestamp IS NULL OR date >= ${from})
          AND (${to}::timestamp   IS NULL OR date <= ${to})
        GROUP BY "contractId"
      ) d ON d."contractId" = ct.id
      LEFT JOIN (
        SELECT "contractId", SUM(amount) AS paid
        FROM "Payment"
        WHERE (${from}::timestamp IS NULL OR date >= ${from})
          AND (${to}::timestamp   IS NULL OR date <= ${to})
        GROUP BY "contractId"
      ) p ON p."contractId" = ct.id
      WHERE ct.seller IS NOT NULL AND ct.seller <> ''
      GROUP BY ct.seller
      ORDER BY (COALESCE(SUM(d.delivered), 0) - COALESCE(SUM(p.paid), 0)) DESC
    `;
    res.json(rows.map(r => {
      const delivered = parseFloat(r.delivered || 0);
      const paid = parseFloat(r.paid || 0);
      return { seller: r.seller, delivered, paid, balance: delivered - paid };
    }));
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/seller-by-contracts/:seller?from=&to=
// client-by-contracts ko'zgusi, lekin Contract.seller bo'yicha (barcha mijozlar kesimi).
// Har shartnoma bo'yicha running balance (savdo +, to'lov −), guruh metasida mijoz nomi.
router.get('/seller-by-contracts/:seller', async (req, res, next) => {
  try {
    const { seller } = req.params;
    const { from, to } = parseRange(req.query);

    const rows = await prisma.$queryRaw`
      SELECT
        id, "contractId", date, type, debit, credit, amount, "desc",
        SUM(amount) OVER (
          PARTITION BY "contractId"
          ORDER BY date, "createdAt", id
          ROWS UNBOUNDED PRECEDING
        )::float AS balance
      FROM (
        SELECT
          s.id, s."contractId", s.date, s."createdAt",
          'sale'::text AS type,
          s."totalAmount"::float AS debit,
          0::float               AS credit,
          s."totalAmount"::float AS amount,
          'Savdo (Nakladnoy № ' || s.nakladnoy || ')' AS "desc"
        FROM "Sale" s
        JOIN "Contract" ct ON ct.id = s."contractId"
        WHERE ct.seller = ${seller}
          AND (${from}::timestamp IS NULL OR s.date >= ${from})
          AND (${to}::timestamp   IS NULL OR s.date <= ${to})
        UNION ALL
        SELECT
          p.id, p."contractId", p.date, p."createdAt",
          'payment'::text AS type,
          0::float            AS debit,
          p.amount::float     AS credit,
          (-p.amount)::float  AS amount,
          'To''lov' || COALESCE(' (' || p.note || ')', '') AS "desc"
        FROM "Payment" p
        JOIN "Contract" ct ON ct.id = p."contractId"
        WHERE ct.seller = ${seller}
          AND (${from}::timestamp IS NULL OR p.date >= ${from})
          AND (${to}::timestamp   IS NULL OR p.date <= ${to})
      ) movements
      ORDER BY "contractId" NULLS LAST, date, "createdAt", id
    `;

    // Shartnoma meta (mijoz nomi bilan) — guruh sarlavhasi va tartibi uchun.
    const contracts = await prisma.contract.findMany({
      where: { seller },
      select: { id: true, number: true, date: true, status: true, client: { select: { name: true } } },
      orderBy: { date: 'asc' },
    });
    const contractMeta = new Map(contracts.map(c => [c.id, c]));
    const contractOrder = new Map(contracts.map((c, i) => [c.id, i]));

    const byContract = new Map();
    for (const r of rows) {
      const key = r.contractId;
      if (!byContract.has(key)) byContract.set(key, []);
      byContract.get(key).push({
        id: r.id, date: r.date, type: r.type,
        debit: r.debit, credit: r.credit, amount: r.amount,
        desc: r.desc, balance: r.balance,
      });
    }

    const groups = [];
    for (const [key, statement] of byContract) {
      if (statement.length === 0) continue;
      const meta = contractMeta.get(key);
      groups.push({
        contract: meta
          ? { id: meta.id, number: meta.number, date: meta.date, status: meta.status, clientName: meta.client?.name }
          : null,
        statement,
        finalBalance: statement.at(-1)?.balance ?? 0,
      });
    }
    groups.sort((a, b) => {
      const oa = a.contract ? contractOrder.get(a.contract.id) : Infinity;
      const ob = b.contract ? contractOrder.get(b.contract.id) : Infinity;
      return oa - ob;
    });

    res.json({
      seller,
      groups,
      totalBalance: groups.reduce((s, g) => s + g.finalBalance, 0),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
