const router = require('express').Router();
const prisma = require('../prisma');
const { interactionSchema } = require('./_schemas');

router.get('/', async (req, res, next) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page)  || 1);
    const limit    = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const search   = (req.query.search  || '').trim();
    const clientId = req.query.clientId || '';
    const offset   = (page - 1) * limit;

    const where = {
      ...(clientId ? { clientId } : {}),
      ...(search ? {
        OR: [
          { client: { name: { contains: search, mode: 'insensitive' } } },
          { note:   { contains: search, mode: 'insensitive' } },
          { type:   { contains: search, mode: 'insensitive' } },
        ],
      } : {}),
    };

    const [interactions, total] = await Promise.all([
      prisma.interaction.findMany({
        where,
        include: { client: true },
        orderBy: { date: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.interaction.count({ where }),
    ]);

    res.json({ data: interactions, total, page, limit });
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { date, type, note, nextDate, clientId } = interactionSchema.parse(req.body);
    const interaction = await prisma.interaction.create({
      data: {
        date: new Date(date),
        type,
        note,
        nextDate: nextDate ? new Date(nextDate) : null,
        clientId,
      },
      include: { client: true },
    });
    res.json(interaction);
  } catch (e) {
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { date, type, note, nextDate, clientId } = interactionSchema.partial().parse(req.body);
    const interaction = await prisma.interaction.update({
      where: { id: req.params.id },
      data: {
        ...(date     !== undefined ? { date: new Date(date) }           : {}),
        ...(type     !== undefined ? { type }                           : {}),
        ...(note     !== undefined ? { note }                           : {}),
        ...(nextDate !== undefined ? { nextDate: nextDate ? new Date(nextDate) : null } : {}),
        ...(clientId !== undefined ? { clientId }                       : {}),
      },
      include: { client: true },
    });
    res.json(interaction);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.interaction.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
