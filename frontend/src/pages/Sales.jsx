import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import { useModalKeys } from '../hooks/useModalKeys';
import Pagination from '../components/Pagination';
import { fmt } from '../lib/format';
import {
  Plus, X, Trash2, Package, Eye, Printer,
  FileText, Truck, User, Calendar, Hash, Search
} from 'lucide-react';

function today() { return new Date().toISOString().split('T')[0]; }

const PACK_TYPES = { 1: '1 dona', 2: '2 dona', 4: '4 dona', 8: '8 dona', 16: '16 dona' };

// ─── Print template ────────────────────────────────────────────────────────
function PrintableInvoice({ sale, company }) {
  if (!sale) return null;
  const td = { border: '1px solid #999', padding: '4px 8px', fontSize: 11 };
  const th = { ...td, background: '#f5f5f5', fontWeight: 'bold', textAlign: 'center' };
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '15mm', color: '#000' }}>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>{company?.companyName || 'Tashkilot'}</h2>
        {company?.companyAddress && <p style={{ margin: '2px 0', fontSize: 11 }}>{company.companyAddress}</p>}
        {company?.companyInn && <p style={{ margin: '2px 0', fontSize: 11 }}>STIR: {company.companyInn}</p>}
      </div>
      <h3 style={{ textAlign: 'center', margin: '8px 0', fontSize: 14 }}>
        YUK XATI № {sale.nakladnoy}
      </h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
        <tbody>
          <tr>
            <td style={td}><b>Mijoz:</b></td>
            <td style={td}>{sale.client?.name}</td>
            <td style={td}><b>Sana:</b></td>
            <td style={td}>{new Date(sale.date).toLocaleDateString('ru-RU')}</td>
          </tr>
          <tr>
            <td style={td}><b>Sotuvchi:</b></td>
            <td style={td}>{sale.sellerName}</td>
            <td style={td}><b>Transport:</b></td>
            <td style={td}>{sale.transportNum || '—'}</td>
          </tr>
        </tbody>
      </table>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
        <thead>
          <tr>
            <th style={th}>№</th>
            <th style={th}>Mahsulot</th>
            <th style={th}>Dona</th>
            <th style={th}>m³</th>
            <th style={th}>kg</th>
            <th style={th}>Narx (1m³)</th>
            <th style={th}>Summa</th>
          </tr>
        </thead>
        <tbody>
          {sale.products?.map((p, i) => (
            <tr key={i}>
              <td style={{ ...td, textAlign: 'center' }}>{i + 1}</td>
              <td style={td}>{p.product?.article || p.productId?.slice(0, 8)}</td>
              <td style={{ ...td, textAlign: 'center' }}>{p.totalPieces}</td>
              <td style={{ ...td, textAlign: 'center' }}>{p.totalCbm?.toFixed(4)}</td>
              <td style={{ ...td, textAlign: 'center' }}>{p.totalKg?.toFixed(2)}</td>
              <td style={{ ...td, textAlign: 'right' }}>{fmt(p.priceCbm)}</td>
              <td style={{ ...td, textAlign: 'right' }}>{fmt(p.rowAmount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={6} style={{ ...th, textAlign: 'right' }}>Jami:</td>
            <td style={{ ...th, textAlign: 'right' }}>{fmt(sale.totalAmount)} UZS</td>
          </tr>
        </tfoot>
      </table>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 30, fontSize: 11 }}>
        <div>Sotuvchi: _________________ / {sale.sellerName} /</div>
        <div>Xaridor: _________________</div>
      </div>
    </div>
  );
}

// ─── ProductRow ─────────────────────────────────────────────────────────────
function ProductRow({ row, products, onUpdate, onRemove, idx }) {
  const handleProductChange = (productId) => {
    const p = products.find(x => x.id === productId);
    if (!p) return;
    onUpdate(idx, { ...row, productId, priceCbm: p.priceCbm, packType: 1, totalPieces: 0, totalCbm: 0, totalKg: 0, totalSqm: 0, rowAmount: 0 });
  };
  const handleChange = (field, val) => {
    const updated = { ...row, [field]: val };
    if (field === 'totalPieces' || field === 'packType') {
      const pieces = parseInt(field === 'totalPieces' ? val : row.totalPieces) || 0;
      const p = products.find(x => x.id === row.productId);
      if (p) {
        updated.totalCbm  = +(pieces * p.cbmPerPce).toFixed(6);
        updated.totalKg   = +(pieces * p.kgPerPce).toFixed(3);
        updated.totalSqm  = +(pieces * p.sqmPerPce).toFixed(4);
        updated.rowAmount = +(updated.totalCbm * updated.priceCbm).toFixed(0);
      }
    }
    if (field === 'priceCbm') updated.rowAmount = +(row.totalCbm * (parseFloat(val) || 0)).toFixed(0);
    onUpdate(idx, updated);
  };
  const s = 'w-full px-2.5 py-1.5 border border-zinc-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white';
  return (
    <tr className="border-b border-zinc-100 hover:bg-zinc-50/50">
      <td className="p-2">
        <select value={row.productId} onChange={e => handleProductChange(e.target.value)} className={s} required>
          <option value="">— Tanlang —</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.article}</option>)}
        </select>
      </td>
      <td className="p-2 w-28">
        <select value={row.packType} onChange={e => handleChange('packType', e.target.value)} className={s}>
          {Object.entries(PACK_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </td>
      <td className="p-2 w-24">
        <input type="number" min="0" value={row.totalPieces} onChange={e => handleChange('totalPieces', e.target.value)} className={s} required />
      </td>
      <td className="p-2 w-24"><input readOnly value={row.totalCbm.toFixed(4)} className={`${s} bg-zinc-50 text-zinc-500`} /></td>
      <td className="p-2 w-24"><input readOnly value={row.totalKg.toFixed(2)} className={`${s} bg-zinc-50 text-zinc-500`} /></td>
      <td className="p-2 w-32">
        <input type="number" min="0" value={row.priceCbm} onChange={e => handleChange('priceCbm', e.target.value)} className={s} />
      </td>
      <td className="p-2 w-36 text-right"><span className="text-sm font-semibold text-zinc-900 pr-2">{fmt(row.rowAmount)}</span></td>
      <td className="p-2 w-10">
        <button type="button" onClick={() => onRemove(idx)} className="p-1 text-zinc-300 hover:text-red-500 transition"><X size={15} /></button>
      </td>
    </tr>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function Sales() {
  const [sales,    setSales]    = useState([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const LIMIT = 50;

  const [clients,   setClients]   = useState([]);
  const [contracts, setContracts] = useState([]);
  const [products,  setProducts]  = useState([]);
  const [settings,  setSettings]  = useState(null);
  const [loading,   setLoading]   = useState(true);

  const [search,          setSearch]         = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterClient,    setFilterClient]   = useState('');
  const [dateFrom,        setDateFrom]       = useState('');
  const [dateTo,          setDateTo]         = useState('');

  const [modal,  setModal]  = useState(false);
  const [detail, setDetail] = useState(null);
  const [delId,  setDelId]  = useState(null);
  const [saving, setSaving] = useState(false);

  const printRef = useRef();
  const handlePrint = useReactToPrint({ contentRef: printRef, documentTitle: `Yuk xati ${detail?.nakladnoy || ''}` });

  const EMPTY_ROW = { productId: '', packType: 1, totalPieces: 0, totalCbm: 0, totalKg: 0, totalSqm: 0, priceCbm: 0, rowAmount: 0 };
  const [form, setForm] = useState({ date: today(), nakladnoy: '', sellerName: '', transportNum: '', clientId: '', contractId: '', rows: [{ ...EMPTY_ROW }] });

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [filterClient, dateFrom, dateTo]);

  const fetchSales = useCallback(() => {
    setLoading(true);
    api.get('/api/sales', { params: { page, limit: LIMIT, search: debouncedSearch, clientId: filterClient, from: dateFrom, to: dateTo } })
      .then(r => { setSales(r.data.data); setTotal(r.data.total); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page, debouncedSearch, filterClient, dateFrom, dateTo]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  // Load clients, products, settings once
  useEffect(() => {
    Promise.all([
      api.get('/api/clients',  { params: { limit: 200 } }),
      api.get('/api/products', { params: { limit: 200 } }),
      api.get('/api/settings'),
    ]).then(([c, p, s]) => {
      setClients(c.data.data);
      setProducts(p.data.data);
      setSettings(s.data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.clientId) { setContracts([]); return; }
    api.get(`/api/contracts?clientId=${form.clientId}`).then(r => setContracts(r.data)).catch(() => setContracts([]));
  }, [form.clientId]);

  const totalAmount = form.rows.reduce((s, r) => s + (parseFloat(r.rowAmount) || 0), 0);

  const updateRow = (idx, updated) => { const rows = [...form.rows]; rows[idx] = updated; setForm(f => ({ ...f, rows })); };
  const removeRow = (idx) => { if (form.rows.length === 1) return; setForm(f => ({ ...f, rows: f.rows.filter((_, i) => i !== idx) })); };
  const addRow    = () => setForm(f => ({ ...f, rows: [...f.rows, { ...EMPTY_ROW }] }));

  const openModal = () => {
    setForm({ date: today(), nakladnoy: '', sellerName: '', transportNum: '', clientId: '', contractId: '', rows: [{ ...EMPTY_ROW }] });
    setModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.clientId)  { toast.error('Mijozni tanlang!'); return; }
    if (!form.contractId){ toast.error('Shartnomani tanlang!'); return; }
    if (form.rows.some(r => !r.productId || r.totalPieces <= 0)) { toast.error('Barcha qatorlarni to\'ldiring!'); return; }
    setSaving(true);
    try {
      await api.post('/api/sales', { ...form, products: form.rows });
      toast.success('Yuk xati saqlandi');
      setModal(false);
      fetchSales();
    } catch { /* interceptor shows toast */ } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/api/sales/${delId}`);
      setDelId(null);
      fetchSales();
      toast.success('O\'chirildi');
    } catch { /* interceptor shows toast */ }
  };

  const openDetail = async (s) => {
    try {
      const r = await api.get(`/api/sales/${s.id}`);
      setDetail(r.data);
    } catch { setDetail(s); }
  };

  const clearFilters = () => { setFilterClient(''); setDateFrom(''); setDateTo(''); setSearch(''); };
  const hasFilter = filterClient || dateFrom || dateTo || search;

  useModalKeys(modal,    handleSave, () => setModal(false));
  useModalKeys(!!detail, null,       () => setDetail(null));

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Hidden print area */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div ref={printRef}><PrintableInvoice sale={detail} company={settings} /></div>
      </div>

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">Savdolar (Yuk xatlari)</h2>
          <p className="text-sm text-zinc-500 mt-0.5">{total} ta yuk xati</p>
        </div>
        <button onClick={openModal} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition flex items-center gap-2 shadow-sm">
          <Plus size={16} /> Yangi Yuk Xati
        </button>
      </div>

      <div className="mini-card p-0">
        {/* Filters toolbar */}
        <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50/50 flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4"/>
            <input type="text" placeholder="Yuk xati №, mijoz..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-1.5 bg-white border border-zinc-200 rounded-md text-sm w-48 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"/>
          </div>
          <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
            className="px-3 py-1.5 border border-zinc-200 rounded-md text-sm bg-white focus:border-blue-500 outline-none">
            <option value="">Barcha mijozlar</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-1.5 border border-zinc-200 rounded-md text-sm bg-white focus:border-blue-500 outline-none" title="Dan"/>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-3 py-1.5 border border-zinc-200 rounded-md text-sm bg-white focus:border-blue-500 outline-none" title="Gacha"/>
          {hasFilter && (
            <button onClick={clearFilters} className="text-xs text-zinc-500 hover:text-zinc-700 flex items-center gap-1">
              <X size={12}/> Tozalash
            </button>
          )}
          <span className="ml-auto text-xs text-zinc-500">{total} natija</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Sana</th>
                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Yuk xati №</th>
                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Mijoz</th>
                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Sotuvchi</th>
                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Jami Summa</th>
                <th className="px-6 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>{[...Array(6)].map((_, j) => <td key={j} className="px-6 py-4"><div className="h-4 bg-zinc-100 animate-pulse rounded"/></td>)}</tr>
                ))
              ) : sales.length === 0 ? (
                <tr><td colSpan="6" className="px-6 py-12 text-center text-zinc-400 text-sm">
                  {hasFilter ? 'Topilmadi' : 'Hozircha yuk xatlari yo\'q'}
                </td></tr>
              ) : sales.map(s => (
                <tr key={s.id} className="hover:bg-zinc-50 transition-colors group">
                  <td className="px-6 py-4 text-sm text-zinc-600">{new Date(s.date).toLocaleDateString('ru-RU')}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-zinc-900 font-mono">{s.nakladnoy}</td>
                  <td className="px-6 py-4 text-sm text-zinc-700">{s.client?.name}</td>
                  <td className="px-6 py-4 text-sm text-zinc-500">{s.sellerName}</td>
                  <td className="px-6 py-4 text-sm text-right font-bold text-emerald-600">{fmt(s.totalAmount)} UZS</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openDetail(s)} className="p-1.5 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition" title="Ko'rish"><Eye size={14}/></button>
                      <button onClick={() => setDelId(s.id)} className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-md transition" title="O'chirish"><Trash2 size={14}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={total} limit={LIMIT} onPage={setPage} />
      </div>

      {/* New Sale Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl my-4">
            <div className="px-6 py-4 border-b border-zinc-200 flex justify-between items-center sticky top-0 bg-white rounded-t-xl z-10">
              <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-2"><FileText size={18} className="text-blue-600"/> Yangi Yuk Xati</h3>
              <button onClick={() => setModal(false)} className="text-zinc-400 hover:text-zinc-600 p-1 rounded-md hover:bg-zinc-100"><X size={20}/></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1 flex items-center gap-1.5"><User size={13}/> Mijoz *</label>
                  <select required value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value, contractId: '' }))}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="">— Mijozni tanlang —</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Shartnoma *</label>
                  <select required value={form.contractId} onChange={e => setForm(f => ({ ...f, contractId: e.target.value }))}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none" disabled={!form.clientId}>
                    <option value="">— Shartnomani tanlang —</option>
                    {contracts.map(c => <option key={c.id} value={c.id}>№{c.number} ({new Date(c.date).toLocaleDateString('ru-RU')})</option>)}
                  </select>
                  {form.clientId && contracts.length === 0 && <p className="text-xs text-amber-600 mt-1">Shartnoma topilmadi</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1 flex items-center gap-1.5"><Calendar size={13}/> Sana *</label>
                  <input type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1 flex items-center gap-1.5"><Hash size={13}/> Yuk xati № *</label>
                  <input required type="text" value={form.nakladnoy} onChange={e => setForm(f => ({ ...f, nakladnoy: e.target.value }))}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="НГ-1234"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Sotuvchi ismi *</label>
                  <input required type="text" value={form.sellerName} onChange={e => setForm(f => ({ ...f, sellerName: e.target.value }))}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="F.I.O."/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1 flex items-center gap-1.5"><Truck size={13}/> Transport raqami</label>
                  <input type="text" value={form.transportNum} onChange={e => setForm(f => ({ ...f, transportNum: e.target.value }))}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="01 A 123 BC"/>
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-3">
                  <p className="text-sm font-semibold text-zinc-700 flex items-center gap-2"><Package size={15} className="text-blue-600"/> Mahsulotlar</p>
                  <button type="button" onClick={addRow} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"><Plus size={13}/> Qator qo'shish</button>
                </div>
                <div className="border border-zinc-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-zinc-50 border-b border-zinc-200">
                      <tr>
                        <th className="p-2 text-left text-xs font-semibold text-zinc-500">Mahsulot</th>
                        <th className="p-2 text-left text-xs font-semibold text-zinc-500">Paket</th>
                        <th className="p-2 text-left text-xs font-semibold text-zinc-500">Dona</th>
                        <th className="p-2 text-left text-xs font-semibold text-zinc-500">m³</th>
                        <th className="p-2 text-left text-xs font-semibold text-zinc-500">kg</th>
                        <th className="p-2 text-left text-xs font-semibold text-zinc-500">Narx (1m³)</th>
                        <th className="p-2 text-right text-xs font-semibold text-zinc-500">Jami (UZS)</th>
                        <th className="p-2 w-8"/>
                      </tr>
                    </thead>
                    <tbody>
                      {form.rows.map((row, idx) => (
                        <ProductRow key={idx} idx={idx} row={row} products={products} onUpdate={updateRow} onRemove={removeRow}/>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex justify-end">
                <div className="bg-zinc-900 text-white rounded-lg px-6 py-4 min-w-64">
                  <p className="text-sm text-zinc-400 mb-1">Jami summa</p>
                  <p className="text-2xl font-bold">{fmt(totalAmount)} <span className="text-sm font-normal text-zinc-400">UZS</span></p>
                </div>
              </div>
              <div className="pt-4 border-t border-zinc-200 flex justify-end gap-3">
                <button type="button" onClick={() => setModal(false)} className="px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 rounded-md transition">Bekor</button>
                <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-md transition shadow-sm">
                  {saving ? 'Saqlanmoqda...' : 'Yuk xatini saqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-zinc-200 flex justify-between items-center sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-zinc-900">Yuk xati: {detail.nakladnoy}</h3>
              <div className="flex items-center gap-2">
                <button onClick={handlePrint} className="px-3 py-1.5 text-sm font-medium border border-zinc-200 rounded-md hover:bg-zinc-50 transition flex items-center gap-1.5">
                  <Printer size={14}/> Chop etish
                </button>
                <button onClick={() => setDetail(null)} className="text-zinc-400 hover:text-zinc-600 p-1 rounded-md hover:bg-zinc-100"><X size={20}/></button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-zinc-500">Mijoz:</span> <span className="font-medium">{detail.client?.name}</span></div>
                <div><span className="text-zinc-500">Sana:</span> <span className="font-medium">{new Date(detail.date).toLocaleDateString('ru-RU')}</span></div>
                <div><span className="text-zinc-500">Sotuvchi:</span> <span className="font-medium">{detail.sellerName}</span></div>
                <div><span className="text-zinc-500">Transport:</span> <span className="font-medium">{detail.transportNum || '—'}</span></div>
              </div>
              <div className="border border-zinc-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 border-b border-zinc-200">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-zinc-500">Mahsulot</th>
                      <th className="px-4 py-2 text-center font-semibold text-zinc-500">Dona</th>
                      <th className="px-4 py-2 text-center font-semibold text-zinc-500">m³</th>
                      <th className="px-4 py-2 text-right font-semibold text-zinc-500">Summa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {detail.products?.map((p, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2 text-zinc-700 font-mono text-xs font-semibold">
                          {p.product?.article || p.productId?.slice(0, 8)}
                        </td>
                        <td className="px-4 py-2 text-center">{p.totalPieces}</td>
                        <td className="px-4 py-2 text-center">{p.totalCbm?.toFixed(4)}</td>
                        <td className="px-4 py-2 text-right font-semibold text-zinc-900">{fmt(p.rowAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end">
                <p className="text-lg font-bold text-zinc-900">Jami: {fmt(detail.totalAmount)} UZS</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {delId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={22} className="text-red-600"/></div>
            <h3 className="text-lg font-bold text-zinc-900 mb-2">Yuk xatini o'chirish</h3>
            <p className="text-sm text-zinc-500 mb-6">Bu yuk xati va uning barcha mahsulotlari o'chiriladi.</p>
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
