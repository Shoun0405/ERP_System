const router = require('express').Router();
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

// Require authentication and read permission for all reports
router.use(authMiddleware);
router.use(requirePermission('reports', 'read'));

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

// GET /api/reports/client-statement/:clientId
router.get('/client-statement/:clientId', async (req, res, next) => {
  try {
    const { clientId } = req.params;

    const client = await prisma.client.findUnique({
      where: { id: clientId }
    });

    if (!client) {
      return res.status(404).json({ error: 'Mijoz topilmadi' });
    }

    const sales = await prisma.sale.findMany({
      where: { clientId },
      select: {
        id: true,
        date: true,
        nakladnoy: true,
        totalAmount: true,
      }
    });

    const payments = await prisma.payment.findMany({
      where: { clientId },
      select: {
        id: true,
        date: true,
        amount: true,
        note: true,
      }
    });

    const ledger = [];
    sales.forEach(s => {
      ledger.push({
        id: s.id,
        date: s.date,
        type: 'sale',
        doc: s.nakladnoy,
        debit: s.totalAmount,
        credit: 0,
        amount: s.totalAmount,
        desc: `Savdo (Nakladnoy № ${s.nakladnoy})`
      });
    });

    payments.forEach(p => {
      ledger.push({
        id: p.id,
        date: p.date,
        type: 'payment',
        doc: '',
        debit: 0,
        credit: p.amount,
        amount: -p.amount,
        desc: `To'lov` + (p.note ? ` (${p.note})` : '')
      });
    });

    ledger.sort((a, b) => new Date(a.date) - new Date(b.date));

    let runningBalance = 0;
    const ledgerWithBalance = ledger.map(item => {
      runningBalance += item.amount;
      return {
        ...item,
        balance: runningBalance
      };
    });

    res.json({
      client: {
        id: client.id,
        name: client.name,
        phone: client.phone
      },
      statement: ledgerWithBalance,
      finalBalance: runningBalance
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

// GET /api/reports/products-top?limit=10
router.get('/products-top', async (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
    const topProducts = await prisma.$queryRaw`
      SELECT 
        p.id, 
        p.article, 
        SUM(sp."totalPieces")::float as "totalPieces",
        SUM(sp."totalCbm")::float as "totalCbm",
        SUM(sp."rowAmount")::float as "totalAmount"
      FROM "SaleProduct" sp
      JOIN "Product" p ON p.id = sp."productId"
      GROUP BY p.id, p.article
      ORDER BY "totalPieces" DESC
      LIMIT ${limit}
    `;

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

module.exports = router;
