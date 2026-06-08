import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useModalKeys } from '../hooks/useModalKeys';
import { useSearchOnEnter } from '../hooks/useSearchOnEnter';
import Pagination from '../components/Pagination';
import AuditCell from '../components/AuditCell';
import { useUsersLookup } from '../hooks/useUsersLookup';
import { fmtDate } from '../lib/format';
import { Plus, X, MessageSquare, Phone, Users, Mail, Calendar, Edit2, Trash2, Search, Copy } from 'lucide-react';

function today() { return new Date().toISOString().split('T')[0]; }

const TYPE_ICONS = {
  "Qo'ng'iroq": Phone,
  'Uchrashuv':  Users,
  'Email':      Mail,
  'Boshqa':     MessageSquare,
};
const TYPE_LIST = Object.keys(TYPE_ICONS);

const TYPE_COLORS = {
  "Qo'ng'iroq": 'bg-[oklch(0.96_0.03_250)] text-[var(--accent)] border-[oklch(0.88_0.05_250)] border',
  'Uchrashuv':  'bg-[oklch(0.96_0.04_155)] text-[oklch(0.38_0.10_155)] border-[oklch(0.88_0.06_155)] border',
  'Email':      'bg-[oklch(0.96_0.04_290)] text-[oklch(0.40_0.12_290)] border-[oklch(0.88_0.05_290)] border',
  'Boshqa':     'bg-[var(--surface-2)] text-[var(--text-2)] border border-[var(--border)]',
};

const EMPTY = { date: today(), type: "Qo'ng'iroq", note: '', nextDate: '', clientId: '' };

const TYPE_KEY = {
  "Qo'ng'iroq": 'call',
  'Uchrashuv':  'meeting',
  'Email':      'email',
  'Boshqa':     'other',
};

