const router   = require('express').Router();
const prisma   = require('../prisma');
const PDFDocument = require('pdfkit');
const ExcelJS  = require('exceljs');
const fs       = require('fs');
const { requirePermission } = require('../middleware/rbac');

// Windows sistemasida Arial (Cyrillic qo'llab-quvvatlaydi), yo'q bo'lsa Helvetica
const WIN_ARIAL      = 'C:/Windows/Fonts/arial.ttf';
const WIN_ARIAL_BOLD = 'C:/Windows/Fonts/arialbd.ttf';
const HAS_CYRILLIC   = fs.existsSync(process.env.PDF_FONT_PATH || WIN_ARIAL);

function makePdfDoc(options = {}) {
  const doc = new PDFDocument({ size: 'A4', margin: 50, ...options });
  const fontPath     = process.env.PDF_FONT_PATH      || WIN_ARIAL;
  const fontBoldPath = process.env.PDF_FONT_BOLD_PATH || WIN_ARIAL_BOLD;
  if (HAS_CYRILLIC) {
    doc.registerFont('PDF-Regular', fontPath);
    doc.registerFont('PDF-Bold', fs.existsSync(fontBoldPath) ? fontBoldPath : fontPath);
  }
  return doc;
}

const F  = HAS_CYRILLIC ? 'PDF-Regular' : 'Helvetica';
const FB = HAS_CYRILLIC ? 'PDF-Bold'    : 'Helvetica-Bold';

async function loadContract(id) {
  return prisma.contract.findUnique({
    where: { id },
    include: {
      client: true,
      specifications: {
        include: { products: { include: { product: true } } },
        orderBy: { number: 'asc' },
      },
    },
  });
}

// GET /api/export/contracts/:id/pdf
router.get('/contracts/:id/pdf', requirePermission('contracts', 'read'), async (req, res, next) => {
  try {
    const contract = await loadContract(req.params.id);
    if (!contract) return res.status(404).json({ error: 'Topilmadi' });

    const settings = await prisma.setting.findUnique({ where: { id: 'global' } });
    const cfg = settings ? JSON.parse(settings.data) : {};

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
      `inline; filename="shartnoma-${contract.number}.pdf"`);

    const doc = makePdfDoc();
    doc.pipe(res);

    // SAHIFA 1 — Shartnoma
    doc.font(FB).fontSize(18)
       .text(`SHARTNOMA № ${contract.number}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.font(F).fontSize(10)
       .text(`Sana: ${new Date(contract.date).toLocaleDateString('ru-RU')}`, { align: 'center' });
    doc.moveDown(1.5);

    doc.font(FB).fontSize(11).text('Sotuvchi:');
    doc.font(F).fontSize(10);
    doc.text(`Kompaniya: ${cfg.companyName || '—'}`);
    doc.text(`INN: ${cfg.companyInn || '—'}`);
    doc.text(`Manzil: ${cfg.companyAddress || '—'}`);
    doc.text(`Telefon: ${cfg.companyPhone || '—'}`);
    doc.moveDown();

    doc.font(FB).fontSize(11).text('Xaridor (Mijoz):');
    doc.font(F).fontSize(10);
    doc.text(`Kompaniya: ${contract.client.name}`);
    doc.text(`INN: ${contract.client.inn || '—'}`);
    doc.text(`Manzil: ${contract.client.address || '—'}`);
    doc.text(`Telefon: ${contract.client.phone || '—'}`);
    doc.moveDown();

    doc.font(FB).fontSize(11)
       .text(`Umumiy shartnoma summasi: ${Math.round(contract.totalValue).toLocaleString('ru-RU')} so'm`);
    doc.moveDown();

    if (contract.notes) {
      doc.font(FB).fontSize(11).text('Izoh:');
      doc.font(F).fontSize(10).text(contract.notes);
      doc.moveDown();
    }

    doc.font(FB).fontSize(10)
       .text(`Status: ${contract.status}`, { align: 'right' });

    // Imzo joyi
    doc.moveDown(3);
    doc.font(F).fontSize(10);
    const y = doc.y;
    doc.text('Sotuvchi: ____________________', 50, y);
    doc.text('Xaridor: ____________________', 300, y);

    // SAHIFA 2 — Spetsifikatsiyalar
    if (contract.specifications.length > 0) {
      doc.addPage();
      doc.font(FB).fontSize(16)
         .text('SPETSIFIKATSIYALAR', { align: 'center' });
      doc.moveDown();

      for (const spec of contract.specifications) {
        doc.font(FB).fontSize(12)
           .text(`Spets № ${spec.number} — ${new Date(spec.date).toLocaleDateString('ru-RU')}`);
        if (spec.notes) {
          doc.font(F).fontSize(9).text(`Izoh: ${spec.notes}`);
        }
        doc.font(F).fontSize(8);

        const colW = [140, 45, 45, 80, 70, 80];
        const headers = ['Mahsulot (artikul)', 'Birlik', 'Soni', 'Narx (QQS bilan)', 'QQS summasi', 'Jami summa'];
        const startX = 50;
        let x = startX;
        const headerY = doc.y + 5;

        doc.font(FB).fontSize(8);
        headers.forEach((h, i) => {
          doc.text(h, x, headerY, { width: colW[i], align: 'left' });
          x += colW[i];
        });
        doc.moveDown(1.5);

        doc.font(F).fontSize(8);
        for (const p of spec.products) {
          x = startX;
          const rowY = doc.y;
          const cols = [
            p.product.article,
            p.unit,
            String(p.quantity),
            Math.round(p.unitPriceVat).toLocaleString('ru-RU'),
            Math.round(p.vatAmount).toLocaleString('ru-RU'),
            Math.round(p.rowTotal).toLocaleString('ru-RU'),
          ];
          cols.forEach((c, i) => {
            doc.text(c, x, rowY, { width: colW[i] });
            x += colW[i];
          });
          doc.moveDown(1);
        }

        doc.font(FB).fontSize(9)
           .text(`Spets jami: ${Math.round(spec.totalValue).toLocaleString('ru-RU')} so'm`);
        doc.moveDown(1.5);
      }
    }

    doc.end();
  } catch (e) { next(e); }
});

