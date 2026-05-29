const prisma = require('../backend/prisma');
const bcrypt = require('../backend/node_modules/bcryptjs');

async function main() {
  const username = 'admin';
  const plainPassword = 'admin123';
  
  console.log('Seeding default administrator user...');
  try {
    const existing = await prisma.user.findUnique({
      where: { username }
    });
    
    if (existing) {
      console.log(`User "${username}" already exists.`);
      return;
    }
    
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        role: 'admin'
      }
    });
    
    console.log(`Default administrator user "${user.username}" created successfully with role "${user.role}".`);
  } catch (err) {
    console.error('Error seeding user:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
