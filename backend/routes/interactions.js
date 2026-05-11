const router = require('express').Router();
const prisma = require('../prisma');
const { interactionSchema } = require('./_schemas');

router.get('/', async (req, res, next) => {
  try {
    const { clientId } = req.query;
    const interactions = await prisma.interaction.findMany({
      where: clientId ? { clientId } : undefined,
      include: { client: true },
      orderBy: { date: 'desc' },
    });
    res.json(interactions);
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
    });
    res.json(interaction);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
