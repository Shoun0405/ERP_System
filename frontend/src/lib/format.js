export const fmt = (n) => (!n && n !== 0) ? '0' : Math.round(n).toLocaleString('ru-RU');
export const fmtOrDash = (n) => (!n && n !== 0) ? '—' : Math.round(n).toLocaleString('ru-RU');
export const fmtDate = (d) => d ? new Date(d).toLocaleDateString('ru-RU') : '—';

// Sana + soat (audit "qachon" ustuni uchun)
export const fmtDateTime = (d) => d
  ? new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—';

// Foydalanuvchi id'sidan deterministik rang (audit "kim" ustuni — har userга alohida rang).
// Faqat UI; DB'ga yozilmaydi. HSL: doim bir xil id → bir xil rang.
export const userColor = (id) => {
  if (!id) return 'var(--text-3)';
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return `hsl(${h} 65% 45%)`;
};
