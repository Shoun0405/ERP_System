require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const prisma = require('../prisma');

// Mavjud Contract.number lardan yearPart va numericPart ni ajratib to'ldiradi.
// Idempotent: ikkinchi marta ishlatilsa numericPart != 0 bo'lganlarni o'tkazib ketadi.
// Format: "26-01" → yearPart=26, numericPart=1
//          "26-3"  → yearPart=26, numericPart=3
//          boshqacha → currentYear, MAX+1

async function main() {
  const dry = process.argv.includes('--dry-run');
  const contracts = await prisma.contract.findMany({
    where: { numericPart: 0 },
    orderBy: { createdAt: 'asc' },
  });

  if (contracts.length === 0) {
    console.log('Backfill kerak emas — barcha shartnomalar allaqachon sozlangan.');
    return;
  }

  console.log(`${contracts.length} ta shartnoma sozlanadi...`);
  const currentYear = new Date().getFullYear() % 100;

  // Yil bo'yicha MAX ni oldindan yuklab olamiz
  const maxByYear = {};

  for (const c of contracts) {
    const m = /^(\d{1,2})-(\d+)$/.exec(c.number);
    let yearPart, numericPart;

    if (m) {
      yearPart    = parseInt(m[1], 10);
      numericPart = parseInt(m[2], 10);
    } else {
      yearPart = currentYear;
      if (!maxByYear[yearPart]) {
        const row = await prisma.contract.aggregate({
          where: { yearPart },
          _max: { numericPart: true },
        });
        maxByYear[yearPart] = row._max.numericPart || 0;
      }
      maxByYear[yearPart] += 1;
      numericPart = maxByYear[yearPart];
    }

    console.log(`  ${c.number} → yearPart=${yearPart}, numericPart=${numericPart}${dry ? ' [DRY]' : ''}`);

    if (!dry) {
      await prisma.contract.update({
        where: { id: c.id },
        data: { yearPart, numericPart },
      });
    }
  }

  console.log(dry ? 'Dry-run yakunlandi.' : 'Backfill yakunlandi.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
