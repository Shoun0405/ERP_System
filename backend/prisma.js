require('dotenv').config();
const { PrismaClient, Prisma } = require('@prisma/client');

// Pul maydonlari DB da `numeric(18,2)` (Decimal) — saqlash va SQL SUM aniq.
// Prisma `Decimal` obyektini API/JS uchun oddiy `number` ga aylantiramiz: shunda
// routelar, hisobotlar (running-balance) va frontend avvalgidek number bilan ishlaydi
// (string konkatenatsiya xatosi yo'q). `$queryRaw` natijalari bunга tegmaydi —
// ular allaqachon SQL da `::float` cast qilingan.
function decimalsToNumber(value) {
  if (value === null || value === undefined) return value;
  if (Prisma.Decimal.isDecimal(value)) return value.toNumber();
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = decimalsToNumber(value[i]);
    return value;
  }
  if (value instanceof Date) return value;
  if (typeof value === 'object') {
    for (const k of Object.keys(value)) value[k] = decimalsToNumber(value[k]);
    return value;
  }
  return value;
}

const prisma = new PrismaClient({
  log: process.env.NODE_ENV !== 'production' ? ['error', 'warn'] : ['error'],
}).$extends({
  name: 'decimalToNumber',
  query: {
    $allModels: {
      async $allOperations({ args, query }) {
        return decimalsToNumber(await query(args));
      },
    },
  },
});

module.exports = prisma;
