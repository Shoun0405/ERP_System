/**
 * StatusBadge — yagona status pill. Audit topilmasi F-14.
 *
 * Hozir ranglar ikki joyda: index.css'dagi .badge-ok/warn/bad VA Clients.jsx'dagi
 * SC obyektidagi qotirilgan oklch() qiymatlar. Bu komponent ularni bitta manbaga
 * yig'adi — barcha modullar shuni ishlatadi, dark mode avtomatik to'g'ri bo'ladi.
 *
 * Ranglar index.css'dagi --ok/--warn/--bad/--accent tokenlaridan oziqlanadi.
 *
 * Foydalanish:
 *   <StatusBadge status="Faol" />
 *   <StatusBadge status={client.status} />
 *   <StatusBadge tone="bad" label="Qarz" />   // to'g'ridan-to'g'ri ton
 */

// Status matni → semantik ton xaritasi (bitta haqiqat manbai)
const STATUS_TONE = {
  // mijoz holatlari
  'Faol': 'ok',
  'Yangi': 'info',
  'Kutilmoqda': 'warn',
  "Muddati o'tgan": 'bad',
  // savdo / to'lov holatlari
  "To'langan": 'ok',
  'Tasdiqlangan': 'ok',
  'Qisman': 'warn',
  'Qarz': 'bad',
  // shartnoma
  'Tugayotgan': 'warn',
  'Yopilgan': 'bad',
  // mahsulot qoldig'i
  'Yetarli': 'ok',
  'Kam qoldiq': 'warn',
  'Tugadi': 'bad',
  // muloqot turlari (Interactions — TYPE_COLORS o'rniga)
  "Qo'ng'iroq": 'info',
  'Uchrashuv': 'ok',
  'Email': 'info',
  'Shikoyat': 'bad',
  'Boshqa': 'info',
  // audit amallari (Audit — ACTION_BADGE o'rniga)
  'create': 'ok',
  'update': 'warn',
  'delete': 'bad',
  'restore': 'info',
  // foydalanuvchi rollari (Users — rol badge o'rniga)
  'superAdmin': 'bad',
  'admin': 'warn',
  'user': 'info',
};

const TONE_CLASS = {
  ok:   'badge-ok',
  warn: 'badge-warn',
  bad:  'badge-bad',
  info: 'badge-info',
};

export default function StatusBadge({ status, tone, label, className = '' }) {
  const t = tone || STATUS_TONE[status] || 'info';
  const cls = TONE_CLASS[t] || 'badge-info';
  return <span className={`badge ${cls} ${className}`}>{label || status}</span>;
}

// Tashqi joylarda ham kerak bo'lsa (masalan filtr ranglari) eksport qilamiz
export { STATUS_TONE, TONE_CLASS };
