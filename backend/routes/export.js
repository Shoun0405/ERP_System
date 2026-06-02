const router   = require('express').Router();
const prisma   = require('../prisma');
const PDFDocument = require('pdfkit');
const ExcelJS  = require('exceljs');
const fs       = require('fs');
const { PDFDocument: PDFLibDocument } = require('pdf-lib');
const { requirePermission } = require('../middleware/rbac');
const {
  fillDocx,
  htmlToPdf, renderHtmlTemplate, contractHtmlData, specHtmlData,
} = require('../lib/docExport');

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

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

function loadSpec(id) {
  return prisma.specification.findUnique({
    where: { id },
    include: {
      contract: { include: { client: true } },
      products: { include: { product: true } },
    },
  });
}

async function loadConfig() {
  const settings = await prisma.setting.findUnique({ where: { id: 'global' } });
  return settings ? JSON.parse(settings.data) : {};
}

// HTML shablon → PDF Buffer (Puppeteer/Chromium) — reuse
async function contractPdfBuffer(contract, cfg) {
  const html = renderHtmlTemplate('contract_template.html', contractHtmlData(contract, cfg));
  return htmlToPdf(html);
}
async function specPdfBuffer(spec, cfg) {
  const html = renderHtmlTemplate('spec_template.html', specHtmlData(spec, cfg));
  return htmlToPdf(html);
}

// GET /api/export/contracts/:id/word — shablon asosidagi .docx
router.get('/contracts/:id/word', requirePermission('contracts', 'read'), async (req, res, next) => {
  try {
    const contract = await loadContract(req.params.id);
    if (!contract) return res.status(404).json({ error: 'Topilmadi' });
    const cfg = await loadConfig();

    const buf = fillDocx('contract_template.docx', contractHtmlData(contract, cfg));
    res.setHeader('Content-Type', DOCX_MIME);
    res.setHeader('Content-Disposition', `attachment; filename="shartnoma-${contract.number}.docx"`);
    res.send(buf);
  } catch (e) { next(e); }
});

// GET /api/export/contracts/:id/pdf — shablon .docx → PDF (LibreOffice)
router.get('/contracts/:id/pdf', requirePermission('contracts', 'read'), async (req, res, next) => {
  try {
    const contract = await loadContract(req.params.id);
    if (!contract) return res.status(404).json({ error: 'Topilmadi' });
    const cfg = await loadConfig();

    const pdf = await contractPdfBuffer(contract, cfg);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="shartnoma-${contract.number}.pdf"`);
    res.send(pdf);
  } catch (e) { next(e); }
});

// GET /api/export/contracts/:id/pdf-with-specs — shartnoma + barcha spetslar bitta PDF da
router.get('/contracts/:id/pdf-with-specs', requirePermission('contracts', 'read'), async (req, res, next) => {
  try {
    const contract = await loadContract(req.params.id);
    if (!contract) return res.status(404).json({ error: 'Topilmadi' });
    const cfg = await loadConfig();

    const merged = await PDFLibDocument.create();

    const appendPdf = async (buffer) => {
      const src = await PDFLibDocument.load(buffer);
      const pages = await merged.copyPages(src, src.getPageIndices());
      pages.forEach(p => merged.addPage(p));
    };

    await appendPdf(await contractPdfBuffer(contract, cfg));

    for (const spec of contract.specifications) {
      // mapSpecData contract.client kutadi — list query da bu yo'q, shu sababli to'ldiramiz
      const specForMap = { ...spec, contract: { ...contract, client: contract.client } };
      await appendPdf(await specPdfBuffer(specForMap, cfg));
    }

    const out = Buffer.from(await merged.save());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="contract-and-specs-${contract.number}.pdf"`);
    res.send(out);
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

// GET /api/export/specs/:id/word — shablon asosidagi .docx
router.get('/specs/:id/word', requirePermission('contracts', 'read'), async (req, res, next) => {
  try {
    const spec = await loadSpec(req.params.id);
    if (!spec) return res.status(404).json({ error: 'Topilmadi' });
    const cfg = await loadConfig();

    const buf = fillDocx('spec_template.docx', specHtmlData(spec, cfg));
    res.setHeader('Content-Type', DOCX_MIME);
    res.setHeader('Content-Disposition', `attachment; filename="spetsifikatsiya-${spec.number}.docx"`);
    res.send(buf);
  } catch (e) { next(e); }
});

// GET /api/export/specs/:id/pdf — shablon .docx → PDF (LibreOffice)
router.get('/specs/:id/pdf', requirePermission('contracts', 'read'), async (req, res, next) => {
  try {
    const spec = await loadSpec(req.params.id);
    if (!spec) return res.status(404).json({ error: 'Topilmadi' });
    const cfg = await loadConfig();

    const pdf = await specPdfBuffer(spec, cfg);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="spetsifikatsiya-${spec.number}.pdf"`);
    res.send(pdf);
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
    if (ids.length > 500) return res.status(400).json({ error: 'Bir vaqtda 500 tagacha hujjat eksport qilish mumkin' });

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
    if (ids.length > 500) return res.status(400).json({ error: 'Bir vaqtda 500 tagacha hujjat eksport qilish mumkin' });

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
