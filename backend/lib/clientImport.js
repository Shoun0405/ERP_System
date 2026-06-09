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
// Uzun raqamlar (STIR/hisob) shablonda matn formatida — shu sabab String() yetarli.
function cellText(cell) {
  const v = cell == null ? null : cell.value;
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v.text != null) return String(v.text).trim();      // rich text / hyperlink
    if (v.result != null) return String(v.result).trim();  // formula natijasi
    return String(v).trim();
  }
  return String(v).trim();
}

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
    let hasAny = false;
    for (const [col, field] of Object.entries(colField)) {
      const txt = cellText(row.getCell(Number(col)));
      raw[field] = txt;
      if (txt) hasAny = true;
    }
    if (hasAny) rows.push({ rowNum: rowNumber, raw });
  });

  return { headerOk: true, rows };
}

// rows (parseClientsXlsx natijasi) + existingInns (Set) → toifalangan qatorlar.
// existingInns @unique cheklovi bo'yicha — soft-delete qilinganlar ham kiradi.
function categorize(rows, existingInns) {
  const seen = new Set(); // fayl ichidagi STIR takrorini aniqlash
  return rows.map(({ rowNum, raw }) => {
    const name = (raw.name || '').trim();
    if (!name) {
      return { rowNum, name: '', inn: raw.inn || '', category: 'error', reason: "Nomi (tashkilot nomi) bo'sh", data: null };
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
