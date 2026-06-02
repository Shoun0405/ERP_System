// Template asosida hujjat generatsiya: .docx to'ldirish (docxtemplater) va
// yuqori sifatli .docx → .pdf konvertatsiya (headless LibreOffice CLI).
//
// Nima uchun LibreOffice: foydalanuvchining tayyor Word shablonlari aynan
// o'sha layout bilan PDF ga aylanishi kerak. HTML→PDF (Puppeteer) shablon
// ko'rinishini takrorlay olmaydi, shuning uchun haqiqiy .docx konvertatsiya
// qilinadi. LibreOffice topilmasa — tushunarli xato qaytaramiz (503).

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { execFile } = require('child_process');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const Mustache = require('mustache');
const { numberToWordsRu } = require('./numToWords');

const TEMPLATE_DIR = path.join(__dirname, '..', 'templates');

// ─── LibreOffice topish ──────────────────────────────────────────────────────
// SOFFICE_PATH env bilan override qilinadi; aks holda OS bo'yicha standart
// joylar tekshiriladi. Runtime da tekshiriladi — keyinroq o'rnatilsa ham ishlaydi.
const SOFFICE_CANDIDATES = [
  process.env.SOFFICE_PATH,
  'C:/Program Files/LibreOffice/program/soffice.exe',
  'C:/Program Files (x86)/LibreOffice/program/soffice.exe',
  '/usr/bin/soffice',
  '/usr/bin/libreoffice',
  '/Applications/LibreOffice.app/Contents/MacOS/soffice',
].filter(Boolean);

function resolveSoffice() {
  for (const p of SOFFICE_CANDIDATES) {
    try {
      if (fs.existsSync(p)) return p;
    } catch { /* ignore */ }
  }
  return null;
}

class PdfConversionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PdfConversionError';
    this.status = 503;
    this.publicMessage = message;
  }
}

// ─── Shablonni to'ldirish ────────────────────────────────────────────────────
function fillDocx(templateFile, data) {
  const templatePath = path.join(TEMPLATE_DIR, templateFile);
  if (!fs.existsSync(templatePath)) {
    const err = new Error(`Shablon topilmadi: backend/templates/${templateFile}. Iltimos, ushbu faylni joylashtiring.`);
    err.status = 500;
    err.publicMessage = `Shablon topilmadi: ${templateFile}`;
    throw err;
  }

  const content = fs.readFileSync(templatePath, 'binary');
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' }, // shablonlar {{placeholder}} ishlatadi
    nullGetter: () => '', // yo'q maydon → bo'sh string ("undefined" emas)
  });

  try {
    doc.render(data);
  } catch (e) {
    // docxtemplater shablon xatolarini yig'ib beradi (noto'g'ri yopilgan loop va h.k.)
    const detail = e.properties?.errors?.map(x => x.properties?.explanation).filter(Boolean).join('; ') || e.message;
    const err = new Error(`Shablonni to'ldirishda xato (${templateFile}): ${detail}`);
    err.status = 500;
    err.publicMessage = `Shablon xatosi: ${templateFile}`;
    throw err;
  }

  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

// ─── .docx → .pdf (LibreOffice headless) ─────────────────────────────────────
function docxToPdf(docxBuffer) {
  const soffice = resolveSoffice();
  if (!soffice) {
    throw new PdfConversionError(
      "PDF yaratish uchun LibreOffice o'rnatilmagan. LibreOffice ni o'rnating yoki SOFFICE_PATH muhit o'zgaruvchisini soffice yo'liga sozlang."
    );
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'erp-doc-'));
  // Har konvertatsiyaga alohida profil — bir vaqtning o'zida bir nechta
  // soffice chaqiruvi bir-biriga xalaqit bermasligi uchun.
  const profileDir = path.join(tmpDir, 'profile');
  const profileUri = 'file:///' + profileDir.replace(/\\/g, '/');
  const inPath  = path.join(tmpDir, 'doc.docx');
  const outPath = path.join(tmpDir, 'doc.pdf');
  fs.writeFileSync(inPath, docxBuffer);

  return new Promise((resolve, reject) => {
    execFile(
      soffice,
      [
        '--headless',
        '--norestore',
        `-env:UserInstallation=${profileUri}`,
        '--convert-to', 'pdf',
        '--outdir', tmpDir,
        inPath,
      ],
      { timeout: 60_000, windowsHide: true },
      (error) => {
        try {
          if (error) {
            return reject(new PdfConversionError(
              "PDF konvertatsiyasi muvaffaqiyatsiz tugadi (LibreOffice). Server logini tekshiring."
            ));
          }
          if (!fs.existsSync(outPath)) {
            return reject(new PdfConversionError('PDF fayl yaratilmadi (LibreOffice natija bermadi).'));
          }
          resolve(fs.readFileSync(outPath));
        } catch (e) {
          reject(e);
        } finally {
          fs.rm(tmpDir, { recursive: true, force: true }, () => {});
        }
      }
    );
  });
}

