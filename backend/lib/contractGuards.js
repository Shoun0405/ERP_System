const prisma = require('../prisma');

// Shartnomaga bog'langan sotuv/to'lovlar sonini qaytaradi.
// "Bog'liq yozuv bo'lsa o'zgartirma/o'chirma" qoidasi uchun yagona manba.
async function countContractLinks(contractId) {
  const [sales, payments] = await Promise.all([
    prisma.sale.count({ where: { contractId } }),
    prisma.payment.count({ where: { contractId } }),
  ]);
  return { sales, payments, hasAny: sales > 0 || payments > 0 };
}

module.exports = { countContractLinks };
