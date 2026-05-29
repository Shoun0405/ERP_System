const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret_jwt_erp_system_123';

module.exports = (req, res, next) => {
  if (process.env.NODE_ENV === 'test' && req.headers['x-bypass-auth'] !== 'false') {
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
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan (Yaroqsiz token)' });
  }
};
