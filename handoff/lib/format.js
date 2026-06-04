// ─────────────────────────────────────────────────────────────────────────────
// format.js — RAQAM ORALIG'I TUZATISHI (UX audit, "sonlar orasi keng" topilmasi)
//
// MUAMMO: toLocaleString('ru-RU') minglarni ajratishda KENG probel (U+00A0,
//         no-break space) qo'yadi → "12 480 000" da oraliq juda katta ko'rinadi.
//
// YECHIM: ajratuvchini INGICHKA probelga (U+202F, narrow no-break space)
//         almashtiramiz. Natija: "12 480 000" → "12 480 000" (ixchamroq),
//         lekin baribir guruhlar ajralib turadi va satrda uzilmaydi.
//
// Bu faqat KO'RINISHGA ta'sir qiladi. Excel eksporti backend'da alohida
// formatlanadi, shuning uchun bu o'zgarish unga tegmaydi.
// ─────────────────────────────────────────────────────────────────────────────

const THIN = '\u202F'; // narrow no-break space — ixcham, lekin uzilmaydigan oraliq
const group = (s) => s.replace(/\u00A0/g, THIN);

export const fmt        = (n) => (!n && n !== 0) ? '0' : group(Math.round(n).toLocaleString('ru-RU'));
export const fmtOrDash  = (n) => (!n && n !== 0) ? '—' : group(Math.round(n).toLocaleString('ru-RU'));
export const fmtDate    = (d) => d ? new Date(d).toLocaleDateString('ru-RU') : '—';

// Sana + soat (audit "qachon" ustuni uchun)
export const fmtDateTime = (d) => d
  ? new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—';

// Foydalanuvchi id'sidan deterministik rang (audit "kim" ustuni — har userga alohida rang).
// Faqat UI; DB'ga yozilmaydi. HSL: doim bir xil id → bir xil rang.
export const userColor = (id) => {
  if (!id) return 'var(--text-3)';
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return `hsl(${h} 65% 45%)`;
};
