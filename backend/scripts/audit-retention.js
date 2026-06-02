// Audit retention — N kundan eski AuditLog yozuvlarini o'chiradi.
// Foydalanish: node scripts/audit-retention.js [DAYS]
//   yoki env: AUDIT_RETENTION_DAYS=365
// Idempotent: deleteMany o'zi idempotent, 2-marta ishlatilganda crash bermaydi.

const prisma = require('../prisma');

async function main() {
  const argDays = parseInt(process.argv[2], 10);
  const envDays = parseInt(process.env.AUDIT_RETENTION_DAYS, 10);
  const days = Number.isFinite(argDays) ? argDays
             : Number.isFinite(envDays) ? envDays
             : 365;

  if (!Number.isFinite(days) || days < 0) {
    console.error(`Noto'g'ri kunlar soni: ${process.argv[2] ?? process.env.AUDIT_RETENTION_DAYS}`);
    process.exitCode = 1;
    return;
  }

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const { count } = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  console.log(`[audit-retention] ${days} kundan eski (${cutoff.toISOString()} dan oldingi) ${count} ta yozuv o'chirildi.`);
}

main()
  .catch((e) => {
    console.error('[audit-retention] xato:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
