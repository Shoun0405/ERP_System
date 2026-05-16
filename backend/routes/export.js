const router   = require('express').Router();
const prisma   = require('../prisma');
const PDFDocument = require('pdfkit');
const ExcelJS  = require('exceljs');

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
router.get('/contracts/:id/pdf', async (req, res, next) => {
  try {
    const contract = await loadContract(req.params.id);
    if (!contract) return res.status(404).json({ error: 'Topilmadi' });

    const settings = await prisma.setting.findUnique({ where: { id: 'global' } });
    const cfg = settings ? JSON.parse(settings.data) : {};

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
      `inline; filename="shartnoma-${contract.number}.pdf"`);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(res);

    // SAHIFA 1 — Shartnoma
    doc.font('Helvetica-Bold').fontSize(18)
       .text(`SHARTNOMA № ${contract.number}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(10)
       .text(`Sana: ${new Date(contract.date).toLocaleDateString('ru-RU')}`, { align: 'center' });
    doc.moveDown(1.5);

    doc.font('Helvetica-Bold').fontSize(11).text('Sotuvchi:');
    doc.font('Helvetica').fontSize(10);
    doc.text(`Kompaniya: ${cfg.companyName || '—'}`);
    doc.text(`INN: ${cfg.companyInn || '—'}`);
    doc.text(`Manzil: ${cfg.companyAddress || '—'}`);
    doc.text(`Telefon: ${cfg.companyPhone || '—'}`);
    doc.moveDown();

    doc.font('Helvetica-Bold').fontSize(11).text('Xaridor (Mijoz):');
    doc.font('Helvetica').fontSize(10);
    doc.text(`Kompaniya: ${contract.client.name}`);
    doc.text(`INN: ${contract.client.inn || '—'}`);
    doc.text(`Manzil: ${contract.client.address || '—'}`);
    doc.text(`Telefon: ${contract.client.phone || '—'}`);
    doc.moveDown();

    doc.font('Helvetica-Bold').fontSize(11)
       .text(`Umumiy shartnoma summasi: ${Math.round(contract.totalValue).toLocaleString('ru-RU')} so'm`);
    doc.moveDown();

    if (contract.notes) {
      doc.font('Helvetica-Bold').fontSize(11).text('Izoh:');
      doc.font('Helvetica').fontSize(10).text(contract.notes);
      doc.moveDown();
    }

    doc.font('Helvetbu-Bold').fontSize(10)
       .text(`Status: ${contract.status}`, { align: 'right' });

    // Imzo joyi
    doc.moveDown(3);
    doc.font('Helvetica').fontSize(10);
    const y = doc.y;
    doc.text('Sotuvchi: ____________________', 50, y);
    doc.text('Xaridor: ____________________', 300, y);

    // SAHIFA 2 — Spetsifikatsiyalar
    if (contract.specifications.length > 0) {
      doc.addPage();
      doc.font('Helvetica-Bold').fontSize(16)
         .text('SPETSIFIKATSIYALAR', { align: 'center' });
      doc.moveDown();

      for (const spec of contract.specifications) {
        doc.font('Helvetica-Bold').fontSize(12)
           .text(`Spets № ${spec.number} — ${new Date(spec.date).toLocaleDateString('ru-RU')}`);
        if (spec.notes) {
          doc.font('Helvetica').fontSize(9).text(`Izoh: ${spec.notes}`);
        }
        doc.font('Helvetica').fontSize(8);

        const colW = [140, 45, 45, 80, 70, 80];
        const headers = ['Mahsulot (artikul)', 'Birlik', 'Soni', 'Narx (QQS bilan)', 'QQS summasi', 'Jami summa'];
        const startX = 50;
        let x = startX;
        const headerY = doc.y + 5;

        doc.font('Helvetica-Bold').fontSize(8);
        headers.forEach((h, i) => {
          doc.text(h, x, headerY, { width: colW[i], align: 'left' });
          x += colW[i];
        });
        doc.moveDown(1.5);

        doc.font('Helvetica').fontSize(8);
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

        doc.font('Helvetica-Bold').fontSize(9)
           .text(`Spets jami: ${Math.round(spec.totalValue).toLocaleString('ru-RU')} so'm`);
        doc.moveDown(1.5);
      }
    }

    doc.end();
  } catch (e) { next(e); }
});

// GET /api/export/contracts/:id/excel
router.get('/contracts/:id/excel', async (req, res, next) => {
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

module.exports = router;
