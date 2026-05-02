import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useModalKeys } from '../hooks/useModalKeys';
import { Plus, X, Trash2, Edit2, RefreshCw, Calculator } from 'lucide-react';

const API = 'http://localhost:3001';
const fmtN = n => (!n && n !== 0) ? '—' : Math.round(n).toLocaleString('ru-RU');
const fmtD = (n, d = 6) => (!n && n !== 0) ? '—' : parseFloat(n).toFixed(d).replace(/\.?0+$/, '');

// Auto-artikul generatsiya
const makeArticle = (density, length, width, thickness) => {
  if (!density || !length || !width || !thickness) return '';
  return `${density}' ${length}x${width}x${thickness}`;
};

// Birliklarni hisoblash
const calcUnits = (length, width, thickness, density) => {
  const l = parseFloat(length) || 0, w = parseFloat(width) || 0;
  const t = parseFloat(thickness) || 0, d = parseFloat(density) || 0;
  const sqm = (l * w) / 1_000_000;
  const cbm = (l * w * t) / 1_000_000_000;
  const kg = cbm * d;
  return { sqmPerPce: sqm, cbmPerPce: cbm, kgPerPce: kg };
};

// Narxlarni hisoblash (bir mahsulot uchun)
const calcPrices = (mode, value, product) => {
  const val = parseFloat(value) || 0;
  const density = parseFloat(product.density) || 1;
  const thickness = parseFloat(product.thickness) || 1;
  let priceCbm = 0, priceTon = 0, priceSqm = 0;
  if (mode === 'cbm') {
    priceCbm = val;
    priceTon = val * 1000 / density;
    priceSqm = val * thickness / 1000;
  } else if (mode === 'ton') {
    priceTon = val;
    priceCbm = val * density / 1000;
    priceSqm = priceCbm * thickness / 1000;
  } else if (mode === 'sqm') {
    priceSqm = val;
    priceCbm = val * 1000 / thickness;
    priceTon = priceCbm * 1000 / density;
  }
  return { priceCbm, priceTon, priceSqm };
};

