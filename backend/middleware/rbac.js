function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan' });
    }

    // Bypass in test environment if configured (M-1: TEST_AUTH_BYPASS majburiy)
    if (process.env.NODE_ENV === 'test' && process.env.TEST_AUTH_BYPASS === '1' && req.headers['x-bypass-auth'] !== 'false') {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Ushbu amalni bajarish uchun sizda yetarli huquqlar mavjud emas' });
    }

    next();
  };
}

function requirePermission(module, action) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan' });
    }

    // Bypass in test environment if configured (M-1: TEST_AUTH_BYPASS majburiy)
    if (process.env.NODE_ENV === 'test' && process.env.TEST_AUTH_BYPASS === '1' && req.headers['x-bypass-auth'] !== 'false') {
      return next();
    }

    // Admins have full access to everything
    if (req.user.role === 'admin') {
      return next();
    }

    const permissions = req.user.permissions;
    if (!permissions) {
      return res.status(403).json({ error: 'Ushbu amalni bajarish uchun sizda yetarli huquqlar mavjud emas' });
    }

    const modulePerms = permissions[module];
    if (!modulePerms || !modulePerms[action]) {
      return res.status(403).json({ error: 'Ushbu amalni bajarish uchun sizda yetarli huquqlar mavjud emas' });
    }

    next();
  };
}

module.exports = { requireRole, requirePermission };
