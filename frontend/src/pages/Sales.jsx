import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useModalKeys } from '../hooks/useModalKeys';
import {
  Plus, X, Trash2, ChevronDown, Package, Eye,
  FileText, Truck, User, Calendar, Hash
} from 'lucide-react';

const API = 'http://localhost:3001';

function fmt(n) {
  if (!n && n !== 0) return '0';
  return Math.round(n).toLocaleString('ru-RU');
}

function today() {
  return new Date().toISOString().split('T')[0];
}

const PACK_TYPES = { 1: '1 dona', 2: '2 dona', 4: '4 dona', 8: '8 dona', 16: '16 dona' };

// Alohida mahsulot qatori komponenti
function ProductRow({ row, products, onUpdate, onRemove, idx }) {
  const selected = products.find(p => p.id === row.productId);

  const handleProductChange = (productId) => {
    const p = products.find(x => x.id === productId);
    if (!p) return;
    onUpdate(idx, {
      ...row,
      productId,
      priceCbm: p.priceCbm,
      packType: 1,
      totalPieces: 0,
      totalCbm: 0,
      totalKg: 0,
      totalSqm: 0,
      rowAmount: 0,
    });
  };

  const handleChange = (field, val) => {
    const updated = { ...row, [field]: val };

    if (field === 'totalPieces' || field === 'packType') {
      const pieces = parseInt(field === 'totalPieces' ? val : row.totalPieces) || 0;
      const packType = parseInt(field === 'packType' ? val : row.packType) || 1;
      const p = products.find(x => x.id === row.productId);
      if (p) {
        updated.totalCbm = +(pieces * p.cbmPerPce).toFixed(6);
        updated.totalKg  = +(pieces * p.kgPerPce).toFixed(3);
        updated.totalSqm = +(pieces * p.sqmPerPce).toFixed(4);
        updated.rowAmount = +(updated.totalCbm * updated.priceCbm).toFixed(0);
      }
    }

    if (field === 'priceCbm') {
      updated.rowAmount = +(row.totalCbm * (parseFloat(val) || 0)).toFixed(0);
    }

    onUpdate(idx, updated);
  };

  const selCls = 'w-full px-2.5 py-1.5 border border-zinc-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white';

  return (
    <tr className="border-b border-zinc-100 hover:bg-zinc-50/50">
      {/* Mahsulot */}
      <td className="p-2">
        <select value={row.productId} onChange={e => handleProductChange(e.target.value)} className={selCls} required>
          <option value="">— Tanlang —</option>
          {products.map(p => (
            <option key={p.id} value={p.id}>{p.article}</option>
          ))}
        </select>
      </td>
      {/* Paket turi */}
      <td className="p-2 w-28">
        <select value={row.packType} onChange={e => handleChange('packType', e.target.value)} className={selCls}>
          {Object.entries(PACK_TYPES).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </td>
      {/* Dona soni */}
      <td className="p-2 w-24">
        <input
          type="number" min="0" value={row.totalPieces}
          onChange={e => handleChange('totalPieces', e.target.value)}
          className={selCls} required
        />
      </td>
      {/* m³ */}
      <td className="p-2 w-24">
        <input readOnly value={row.totalCbm.toFixed(4)} className={`${selCls} bg-zinc-50 text-zinc-500`} />
      </td>
      {/* kg */}
      <td className="p-2 w-24">
        <input readOnly value={row.totalKg.toFixed(2)} className={`${selCls} bg-zinc-50 text-zinc-500`} />
      </td>
      {/* Narx (1m³) */}
      <td className="p-2 w-32">
        <input
          type="number" min="0" value={row.priceCbm}
          onChange={e => handleChange('priceCbm', e.target.value)}
          className={selCls}
        />
      </td>
      {/* Jami */}
      <td className="p-2 w-36 text-right">
        <span className="text-sm font-semibold text-zinc-900 pr-2">{fmt(row.rowAmount)}</span>
      </td>
      {/* O'chirish */}
      <td className="p-2 w-10">
        <button type="button" onClick={() => onRemove(idx)} className="p-1 text-zinc-300 hover:text-red-500 transition">
          <X size={15} />
        </button>
      </td>
    </tr>
  );
}

export default function Sales() {
  const [sales,    setSales]    = useState([]);
  const [clients,  setClients]  = useState([]);
  const [contracts,setContracts]= useState([]);
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(false);
  const [detail,   setDetail]   = useState(null);
  const [delId,    setDelId]    = useState(null);
  const [saving,   setSaving]   = useState(false);

  const EMPTY_ROW = { productId: '', packType: 1, totalPieces: 0, totalCbm: 0, totalKg: 0, totalSqm: 0, priceCbm: 0, rowAmount: 0 };

  const [form, setForm] = useState({
    date: today(), nakladnoy: '', sellerName: '', transportNum: '',
    clientId: '', contractId: '',
    rows: [{ ...EMPTY_ROW }],
  });

  const fetchAll = useCallback(() => {
    setLoading(true);
    Promise.all([
      axios.get(`${API}/api/sales`),
      axios.get(`${API}/api/clients`),
      axios.get(`${API}/api/products`),
    ]).then(([s, c, p]) => {
      setSales(s.data);
      setClients(c.data);
      setProducts(p.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);


  // Mijoz o'zgarganda shartnomalarini yuklash
  useEffect(() => {
    if (!form.clientId) { setContracts([]); return; }
    axios.get(`${API}/api/contracts?clientId=${form.clientId}`)
      .then(r => setContracts(r.data))
      .catch(() => setContracts([]));
  }, [form.clientId]);

  const totalAmount = form.rows.reduce((s, r) => s + (parseFloat(r.rowAmount) || 0), 0);

  const updateRow = (idx, updated) => {
    const rows = [...form.rows];
    rows[idx] = updated;
    setForm(f => ({ ...f, rows }));
  };

  const removeRow = (idx) => {
    if (form.rows.length === 1) return;
    setForm(f => ({ ...f, rows: f.rows.filter((_, i) => i !== idx) }));
  };

  const addRow = () => setForm(f => ({ ...f, rows: [...f.rows, { ...EMPTY_ROW }] }));

  const openModal = () => {
    setForm({ date: today(), nakladnoy: '', sellerName: '', transportNum: '', clientId: '', contractId: '', rows: [{ ...EMPTY_ROW }] });
    setModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.clientId) return alert('Mijozni tanlang!');
    if (!form.contractId) return alert('Shartnomani tanlang!');
    if (form.rows.some(r => !r.productId || r.totalPieces <= 0)) return alert('Barcha qatorlarni to\'ldiring!');

    setSaving(true);
    try {
      await axios.post(`${API}/api/sales`, {
        ...form,
        products: form.rows,
      });
      setModal(false);
      fetchAll();
    } catch (err) {
      alert('Xatolik: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API}/api/sales/${delId}`);
      setDelId(null);
      fetchAll();
    } catch (err) {
      alert('O\'chirib bo\'lmadi');
    }
  };

  // Ctrl+Enter → saqlash, Esc → yopish
  useModalKeys(modal, handleSave, () => setModal(false));
  useModalKeys(!!detail, null, () => setDetail(null));

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">Savdolar (Yuk xatlari)</h2>
          <p className="text-sm text-zinc-500 mt-0.5">{sales.length} ta yuk xati</p>
        </div>
        <button
          onClick={openModal}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition flex items-center gap-2 shadow-sm"
        >
          <Plus size={16} /> Yangi Yuk Xati
        </button>
      </div>

      {/* Table */}
      <div className="mini-card p-0">
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
                  <tr key={i}>
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-6 py-4"><div className="h-4 bg-zinc-100 animate-pulse rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-zinc-400 text-sm">Hozircha yuk xatlari yo'q</td>
                </tr>
              ) : (
                sales.map(s => (
                  <tr key={s.id} className="hover:bg-zinc-50 transition-colors group">
                    <td className="px-6 py-4 text-sm text-zinc-600">{new Date(s.date).toLocaleDateString('ru-RU')}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-zinc-900 font-mono">{s.nakladnoy}</td>
                    <td className="px-6 py-4 text-sm text-zinc-700">{s.client?.name}</td>
                    <td className="px-6 py-4 text-sm text-zinc-500">{s.sellerName}</td>
                    <td className="px-6 py-4 text-sm text-right font-bold text-emerald-600">{fmt(s.totalAmount)} UZS</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setDetail(s)}
                          className="p-1.5 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition"
                          title="Ko'rish"
                        ><Eye size={14} /></button>
                        <button
                          onClick={() => setDelId(s.id)}
                          className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"
                          title="O'chirish"
                        ><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Sale Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl my-4">
            {/* Modal header */}
            <div className="px-6 py-4 border-b border-zinc-200 flex justify-between items-center sticky top-0 bg-white rounded-t-xl z-10">
              <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                <FileText size={18} className="text-blue-600" /> Yangi Yuk Xati
              </h3>
              <button onClick={() => setModal(false)} className="text-zinc-400 hover:text-zinc-600 p-1 rounded-md hover:bg-zinc-100">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-6">
              {/* Asosiy maydonlar */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1 flex items-center gap-1.5">
                    <User size={13} /> Mijoz *
                  </label>
                  <select
                    required value={form.clientId}
                    onChange={e => setForm(f => ({ ...f, clientId: e.target.value, contractId: '' }))}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">— Mijozni tanlang —</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Shartnoma *</label>
                  <select
                    required value={form.contractId}
                    onChange={e => setForm(f => ({ ...f, contractId: e.target.value }))}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    disabled={!form.clientId}
                  >
                    <option value="">— Shartnomani tanlang —</option>
                    {contracts.map(c => (
                      <option key={c.id} value={c.id}>
                        №{c.number} ({new Date(c.date).toLocaleDateString('ru-RU')})
                      </option>
                    ))}
                  </select>
                  {form.clientId && contracts.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">Bu mijoz uchun shartnoma topilmadi</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1 flex items-center gap-1.5">
                    <Calendar size={13} /> Sana *
                  </label>
                  <input
                    type="date" required value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1 flex items-center gap-1.5">
                    <Hash size={13} /> Yuk xati № *
                  </label>
                  <input
                    required type="text" value={form.nakladnoy}
                    onChange={e => setForm(f => ({ ...f, nakladnoy: e.target.value }))}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Masalan: НГ-1234"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Sotuvchi ismi *</label>
                  <input
                    required type="text" value={form.sellerName}
                    onChange={e => setForm(f => ({ ...f, sellerName: e.target.value }))}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="F.I.O."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1 flex items-center gap-1.5">
                    <Truck size={13} /> Transport raqami
                  </label>
                  <input
                    type="text" value={form.transportNum}
                    onChange={e => setForm(f => ({ ...f, transportNum: e.target.value }))}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="01 A 123 BC"
                  />
                </div>
              </div>

              {/* Mahsulotlar jadvali */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <p className="text-sm font-semibold text-zinc-700 flex items-center gap-2">
                    <Package size={15} className="text-blue-600" /> Mahsulotlar
                  </p>
                  <button type="button" onClick={addRow} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                    <Plus size={13} /> Qator qo'shish
                  </button>
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
                        <th className="p-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.rows.map((row, idx) => (
                        <ProductRow
                          key={idx}
                          idx={idx}
                          row={row}
                          products={products}
                          onUpdate={updateRow}
                          onRemove={removeRow}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Jami */}
              <div className="flex justify-end">
                <div className="bg-zinc-900 text-white rounded-lg px-6 py-4 min-w-64">
                  <p className="text-sm text-zinc-400 mb-1">Jami summa</p>
                  <p className="text-2xl font-bold">{fmt(totalAmount)} <span className="text-sm font-normal text-zinc-400">UZS</span></p>
                </div>
              </div>

              {/* Buttons */}
              <div className="pt-4 border-t border-zinc-200 flex justify-end gap-3">
                <button type="button" onClick={() => setModal(false)} className="px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 rounded-md transition">
                  Bekor qilish
                </button>
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
              <button onClick={() => setDetail(null)} className="text-zinc-400 hover:text-zinc-600 p-1 rounded-md hover:bg-zinc-100">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-zinc-500">Mijoz:</span> <span className="font-medium">{detail.client?.name}</span></div>
                <div><span className="text-zinc-500">Sana:</span> <span className="font-medium">{new Date(detail.date).toLocaleDateString('ru-RU')}</span></div>
                <div><span className="text-zinc-500">Sotuvchi:</span> <span className="font-medium">{detail.sellerName}</span></div>
                <div><span className="text-zinc-500">Transport:</span> <span className="font-medium">{detail.transportNum || '—'}</span></div>
              </div>
              <div className="border border-zinc-200 rounded-lg overflow-hidden mt-4">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 border-b border-zinc-200">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-zinc-500">Mahsulot ID</th>
                      <th className="px-4 py-2 text-center font-semibold text-zinc-500">Dona</th>
                      <th className="px-4 py-2 text-center font-semibold text-zinc-500">m³</th>
                      <th className="px-4 py-2 text-right font-semibold text-zinc-500">Summa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {detail.products?.map((p, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2 text-zinc-600 font-mono text-xs">{p.productId.slice(0, 8)}...</td>
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
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-600" />
            </div>
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
