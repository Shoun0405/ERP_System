const jwt = require('jsonwebtoken');

// C-1: Zaif, qattiq yozilgan default sekret (`'secret_jwt_erp_system_123'`) olib tashlandi.
// Endi JWT_SECRET majburiy — bo'lmasa yoki juda qisqa bo'lsa server xavfsiz holatda
// ishga tusha olmaydi (graceful crash). Sekret bitta shu modulda — auth route va
// middleware ikkalasi ham shu yerdan oladi (ikki joyda takrorlanmaydi).
const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_TTL  = process.env.JWT_TTL || '24h';

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error(
    "[FATAL] JWT_SECRET environment o'zgaruvchisi topilmadi yoki 32 belgidan qisqa.\n" +
    "        Server xavfsiz ishlay olmaydi va to'xtatildi.\n" +
    "        .env fayliga kuchli tasodifiy sekret qo'shing, masalan:\n" +
    "        node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
  );
  process.exit(1);
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { signToken, verifyToken, TOKEN_TTL };
