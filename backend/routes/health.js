const router = require('express').Router();
const prisma = require('../prisma');

router.get('/', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', uptime: Math.floor(process.uptime()), db: 'up' });
  } catch {
    res.status(503).json({ status: 'error', db: 'down' });
  }
});

module.exports = router;
