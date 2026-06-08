// Locale-aware formatlash. Aktiv BCP-47 tag i18n qatlamidan (i18n/index.js)
// languageChanged'da beriladi — format.js toza qoladi (i18n import qilmaydi),
// shu sabab unit-test qilinadi va circular dependency yo'q.
let currentTag = 'uz-UZ';
const numCache = new Map();
const dateCache = new Map();
const dateTimeCache = new Map();

const num = (tag) => {
  if (!numCache.has(tag)) numCache.set(tag, new Intl.NumberFormat(tag, { maximumFractionDigits: 0 }));
  return numCache.get(tag);
};
const dateF = (tag) => {
  if (!dateCache.has(tag)) dateCache.set(tag, new Intl.DateTimeFormat(tag));
  return dateCache.get(tag);
};
const dateTimeF = (tag) => {
  if (!dateTimeCache.has(tag)) dateTimeCache.set(tag, new Intl.DateTimeFormat(tag, {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }));
  return dateTimeCache.get(tag);
};

export const setFormatLocale = (tag) => { currentTag = tag || 'uz-UZ'; };
export const getFormatLocale = () => currentTag;

export const fmt        = (n) => (!n && n !== 0) ? '0' : num(currentTag).format(Math.round(n));
export const fmtOrDash  = (n) => (!n && n !== 0) ? '—' : num(currentTag).format(Math.round(n));
export const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '—' : dateF(currentTag).format(dt);
};
export const fmtDateTime = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '—' : dateTimeF(currentTag).format(dt);
};

// Foydalanuvchi id'sidan deterministik rang (audit "kim" ustuni). Faqat UI.
export const userColor = (id) => {
  if (!id) return 'var(--text-3)';
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return `hsl(${h} 65% 45%)`;
};
