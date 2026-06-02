const router   = require('express').Router();
const prisma   = require('../prisma');
const { Prisma } = require('@prisma/client');
const PDFDocument = require('pdfkit');
const ExcelJS  = require('exceljs');
const archiver = require('archiver');
const fs       = require('fs');
const { PDFDocument: PDFLibDocument } = require('pdf-lib');
const { requirePermission } = require('../middleware/rbac');
const {
  fillDocx,
  htmlToPdf, renderHtmlTemplate, contractHtmlData, specHtmlData,
} = require('../lib/docExport');

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Fayl nomi uchun xavfsiz: yo'l ajratuvchilar va boshqaruv belgilarini olib tashlash
function safeFileName(s) {
  return String(s || '').replace(/[\/\\?%*:|"<>\x00-\x1f]/g, '_').trim() || 'fayl';
}

// ?ids= ni vergul bo'yicha ajratib, bo'sh/limit cheklovlarini tekshiradi.
// Xato bo'lsa res ga 400 yozadi va null qaytaradi (chaqiruvchi to'xtaydi).
function parseIds(req, res) {
  const ids = (req.query.ids || '').split(',').filter(Boolean);
  if (ids.length === 0) {
    res.status(400).json({ error: 'ids param majburiy' });
    return null;
  }
  if (ids.length > 500) {
    res.status(400).json({ error: 'Bir vaqtda 500 tagacha hujjat eksport qilish mumkin' });
    return null;
  }
  return ids;
}

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

function loadSales(ids) {
  return prisma.sale.findMany({
    where: { id: { in: ids } },
    include: {
      client: true,
      contract: true,
      spec: true,
      products: { include: { product: true } },
    },
    orderBy: { date: 'desc' },
  });
}

// Bitta yuk xati (savdo) → PDF Buffer (pdfkit). Yuk xati ko'rinishidagi hujjat:
// shapka, mijoz/sotuvchi rekvizitlari, mahsulot jadvali, jami summa.
function salePdfBuffer(sale, cfg) {
  return new Promise((resolve, reject) => {
    const doc = makePdfDoc();
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    if (cfg.companyName) doc.font(FB).fontSize(14).text(cfg.companyName, { align: 'center' });
    if (cfg.companyAddress) doc.font(F).fontSize(9).text(cfg.companyAddress, { align: 'center' });
    if (cfg.companyInn) doc.font(F).fontSize(9).text(`STIR: ${cfg.companyInn}`, { align: 'center' });
    doc.moveDown(0.5);

    doc.font(FB).fontSize(13).text(`YUK XATI № ${sale.nakladnoy}`, { align: 'center' });
    doc.moveDown(0.5);

    doc.font(F).fontSize(9);
    doc.text(`Sana: ${new Date(sale.date).toLocaleDateString('ru-RU')}`);
    doc.text(`Mijoz: ${sale.client?.name || ''}`);
    if (sale.client?.inn) doc.text(`Mijoz STIR: ${sale.client.inn}`);
    doc.text(`Sotuvchi: ${sale.sellerName || ''}`);
    if (sale.contract) doc.text(`Shartnoma: №${sale.contract.number}`);
    if (sale.spec) doc.text(`Spetsifikatsiya: №${sale.spec.number}`);
    if (sale.transportNum) doc.text(`Transport: ${sale.transportNum}`);
    doc.moveDown(0.7);

    const colW = [25, 150, 55, 65, 60, 100];
    const headers = ['№', 'Mahsulot', 'Dona', 'm³', 'kg', 'Summa'];
    const startX = 50;
    let x = startX;
    const headerY = doc.y;
    doc.font(FB).fontSize(8);
    headers.forEach((h, i) => {
      doc.text(h, x, headerY, { width: colW[i], align: i === 0 || i >= 2 ? (i === 0 ? 'left' : 'right') : 'left' });
      x += colW[i];
    });
    doc.moveDown(1.2);

    doc.font(F).fontSize(8);
    (sale.products || []).forEach((p, i) => {
      x = startX;
      const rowY = doc.y;
      const cols = [
        String(i + 1),
        p.product?.article || (p.productId ? p.productId.slice(0, 8) : ''),
        String(p.totalPieces ?? 0),
        (Number(p.totalCbm) || 0).toFixed(4),
        (Number(p.totalKg) || 0).toFixed(2),
        Math.round(Number(p.rowAmount) || 0).toLocaleString('ru-RU'),
      ];
      cols.forEach((c, ci) => {
        doc.text(c, x, rowY, { width: colW[ci], align: ci === 0 || ci === 1 ? 'left' : 'right' });
        x += colW[ci];
      });
      doc.moveDown(1);
    });

    doc.moveDown(0.5);
    doc.font(FB).fontSize(10).text(
      `Jami: ${Math.round(Number(sale.totalAmount) || 0).toLocaleString('ru-RU')} UZS`,
      { align: 'right' },
    );

    doc.end();
  });
}

// Bir nechta hujjatni bitta ZIP ga oqim (stream) qilib yuboradi.
// `entries` — { name, buffer } massivi yoki uni qaytaradigan async generator emas,
// balki ketma-ket PDF chizadigan async funksiya: ZIP ni bloklamasdan, fayllar
// tayyor bo'lishi bilan qo'shiladi. Xato bo'lsa `next(err)` chaqiriladi.
async function streamZip(res, next, zipName, buildEntries) {
  const archive = archiver('zip', { zlib: { level: 9 } });
  let aborted = false;

  archive.on('error', err => {
    aborted = true;
    if (!res.headersSent) return next(err);
    res.destroy(err);
  });
  // Mijoz ulanishni uzsa, arxivni to'xtatamiz (resurs sizib chiqmasligi uchun)
  res.on('close', () => { if (!res.writableFinished) { aborted = true; archive.destroy(); } });

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
  archive.pipe(res);

  try {
    await buildEntries((name, data) => {
      // Puppeteer page.pdf() Uint8Array qaytaradi — archiver Buffer/Stream kutadi
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
      if (!aborted) archive.append(buffer, { name });
    });
    if (!aborted) await archive.finalize();
  } catch (err) {
    if (!aborted) {
      archive.destroy();
      if (!res.headersSent) return next(err);
      res.destroy(err);
    }
  }
}

// GET /api/export/sales/zip?ids=... — har bir savdo alohida PDF, bitta ZIP ichida
router.get('/sales/zip', requirePermission('sales', 'read'), async (req, res, next) => {
  const ids = parseIds(req, res);
  if (!ids) return;

  const sales = await loadSales(ids);
  if (sales.length === 0) return res.status(404).json({ error: 'Topilmadi' });
  const cfg = await loadConfig();

  const usedNames = new Set();
  await streamZip(res, next, 'savdolar.zip', async (append) => {
    for (const sale of sales) {
      const pdf = await salePdfBuffer(sale, cfg);
      let name = `savdo_${safeFileName(sale.nakladnoy)}.pdf`;
      // Nakladnoy takrorlansa ham fayllar ustma-ust tushmasin
      let i = 2;
      while (usedNames.has(name)) name = `savdo_${safeFileName(sale.nakladnoy)}_${i++}.pdf`;
      usedNames.add(name);
      append(name, pdf);
    }
  });
});

// GET /api/export/contracts/zip?ids=... — har shartnoma alohida PDF, bitta ZIP ichida
router.get('/contracts/zip', requirePermission('contracts', 'read'), async (req, res, next) => {
  const ids = parseIds(req, res);
  if (!ids) return;

  const contracts = (await Promise.all(ids.map(loadContract))).filter(Boolean);
  if (contracts.length === 0) return res.status(404).json({ error: 'Topilmadi' });
  const cfg = await loadConfig();

  const usedNames = new Set();
  await streamZip(res, next, 'shartnomalar.zip', async (append) => {
    for (const contract of contracts) {
      const pdf = await contractPdfBuffer(contract, cfg);
      let name = `shartnoma_${safeFileName(contract.number)}.pdf`;
      let i = 2;
      while (usedNames.has(name)) name = `shartnoma_${safeFileName(contract.number)}_${i++}.pdf`;
      usedNames.add(name);
      append(name, pdf);
    }
  });
});

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
    const ids = parseIds(req, res);
    if (!ids) return;

    const sales = await loadSales(ids);

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
    const ids = parseIds(req, res);
    if (!ids) return;

    const sales = await loadSales(ids);

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

// Mijozlar ro'yxati + qarz hisobi (routes/clients.js dagi SQL bilan bir xil mantiq).
// Sale↔Payment Kartez ko'paytmasini oldini olish uchun avval subquery da agregat.
const CLIENT_SORT_COLS = {
  name: 'name', inn: 'inn', phone: 'phone', seller: 'seller',
  status: 'status', debt: 'debt', createdAt: '"createdAt"',
};

// GET /api/export/clients/excel?search=&debtFilter=&sortBy=&sortDir=
router.get('/clients/excel', requirePermission('clients', 'read'), async (req, res, next) => {
  try {
    const search   = (req.query.search || '').trim();
    const sortBy   = req.query.sortBy || 'createdAt';
    const sortDir  = req.query.sortDir === 'asc' ? 'ASC' : 'DESC';
    const orderCol = CLIENT_SORT_COLS[sortBy] || '"createdAt"';

    const where = search
      ? Prisma.sql`WHERE (
          c.name   ILIKE ${`%${search}%`} OR
          c.inn    ILIKE ${`%${search}%`} OR
          c.phone  ILIKE ${`%${search}%`} OR
          c.seller ILIKE ${`%${search}%`}
        )`
      : Prisma.empty;

    const debtFilter = req.query.debtFilter || 'barchasi';
    let debtCondition = Prisma.empty;
    if (debtFilter === 'qarzdorlar')      debtCondition = Prisma.sql`WHERE debt > 0`;
    else if (debtFilter === 'haqdorlar')  debtCondition = Prisma.sql`WHERE debt < 0`;
    else if (debtFilter === 'yangi')      debtCondition = Prisma.sql`WHERE debt = 0`;

    const rows = await prisma.$queryRaw(Prisma.sql`
      WITH client_debts AS (
        SELECT
          c.name, c.inn, c.phone, c.director, c.address,
          c.category, c.status, c.seller,
          c."createdAt",
          (COALESCE(s_agg.total, 0) - COALESCE(p_agg.total, 0))::float AS debt
        FROM "Client" c
        LEFT JOIN (
          SELECT "clientId", SUM("totalAmount") AS total FROM "Sale" GROUP BY "clientId"
        ) s_agg ON s_agg."clientId" = c.id
        LEFT JOIN (
          SELECT "clientId", SUM(amount) AS total FROM "Payment" GROUP BY "clientId"
        ) p_agg ON p_agg."clientId" = c.id
        ${where}
      )
      SELECT * FROM client_debts
      ${debtCondition}
      ORDER BY ${Prisma.raw(orderCol)} ${Prisma.raw(sortDir)}
      LIMIT 5000
    `);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'ERP System';
    const ws = wb.addWorksheet('Mijozlar');
    [28, 14, 16, 22, 28, 16, 14, 22, 20].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

    const hRow = ws.addRow([
      'Nomi', 'STIR', 'Telefon', 'Direktor', 'Manzil',
      'Kategoriya', 'Holati', 'Sotuvchi', 'Qarzdorlik (UZS)',
    ]);
    hRow.font = { bold: true };

    rows.forEach(c => {
      ws.addRow([
        c.name, c.inn || '', c.phone || '', c.director || '', c.address || '',
        c.category || '', c.status || '', c.seller || '', Math.round(Number(c.debt) || 0),
      ]);
    });

    res.setHeader('Content-Type', XLSX_MIME);
    res.setHeader('Content-Disposition',
      `attachment; filename="mijozlar_${new Date().toISOString().split('T')[0]}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) { next(e); }
});

// GET /api/export/dashboard/monthly-excel — oxirgi 6 oylik savdo (dashboard bilan bir xil)
router.get('/dashboard/monthly-excel', requirePermission('reports', 'read'), async (req, res, next) => {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const monthlyRaw = await prisma.$queryRaw`
      SELECT
        TO_CHAR(date, 'YYYY-MM') AS month_key,
        SUM("totalAmount")::float AS amount
      FROM "Sale"
      WHERE date >= ${sixMonthsAgo}
      GROUP BY month_key
      ORDER BY month_key
    `;

    const monthNames = ['Yan','Fev','Mar','Apr','May','Iyn','Iyl','Avg','Sen','Okt','Noy','Dek'];
    const monthlyMap = {};
    monthlyRaw.forEach(r => { monthlyMap[r.month_key] = Number(r.amount); });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'ERP System';
    const ws = wb.addWorksheet('Oylik savdo');
    ws.getColumn(1).width = 12;
    ws.getColumn(2).width = 20;
    const hRow = ws.addRow(['Oy', 'Summa (UZS)']);
    hRow.font = { bold: true };

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      ws.addRow([monthNames[d.getMonth()], Math.round(monthlyMap[key] || 0)]);
    }

    res.setHeader('Content-Type', XLSX_MIME);
    res.setHeader('Content-Disposition',
      `attachment; filename="oylik_savdo_${new Date().toISOString().split('T')[0]}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) { next(e); }
});

module.exports = router;
