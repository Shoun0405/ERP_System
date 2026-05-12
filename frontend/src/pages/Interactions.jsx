import React, { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useModalKeys } from '../hooks/useModalKeys';
import Pagination from '../components/Pagination';
import { Plus, X, MessageSquare, Phone, Users, Mail, Calendar, Edit2, Trash2, Search } from 'lucide-react';

function today() { return new Date().toISOString().split('T')[0]; }

const TYPE_ICONS = {
  "Qo'ng'iroq": Phone,
  'Uchrashuv':  Users,
  'Email':      Mail,
  'Boshqa':     MessageSquare,
};
const TYPE_LIST = Object.keys(TYPE_ICONS);

const TYPE_COLORS = {
  "Qo'ng'iroq": 'bg-blue-50 text-blue-700 border-blue-200',
  'Uchrashuv':  'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Email':      'bg-violet-50 text-violet-700 border-violet-200',
  'Boshqa':     'bg-zinc-50 text-zinc-600 border-zinc-200',
};

const EMPTY = { date: today(), type: "Qo'ng'iroq", note: '', nextDate: '', clientId: '' };

export default function InteractionsPage() {
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
  const [search,           setSearch]           = useState('');
  const [debouncedSearch,  setDebouncedSearch]  = useState('');

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

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
  const closeModal = () => { setModal(null); setEditId(null); };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!form.clientId) { toast.error('Mijozni tanlang!'); return; }
    setSaving(true);
    const payload = { ...form, nextDate: form.nextDate || null };
    try {
      if (modal === 'edit') {
        await api.put(`/api/interactions/${editId}`, payload);
        toast.success('Yangilandi');
      } else {
        await api.post('/api/interactions', payload);
        toast.success("Muloqot qo'shildi");
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
      toast.success("O'chirildi");
    } catch { /* interceptor shows toast */ }
  };

  useModalKeys(!!modal, handleSave, closeModal);

  const inp = 'w-full px-3 py-2 border border-zinc-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none transition';
  const hasFilter = filterClient || search;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">Muloqotlar (CRM tarix)</h2>
          <p className="text-sm text-zinc-500 mt-0.5">{total} ta yozuv</p>
        </div>
        <button onClick={openAdd} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition flex items-center gap-2 shadow-sm">
          <Plus size={16}/> Yangi muloqot
        </button>
      </div>

      <div className="mini-card p-0">
        <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50/50 flex items-center gap-3 flex-wrap">
          <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
            className="px-3 py-1.5 border border-zinc-200 rounded-md text-sm bg-white focus:border-blue-500 outline-none">
            <option value="">Barcha mijozlar</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4"/>
            <input type="text" placeholder="Mijoz, izoh, tur..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-1.5 bg-white border border-zinc-200 rounded-md text-sm focus:border-blue-500 outline-none transition w-44"/>
          </div>
          {hasFilter && (
            <button onClick={() => { setFilterClient(''); setSearch(''); }}
              className="text-xs text-zinc-500 hover:text-zinc-700 flex items-center gap-1">
              <X size={12}/> Tozalash
            </button>
          )}
        </div>

        <div className="divide-y divide-zinc-100">
          {loading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="px-6 py-4 flex gap-4">
                <div className="w-9 h-9 bg-zinc-100 animate-pulse rounded-lg shrink-0"/>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-zinc-100 animate-pulse rounded w-1/3"/>
                  <div className="h-3 bg-zinc-100 animate-pulse rounded w-2/3"/>
                </div>
              </div>
            ))
          ) : interactions.length === 0 ? (
            <div className="px-6 py-12 text-center text-zinc-400 text-sm">
              {hasFilter ? 'Topilmadi' : "Hozircha muloqotlar yo'q"}
            </div>
          ) : interactions.map(it => {
            const Icon = TYPE_ICONS[it.type] || MessageSquare;
            return (
              <div key={it.id} className="px-6 py-4 flex gap-4 hover:bg-zinc-50 transition-colors group">
                <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${TYPE_COLORS[it.type] || TYPE_COLORS['Boshqa']}`}>
                  <Icon size={15}/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-zinc-900">{it.client?.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${TYPE_COLORS[it.type] || TYPE_COLORS['Boshqa']}`}>{it.type}</span>
                    <span className="text-xs text-zinc-400">{new Date(it.date).toLocaleDateString('ru-RU')}</span>
                  </div>
                  {it.note && <p className="text-sm text-zinc-600 mt-1">{it.note}</p>}
                  {it.nextDate && (
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <Calendar size={11}/> Keyingi: {new Date(it.nextDate).toLocaleDateString('ru-RU')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => openEdit(it)} className="p-1.5 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition"><Edit2 size={14}/></button>
                  <button onClick={() => setDelId(it.id)} className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"><Trash2 size={14}/></button>
                </div>
              </div>
            );
          })}
        </div>
        <Pagination page={page} total={total} limit={LIMIT} onPage={setPage}/>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-zinc-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-zinc-900">{modal === 'edit' ? 'Muloqotni tahrirlash' : 'Yangi muloqot'}</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">Ctrl+Enter — saqlash</span>
                <button onClick={closeModal} className="text-zinc-400 hover:text-zinc-600 p-1 rounded-md hover:bg-zinc-100"><X size={20}/></button>
              </div>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Mijoz *</label>
                <select required value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))} className={inp}>
                  <option value="">— Mijozni tanlang —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Sana *</label>
                  <input type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inp}/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Turi *</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inp}>
                    {TYPE_LIST.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Izoh</label>
                <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  className={`${inp} resize-none`} rows={3} placeholder="Muloqot haqida qisqacha..."/>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Keyingi aloqa sanasi <span className="text-zinc-400 font-normal">— ixtiyoriy</span></label>
                <input type="date" value={form.nextDate} onChange={e => setForm(f => ({ ...f, nextDate: e.target.value }))} className={inp}/>
              </div>
              <div className="pt-4 border-t border-zinc-200 flex justify-end gap-3">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 rounded-md transition">Bekor</button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-md transition shadow-sm">
                  {saving ? 'Saqlanmoqda...' : 'Saqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {delId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={22} className="text-red-600"/></div>
            <h3 className="text-lg font-bold text-zinc-900 mb-2">Muloqotni o'chirish</h3>
            <p className="text-sm text-zinc-500 mb-6">Bu yozuv o'chiriladi.</p>
            <div className="flex gap-3">
              <button onClick={() => setDelId(null)} className="flex-1 px-4 py-2 text-sm font-medium border border-zinc-300 rounded-md hover:bg-zinc-50 transition">Bekor</button>
              <button onClick={handleDelete} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition">O'chirish</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
