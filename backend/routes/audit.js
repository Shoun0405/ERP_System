const router = require('express').Router();
const prisma = require('../prisma');
const { requireRole } = require('../middleware/rbac');

// Audit jurnali — faqat admin ko'ra oladi.
router.use(requireRole('admin'));

// GET /api/audit — filtr (entityType, action, userId, from, to) + pagination.
router.get('/', async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const skip  = (page - 1) * limit;

    const where = {};
    if (req.query.entityType) where.entityType = String(req.query.entityType);
    if (req.query.action)     where.action     = String(req.query.action);
    if (req.query.userId)     where.userId     = String(req.query.userId);

    if (req.query.from || req.query.to) {
      where.createdAt = {};
      if (req.query.from) {
        const from = new Date(req.query.from);
        if (!isNaN(from)) where.createdAt.gte = from;
      }
      if (req.query.to) {
        const to = new Date(req.query.to);
        // "to" — kun oxirigacha kiritiladi (inklyuziv sana filtri)
        if (!isNaN(to)) where.createdAt.lte = to;
      }
    }

    // include.user — bitta to-one join (cartesian emas), shuning uchun N+1 yo'q.
    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { username: true, fullName: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ data, total, page, limit });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
