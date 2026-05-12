const router = require('express').Router();
const prisma = require('../prisma');
const { contractSchema } = require('./_schemas');

router.get('/', async (req, res, next) => {
  try {
    const { clientId } = req.query;
    const contracts = await prisma.contract.findMany({
      where: clientId ? { clientId } : undefined,
      include: { client: true },
      orderBy: { date: 'desc' },
    });
    res.json(contracts);
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { number, date, totalValue, clientId } = contractSchema.parse(req.body);
    const contract = await prisma.contract.create({
      data: { number, date: new Date(date), totalValue, clientId },
    });
    res.json(contract);
  } catch (e) {
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { number, date, totalValue } = contractSchema.partial().parse(req.body);
    const contract = await prisma.contract.update({
      where: { id: req.params.id },
      data: {
        ...(number     !== undefined ? { number }                   : {}),
        ...(date       !== undefined ? { date: new Date(date) }     : {}),
        ...(totalValue !== undefined ? { totalValue }               : {}),
      },
      include: { client: true },
    });
    res.json(contract);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.contract.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) {
    if (e.code === 'P2003') {
      const err = new Error();
      err.status = 409;
      err.publicMessage = "Bog'langan savdo yoki to'lov mavjud";
      return next(err);
    }
    next(e);
  }
});

module.exports = router;