// ─── HTML → PDF (Puppeteer headless Chromium) ────────────────────────────────
// PDF eksport endi LibreOffice/Word ga bog'liq emas: HTML shablon (lib/templates
// .html) ma'lumot bilan to'ldirilib, Chromium "Print to PDF" orqali A4 PDF qiladi.
// Bitta brauzer instansiyasi qayta ishlatiladi (har so'rovda yangi sahifa ochiladi).
let _browserPromise = null;

async function getBrowser() {
  const puppeteer = require('puppeteer');
  if (_browserPromise) {
    try {
      const b = await _browserPromise;
      if (b.connected ?? b.isConnected()) return b;
    } catch { /* qayta ishga tushiramiz */ }
  }
  _browserPromise = puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'], // Linux deploy uchun
  });
  return _browserPromise;
}

async function htmlToPdf(html) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
    });
  } finally {
    await page.close().catch(() => {});
  }
}

async function closeBrowser() {
  if (_browserPromise) {
    try { (await _browserPromise).close(); } catch { /* ignore */ }
    _browserPromise = null;
  }
}

// HTML shablonni Mustache bilan to'ldiradi (delimiter {{ }}, {{#products}} loop)
function renderHtmlTemplate(templateFile, data) {
  const templatePath = path.join(TEMPLATE_DIR, templateFile);
  if (!fs.existsSync(templatePath)) {
    const err = new Error(`HTML shablon topilmadi: backend/templates/${templateFile}`);
    err.status = 500;
    err.publicMessage = `Shablon topilmadi: ${templateFile}`;
    throw err;
  }
  const tpl = fs.readFileSync(templatePath, 'utf8');
  return Mustache.render(tpl, data);
}

// ─── Formatlash yordamchilari ────────────────────────────────────────────────
const fmtMoney = (n) => Math.round(Number(n) || 0).toLocaleString('ru-RU');

const fmtDate = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yy = dt.getFullYear();
  return `${dd}.${mm}.${yy}`;
};

// ─── DB → shablon o'zgaruvchilari ────────────────────────────────────────────
function mapContractData(contract, cfg) {
  const cl = contract.client || {};
  return {
    contractNumber: contract.number ?? '',
    contractDate:   fmtDate(contract.date),
    notes:          contract.notes ?? '',
    totalValue:     fmtMoney(contract.totalValue),
    status:         contract.status ?? '',
    seller:         contract.seller ?? '',

    clientName:     cl.name ?? '',
    clientInn:      cl.inn ?? '',
    clientDirector: cl.director ?? '',
    clientPhone:    cl.phone ?? '',
    clientAddress:  cl.address ?? '',
    clientAccount:  cl.account ?? '',
    clientMfo:      cl.mfo ?? '',

    companyName:     cfg.companyName ?? '',
    companyInn:      cfg.companyInn ?? '',
    companyAddress:  cfg.companyAddress ?? '',
    companyPhone:    cfg.companyPhone ?? '',
    companyAccount:  cfg.companyAccount ?? '',
    companyMfo:      cfg.companyMfo ?? '',
    companyBank:     cfg.companyBank ?? '',
    companyDirector: cfg.companyDirector ?? '',
  };
}

