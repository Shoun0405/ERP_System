import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { fmt } from '../lib/format';
import { useModalKeys } from '../hooks/useModalKeys';
import { Search, ChevronLeft, ChevronRight, X, Eye } from 'lucide-react';

// Audit jurnalida kuzatiladigan entity turlari (backenddagi entityType qiymatlari bilan mos)
const ENTITY_TYPES = [
  { value: '',             label: 'Barcha turlar' },
  { value: 'client',       label: 'Mijoz' },
  { value: 'product',      label: 'Mahsulot' },
  { value: 'contract',     label: 'Shartnoma' },
  { value: 'sale',         label: 'Savdo' },
  { value: 'payment',      label: "To'lov" },
  { value: 'specification', label: 'Spetsifikatsiya' },
  { value: 'interaction',  label: 'Muloqot' },
  { value: 'setting',      label: 'Sozlama' },
  { value: 'user',         label: 'Foydalanuvchi' },
];

const ACTIONS = [
  { value: '',       label: 'Barcha amallar' },
  { value: 'create', label: 'Yaratish' },
  { value: 'update', label: "O'zgartirish" },
  { value: 'delete', label: "O'chirish" },
];

const ACTION_BADGE = {
  create: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  update: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  delete: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
};

const ACTION_LABEL = { create: 'Yaratish', update: "O'zgartirish", delete: "O'chirish" };
const ENTITY_LABEL = Object.fromEntries(ENTITY_TYPES.filter(e => e.value).map(e => [e.value, e.label]));

const LIMIT = 50;

