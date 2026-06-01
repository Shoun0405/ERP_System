const router = require('express').Router();
const prisma = require('../prisma');
const { settingSchema } = require('./_schemas');
const { requireRole, requirePermission } = require('../middleware/rbac');
const { logAudit } = require('../lib/audit');

const DEFAULT_SETTINGS = {
  companyName: '', companyAddress: '', companyInn: '',
  companyPhone: '', companyBank: '', companyMfo: '', companyAccount: '',
  sellers: [],
};

router.get('/', async (req, res, next) => {
  try {
    // upsert to avoid race condition on first request (findUnique + create is not atomic)
    const setting = await prisma.setting.upsert({
      where:  { id: 'global' },
      update: {},
      create: { id: 'global', data: JSON.stringify(DEFAULT_SETTINGS) },
    });
    res.json({ ...JSON.parse(setting.data), updatedAt: setting.updatedAt });
  } catch (e) {
    next(e);
  }
});

// Admin-only update settings
router.put('/', requirePermission('settings', 'update'), async (req, res, next) => {
  try {
    const validated = settingSchema.parse(req.body);
    const setting = await prisma.setting.upsert({
      where:  { id: 'global' },
      update: { data: JSON.stringify(validated) },
      create: { id: 'global', data: JSON.stringify(validated) },
    });
    
    await logAudit(req.user.id, 'update', 'setting', 'global', validated, req);

    res.json({ ...JSON.parse(setting.data), updatedAt: setting.updatedAt });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
