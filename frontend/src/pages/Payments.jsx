import React, { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useModalKeys } from '../hooks/useModalKeys';
import Pagination from '../components/Pagination';
import { Plus, X, Trash2, AlertCircle, Search } from 'lucide-react';

function fmt(n) {
  if (!n && n !== 0) return '0';
  return Math.round(n).toLocaleString('ru-RU');
}
function today() { return new Date().toISOString().split('T')[0]; }

export default function Payments() {
  const [payments,  setPayments]  = useState([]);
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);
  const LIMIT = 50;

  const [clients,   setClients]   = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(false);
  const [delId,     setDelId]     = useState(null);
  const [saving,    setSaving]    = useState(false);

  const [filterClient, setFilterClient] = useState('');
  const [search,    setSearch]    = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateFrom,  setDateFrom]  = useState('');
  const [dateTo,    setDateTo]    = useState('');

  const [form, setForm] = useState({ date: today(), amount: '', note: '', clientId: '', contractId: '' });

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [filterClient, dateFrom, dateTo]);

  const fetchPayments = useCallback(() => {
    setLoading(true);
    api.get('/api/payments', { params: { page, limit: LIMIT, search: debouncedSearch, clientId: filterClient, from: dateFrom, to: dateTo } })
      .then(r => { setPayments(r.data.data); setTotal(r.data.total); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page, debouncedSearch, filterClient, dateFrom, dateTo]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  useEffect(() => {
    api.get('/api/clients', { params: { limit: 200 } }).then(r => setClients(r.data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.clientId) { setContracts([]); return; }
    api.get(`/api/contracts?clientId=${form.clientId}`).then(r => setContracts(r.data)).catch(() => setContracts([]));
  }, [form.clientId]);

  const totalIn = payments.reduce((s, p) => s + p.amount, 0);
  const hasFilter = filterClient || dateFrom || dateTo || search;

  const openModal = () => {
    setForm({ date: today(), amount: '', note: '', clientId: '', contractId: '' });
    setModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.clientId)   { toast.error('Mijozni tanlang!'); return; }
    if (!form.contractId) { toast.error('Shartnomani tanlang!'); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Summani kiriting!'); return; }
    setSaving(true);
    try {
      await api.post('/api/payments', form);
      toast.success('To\'lov kiritildi');
      setModal(false);
      fetchPayments();
    } catch { /* interceptor shows toast */ } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/api/payments/${delId}`);
      setDelId(null);
      fetchPayments();
      toast.success('O\'chirildi');
    } catch { /* interceptor shows toast */ }
  };

  useModalKeys(modal, handleSave, () => setModal(false));

  const inp = 'w-full px-3 py-2 border border-zinc-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none transition';

  const debtSummary = clients
    .map(c => ({ ...c, debt: c.debt ?? (c.totalSales || 0) - (c.totalPayments || 0) }))
    .filter(c => c.debt !== 0)
    .sort((a, b) => b.debt - a.debt)
    .slice(0, 8);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">Tushumlar</h2>
          <p className="text-sm text-zinc-500 mt-0.5">{total} ta to'lov</p>
        </div>
        <button onClick={openModal} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition flex items-center gap-2 shadow-sm">
          <Plus size={16}/> Yangi Tushum
        </button>
      </div>

      {debtSummary.length > 0 && (
        <div className="mini-card p-0">
          <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50/50 flex items-center gap-2">
            <AlertCircle size={15} className="text-red-500"/>
            <h3 className="text-sm font-semibold text-zinc-900">Qarzdorlik holati</h3>
          </div>
          <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            {debtSummary.map(c => (
              <div key={c.id} onClick={() => setFilterClient(filterClient === c.id ? '' : c.id)}
                className={`p-3 rounded-lg border cursor-pointer transition ${
                  filterClient === c.id ? 'border-blue-300 bg-blue-50'
                  : c.debt > 0 ? 'border-red-100 bg-red-50/50 hover:border-red-200'
                  : 'border-emerald-100 bg-emerald-50/50 hover:border-emerald-200'
                }`}>
                <p className="text-xs font-medium text-zinc-600 truncate">{c.name}</p>
                <p className={`text-sm font-bold mt-1 ${c.debt > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {c.debt > 0 ? '' : '+'}{fmt(c.debt)} UZS
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mini-card p-0">
        <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50/50 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
              className="px-3 py-1.5 border border-zinc-200 rounded-md text-sm bg-white focus:border-blue-500 outline-none">
              <option value="">Barcha mijozlar</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4"/>
              <input type="text" placeholder="Mijoz, izoh..." value={search} onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-4 py-1.5 bg-white border border-zinc-200 rounded-md text-sm focus:border-blue-500 outline-none transition w-40"/>
            </div>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-1.5 border border-zinc-200 rounded-md text-sm bg-white focus:border-blue-500 outline-none" title="Dan"/>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="px-3 py-1.5 border border-zinc-200 rounded-md text-sm bg-white focus:border-blue-500 outline-none" title="Gacha"/>
            {hasFilter && (
              <button onClick={() => { setFilterClient(''); setSearch(''); setDateFrom(''); setDateTo(''); }}
                className="text-xs text-zinc-500 hover:text-zinc-700 flex items-center gap-1">
                <X size={12}/> Tozalash
              </button>
            )}
          </div>
          <div className="text-sm font-semibold text-zinc-700">
            Jami: <span className="text-emerald-600">{fmt(totalIn)} UZS</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Sana</th>
                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Mijoz</th>
                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Shartnoma</th>
                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Izoh</th>
                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Summa</th>
                <th className="px-6 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>{[...Array(6)].map((_, j) => <td key={j} className="px-6 py-4"><div className="h-4 bg-zinc-100 animate-pulse rounded"/></td>)}</tr>
                ))
              ) : payments.length === 0 ? (
                <tr><td colSpan="6" className="px-6 py-12 text-center text-zinc-400 text-sm">
                  {hasFilter ? 'Topilmadi' : 'Hozircha to\'lovlar yo\'q'}
                </td></tr>
              ) : payments.map(p => (
                <tr key={p.id} className="hover:bg-zinc-50 transition-colors group">
                  <td className="px-6 py-4 text-sm text-zinc-600">{new Date(p.date).toLocaleDateString('ru-RU')}</td>
                  <td className="px-6 py-4 text-sm font-medium text-zinc-900">{p.client?.name}</td>
                  <td className="px-6 py-4 text-sm text-zinc-500">{p.contract ? `№${p.contract.number}` : '—'}</td>
                  <td className="px-6 py-4 text-sm text-zinc-500">{p.note || '—'}</td>
                  <td className="px-6 py-4 text-sm text-right font-bold text-emerald-600">{fmt(p.amount)} UZS</td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setDelId(p.id)} className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"><Trash2 size={14}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={total} limit={LIMIT} onPage={setPage}/>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-zinc-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-zinc-900">Yangi Tushum kiritish</h3>
              <button onClick={() => setModal(false)} className="text-zinc-400 hover:text-zinc-600 p-1 rounded-md hover:bg-zinc-100"><X size={20}/></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Mijoz *</label>
                <select required value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value, contractId: '' }))} className={inp}>
                  <option value="">— Mijozni tanlang —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Shartnoma *</label>
                <select required value={form.contractId} onChange={e => setForm(f => ({ ...f, contractId: e.target.value }))} className={inp} disabled={!form.clientId}>
                  <option value="">— Shartnomani tanlang —</option>
                  {contracts.map(c => <option key={c.id} value={c.id}>№{c.number} ({new Date(c.date).toLocaleDateString('ru-RU')})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Sana *</label>
                  <input type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inp}/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Summa (UZS) *</label>
                  <input type="number" required min="1" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className={inp} placeholder="0"/>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Izoh</label>
                <input type="text" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className={inp} placeholder="To'lov turi, bank, qayd..."/>
              </div>
              <div className="pt-4 border-t border-zinc-200 flex justify-end gap-3">
                <button type="button" onClick={() => setModal(false)} className="px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 rounded-md transition">Bekor</button>
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
            <h3 className="text-lg font-bold text-zinc-900 mb-2">To'lovni o'chirish</h3>
            <p className="text-sm text-zinc-500 mb-6">Bu to'lov yozuvi o'chiriladi.</p>
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
