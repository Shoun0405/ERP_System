const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// ─────────────────────────────────────────────
// CLIENTS
// ─────────────────────────────────────────────
app.get('/api/clients', async (req, res) => {
  try {
    const clients = await prisma.client.findMany({
      include: {
        contracts: true,
        sales: { select: { totalAmount: true } },
        payments: { select: { amount: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    // Qarzdorlikni hisoblash
    const withDebt = clients.map(c => ({
      ...c,
      totalSales: c.sales.reduce((s, x) => s + x.totalAmount, 0),
      totalPaid: c.payments.reduce((s, x) => s + x.amount, 0),
      debt: c.sales.reduce((s, x) => s + x.totalAmount, 0) - c.payments.reduce((s, x) => s + x.amount, 0),
    }));
    res.json(withDebt);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/clients', async (req, res) => {
  try {
    const client = await prisma.client.create({ data: req.body });
    res.json(client);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Prisma managed va computed maydonlarni olib tashlaymiz
    const { id: _id, createdAt, contracts, sales, payments, interactions, debt, totalSales, totalPaid, ...data } = req.body;
    const client = await prisma.client.update({ where: { id }, data });
    res.json(client);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.client.delete({ where: { id } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// PRODUCTS
// ─────────────────────────────────────────────
app.get('/api/products', async (req, res) => {
  try {
    const products = await prisma.product.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(products);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const p = req.body;
    const product = await prisma.product.create({
      data: {
        article: p.article,
        density: parseFloat(p.density),
        length: parseFloat(p.length),
        width: parseFloat(p.width),
        thickness: parseFloat(p.thickness),
        priceCbm: parseFloat(p.priceCbm) || 0,
        priceTon: parseFloat(p.priceTon) || 0,
        priceSqm: parseFloat(p.priceSqm) || 0,
        cbmPerPce: parseFloat(p.cbmPerPce) || 0,
        sqmPerPce: parseFloat(p.sqmPerPce) || 0,
        kgPerPce: parseFloat(p.kgPerPce) || 0,
      },
    });
    res.json(product);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Barcha mahsulotlar narxini bir yo'la yangilash
app.put('/api/products/bulk-price', async (req, res) => {
  try {
    const { updates } = req.body; // [{id, priceTon, priceCbm, priceSqm}]
    await Promise.all(updates.map(u =>
      prisma.product.update({
        where: { id: u.id },
        data: {
          priceTon: parseFloat(u.priceTon) || 0,
          priceCbm: parseFloat(u.priceCbm) || 0,
          priceSqm: parseFloat(u.priceSqm) || 0,
        },
      })
    ));
    const products = await prisma.product.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(products);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const p = req.body;
    const product = await prisma.product.update({
      where: { id },
      data: {
        article: p.article,
        density: parseFloat(p.density),
        length: parseFloat(p.length),
        width: parseFloat(p.width),
        thickness: parseFloat(p.thickness),
        priceCbm: parseFloat(p.priceCbm) || 0,
        priceTon: parseFloat(p.priceTon) || 0,
        priceSqm: parseFloat(p.priceSqm) || 0,
        cbmPerPce: parseFloat(p.cbmPerPce) || 0,
        sqmPerPce: parseFloat(p.sqmPerPce) || 0,
        kgPerPce: parseFloat(p.kgPerPce) || 0,
      },
    });
    res.json(product);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// CONTRACTS
// ─────────────────────────────────────────────
app.get('/api/contracts', async (req, res) => {
  try {
    const { clientId } = req.query;
    const contracts = await prisma.contract.findMany({
      where: clientId ? { clientId } : undefined,
      include: { client: true },
      orderBy: { date: 'desc' },
    });
    res.json(contracts);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/contracts', async (req, res) => {
  try {
    const { number, date, totalValue, clientId } = req.body;
    const contract = await prisma.contract.create({
      data: {
        number,
        date: new Date(date),
        totalValue: parseFloat(totalValue),
        clientId,
      },
    });
    res.json(contract);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// SALES (Yuk xatlari)
// ─────────────────────────────────────────────
app.get('/api/sales', async (req, res) => {
  try {
    const sales = await prisma.sale.findMany({
      include: {
        client: true,
        contract: true,
        products: { include: { sale: false } },
      },
      orderBy: { date: 'desc' },
    });
    res.json(sales);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/sales/:id', async (req, res) => {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: req.params.id },
      include: { client: true, contract: true, products: true },
    });
    if (!sale) return res.status(404).json({ error: 'Topilmadi' });
    res.json(sale);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/sales', async (req, res) => {
  try {
    const { date, nakladnoy, sellerName, transportNum, clientId, contractId, products } = req.body;

    const totalAmount = products.reduce((sum, p) => sum + parseFloat(p.rowAmount), 0);

    const sale = await prisma.sale.create({
      data: {
        date: new Date(date),
        nakladnoy,
        sellerName,
        transportNum: transportNum || '',
        totalAmount,
        clientId,
        contractId,
        products: {
          create: products.map(p => ({
            productId: p.productId,
            packType: parseInt(p.packType),
            totalPieces: parseInt(p.totalPieces),
            totalCbm: parseFloat(p.totalCbm),
            totalKg: parseFloat(p.totalKg),
            totalSqm: parseFloat(p.totalSqm),
            priceCbm: parseFloat(p.priceCbm),
            rowAmount: parseFloat(p.rowAmount),
          })),
        },
      },
      include: { client: true, contract: true, products: true },
    });
    res.json(sale);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/sales/:id', async (req, res) => {
  try {
    await prisma.sale.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// PAYMENTS (Tushumlar)
// ─────────────────────────────────────────────
app.get('/api/payments', async (req, res) => {
  try {
    const { clientId } = req.query;
    const payments = await prisma.payment.findMany({
      where: clientId ? { clientId } : undefined,
      include: { client: true, contract: true },
      orderBy: { date: 'desc' },
    });
    res.json(payments);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/payments', async (req, res) => {
  try {
    const { date, amount, note, clientId, contractId } = req.body;
    const payment = await prisma.payment.create({
      data: {
        date: new Date(date),
        amount: parseFloat(amount),
        note: note || '',
        clientId,
        contractId,
      },
      include: { client: true, contract: true },
    });
    res.json(payment);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/payments/:id', async (req, res) => {
  try {
    await prisma.payment.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// INTERACTIONS (CRM voqealari)
// ─────────────────────────────────────────────
app.get('/api/interactions', async (req, res) => {
  try {
    const { clientId } = req.query;
    const interactions = await prisma.interaction.findMany({
      where: clientId ? { clientId } : undefined,
      include: { client: true },
      orderBy: { date: 'desc' },
    });
    res.json(interactions);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/interactions', async (req, res) => {
  try {
    const { date, type, note, nextDate, clientId } = req.body;
    const interaction = await prisma.interaction.create({
      data: {
        date: new Date(date),
        type,
        note,
        nextDate: nextDate ? new Date(nextDate) : null,
        clientId,
      },
    });
    res.json(interaction);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// DASHBOARD — Statistika
// ─────────────────────────────────────────────
app.get('/api/dashboard', async (req, res) => {
  try {
    // Bugungi sana oralig'i
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Umumiy savdo va to'lovlar (qarzdorlik hisoblash uchun)
    const allSales = await prisma.sale.findMany({ select: { totalAmount: true, clientId: true } });
    const allPayments = await prisma.payment.findMany({ select: { amount: true, clientId: true } });

    const totalSales = allSales.reduce((s, x) => s + x.totalAmount, 0);
    const totalPaid = allPayments.reduce((s, x) => s + x.amount, 0);
    const totalDebt = totalSales - totalPaid;

    // Bugungi savdo
    const todaySales = await prisma.sale.findMany({
      where: { date: { gte: todayStart, lte: todayEnd } },
      select: { totalAmount: true },
    });
    const todayTotal = todaySales.reduce((s, x) => s + x.totalAmount, 0);

    // Faol mijozlar soni
    const clientsCount = await prisma.client.count();

    // Eng yirik qarzdorlar (top 5)
    const clients = await prisma.client.findMany({
      include: {
        sales: { select: { totalAmount: true } },
        payments: { select: { amount: true } },
      },
    });
    const debtors = clients
      .map(c => ({
        id: c.id,
        name: c.name,
        debt: c.sales.reduce((s, x) => s + x.totalAmount, 0) - c.payments.reduce((s, x) => s + x.amount, 0),
      }))
      .filter(c => c.debt > 0)
      .sort((a, b) => b.debt - a.debt)
      .slice(0, 5);

    // So'nggi 5 ta savdo
    const recentSales = await prisma.sale.findMany({
      take: 5,
      orderBy: { date: 'desc' },
      include: { client: true },
    });

    // Oylik savdo (oxirgi 6 oy)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const monthlySalesRaw = await prisma.sale.findMany({
      where: { date: { gte: sixMonthsAgo } },
      select: { date: true, totalAmount: true },
    });

    // Oylar bo'yicha guruhlash
    const monthlyMap = {};
    monthlySalesRaw.forEach(s => {
      const key = `${s.date.getFullYear()}-${String(s.date.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap[key] = (monthlyMap[key] || 0) + s.totalAmount;
    });

    // Oxirgi 6 oy uchun to'liq ro'yxat
    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthNames = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
      monthlyData.push({
        month: monthNames[d.getMonth()],
        amount: monthlyMap[key] || 0,
      });
    }

    res.json({
      totalDebt,
      todayTotal,
      clientsCount,
      debtors,
      recentSales,
      monthlyData,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────
app.get('/api/settings', async (req, res) => {
  try {
    let setting = await prisma.setting.findUnique({ where: { id: 'global' } });
    if (!setting) {
      setting = await prisma.setting.create({
        data: {
          id: 'global',
          data: JSON.stringify({
            companyName: '',
            companyAddress: '',
            companyInn: '',
            companyPhone: '',
            companyBank: '',
            companyMfo: '',
            companyAccount: '',
            sellers: [],
          }),
        },
      });
    }
    res.json(JSON.parse(setting.data));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    const setting = await prisma.setting.upsert({
      where: { id: 'global' },
      update: { data: JSON.stringify(req.body) },
      create: { id: 'global', data: JSON.stringify(req.body) },
    });
    res.json(JSON.parse(setting.data));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
const PORT = 3001;
app.listen(PORT, () => console.log(`✅ Backend running on http://localhost:${PORT}`));
