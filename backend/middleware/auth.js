const { verifyToken } = require('../lib/jwt');

module.exports = (req, res, next) => {
  // M-1: Bypass faqat NODE_ENV=test VA TEST_AUTH_BYPASS=1 birga bo'lganda ishlaydi.
  // Shunday qilib prod da xato bilan NODE_ENV=test qo'yilsa ham auth chetlab o'tilmaydi.
  if (process.env.NODE_ENV === 'test' && process.env.TEST_AUTH_BYPASS === '1' && req.headers['x-bypass-auth'] !== 'false') {
    req.user = { id: 'test-admin-id', username: 'test-admin', role: 'admin' };
    return next();
  }

  let token = req.cookies?.token;
  
  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan (Token topilmadi)' });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan (Yaroqsiz token)' });
  }
};
