import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const prisma  = require('../prisma');

/** Test fayllar orasida tozalash uchun */
export async function cleanAll() {
  await prisma.saleProduct.deleteMany();
  await prisma.specProduct.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.specification.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.interaction.deleteMany();
  await prisma.client.deleteMany();
  await prisma.product.deleteMany();
}

let _seq = 0;
export const uid = () => String(Date.now()).slice(-7) + String(++_seq).padStart(2, '0');

export async function makeClient(extra = {}) {
  const n = uid();
  return prisma.client.create({
    data: { name: `Test Mijoz ${n}`, inn: n.padStart(9, '0'), status: 'Yangi', ...extra },
  });
}

export async function makeContract(clientId) {
  const n = uid();
  return prisma.contract.create({
    data: { number: `T-${n}`, date: new Date(), totalValue: 1_000_000, clientId },
  });
}

export async function makeProduct(extra = {}) {
  const n = uid();
  return prisma.product.create({
    data: {
      article: `Art-${n}`, density: 80, length: 2400, width: 1200,
      thickness: 12, sqmPerPce: 2.88, cbmPerPce: 0.034560, kgPerPce: 2.765,
      priceCbm: 5_000_000, priceTon: 62_500_000, priceSqm: 60_000,
      ...extra,
    },
  });
}
