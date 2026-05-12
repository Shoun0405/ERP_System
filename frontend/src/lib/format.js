export const fmt = (n) => (!n && n !== 0) ? '0' : Math.round(n).toLocaleString('ru-RU');
export const fmtOrDash = (n) => (!n && n !== 0) ? '—' : Math.round(n).toLocaleString('ru-RU');
export const fmtDate = (d) => d ? new Date(d).toLocaleDateString('ru-RU') : '—';
