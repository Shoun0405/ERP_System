const router = require('express').Router();
const prisma = require('../prisma');
const { paymentSchema } = require('./_schemas');
const { requireRole, requirePermission } = require('../middleware/rbac');
const { logAudit } = require('../lib/audit');

router.get('/', requirePermission('payments', 'read'), async (req, res, next) => {
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

router.post('/', requirePermission('payments', 'create'), async (req, res, next) => {
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

    await logAudit(req.user.id, 'create', 'payment', payment.id, { date, amount, note, clientId, contractId }, req);

    res.json(payment);
  } catch (e) {
    next(e);
  }
});

// Admin-only delete
router.delete('/:id', requirePermission('payments', 'delete'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) {
      return res.status(404).json({ error: 'To\'lov topilmadi' });
    }
    await prisma.payment.delete({ where: { id } });
    await logAudit(req.user.id, 'delete', 'payment', id, { amount: payment.amount }, req);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