function mapSpecData(spec, cfg) {
  const contract = spec.contract || {};
  const cl = contract.client || {};
  const products = (spec.products || []).map((p, i) => ({
    index:        i + 1,
    article:      p.product?.article ?? '',
    unit:         p.unit ?? '',
    quantity:     fmtMoney(p.quantity),
    unitPriceVat: fmtMoney(p.unitPriceVat),
    vatAmount:    fmtMoney(p.vatAmount),
    rowTotal:     fmtMoney(p.rowTotal),
  }));

  return {
    specNumber:     spec.number ?? '',
    specDate:       fmtDate(spec.date),
    notes:          spec.notes ?? '',
    totalValue:     fmtMoney(spec.totalValue),

    contractNumber: contract.number ?? '',
    contractDate:   fmtDate(contract.date),

    clientName:     cl.name ?? '',
    clientInn:      cl.inn ?? '',
    clientDirector: cl.director ?? '',
    clientPhone:    cl.phone ?? '',
    clientAddress:  cl.address ?? '',
    clientAccount:  cl.account ?? '',
    clientMfo:      cl.mfo ?? '',

    companyName:     cfg.companyName ?? '',
    companyInn:      cfg.companyInn ?? '',
    companyAddress:  cfg.companyAddress ?? '',
    companyPhone:    cfg.companyPhone ?? '',
    companyAccount:  cfg.companyAccount ?? '',
    companyMfo:      cfg.companyMfo ?? '',
    companyBank:     cfg.companyBank ?? '',
    companyDirector: cfg.companyDirector ?? '',

    products,
  };
}

// Ruscha sana: «02» июня 2026 г.
const RU_MONTHS = ['января','февраля','марта','апреля','мая','июня','июля',
  'августа','сентября','октября','ноября','декабря'];
const fmtDateRu = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return `«${String(dt.getDate()).padStart(2, '0')}» ${RU_MONTHS[dt.getMonth()]} ${dt.getFullYear()} г.`;
};

const VAT_DIVISOR = 1.12; // QQS bilan narxdan QQSsiz narxni ajratish

// ─── DB → HTML shablon ma'lumotlari ──────────────────────────────────────────
function contractHtmlData(contract, cfg) {
  const cl = contract.client || {};
  return {
    contractNumber: contract.number ?? '',
    contractDate:   fmtDateRu(contract.date),
    totalDigits:    fmtMoney(contract.totalValue),
    totalWords:     numberToWordsRu(contract.totalValue),

    buyerName:     cl.name ?? '',
    buyerDirector: cl.director ?? '',
    buyerAddress:  cl.address ?? '',
    buyerAccount:  cl.account ?? '',
    buyerBank:     cl.bank ?? '',      // Client modelida bank nomi yo'q — bo'sh
    buyerInn:      cl.inn ?? '',
    buyerMfo:      cl.mfo ?? '',

    // Kelajakda kompaniya rekvizitlari shablonga dinamik kerak bo'lsa:
    companyName:     cfg.companyName ?? '',
    companyInn:      cfg.companyInn ?? '',
    companyAddress:  cfg.companyAddress ?? '',
    companyAccount:  cfg.companyAccount ?? '',
    companyMfo:      cfg.companyMfo ?? '',
    companyBank:     cfg.companyBank ?? '',
    companyDirector: cfg.companyDirector ?? '',
  };
}

function specHtmlData(spec, cfg) {
  const contract = spec.contract || {};
  const cl = contract.client || {};
  const products = (spec.products || []).map((p, i) => {
    const pr = p.product || {};
    const priceVat = Number(p.unitPriceVat) || 0;
    const priceNoVat = priceVat / VAT_DIVISOR;
    const vatPerUnit = priceVat - priceNoVat;
    return {
      index:       i + 1,
      name:        pr.article ?? 'БАЗАЛЬТОВАЯ ВАТА',
      density:     fmtMoney(pr.density),
      length:      fmtMoney(pr.length),
      width:       fmtMoney(pr.width),
      thickness:   fmtMoney(pr.thickness),
      unit:        p.unit ?? '',
      priceNoVat:  fmtMoney(priceNoVat),
      vat:         fmtMoney(vatPerUnit),
      priceVat:    fmtMoney(priceVat),
      quantity:    fmtMoney(p.quantity),
      rowTotal:    fmtMoney(p.rowTotal),
    };
  });

  return {
    specNumber:     spec.number ?? '',
    specDate:       fmtDateRu(spec.date),
    contractNumber: contract.number ?? '',
    contractDate:   fmtDateRu(contract.date),
    totalDigits:    fmtMoney(spec.totalValue),
    totalWords:     numberToWordsRu(spec.totalValue),

    buyerName:     cl.name ?? '',
    buyerInn:      cl.inn ?? '',

    companyName: cfg.companyName ?? '',

    products,
  };
}

module.exports = {
  fillDocx,
  docxToPdf,
  resolveSoffice,
  mapContractData,
  mapSpecData,
  htmlToPdf,
  closeBrowser,
  renderHtmlTemplate,
  contractHtmlData,
  specHtmlData,
  fmtMoney,
  fmtDate,
  fmtDateRu,
  PdfConversionError,
  TEMPLATE_DIR,
};
