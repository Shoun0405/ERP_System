const ExcelJS = require('exceljs');
const { clientSchema } = require('../routes/_schemas');

// Excel sarlavhasi (kichik harf) → Client maydoni
const HEADER_TO_FIELD = {
  'nomi': 'name',
  'stir': 'inn',
  'telefon': 'phone',
  'direktor': 'director',
  'manzil': 'address',
  'hisob raqami': 'account',
  'mfo': 'mfo',
  'bank': 'bank',
  'sotuvchi': 'seller',
};

// "To'liqlik" uchun tekshiriladigan maydonlar (name majburiy; phone hisobga olinmaydi)
const COMPLETENESS_FIELDS = ['inn', 'director', 'address', 'account', 'mfo', 'bank', 'seller'];

const EMPTY_RAW = () => ({
  name: '', inn: '', phone: '', director: '', address: '',
  account: '', mfo: '', bank: '', seller: '',
});

// ExcelJS katak qiymatini matnga aylantiradi. Raqam/forma/rich-text holatlarini ham qamraydi.
function cellText(cell) {
  const v = cell == null ? null : cell.value;
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v.text != null) return String(v.text).trim();      // rich text / hyperlink
    if (v.result != null) return String(v.result).trim();  // formula natijasi
    return String(v).trim();
  }
  if (typeof v === 'number') {
    // Butun sonlarni eksponensial yozuvsiz to'liq string qilamiz (toFixed — ICU shart emas).
    // Aniqlik yo'qolgan-yo'qolmagani isUnsafeNumericCell() bilan alohida aniqlanadi.
    return Number.isInteger(v) ? v.toFixed(0) : String(v);
  }
  return String(v).trim();
}

// Katak SON bo'lib, JS xavfsiz butun son chegarasidan oshsa (>= 2^53), asl raqamlar
// (uzun STIR/hisob raqami) aniqligini yo'qotadi. Bunday katakni belgilab, foydalanuvchini
// MATN formatiga yo'naltiramiz — buzilgan moliyaviy identifikator sokin saqlanmasligi uchun.
function isUnsafeNumericCell(cell) {
  const v = cell == null ? null : cell.value;
  return typeof v === 'number' && !Number.isSafeInteger(v);
}

const FIELD_LABEL = {
  name: 'Nomi', inn: 'STIR', phone: 'Telefon', director: 'Direktor', address: 'Manzil',
  account: 'Hisob raqami', mfo: 'MFO', bank: 'Bank', seller: 'Sotuvchi',
};

// Buffer (.xlsx) → { headerOk, rows: [{ rowNum, raw }] }
// headerOk=false agar 'Nomi' ustuni topilmasa.
async function parseClientsXlsx(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return { headerOk: false, rows: [] };

  const colField = {}; // colNumber → field
  ws.getRow(1).eachCell((cell, colNumber) => {
    const key = cellText(cell).toLowerCase();
    if (HEADER_TO_FIELD[key]) colField[colNumber] = HEADER_TO_FIELD[key];
  });

  if (!Object.values(colField).includes('name')) {
    return { headerOk: false, rows: [] };
  }

  const rows = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // sarlavha
    const raw = EMPTY_RAW();
    const numericRisk = []; // aniqligini yo'qotgan raqamli kataklar (field nomlari)
    let hasAny = false;
    for (const [col, field] of Object.entries(colField)) {
      const cell = row.getCell(Number(col));
      const txt = cellText(cell);
      raw[field] = txt;
      if (txt) hasAny = true;
      if (isUnsafeNumericCell(cell)) numericRisk.push(field);
    }
    if (hasAny) rows.push({ rowNum: rowNumber, raw, numericRisk });
  });

  return { headerOk: true, rows };
}

// rows (parseClientsXlsx natijasi) + existingInns (Set) → toifalangan qatorlar.
// existingInns @unique cheklovi bo'yicha — soft-delete qilinganlar ham kiradi.
function categorize(rows, existingInns) {
  const seen = new Set(); // fayl ichidagi STIR takrorini aniqlash
  return rows.map(({ rowNum, raw, numericRisk }) => {
    const name = (raw.name || '').trim();
    if (!name) {
      return { rowNum, name: '', inn: raw.inn || '', category: 'error', reason: "Nomi (tashkilot nomi) bo'sh", data: null };
    }

    // Aniqligini yo'qotgan raqamli katak (mas. 20 xonali hisob raqami matn emas) → xato.
    if (numericRisk && numericRisk.length) {
      const labels = numericRisk.map(f => FIELD_LABEL[f] || f).join(', ');
      return { rowNum, name, inn: raw.inn || '', category: 'error',
        reason: `${labels} ustunini MATN formatida kiriting (raqam aniqligi yo'qoldi)`, data: null };
    }

    let data;
    try {
      data = clientSchema.parse(raw);
    } catch (e) {
      const issue = e?.issues?.[0];
      const field = issue?.path?.join('.') || '';
      const msg = issue?.message || "Qiymat noto'g'ri";
      return { rowNum, name, inn: raw.inn || '', category: 'error', reason: field ? `${field}: ${msg}` : msg, data: null };
    }

    const inn = data.inn; // null yoki string
    if (inn) {
      if (existingInns.has(inn)) {
        return { rowNum, name, inn, category: 'duplicate', reason: 'STIR bazada allaqachon mavjud', data: null };
      }
      if (seen.has(inn)) {
        return { rowNum, name, inn, category: 'error', reason: 'STIR fayl ichida takrorlangan', data: null };
      }
      seen.add(inn);
    }

    const incomplete = COMPLETENESS_FIELDS.some(f => !String(raw[f] ?? '').trim());
    return { rowNum, name, inn: inn || '', category: incomplete ? 'incomplete' : 'valid', reason: null, data };
  });
}

module.exports = { parseClientsXlsx, categorize, COMPLETENESS_FIELDS, HEADER_TO_FIELD };