export default function AuditPage() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [payloadModal, setPayloadModal] = useState(null); // tanlangan yozuv payloadi

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/audit', {
        params: {
          page,
          limit: LIMIT,
          ...(entityType && { entityType }),
          ...(action && { action }),
          ...(from && { from }),
          // "to" sanasini kun oxirigacha (inklyuziv) kengaytiramiz
          ...(to && { to: `${to}T23:59:59.999` }),
        },
      });
      setRows(res.data.data);
      setTotal(res.data.total);
    } catch {
      // xatolarni shared api interceptor ko'rsatadi
    } finally {
      setLoading(false);
    }
  }, [page, entityType, action, from, to]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Filtr o'zgarsa 1-sahifaga qaytamiz
  useEffect(() => { setPage(1); }, [entityType, action, from, to]);

  useModalKeys(!!payloadModal, null, () => setPayloadModal(null));

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const resetFilters = () => {
    setEntityType('');
    setAction('');
    setFrom('');
    setTo('');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text)]">Audit jurnali</h2>
          <p className="text-xs text-[var(--text-3)] mt-0.5">Tizimdagi barcha o'zgarishlar tarixi (kim, qachon, nima)</p>
        </div>
        <div className="text-xs text-[var(--text-3)] font-medium">
          Jami: <span className="font-mono font-semibold text-[var(--text-2)]">{fmt(total)}</span> ta yozuv
        </div>
      </div>

      {/* Filtrlar paneli */}
      <div className="card p-4 border border-[var(--border)]">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-[var(--text-2)] uppercase tracking-wider">Entity turi</label>
            <select
              value={entityType}
              onChange={e => setEntityType(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              {ENTITY_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-[var(--text-2)] uppercase tracking-wider">Amal</label>
            <select
              value={action}
              onChange={e => setAction(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              {ACTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-[var(--text-2)] uppercase tracking-wider">Sanadan</label>
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-[var(--text-2)] uppercase tracking-wider">Sanagacha</label>
            <input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          <button
            onClick={resetFilters}
            className="btn btn-outline flex items-center justify-center gap-2 text-xs font-semibold py-2 px-4 rounded-lg cursor-pointer"
          >
            <Search size={14} />
            Tozalash
          </button>
        </div>
      </div>

      {/* Asosiy jadval */}
      <div className="card p-0 overflow-hidden border border-[var(--border)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                <th className="px-5 py-3 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wider">Sana / vaqt</th>
                <th className="px-5 py-3 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wider">Foydalanuvchi</th>
                <th className="px-5 py-3 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wider">Amal</th>
                <th className="px-5 py-3 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wider">Entity turi</th>
                <th className="px-5 py-3 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wider">Entity ID</th>
                <th className="px-5 py-3 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wider">IP manzil</th>
                <th className="px-5 py-3 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wider text-right">Tafsilot</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-5 py-3"><div className="h-4 bg-[var(--surface-2)] animate-pulse rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-5 py-12 text-center text-xs text-[var(--text-3)] font-medium">Audit yozuvlari topilmadi</td>
                </tr>
              ) : (
                rows.map(r => (
                  <tr key={r.id} className="hover:bg-[var(--surface-2)] transition-colors">
                    <td className="px-5 py-3 text-xs text-[var(--text-2)] whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleString('ru-RU')}
                    </td>
                    <td className="px-5 py-3 text-xs">
                      <div className="font-semibold text-[var(--text)]">{r.user?.fullName || r.user?.username || '—'}</div>
                      {r.user?.username && r.user?.fullName && (
                        <div className="text-[10px] font-mono text-[var(--text-3)]">{r.user.username}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-bold ${ACTION_BADGE[r.action] || 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400'}`}>
                        {ACTION_LABEL[r.action] || r.action}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-[var(--text-2)]">{ENTITY_LABEL[r.entityType] || r.entityType}</td>
                    <td className="px-5 py-3 text-xs font-mono text-[var(--text-3)] max-w-[180px] truncate" title={r.entityId || ''}>
                      {r.entityId || '—'}
                    </td>
                    <td className="px-5 py-3 text-xs font-mono text-[var(--text-3)]">{r.ipAddress || '—'}</td>
                    <td className="px-5 py-3 text-xs text-right">
                      {r.payload != null ? (
                        <button
                          onClick={() => setPayloadModal(r)}
                          className="inline-flex items-center gap-1 p-1 text-slate-500 hover:text-[var(--accent)] transition"
                          title="O'zgarishlarni ko'rish"
                        >
                          <Eye size={15} strokeWidth={2} />
                        </button>
                      ) : (
                        <span className="text-[var(--text-3)]">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && total > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border)] bg-[var(--surface-2)]">
            <span className="text-xs text-[var(--text-3)]">
              {((page - 1) * LIMIT) + 1}–{Math.min(page * LIMIT, total)} / {fmt(total)}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 border border-[var(--border)] rounded-lg text-[var(--text-2)] hover:bg-[var(--surface)] disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="text-xs font-medium text-[var(--text-2)]">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 border border-[var(--border)] rounded-lg text-[var(--text-2)] hover:bg-[var(--surface)] disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Payload (o'zgarishlar) modali */}
      {payloadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in my-8">
            <div className="flex justify-between items-center px-6 py-4 border-b border-[var(--border)] bg-[var(--surface-2)]">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text)]">O'zgarishlar (payload)</h3>
                <p className="text-[10px] text-[var(--text-3)] mt-0.5">
                  {ENTITY_LABEL[payloadModal.entityType] || payloadModal.entityType}
                  {' · '}
                  {ACTION_LABEL[payloadModal.action] || payloadModal.action}
                  {' · '}
                  {new Date(payloadModal.createdAt).toLocaleString('ru-RU')}
                </p>
              </div>
              <button
                onClick={() => setPayloadModal(null)}
                className="text-[var(--text-3)] hover:text-[var(--text)] transition cursor-pointer"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>
            <div className="p-6">
              <pre className="text-[11px] leading-relaxed font-mono text-[var(--text-2)] bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-4 overflow-x-auto max-h-[60vh] overflow-y-auto whitespace-pre-wrap break-words">
                {JSON.stringify(payloadModal.payload, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
