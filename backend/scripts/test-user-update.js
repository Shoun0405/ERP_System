const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const olimtoy = await prisma.user.findFirst({ where: { username: '123' } });
  console.log('Olimtoy before update:', olimtoy);

  const updated = await prisma.user.update({
    where: { id: olimtoy.id },
    data: {
      permissions: {
        clients: { read: true, create: false, update: false, delete: false }
      }
    }
  });
  console.log('Olimtoy after update:', updated);
}

main().catch(console.error).finally(() => prisma.$disconnect());
