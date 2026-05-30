const router = require('express').Router();
const prisma = require('../prisma');
const { paymentSchema } = require('./_schemas');

router.get('/', async (req, res, next) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page)  || 1);
    const limit    = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const search   = (req.query.search   || '').trim();
    const clientId = req.query.clientId  || '';
    const from     = req.query.from      || '';
    const to       = req.query.to        || '';
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
          { client: { name: { contains: search, mode: 'insensitive' } } },
          { note:   { contains: search, mode: 'insensitive' } },
        ],
      } : {}),
    };

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          client:   { select: { id: true, name: true } },
          contract: { select: { id: true, number: true } },
        },
        orderBy: { date: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);

    res.json({ data: payments, total, page, limit });
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { date, amount, note, clientId, contractId } = paymentSchema.parse(req.body);

    if (contractId) {
      const contract = await prisma.contract.findUnique({
        where: { id: contractId },
        select: { clientId: true },
      });
      if (!contract) {
        return res.status(400).json({ error: 'Shartnoma topilmadi' });
      }
      if (contract.clientId !== clientId) {
        return res.status(400).json({ error: 'Kiritilgan shartnoma ushbu mijozga tegishli emas' });
      }
    }

    const payment = await prisma.payment.create({
      data: { date: new Date(date), amount, note, clientId, contractId: contractId || null },
      include: {
        client:   { select: { id: true, name: true } },
        contract: { select: { id: true, number: true } },
      },
    });
    res.json(payment);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.payment.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
