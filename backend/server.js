const app    = require('./app');
const prisma = require('./prisma');

const PORT   = process.env.PORT || 3001;
const server = app.listen(PORT, () =>
  console.log(`Backend running on http://localhost:${PORT}`)
);

['SIGINT', 'SIGTERM'].forEach(sig =>
  process.on(sig, async () => {
    console.log(`\n${sig} — server yopilmoqda...`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  })
);
