const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  console.log('Old state of users:', users);

  for (const user of users) {
    if (!user.isActive) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isActive: true }
      });
      console.log(`User ${user.username} activated!`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