// GET /api/export/contracts/:id/excel
router.get('/contracts/:id/excel', requirePermission('contracts', 'read'), async (req, res, next) => {
  try {
    const contract = await loadContract(req.params.id);
    if (!contract) return res.status(404).json({ error: 'Topilmadi' });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'ERP System';

    // Sheet 1: Shartnoma
    const ws1 = wb.addWorksheet('Shartnoma');
    ws1.getColumn(1).width = 25;
    ws1.getColumn(2).width = 40;

    const addRow = (label, value) => {
      const row = ws1.addRow([label, value]);
      row.getCell(1).font = { bold: true };
    };

    addRow('Shartnoma raqami', contract.number);
    addRow('Sana', new Date(contract.date).toLocaleDateString('ru-RU'));
    addRow('Status', contract.status);
    addRow('Mijoz', contract.client.name);
    addRow('Mijoz INN', contract.client.inn || '');
    addRow('Mijoz manzili', contract.client.address || '');
    addRow('Umumiy summa', contract.totalValue);
    addRow('Izoh', contract.notes || '');

    // Sheet 2: Spetsifikatsiyalar
    const ws2 = wb.addWorksheet('Spetsifikatsiyalar');
    [1,2,3,4,5,6,7].forEach((_, i) => { ws2.getColumn(i+1).width = [8,25,18,20,12,16,16][i]; });

    const hRow = ws2.addRow([
      'Spets №', 'Mahsulot (artikul)', 'Birlik', 'Narx (QQS bilan)', 'Soni', 'QQS summasi', 'Jami summa',
    ]);
    hRow.font = { bold: true };

    for (const spec of contract.specifications) {
      for (const p of spec.products) {
        ws2.addRow([
          spec.number,
          p.product.article,
          p.unit,
          p.unitPriceVat,
          p.quantity,
          p.vatAmount,
          p.rowTotal,
        ]);
      }
      const sumRow = ws2.addRow(['', '', '', '', '', "Spets jami:", spec.totalValue]);
      sumRow.font = { bold: true };
    }

    res.setHeader('Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',
      `attachment; filename="shartnoma-${contract.number}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) { next(e); }
});

// GET /api/export/specs/:id/pdf
router.get('/specs/:id/pdf', requirePermission('contracts', 'read'), async (req, res, next) => {
  try {
    const spec = await prisma.specification.findUnique({
      where: { id: req.params.id },
      include: {
        contract: { include: { client: true } },
        products: { include: { product: true } },
      },
    });
    if (!spec) return res.status(404).json({ error: 'Topilmadi' });

    const settings = await prisma.setting.findUnique({ where: { id: 'global' } });
    const cfg = settings ? JSON.parse(settings.data) : {};

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
      `inline; filename="spetsifikatsiya-${spec.number}.pdf"`);

    const doc = makePdfDoc();
    doc.pipe(res);

    doc.font(FB).fontSize(16)
       .text(`SPETSIFIKATSIYA № ${spec.number}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.font(F).fontSize(10)
       .text(`Shartnoma № ${spec.contract.number} bo'yicha`, { align: 'center' });
    doc.text(`Sana: ${new Date(spec.date).toLocaleDateString('ru-RU')}`, { align: 'center' });
    doc.moveDown(1.5);

    doc.font(FB).fontSize(11).text('Sotuvchi:');
    doc.font(F).fontSize(10);
    doc.text(`Kompaniya: ${cfg.companyName || '—'}`);
    doc.text(`INN: ${cfg.companyInn || '—'}`);
    doc.text(`Manzil: ${cfg.companyAddress || '—'}`);
    doc.text(`Telefon: ${cfg.companyPhone || '—'}`);
    doc.moveDown();

    doc.font(FB).fontSize(11).text('Xaridor (Mijoz):');
    doc.font(F).fontSize(10);
    doc.text(`Kompaniya: ${spec.contract.client.name}`);
    doc.text(`INN: ${spec.contract.client.inn || '—'}`);
    doc.text(`Manzil: ${spec.contract.client.address || '—'}`);
    doc.text(`Telefon: ${spec.contract.client.phone || '—'}`);
    doc.moveDown();

    if (spec.notes) {
      doc.font(FB).fontSize(10).text(`Izoh: ${spec.notes}`);
      doc.moveDown(0.5);
    }

    const colW = [140, 45, 45, 80, 70, 80];
    const headers = ['Mahsulot (artikul)', 'Birlik', 'Soni', 'Narx (QQS bilan)', 'QQS summasi', 'Jami summa'];
    const startX = 50;
    let x = startX;
    const headerY = doc.y + 5;

    doc.font(FB).fontSize(8);
    headers.forEach((h, i) => {
      doc.text(h, x, headerY, { width: colW[i], align: 'left' });
      x += colW[i];
    });
    doc.moveDown(1.5);

    doc.font(F).fontSize(8);
    for (const p of spec.products) {
      x = startX;
      const rowY = doc.y;
      const cols = [
        p.product.article,
        p.unit,
        String(p.quantity),
        Math.round(p.unitPriceVat).toLocaleString('ru-RU'),
        Math.round(p.vatAmount).toLocaleString('ru-RU'),
        Math.round(p.rowTotal).toLocaleString('ru-RU'),
      ];
      cols.forEach((c, i) => {
        doc.text(c, x, rowY, { width: colW[i] });
        x += colW[i];
      });
      doc.moveDown(1);
    }
    doc.moveDown(1);

    doc.font(FB).fontSize(10)
       .text(`Jami: ${Math.round(spec.totalValue).toLocaleString('ru-RU')} so'm`, { align: 'right' });

    doc.moveDown(3);
    doc.font(F).fontSize(10);
    const y = doc.y;
    doc.text('Sotuvchi: ____________________', 50, y);
    doc.text('Xaridor: ____________________', 300, y);

    doc.end();
  } catch (e) { next(e); }
});

// GET /api/export/specs/:id/excel
router.get('/specs/:id/excel', requirePermission('contracts', 'read'), async (req, res, next) => {
  try {
    const spec = await prisma.specification.findUnique({
      where: { id: req.params.id },
      include: {
        contract: { include: { client: true } },
        products: { include: { product: true } },
      },
    });
    if (!spec) return res.status(404).json({ error: 'Topilmadi' });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'ERP System';

    const ws = wb.addWorksheet(`Spets №${spec.number}`);
    [1,2,3,4,5,6,7].forEach((_, i) => { ws.getColumn(i+1).width = [8,25,18,20,12,16,16][i]; });

    const hRow = ws.addRow([
      'Spets №', 'Mahsulot (artikul)', 'Birlik', 'Narx (QQS bilan)', 'Soni', 'QQS summasi', 'Jami summa',
    ]);
    hRow.font = { bold: true };

    for (const p of spec.products) {
      ws.addRow([
        spec.number,
        p.product.article,
        p.unit,
        p.unitPriceVat,
        p.quantity,
        p.vatAmount,
        p.rowTotal,
      ]);
    }
    const sumRow = ws.addRow(['', '', '', '', '', "Jami:", spec.totalValue]);
    sumRow.font = { bold: true };

    res.setHeader('Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',
      `attachment; filename="spetsifikatsiya-${spec.number}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) { next(e); }
});

// GET /api/export/sales/pdf?ids=...
router.get('/sales/pdf', requirePermission('sales', 'read'), async (req, res, next) => {
  try {
    const ids = (req.query.ids || '').split(',').filter(Boolean);
    if (ids.length === 0) return res.status(400).json({ error: 'ids param majburiy' });

    const sales = await prisma.sale.findMany({
      where: { id: { in: ids } },
      include: {
        client: true,
        contract: true,
        spec: true,
        products: { include: { product: true } }
      },
      orderBy: { date: 'desc' }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="savdolar-hisoboti.pdf"');

    const doc = makePdfDoc();
    doc.pipe(res);

    doc.font(FB).fontSize(16).text('SAVDOLAR (YUK XATLARI) HISOBOTI', { align: 'center' });
    doc.moveDown();

    const colW = [70, 70, 115, 75, 75, 95];
    const headers = ['Sana', 'Yuk xati №', 'Mijoz', 'Shartnoma', 'Spets', 'Jami Summa'];
    const startX = 50;
    let x = startX;
    const headerY = doc.y;

    doc.font(FB).fontSize(9);
    headers.forEach((h, i) => {
      doc.text(h, x, headerY, { width: colW[i], align: i === 5 ? 'right' : 'left' });
      x += colW[i];
    });
    doc.moveDown(1.2);

    doc.font(F).fontSize(8);
    let grandTotal = 0;
    for (const s of sales) {
      x = startX;
      const rowY = doc.y;
      grandTotal += s.totalAmount;
      const cols = [
        new Date(s.date).toLocaleDateString('ru-RU'),
        s.nakladnoy,
        s.client?.name || '',
        s.contract ? `№${s.contract.number}` : '—',
        s.spec ? `№${s.spec.number}` : '—',
        Math.round(s.totalAmount).toLocaleString('ru-RU') + ' UZS'
      ];
      cols.forEach((c, i) => {
        doc.text(c, x, rowY, { width: colW[i], align: i === 5 ? 'right' : 'left' });
        x += colW[i];
      });
      doc.moveDown(1);
    }
    doc.moveDown(1);
    doc.font(FB).fontSize(10).text(`Grand Jami: ${Math.round(grandTotal).toLocaleString('ru-RU')} UZS`, { align: 'right' });

    doc.end();
  } catch (e) { next(e); }
});

// GET /api/export/sales/excel?ids=...
router.get('/sales/excel', requirePermission('sales', 'read'), async (req, res, next) => {
  try {
    const ids = (req.query.ids || '').split(',').filter(Boolean);
    if (ids.length === 0) return res.status(400).json({ error: 'ids param majburiy' });

    const sales = await prisma.sale.findMany({
      where: { id: { in: ids } },
      include: {
        client: true,
        contract: true,
        spec: true,
        products: { include: { product: true } }
      },
      orderBy: { date: 'desc' }
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'ERP System';
    const ws = wb.addWorksheet('Savdolar');
    [10, 15, 25, 15, 15, 15, 20].forEach((w, i) => { ws.getColumn(i+1).width = w; });

    const hRow = ws.addRow(['Sana', 'Yuk xati №', 'Mijoz', 'Shartnoma', 'Spets', 'Sotuvchi', 'Jami Summa']);
    hRow.font = { bold: true };

    sales.forEach(s => {
      ws.addRow([
        new Date(s.date).toLocaleDateString('ru-RU'),
        s.nakladnoy,
        s.client?.name || '',
        s.contract ? `№${s.contract.number}` : '—',
        s.spec ? `№${s.spec.number}` : '—',
        s.sellerName || '',
        s.totalAmount
      ]);
    });

    const totalRow = ws.addRow(['', '', '', '', '', 'Jami:', sales.reduce((sum, s) => sum + s.totalAmount, 0)]);
    totalRow.font = { bold: true };

    res.setHeader('Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',
      `attachment; filename="savdolar-hisoboti.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) { next(e); }
});

module.exports = router;
