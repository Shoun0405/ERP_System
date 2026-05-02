const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
  console.log('Migratsiya boshlanmoqda...');
  
  if (!fs.existsSync('./erp_backup.json')) {
    console.error('XATOLIK: erp_backup.json fayli topilmadi!');
    return;
  }

  const raw = fs.readFileSync('./erp_backup.json', 'utf8');
  const data = JSON.parse(raw);

  try {
    // Mijozlar
    if (data.clients && data.clients.length > 0) {
      console.log(`${data.clients.length} ta mijoz ko'chirilmoqda...`);
      for (const c of data.clients) {
        await prisma.client.create({
          data: {
            id: c.id,
            name: c.name,
            inn: c.inn || '',
            status: c.status || 'Yangi',
            category: c.category || '',
            createdAt: new Date(c.created_at || Date.now())
          }
        });
      }
    }

    // Maxsulotlar
    if (data.products && data.products.length > 0) {
      console.log(`${data.products.length} ta maxsulot ko'chirilmoqda...`);
      for (const p of data.products) {
        await prisma.product.create({
          data: {
            id: p.id,
            article: p.article,
            density: parseFloat(p.density || 0),
            length: parseFloat(p.length || 0),
            width: parseFloat(p.width || 0),
            thickness: parseFloat(p.thickness || 0),
            priceCbm: parseFloat(p.price || p.priceCbm || 0),
            sqmPerPce: 0, cbmPerPce: 0, kgPerPce: 0
          }
        });
      }
    }

    // Shartnomalar
    if (data.contracts && data.contracts.length > 0) {
      console.log(`${data.contracts.length} ta shartnoma ko'chirilmoqda...`);
      for (const c of data.contracts) {
        await prisma.contract.create({
          data: {
            id: c.id,
            number: c.number,
            date: new Date(c.date || Date.now()),
            totalValue: parseFloat(c.totalValue || 0),
            clientId: c.clientId
          }
        });
      }
    }

    // Savdolar
    if (data.sales && data.sales.length > 0) {
      console.log(`${data.sales.length} ta savdo ko'chirilmoqda...`);
      for (const s of data.sales) {
        await prisma.sale.create({
          data: {
            id: s.id,
            date: new Date(s.date || Date.now()),
            nakladnoy: s.nakladnoy || '',
            sellerName: s.sellerName || 'Sotuvchi',
            totalAmount: parseFloat(s.totalAmount || 0),
            clientId: s.clientId,
            contractId: s.contractId || (data.contracts[0] ? data.contracts[0].id : '') 
          }
        });
        // Mahsulotlari
        if (s.products) {
          for (const sp of s.products) {
            await prisma.saleProduct.create({
              data: {
                id: sp.id || require('crypto').randomUUID(),
                saleId: s.id,
                productId: sp.productId,
                packType: parseInt(sp.packType || 3),
                totalPieces: parseInt(sp.totalPieces || 0),
                totalCbm: parseFloat(sp.totalCbm || 0),
                totalKg: parseFloat(sp.totalKg || 0),
                totalSqm: parseFloat(sp.totalSqm || 0),
                priceCbm: parseFloat(sp.price || 0),
                rowAmount: parseFloat(sp.rowAmount || 0)
              }
            });
          }
        }
      }
    }

    // Tushumlar
    if (data.payments && data.payments.length > 0) {
      console.log(`${data.payments.length} ta tushum ko'chirilmoqda...`);
      for (const p of data.payments) {
        await prisma.payment.create({
          data: {
            id: p.id,
            date: new Date(p.date || Date.now()),
            amount: parseFloat(p.amount || 0),
            note: p.note || '',
            clientId: p.clientId,
            contractId: p.contractId || ''
          }
        });
      }
    }

    console.log('Muvaffaqiyatli! Barcha ma`lumotlar yangi bazaga o`tkazildi.');
  } catch (err) {
    console.error('Xatolik yuz berdi:', err);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
