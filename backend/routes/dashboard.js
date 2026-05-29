const router = require('express').Router();
const prisma = require('../prisma');

router.get('/', async (req, res, next) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const [
      salesAgg,
      paymentsAgg,
      todaySalesAgg,
      clientsCount,
      topDebtors,
      recentSales,
      monthlySalesRaw,
    ] = await Promise.all([
      prisma.sale.aggregate({ _sum: { totalAmount: true } }),
      prisma.payment.aggregate({ _sum: { amount: true } }),
      prisma.sale.aggregate({
        where: { date: { gte: todayStart, lte: todayEnd } },
        _sum: { totalAmount: true },
      }),
      prisma.client.count(),
      // Pre-aggregate to avoid Cartesian product between Sale and Payment
      prisma.$queryRaw`
        SELECT
          c.id, c.name,
          (COALESCE(s_agg.total, 0) - COALESCE(p_agg.total, 0))::float AS debt
        FROM "Client" c
        LEFT JOIN (
          SELECT "clientId", SUM("totalAmount") AS total FROM "Sale" GROUP BY "clientId"
        ) s_agg ON s_agg."clientId" = c.id
        LEFT JOIN (
          SELECT "clientId", SUM(amount) AS total FROM "Payment" GROUP BY "clientId"
        ) p_agg ON p_agg."clientId" = c.id
        WHERE (COALESCE(s_agg.total, 0) - COALESCE(p_agg.total, 0)) > 0
        ORDER BY debt DESC
        LIMIT 5
      `,
      prisma.sale.findMany({
        take: 5,
        orderBy: { date: 'desc' },
        include: { client: { select: { id: true, name: true } } },
      }),
      prisma.$queryRaw`
        SELECT
          TO_CHAR(date, 'YYYY-MM') AS month_key,
          SUM("totalAmount") AS amount
        FROM "Sale"
        WHERE date >= ${sixMonthsAgo}
        GROUP BY month_key
        ORDER BY month_key
      `,
    ]);

    const totalSales = salesAgg._sum.totalAmount || 0;
    const totalPaid  = paymentsAgg._sum.amount   || 0;
    const totalDebt  = totalSales - totalPaid;
    const todayTotal = todaySalesAgg._sum.totalAmount || 0;

    const debtors = topDebtors.map(d => ({
      id: d.id, name: d.name, debt: Number(d.debt),
    }));

    const monthNames = ['Yan','Fev','Mar','Apr','May','Iyn','Iyl','Avg','Sen','Okt','Noy','Dek'];
    const monthlyMap = {};
    monthlySalesRaw.forEach(r => { monthlyMap[r.month_key] = Number(r.amount); });

    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyData.push({ month: monthNames[d.getMonth()], amount: monthlyMap[key] || 0 });
    }

    res.json({ totalDebt, todayTotal, clientsCount, debtors, recentSales, monthlyData });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
