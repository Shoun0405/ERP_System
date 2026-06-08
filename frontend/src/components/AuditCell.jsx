import { fmtDateTime, userColor } from '../lib/format';
import { useTranslation } from 'react-i18next';

// Audit "Kim / Qachon" ustuni: yuqorida oxirgi tegingan foydalanuvchi (rangli),
// ostida vaqt. Tahrir bo'lgan bo'lsa updatedBy, aks holda createdBy.
export default function AuditCell({ record, users }) {
  const { t } = useTranslation();
  const actorId = record?.updatedById || record?.createdById || null;
  const when    = record?.updatedAt   || record?.createdAt   || null;
  const edited  = !!record?.updatedById;
  const name    = (actorId && users?.get(actorId)?.fullName) || '—';

  if (!actorId && !when) {
    return <span className="text-[11px] text-[var(--text-3)]">—</span>;
  }

  return (
    <div className="leading-tight">
      <div className="text-[11px] font-semibold flex items-center gap-1" style={{ color: userColor(actorId) }}>
        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: userColor(actorId) }} />
        {name}
        {edited && <span className="text-[9px] font-normal text-[var(--text-3)]">{t('pagination.edited')}</span>}
      </div>
      <div className="text-[10px] text-[var(--text-3)] font-mono">{fmtDateTime(when)}</div>
    </div>
  );
}
