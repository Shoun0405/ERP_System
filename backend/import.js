require('dotenv').config();
const fs = require('fs');
const { randomUUID } = require('crypto');
const prisma = require('./prisma');

const DRY_RUN = process.argv.includes('--dry-run');

async function migrate() {
  if (DRY_RUN) console.log('[DRY-RUN] Haqiqiy yozish bo\'lmaydi.');
  console.log('Migratsiya boshlanmoqda...');

  if (!fs.existsSync('./erp_backup.json')) {
    console.error('XATOLIK: erp_backup.json fayli topilmadi!');
    return;
  }

  const data = JSON.parse(fs.readFileSync('./erp_backup.json', 'utf8'));

  try {
    if (data.clients?.length) {
      console.log(`${data.clients.length} ta mijoz...`);
      for (const c of data.clients) {
        if (DRY_RUN) { console.log('[DRY-RUN] client:', c.name); continue; }
        await prisma.client.upsert({
          where: { id: c.id },
          update: { name: c.name, status: c.status || 'Yangi', category: c.category || '' },
          create: {
            id: c.id,
            name: c.name,
            inn: c.inn || c.id,
            status: c.status || 'Yangi',
            category: c.category || '',
            createdAt: new Date(c.created_at || Date.now()),
          },
        });
      }
    }

    if (data.products?.length) {
      console.log(`${data.products.length} ta mahsulot...`);
      for (const p of data.products) {
        await prisma.product.upsert({
          where: { id: p.id },
          update: {},
          create: {
            id: p.id,
            article: p.article,
            density: parseFloat(p.density || 0),
            length: parseFloat(p.length || 0),
            width: parseFloat(p.width || 0),
            thickness: parseFloat(p.thickness || 0),
            priceCbm: parseFloat(p.price || p.priceCbm || 0),
            sqmPerPce: 0,
            cbmPerPce: 0,
            kgPerPce: 0,
          },
        });
      }
    }

    if (data.contracts?.length) {
      console.log(`${data.contracts.length} ta shartnoma...`);
      for (const c of data.contracts) {
        await prisma.contract.upsert({
          where: { id: c.id },
          update: {},
          create: {
            id: c.id,
            number: c.number,
            date: new Date(c.date || Date.now()),
            totalValue: parseFloat(c.totalValue || 0),
            clientId: c.clientId,
          },
        });
      }
    }

    if (data.sales?.length) {
      console.log(`${data.sales.length} ta savdo...`);
      for (const s of data.sales) {
        await prisma.sale.upsert({
          where: { id: s.id },
          update: {},
          create: {
            id: s.id,
            date: new Date(s.date || Date.now()),
            nakladnoy: s.nakladnoy || '',
            sellerName: s.sellerName || 'Sotuvchi',
            totalAmount: parseFloat(s.totalAmount || 0),
            clientId: s.clientId,
            contractId: s.contractId || null,
          },
        });
        if (s.products?.length) {
          for (const sp of s.products) {
            const spId = sp.id || randomUUID();
            await prisma.saleProduct.upsert({
              where: { id: spId },
              update: {},
              create: {
                id: spId,
                saleId: s.id,
                productId: sp.productId,
                packType: parseInt(sp.packType || 3),
                totalPieces: parseInt(sp.totalPieces || 0),
                totalCbm: parseFloat(sp.totalCbm || 0),
                totalKg: parseFloat(sp.totalKg || 0),
                totalSqm: parseFloat(sp.totalSqm || 0),
                priceCbm: parseFloat(sp.price || 0),
                rowAmount: parseFloat(sp.rowAmount || 0),
              },
            });
          }
        }
      }
    }

    if (data.payments?.length) {
      console.log(`${data.payments.length} ta tushum...`);
      for (const p of data.payments) {
        await prisma.payment.upsert({
          where: { id: p.id },
          update: {
            amount: parseFloat(p.amount || 0),
            note: p.note || '',
          },
          create: {
            id: p.id,
            date: new Date(p.date || Date.now()),
            amount: parseFloat(p.amount || 0),
            note: p.note || '',
            isFromExcel: true,
            clientId: p.clientId,
            contractId: p.contractId || null,
          },
        });
      }
    }

    console.log('Muvaffaqiyatli! Barcha ma\'lumotlar ko\'chirildi.');
  } catch (err) {
    console.error('Xatolik:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