export default function InteractionsPage({ user }) {
  const { t } = useTranslation();
  const typeLabel = (type) => t(`interactions.type.${TYPE_KEY[type] || 'other'}`);
  const canHardDelete = user?.role === 'superAdmin';
  const auditUsers = useUsersLookup();
  const [interactions, setInteractions] = useState([]);
  const [total,        setTotal]        = useState(0);
  const [page,         setPage]         = useState(1);
  const LIMIT = 50;

  const [clients,      setClients]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [modal,        setModal]        = useState(null); // 'add' | 'edit' | null
  const [editId,       setEditId]       = useState(null);
  const [delId,        setDelId]        = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [form,         setForm]         = useState(EMPTY);

  const [filterClient,     setFilterClient]     = useState('');
  const { text: search, query: debouncedSearch, reset: resetSearch, inputProps: searchInput } = useSearchOnEnter('', () => setPage(1));

  useEffect(() => { setPage(1); }, [filterClient]);

  const fetchInteractions = useCallback(() => {
    setLoading(true);
    api.get('/api/interactions', { params: { page, limit: LIMIT, search: debouncedSearch, clientId: filterClient } })
      .then(r => { setInteractions(r.data.data); setTotal(r.data.total); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page, debouncedSearch, filterClient]);

  useEffect(() => { fetchInteractions(); }, [fetchInteractions]);

  useEffect(() => {
    api.get('/api/clients', { params: { limit: 200 } }).then(r => setClients(r.data.data)).catch(() => {});
  }, []);

  const openAdd = () => { setForm(EMPTY); setEditId(null); setModal('add'); };
  const openEdit = (it) => {
    setForm({
      date:     it.date.split('T')[0],
      type:     it.type,
      note:     it.note || '',
      nextDate: it.nextDate ? it.nextDate.split('T')[0] : '',
      clientId: it.clientId,
    });
    setEditId(it.id);
    setModal('edit');
  };
  const handleCopy = it => {
    setForm({
      date:     today(),
      type:     it.type,
      note:     it.note || '',
      nextDate: it.nextDate ? it.nextDate.split('T')[0] : '',
      clientId: it.clientId,
    });
    setEditId(null);
    setModal('add');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const closeModal = () => { setModal(null); setEditId(null); };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!form.clientId) { toast.error(t('interactions.selectClientError')); return; }
    setSaving(true);
    const payload = { ...form, nextDate: form.nextDate || null };
    try {
      if (modal === 'edit') {
        await api.put(`/api/interactions/${editId}`, payload);
        toast.success(t('common.updated'));
      } else {
        await api.post('/api/interactions', payload);
        toast.success(t('interactions.added'));
      }
      fetchInteractions();
      closeModal();
    } catch { /* interceptor shows toast */ } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/api/interactions/${delId}`);
      setDelId(null);
      fetchInteractions();
      toast.success(t('common.deleted'));
    } catch { /* interceptor shows toast */ }
  };

  const handleRestore = async (rec) => {
    try { await api.post(`/api/interactions/${rec.id}/restore`); toast.success(t('common.restored')); fetchInteractions(); }
    catch { /* interceptor toast */ }
  };
  const handleHardDelete = async (rec) => {
    if (!window.confirm(t('common.hardDeleteConfirm'))) return;
    try { await api.delete(`/api/interactions/${rec.id}/hard`); toast.success(t('common.hardDeleted')); fetchInteractions(); }
    catch { /* interceptor toast */ }
  };

  useModalKeys(!!modal, handleSave, closeModal);

  const inp = 'w-full px-3 py-2 border border-[var(--border)] bg-[var(--surface)] rounded-md text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none transition text-[var(--text)]';
  const hasFilter = filterClient || search;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 animate-in">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">{t('interactions.title')}</h2>
            <p className="text-xs text-[var(--text-3)] mt-0.5">{t('interactions.count', { count: total })}</p>
          </div>
          <button onClick={openAdd} className="px-3 py-1.5 btn-primary rounded-lg text-xs font-medium transition flex items-center gap-1.5 shadow-sm">
            <Plus size={16} strokeWidth={2.2}/> {t('interactions.new')}
          </button>
        </div>
      </div>

      {/* Inline Accordion Form for adding Interaction */}
      {modal === 'add' && (
        <div className="mini-card p-6 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex justify-between items-center border-b border-[var(--border)] pb-3">
            <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
              <Plus size={18} strokeWidth={2.2} className="text-[var(--accent)]"/>
              {t('interactions.modalTitle')}
            </h3>
            <button onClick={closeModal} className="text-[var(--text-3)] hover:text-[var(--text)] p-1 rounded-md hover:bg-[var(--surface-2)]">
              <X size={18} strokeWidth={2.2}/>
            </button>
          </div>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-2)] mb-1">{t('interactions.clientLabel')} *</label>
                <select required value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))} className={inp}>
                  <option value="">{t('common.selectClient')}</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-2)] mb-1">{t('common.date')} *</label>
                  <input type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inp}/>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-2)] mb-1">{t('interactions.typeLabel')} *</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inp}>
                    {TYPE_LIST.map(ty => <option key={ty} value={ty}>{typeLabel(ty)}</option>)}
                  </select>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-[var(--text-2)] mb-1">{t('common.comment')}</label>
                <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  className={`${inp} resize-none`} rows={3} placeholder={t('interactions.notePlaceholder')}/>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-[var(--text-2)] mb-1">{t('interactions.nextDateLabel')} <span className="text-[var(--text-3)] font-normal">{t('common.optional')}</span></label>
                <input type="date" value={form.nextDate} onChange={e => setForm(f => ({ ...f, nextDate: e.target.value }))} className={inp}/>
              </div>
            </div>
            <div className="pt-3 border-t border-[var(--border)] flex justify-end gap-2">
              <button type="button" onClick={closeModal} className="px-3 py-1.5 text-xs font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] rounded-lg border border-[var(--border)] transition">{t('common.cancel')}</button>
              <button type="submit" disabled={saving} className="px-4 py-1.5 btn-primary disabled:opacity-60 text-xs font-medium rounded-lg transition shadow-sm">
                {saving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="mini-card p-0">
        <div className="px-5 py-3 border-b border-[var(--border)] bg-[var(--surface-2)] flex items-center gap-3 flex-wrap">
          <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
            className="px-3 py-1.5 border border-[var(--border)] rounded-lg text-xs bg-[var(--surface)] focus:border-[var(--accent)] outline-none transition text-[var(--text)]">
            <option value="">{t('interactions.allClients')}</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="relative">
            <Search size={16} strokeWidth={2.2} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]"/>
            <input type="text" placeholder={t('interactions.searchPlaceholder')} {...searchInput}
              className="pl-9 pr-4 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs focus:border-[var(--accent)] outline-none transition w-44 text-[var(--text)] placeholder-[var(--text-3)]"/>
          </div>
          {hasFilter && (
            <button onClick={() => { setFilterClient(''); resetSearch(); }}
              className="text-xs text-[var(--text-3)] hover:text-[var(--text)] flex items-center gap-1">
              <X size={14} strokeWidth={2}/> {t('common.clear')}
            </button>
          )}
        </div>

        <div className="divide-y divide-[var(--border)] bg-[var(--surface)]">
          {loading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="px-5 py-3 flex gap-4">
                <div className="w-8 h-8 bg-[var(--surface-2)] animate-pulse rounded-lg shrink-0"/>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[var(--surface-2)] animate-pulse rounded w-1/3"/>
                  <div className="h-3 bg-[var(--surface-2)] animate-pulse rounded w-2/3"/>
                </div>
              </div>
            ))
          ) : interactions.length === 0 ? (
            <div className="px-5 py-12 text-center text-[var(--text-3)] text-xs">
              {hasFilter ? t('common.notFound') : t('interactions.empty')}
            </div>
          ) : interactions.map(it => {
            const Icon = TYPE_ICONS[it.type] || MessageSquare;
            return (
              <div key={it.id} className={`px-5 py-3 flex gap-4 hover:bg-[var(--surface-2)] transition-colors group border-b border-[var(--border)] last:border-none${it.deletedAt?' opacity-60 bg-red-50 dark:bg-red-950/20':''}`}>
                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${TYPE_COLORS[it.type] || TYPE_COLORS['Boshqa']}`}>
                  <Icon size={18} strokeWidth={2}/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-[var(--text)]">{it.client?.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${TYPE_COLORS[it.type] || TYPE_COLORS['Boshqa']}`}>{typeLabel(it.type)}</span>
                    <span className="text-[10px] text-[var(--text-3)] font-mono">{fmtDate(it.date)}</span>
                  </div>
                  {it.note && <p className="text-xs text-[var(--text-2)] mt-1">{it.note}</p>}
                  {it.nextDate && (
                    <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1 font-semibold">
                      <Calendar size={13} strokeWidth={2}/> {t('interactions.nextShort')}: {fmtDate(it.nextDate)}
                    </p>
                  )}
                  <div className="mt-1.5"><AuditCell record={it} users={auditUsers} /></div>
                </div>
                {it.deletedAt ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-red-500 font-semibold">{t('common.deletedBadge')}</span>
                    {canHardDelete && (
                      <>
                        <button onClick={() => handleRestore(it)} className="text-[10px] text-[var(--accent)] font-semibold hover:underline px-1" title={t('common.restore')}>{t('common.restore')}</button>
                        <button onClick={() => handleHardDelete(it)} className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition" title={t('common.hardDelete')}><Trash2 size={15} strokeWidth={1.8}/></button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => handleCopy(it)} className="p-1 text-[var(--text-3)] hover:text-[var(--accent)] hover:bg-[var(--surface-2)] rounded transition" title={t('common.copy')}><Copy size={15} strokeWidth={1.8}/></button>
                    <button onClick={() => openEdit(it)} className="p-1 text-[var(--text-3)] hover:text-[var(--accent)] hover:bg-[var(--surface-2)] rounded transition" title={t('common.edit')}><Edit2 size={15} strokeWidth={1.8}/></button>
                    <button onClick={() => setDelId(it.id)} className="p-1 text-[var(--text-3)] hover:text-red-500 hover:bg-red-50 rounded transition" title={t('common.delete')}><Trash2 size={15} strokeWidth={1.8}/></button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <Pagination page={page} total={total} limit={LIMIT} onPage={setPage}/>
      </div>

      {modal === 'edit' && (
        <div className="modal-overlay">
          <div className="modal-card w-full max-w-md">
            <div className="px-6 py-4 border-b border-[var(--border)] flex justify-between items-center">
              <h3 className="text-lg font-bold text-[var(--text)]">{t('interactions.editTitle')}</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-3)]">{t('common.shortcutHint')}</span>
                <button onClick={closeModal} className="text-[var(--text-3)] hover:text-[var(--text)] p-1 rounded-md hover:bg-[var(--surface-2)]"><X size={20}/></button>
              </div>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-2)] mb-1">{t('interactions.clientLabel')} *</label>
                <select required value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))} className={inp}>
                  <option value="">{t('common.selectClient')}</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-2)] mb-1">{t('common.date')} *</label>
                  <input type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inp}/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-2)] mb-1">{t('interactions.typeLabel')} *</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inp}>
                    {TYPE_LIST.map(ty => <option key={ty} value={ty}>{typeLabel(ty)}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-2)] mb-1">{t('common.comment')}</label>
                <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  className={`${inp} resize-none`} rows={3} placeholder={t('interactions.notePlaceholder')}/>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-2)] mb-1">{t('interactions.nextDateLabel')} <span className="text-[var(--text-3)] font-normal">{t('common.optional')}</span></label>
                <input type="date" value={form.nextDate} onChange={e => setForm(f => ({ ...f, nextDate: e.target.value }))} className={inp}/>
              </div>
              <div className="pt-4 border-t border-[var(--border)] flex justify-end gap-3">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] rounded-md transition">{t('common.cancel')}</button>
                <button type="submit" disabled={saving} className="px-5 py-2 btn-primary disabled:opacity-60 text-sm font-medium rounded-md transition shadow-sm">
                  {saving ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {delId && (
        <div className="modal-overlay">
          <div className="modal-card w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={22} className="text-red-600"/></div>
            <h3 className="text-lg font-bold text-[var(--text)] mb-2">{t('interactions.deleteTitle')}</h3>
            <p className="text-sm text-[var(--text-3)] mb-6">{t('interactions.deleteBody')}</p>
            <div className="flex gap-3">
              <button onClick={() => setDelId(null)} className="flex-1 px-4 py-2 text-sm font-medium border border-[var(--border)] rounded-md hover:bg-[var(--surface-2)] transition">{t('common.cancel')}</button>
              <button onClick={handleDelete} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition">{t('common.delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
