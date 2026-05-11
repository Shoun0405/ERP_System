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

module.exports = router;