const EMPTY_FORM = { density: '', length: '', width: '', thickness: '' };

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(null); // null | 'add' | 'edit'
  const [editId, setEditId]     = useState(null);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [delId, setDelId]       = useState(null);
  const [applying, setApplying] = useState(false);

  // Global narx paneli
  const [priceMode, setPriceMode]   = useState('cbm'); // 'ton' | 'cbm' | 'sqm'
  const [priceValue, setPriceValue] = useState('');

  // Forma uchun computed values
  const units = calcUnits(form.length, form.width, form.thickness, form.density);
  const article = makeArticle(form.density, form.length, form.width, form.thickness);

  const fetchProducts = useCallback(() => {
    setLoading(true);
    axios.get(`${API}/api/products`)
      .then(r => { setProducts(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Narx paneli preview (birinchi mahsulot uchun)
  const previewPrices = products.length > 0 && priceValue
    ? calcPrices(priceMode, priceValue, products[0])
    : null;

  // Barcha mahsulotlarga narx qo'llash
  const applyPrices = async () => {
    if (!priceValue || products.length === 0) return;
    setApplying(true);
    try {
      const updates = products.map(p => ({
        id: p.id,
        ...calcPrices(priceMode, priceValue, p),
      }));
      const updated = await axios.put(`${API}/api/products/bulk-price`, { updates });
      setProducts(updated.data);
    } catch (err) {
      alert('Xatolik: ' + (err.response?.data?.error || err.message));
    } finally {
      setApplying(false);
    }
  };

  const openAdd = () => { setForm(EMPTY_FORM); setEditId(null); setModal('add'); };
  const openEdit = p => {
    setForm({ density: String(p.density), length: String(p.length), width: String(p.width), thickness: String(p.thickness) });
    setEditId(p.id);
    setModal('edit');
  };
  const closeModal = () => { setModal(null); setEditId(null); };

  const handleSave = async e => {
    e.preventDefault();
    if (!article) return alert('O\'lchamlarni to\'liq kiriting!');
    setSaving(true);
    const payload = {
      article,
      density: parseFloat(form.density),
      length: parseFloat(form.length),
      width: parseFloat(form.width),
      thickness: parseFloat(form.thickness),
      ...units,
      priceCbm: editId ? (products.find(p => p.id === editId)?.priceCbm || 0) : 0,
      priceTon: editId ? (products.find(p => p.id === editId)?.priceTon || 0) : 0,
      priceSqm: editId ? (products.find(p => p.id === editId)?.priceSqm || 0) : 0,
    };
    try {
      if (modal === 'add') await axios.post(`${API}/api/products`, payload);
      else await axios.put(`${API}/api/products/${editId}`, payload);
      fetchProducts();
      closeModal();
    } catch (err) {
      alert('Xatolik: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API}/api/products/${delId}`);
      setDelId(null);
      fetchProducts();
    } catch { alert('O\'chirib bo\'lmadi'); }
  };

  useModalKeys(!!modal, handleSave, closeModal);

  const inp = 'w-full px-3 py-2 border border-zinc-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none transition';
  const modeBtn = (m, label) => (
    <button type="button" onClick={() => setPriceMode(m)}
      className={`px-4 py-2 text-sm font-medium rounded-md transition ${priceMode === m ? 'bg-zinc-900 text-white' : 'bg-white border border-zinc-300 text-zinc-600 hover:bg-zinc-50'}`}>
      {label}
    </button>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">Mahsulotlar bazasi</h2>
          <p className="text-sm text-zinc-500 mt-0.5">{products.length} ta mahsulot · Kalkulyator va spetsifikatsiya</p>
        </div>
        <button onClick={openAdd} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition flex items-center gap-2 shadow-sm">
          <Plus size={16}/> Yangi Mahsulot
        </button>
      </div>

      {/* Global Narx Paneli */}
      <div className="mini-card border-blue-200 bg-blue-50/30">
        <div className="flex items-start gap-6 flex-wrap">
          <div className="flex items-center gap-1.5 shrink-0">
            <Calculator size={15} className="text-blue-600"/>
            <span className="text-sm font-semibold text-zinc-800">Global narx</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {modeBtn('ton', '1 tonna')}
            {modeBtn('cbm', '1 m³')}
            {modeBtn('sqm', '1 m²')}
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-48">
            <input
              type="number" min="0" value={priceValue}
              onChange={e => setPriceValue(e.target.value)}
              placeholder="Narxni kiriting (UZS)"
              className="flex-1 px-3 py-2 border border-zinc-300 bg-white rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <span className="text-sm text-zinc-500 shrink-0">UZS</span>
          </div>
          <button
            onClick={applyPrices}
            disabled={applying || !priceValue || products.length === 0}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-md text-sm font-medium transition flex items-center gap-2 shrink-0"
          >
            <RefreshCw size={14} className={applying ? 'animate-spin' : ''}/>
            {applying ? 'Yangilanmoqda...' : `Barcha ${products.length} ta mahsulotga qo'llash`}
          </button>
        </div>

        {/* Preview */}
        {previewPrices && (
          <div className="mt-3 pt-3 border-t border-blue-200 flex gap-6 text-xs text-zinc-600">
            <span className="text-zinc-400">Birinchi mahsulot uchun preview:</span>
            <span>1 tonna → <strong className="text-zinc-800">{fmtN(previewPrices.priceTon)} UZS</strong></span>
            <span>1 m³ → <strong className="text-zinc-800">{fmtN(previewPrices.priceCbm)} UZS</strong></span>
            <span>1 m² → <strong className="text-zinc-800">{fmtN(previewPrices.priceSqm)} UZS</strong></span>
            <span className="text-zinc-400 italic">*Har mahsulot zichlik va qalinligiga qarab farq qiladi</span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="mini-card p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Artikul</th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">O'lcham (mm)</th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right whitespace-nowrap">Zichlik</th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right whitespace-nowrap">1 dona m²</th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right whitespace-nowrap">1 dona m³</th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right whitespace-nowrap">1 dona kg</th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right whitespace-nowrap bg-amber-50">UZS / tonna</th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right whitespace-nowrap bg-emerald-50">UZS / m³</th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right whitespace-nowrap bg-blue-50">UZS / m²</th>
                <th className="px-4 py-3 w-16"/>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>{[...Array(10)].map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-zinc-100 animate-pulse rounded"/></td>
                  ))}</tr>
                ))
              ) : products.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-zinc-400">Hozircha mahsulotlar yo'q</td></tr>
              ) : products.map(p => (
                <tr key={p.id} className="hover:bg-zinc-50 transition-colors group">
                  <td className="px-4 py-3 font-semibold text-zinc-900 font-mono text-xs">{p.article}</td>
                  <td className="px-4 py-3 text-zinc-600">{p.length}×{p.width}×{p.thickness}</td>
                  <td className="px-4 py-3 text-right text-zinc-600">{p.density} kg/m³</td>
                  <td className="px-4 py-3 text-right font-medium text-zinc-700">{fmtD(p.sqmPerPce, 4)}</td>
                  <td className="px-4 py-3 text-right font-medium text-zinc-700">{fmtD(p.cbmPerPce, 6)}</td>
                  <td className="px-4 py-3 text-right font-medium text-zinc-700">{fmtD(p.kgPerPce, 3)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-amber-700 bg-amber-50/50">{p.priceTon > 0 ? fmtN(p.priceTon) : <span className="text-zinc-300 font-normal">—</span>}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700 bg-emerald-50/50">{p.priceCbm > 0 ? fmtN(p.priceCbm) : <span className="text-zinc-300 font-normal">—</span>}</td>
                  <td className="px-4 py-3 text-right font-semibold text-blue-700 bg-blue-50/50">{p.priceSqm > 0 ? fmtN(p.priceSqm) : <span className="text-zinc-300 font-normal">—</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(p)} className="p-1.5 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition" title="Tahrirlash"><Edit2 size={13}/></button>
                      <button onClick={() => setDelId(p.id)} className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-md transition" title="O'chirish"><Trash2 size={13}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-zinc-900">{modal === 'add' ? 'Yangi Mahsulot' : 'Mahsulotni tahrirlash'}</h3>
              <button onClick={closeModal} className="text-zinc-400 hover:text-zinc-600 p-1 rounded hover:bg-zinc-100"><X size={20}/></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-5">
              {/* Artikul preview */}
              <div className="bg-zinc-900 rounded-lg px-4 py-3 flex items-center justify-between">
                <span className="text-xs text-zinc-500 uppercase tracking-wider">Artikul (auto)</span>
                <span className="text-white font-mono font-bold text-lg">{article || '—'}</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Zichlik (kg/m³) *</label>
                  <input required type="number" step="0.01" min="1" value={form.density}
                    onChange={e => setForm(f => ({...f, density: e.target.value}))} className={inp} placeholder="80"/>
                </div>
                <div className="flex items-end">
                  <p className="text-xs text-zinc-400 pb-2.5">Zichlik artikulning boshi bo'ladi</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">O'lchamlar (mm) *</label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <input required type="number" min="1" value={form.length}
                      onChange={e => setForm(f => ({...f, length: e.target.value}))} className={inp} placeholder="Uzunlik"/>
                    <p className="text-xs text-zinc-400 mt-1 text-center">Uzunlik</p>
                  </div>
                  <div>
                    <input required type="number" min="1" value={form.width}
                      onChange={e => setForm(f => ({...f, width: e.target.value}))} className={inp} placeholder="Eni"/>
                    <p className="text-xs text-zinc-400 mt-1 text-center">Eni</p>
                  </div>
                  <div>
                    <input required type="number" min="1" value={form.thickness}
                      onChange={e => setForm(f => ({...f, thickness: e.target.value}))} className={inp} placeholder="Qalinlik"/>
                    <p className="text-xs text-zinc-400 mt-1 text-center">Qalinlik</p>
                  </div>
                </div>
              </div>

              {/* Auto-hisoblangan qiymatlar */}
              {article && (
                <div className="grid grid-cols-3 gap-3 bg-zinc-50 border border-zinc-200 rounded-lg p-4">
                  <div className="text-center">
                    <p className="text-xs text-zinc-500 mb-1">1 dona m²</p>
                    <p className="text-sm font-bold text-zinc-900">{fmtD(units.sqmPerPce, 4)}</p>
                  </div>
                  <div className="text-center border-x border-zinc-200">
                    <p className="text-xs text-zinc-500 mb-1">1 dona m³</p>
                    <p className="text-sm font-bold text-zinc-900">{fmtD(units.cbmPerPce, 6)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-zinc-500 mb-1">1 dona kg</p>
                    <p className="text-sm font-bold text-zinc-900">{fmtD(units.kgPerPce, 3)}</p>
                  </div>
                </div>
              )}

              <p className="text-xs text-zinc-400 flex items-center gap-1.5">
                <Calculator size={12}/> Narxlar global narx panelidan boshqariladi — bu yerda kiritilmaydi
              </p>

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

      {/* Delete Confirm */}
      {delId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={22} className="text-red-600"/></div>
            <h3 className="text-lg font-bold text-zinc-900 mb-2">Mahsulotni o'chirish</h3>
            <p className="text-sm text-zinc-500 mb-6">Bu mahsulot bazadan o'chiriladi.</p>
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
