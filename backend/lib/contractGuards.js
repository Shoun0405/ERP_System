const prisma = require('../prisma');

// Shartnomaga bog'langan sotuv/to'lovlar sonini qaytaradi.
// "Bog'liq yozuv bo'lsa o'zgartirma/o'chirma" qoidasi uchun yagona manba.
async function countContractLinks(contractId) {
  // Faqat faol (o'chirilmagan) bog'lanishlar hisobga olinadi.
  const [sales, payments] = await Promise.all([
    prisma.sale.count({ where: { contractId, deletedAt: null } }),
    prisma.payment.count({ where: { contractId, deletedAt: null } }),
  ]);
  return { sales, payments, hasAny: sales > 0 || payments > 0 };
}

module.exports = { countContractLinks };
