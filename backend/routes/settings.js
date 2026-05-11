const router = require('express').Router();
const prisma = require('../prisma');
const { settingSchema } = require('./_schemas');

const DEFAULT_SETTINGS = {
  companyName: '', companyAddress: '', companyInn: '',
  companyPhone: '', companyBank: '', companyMfo: '', companyAccount: '',
  sellers: [],
};

router.get('/', async (req, res, next) => {
  try {
    let setting = await prisma.setting.findUnique({ where: { id: 'global' } });
    if (!setting) {
      setting = await prisma.setting.create({
        data: { id: 'global', data: JSON.stringify(DEFAULT_SETTINGS) },
      });
    }
    res.json({ ...JSON.parse(setting.data), updatedAt: setting.updatedAt });
  } catch (e) {
    next(e);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const validated = settingSchema.parse(req.body);
    const setting = await prisma.setting.upsert({
      where:  { id: 'global' },
      update: { data: JSON.stringify(validated) },
      create: { id: 'global', data: JSON.stringify(validated) },
    });
    res.json({ ...JSON.parse(setting.data), updatedAt: setting.updatedAt });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
