import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useModalKeys } from '../hooks/useModalKeys';
import { useSearchOnEnter } from '../hooks/useSearchOnEnter';
import Pagination from '../components/Pagination';
import { Plus, X, Trash2, Edit2, RefreshCw, Calculator, Search, Copy } from 'lucide-react';
import { fmtOrDash as fmtN } from '../lib/format';

const fmtD = (n, d = 6) => (!n && n !== 0) ? '—' : parseFloat(n).toFixed(d).replace(/\.?0+$/, '');

const makeArticle = (density, length, width, thickness) => {
  if (!density || !length || !width || !thickness) return '';
  return `${density}' ${length}x${width}x${thickness}`;
};

const calcUnits = (length, width, thickness, density) => {
  const l = parseFloat(length) || 0, w = parseFloat(width) || 0;
  const t = parseFloat(thickness) || 0, d = parseFloat(density) || 0;
  const sqm = (l * w) / 1_000_000;
  const cbm = (l * w * t) / 1_000_000_000;
  const kg  = cbm * d;
  return { sqmPerPce: sqm, cbmPerPce: cbm, kgPerPce: kg };
};

const calcPrices = (mode, value, product) => {
  const val      = parseFloat(value) || 0;
  const density  = parseFloat(product.density)   || 1;
  const thickness= parseFloat(product.thickness) || 1;
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

const DEFAULT_NAME = 'Базальтовая вата';
const EMPTY_FORM = { name: DEFAULT_NAME, density: '', length: '', width: '', thickness: '' };

export default function Products({ user }) {
  const { t } = useTranslation();
  const canCreate = user?.role === 'admin' || user?.permissions?.products?.create !== false;
  const canUpdate = user?.role === 'admin' || user?.permissions?.products?.update !== false;
  const canDelete = user?.role === 'admin' || user?.permissions?.products?.delete === true;

  const [products,  setProducts]  = useState([]);
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);
  const LIMIT = 50;

  const [loading,   setLoading]   = useState(true);
  const { text: search, query: debouncedSearch, inputProps: searchInput } = useSearchOnEnter('', () => setPage(1));
  const [modal,     setModal]     = useState(null);
  const [editId,    setEditId]    = useState(null);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);
  const [delId,     setDelId]     = useState(null);
  const [applying,  setApplying]  = useState(false);

  const [priceMode,  setPriceMode]  = useState('cbm');
  const [priceValue, setPriceValue] = useState('');

  const units   = calcUnits(form.length, form.width, form.thickness, form.density);
  const article = makeArticle(form.density, form.length, form.width, form.thickness);

  const fetchProducts = useCallback(() => {
    setLoading(true);
    api.get('/api/products', { params: { page, limit: LIMIT, search: debouncedSearch } })
      .then(r => { setProducts(r.data.data); setTotal(r.data.total); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page, debouncedSearch]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const previewPrices = products.length > 0 && priceValue
    ? calcPrices(priceMode, priceValue, products[0])
    : null;

  const applyPrices = async () => {
    if (!priceValue || products.length === 0) return;
    setApplying(true);
    try {
      const updates = products.map(p => ({
        id: p.id,
        ...calcPrices(priceMode, priceValue, p),
      }));
      await api.put('/api/products/bulk-price', { updates });
      toast.success(t('products.pricesUpdated'));
      fetchProducts();
    } catch { /* interceptor shows toast */ } finally {
      setApplying(false);
    }
  };

  const openAdd = () => { setForm(EMPTY_FORM); setEditId(null); setModal('add'); };
  const openEdit = p => {
    setForm({ name: p.name ?? DEFAULT_NAME, density: String(p.density), length: String(p.length), width: String(p.width), thickness: String(p.thickness) });
    setEditId(p.id);
    setModal('edit');
  };
  const handleCopy = p => {
    setForm({ name: p.name ?? DEFAULT_NAME, density: String(p.density), length: String(p.length), width: String(p.width), thickness: String(p.thickness) });
    setEditId(null);
    setModal('add');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const closeModal = () => { setModal(null); setEditId(null); };

  const handleSave = async e => {
    e.preventDefault();
    if (!article) { toast.error(t('products.fillDimensions')); return; }
    setSaving(true);
    const payload = {
      article,
      name:      form.name,
      density:   parseFloat(form.density),
      length:    parseFloat(form.length),
      width:     parseFloat(form.width),
      thickness: parseFloat(form.thickness),
      ...units,
      priceCbm: editId ? (products.find(p => p.id === editId)?.priceCbm || 0) : 0,
      priceTon: editId ? (products.find(p => p.id === editId)?.priceTon || 0) : 0,
      priceSqm: editId ? (products.find(p => p.id === editId)?.priceSqm || 0) : 0,
    };
    try {
      if (modal === 'add') await api.post('/api/products', payload);
      else await api.put(`/api/products/${editId}`, payload);
      toast.success(modal === 'add' ? t('products.added') : t('products.savedUpdated'));
      fetchProducts();
      closeModal();
    } catch { /* interceptor shows toast */ } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/api/products/${delId}`);
      setDelId(null);
      fetchProducts();
      toast.success(t('common.deleted'));
    } catch { /* interceptor shows toast */ }
  };

  useModalKeys(!!modal, handleSave, closeModal);

  const inp = 'w-full px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] outline-none transition text-[var(--text)]';
  const modeBtn = (m, label) => (
    <button type="button" onClick={() => setPriceMode(m)}
      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${priceMode === m ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'}`}>
      {label}
    </button>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">{t('products.dbTitle')}</h2>
            <p className="text-xs text-[var(--text-3)] mt-0.5">{t('products.countSubtitle', { count: total })}</p>
          </div>
          {canCreate && (
            <button onClick={openAdd} className="px-3 py-1.5 btn-primary rounded-lg text-xs font-medium transition flex items-center gap-2 shadow-sm">
              <Plus size={16} strokeWidth={2.2}/> {t('products.newProduct')}
            </button>
          )}
        </div>
      </div>

      {/* Inline Accordion Form for adding Product */}
      {modal === 'add' && (
        <div className="mini-card p-6 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex justify-between items-center border-b border-[var(--border)] pb-3">
            <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
              <Plus size={18} strokeWidth={2.2} className="text-[var(--accent)]"/>
              {t('products.addProduct')}
            </h3>
            <button onClick={closeModal} className="text-[var(--text-3)] hover:text-[var(--text)] p-1 rounded-md hover:bg-[var(--surface-2)]">
              <X size={18} strokeWidth={2.2}/>
            </button>
          </div>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-[var(--text-3)] uppercase tracking-wider">{t('products.articleAuto')}</span>
              <span className="text-[var(--text)] font-mono font-bold text-lg">{article || '—'}</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-2)] mb-1">{t('products.nameLabel')}</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} placeholder="Базальтовая вата" />
              <p className="text-[10px] text-[var(--text-3)] mt-1">{t('products.printPreview', { name: form.name || '—', density: form.density || '…', length: form.length || '…', width: form.width || '…', thickness: form.thickness || '…' })}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-2)] mb-1">{t('products.densityLabel')}</label>
                <input required type="number" step="0.01" min="1" value={form.density}
                  onChange={e => setForm(f => ({...f, density: e.target.value}))} className={inp} placeholder="80"/>
              </div>
              <div className="flex items-end">
                <p className="text-xs text-[var(--text-3)] pb-2">{t('products.densityHint')}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-2)] mb-1">{t('products.dimensionsLabel')}</label>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <input required type="number" min="1" value={form.length}
                    onChange={e => setForm(f => ({...f, length: e.target.value}))} className={inp} placeholder={t('products.length')}/>
                  <p className="text-[10px] text-[var(--text-3)] mt-1 text-center">{t('products.length')}</p>
                </div>
                <div>
                  <input required type="number" min="1" value={form.width}
                    onChange={e => setForm(f => ({...f, width: e.target.value}))} className={inp} placeholder={t('products.width')}/>
                  <p className="text-[10px] text-[var(--text-3)] mt-1 text-center">{t('products.width')}</p>
                </div>
                <div>
                  <input required type="number" min="1" value={form.thickness}
                    onChange={e => setForm(f => ({...f, thickness: e.target.value}))} className={inp} placeholder={t('products.thickness')}/>
                  <p className="text-[10px] text-[var(--text-3)] mt-1 text-center">{t('products.thickness')}</p>
                </div>
              </div>
            </div>

            {article && (
              <div className="grid grid-cols-3 gap-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-3">
                <div className="text-center">
                  <p className="text-[10px] text-[var(--text-3)] mb-1">{t('products.perPceSqm')}</p>
                  <p className="text-xs font-bold text-[var(--text)] font-mono">{fmtD(units.sqmPerPce, 4)}</p>
                </div>
                <div className="text-center border-x border-[var(--border)]">
                  <p className="text-[10px] text-[var(--text-3)] mb-1">{t('products.perPceCbm')}</p>
                  <p className="text-xs font-bold text-[var(--text)] font-mono">{fmtD(units.cbmPerPce, 6)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-[var(--text-3)] mb-1">{t('products.perPceKg')}</p>
                  <p className="text-xs font-bold text-[var(--text)] font-mono">{fmtD(units.kgPerPce, 3)}</p>
                </div>
              </div>
            )}

            <p className="text-[10px] text-[var(--text-3)] flex items-center gap-1.5 justify-center">
              <Calculator size={13} strokeWidth={2}/> {t('products.priceManagedHint')}
            </p>

            <div className="pt-3 border-t border-[var(--border)] flex justify-end gap-2">
              <button type="button" onClick={closeModal} className="px-3 py-1.5 text-xs font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] rounded-lg border border-[var(--border)] transition">{t('common.cancel')}</button>
              <button type="submit" disabled={saving} className="px-4 py-1.5 bg-[var(--accent)] hover:opacity-90 disabled:opacity-60 text-[var(--accent-text)] text-xs font-medium rounded-lg transition shadow-sm">
                {saving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Global Narx Paneli */}
      {canUpdate && (
        <div className="mini-card border-[oklch(0.88_0.05_250)] bg-[oklch(0.96_0.03_250)]/30">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-1.5 shrink-0">
              <Calculator size={18} strokeWidth={2.2} className="text-[var(--accent)]"/>
              <span className="text-xs font-semibold text-[var(--text)]">{t('products.globalPrice')}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {modeBtn('ton', t('products.perTonna'))}
              {modeBtn('cbm', t('products.perCbm'))}
              {modeBtn('sqm', t('products.perSqm'))}
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-48">
              <input type="number" min="0" value={priceValue}
                onChange={e => setPriceValue(e.target.value)}
                placeholder={t('products.enterPrice')}
                className="flex-1 px-3 py-1.5 border border-[var(--border)] bg-[var(--surface)] rounded-lg text-xs focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] outline-none text-[var(--text)] placeholder-[var(--text-3)]"/>
              <span className="text-xs text-[var(--text-2)] shrink-0 font-medium font-mono">UZS</span>
            </div>
            <button onClick={applyPrices}
              disabled={applying || !priceValue || products.length === 0}
              className="px-3 py-1.5 bg-[var(--accent)] hover:opacity-90 disabled:opacity-40 text-[var(--accent-text)] rounded-lg text-xs font-medium transition flex items-center gap-2 shrink-0 shadow-sm">
              <RefreshCw size={15} strokeWidth={2} className={applying ? 'animate-spin' : ''}/>
              {applying ? t('products.applying') : t('products.applyToVisible', { count: products.length })}
            </button>
          </div>
          {previewPrices && (
            <div className="mt-3 pt-3 border-t border-[var(--border)] flex gap-6 text-[10.5px] text-[var(--text-2)]">
              <span className="text-[var(--text-3)]">{t('products.firstProductPreview')}</span>
              <span>{t('products.perTonna')} → <strong className="text-[var(--text)] font-mono">{fmtN(previewPrices.priceTon)} UZS</strong></span>
              <span>{t('products.perCbm')} → <strong className="text-[var(--text)] font-mono">{fmtN(previewPrices.priceCbm)} UZS</strong></span>
              <span>{t('products.perSqm')} → <strong className="text-[var(--text)] font-mono">{fmtN(previewPrices.priceSqm)} UZS</strong></span>
              <span className="text-[var(--text-3)] italic">{t('products.previewNote')}</span>
            </div>
          )}
        </div>
      )}

      <div className="mini-card p-0">
        <div className="px-5 py-3 border-b border-[var(--border)] bg-[var(--surface-2)] flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={16} strokeWidth={2.2} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]"/>
            <input type="text" placeholder={t('products.searchPlaceholder')} {...searchInput}
              className="pl-9 pr-4 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs w-full focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] outline-none transition text-[var(--text)] placeholder-[var(--text-3)]"/>
          </div>
          {search && <span className="text-xs text-[var(--text-3)]">{t('products.resultsCount', { count: total })}</span>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                <th className="px-3 py-2 text-[10px] font-semibold text-[var(--text-2)] uppercase tracking-wider whitespace-nowrap">{t('products.thArticle')}</th>
                <th className="px-3 py-2 text-[10px] font-semibold text-[var(--text-2)] uppercase tracking-wider whitespace-nowrap">{t('products.thDimensions')}</th>
                <th className="px-3 py-2 text-[10px] font-semibold text-[var(--text-2)] uppercase tracking-wider text-right whitespace-nowrap">{t('products.thDensity')}</th>
                <th className="px-3 py-2 text-[10px] font-semibold text-[var(--text-2)] uppercase tracking-wider text-right whitespace-nowrap">{t('products.perPceSqm')}</th>
                <th className="px-3 py-2 text-[10px] font-semibold text-[var(--text-2)] uppercase tracking-wider text-right whitespace-nowrap">{t('products.perPceCbm')}</th>
                <th className="px-3 py-2 text-[10px] font-semibold text-[var(--text-2)] uppercase tracking-wider text-right whitespace-nowrap">{t('products.perPceKg')}</th>
                <th className="px-3 py-2 text-[10px] font-semibold text-amber-700 bg-[oklch(0.97_0.02_70)]/40 uppercase tracking-wider text-right whitespace-nowrap">{t('products.thPriceTon')}</th>
                <th className="px-3 py-2 text-[10px] font-semibold text-emerald-700 bg-[oklch(0.97_0.03_150)]/40 uppercase tracking-wider text-right whitespace-nowrap">{t('products.thPriceCbm')}</th>
                <th className="px-3 py-2 text-[10px] font-semibold text-blue-700 bg-[oklch(0.96_0.03_250)]/40 uppercase tracking-wider text-right whitespace-nowrap">{t('products.thPriceSqm')}</th>
                {(canUpdate || canDelete) && <th className="px-3 py-2 w-16 bg-[var(--surface-2)]"/>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>{[...Array(10)].map((_, j) => (
                    <td key={j} className="px-3 py-2"><div className="h-4 bg-[var(--surface-2)] animate-pulse rounded"/></td>
                  ))}</tr>
                ))
              ) : products.length === 0 ? (
                <tr><td colSpan={10} className="px-3 py-10 text-center text-[var(--text-3)] text-xs">
                  {search ? t('common.notFound') : t('products.empty')}
                </td></tr>
              ) : products.map(p => (
                <tr key={p.id} className="hover:bg-[var(--surface-2)] border-b border-[var(--border)] transition-colors group">
                  <td className="px-3 py-2">
                    <div className="font-semibold text-[var(--text)] font-mono text-[11px] tracking-tight">{p.article}</div>
                    <div className="text-[10px] text-[var(--text-3)] truncate max-w-[200px]">{p.name}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-[var(--text-2)] font-mono">{p.length}×{p.width}×{p.thickness}</td>
                  <td className="px-3 py-2 text-right text-xs text-[var(--text-2)] font-mono">{p.density} <span className="text-[var(--text-3)]">kg/m³</span></td>
                  <td className="px-3 py-2 text-right font-medium text-[var(--text-2)] font-mono text-[11px]">{fmtD(p.sqmPerPce, 4)}</td>
                  <td className="px-3 py-2 text-right font-medium text-[var(--text-2)] font-mono text-[11px]">{fmtD(p.cbmPerPce, 6)}</td>
                  <td className="px-3 py-2 text-right font-medium text-[var(--text-2)] font-mono text-[11px]">{fmtD(p.kgPerPce, 3)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-amber-700 bg-[oklch(0.97_0.02_70)]/20 font-mono text-[11px]">{p.priceTon > 0 ? fmtN(p.priceTon) : <span className="text-[var(--text-3)] font-normal">—</span>}</td>
                  <td className="px-3 py-2 text-right font-semibold text-emerald-700 bg-[oklch(0.97_0.03_150)]/20 font-mono text-[11px]">{p.priceCbm > 0 ? fmtN(p.priceCbm) : <span className="text-[var(--text-3)] font-normal">—</span>}</td>
                  <td className="px-3 py-2 text-right font-semibold text-blue-700 bg-[oklch(0.96_0.03_250)]/20 font-mono text-[11px]">{p.priceSqm > 0 ? fmtN(p.priceSqm) : <span className="text-[var(--text-3)] font-normal">—</span>}</td>
                  {(canUpdate || canDelete) && (
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleCopy(p)} className="p-1 text-[var(--text-3)] hover:text-[var(--accent)] hover:bg-[var(--surface-2)] rounded transition" title={t('common.copy')}><Copy size={15} strokeWidth={1.8}/></button>
                        {canUpdate && (
                          <button onClick={() => openEdit(p)} className="p-1 text-[var(--text-3)] hover:text-[var(--accent)] hover:bg-[var(--surface-2)] rounded transition" title={t('common.edit')}><Edit2 size={15} strokeWidth={1.8}/></button>
                        )}
                        {canDelete && (
                          <button onClick={() => setDelId(p.id)} className="p-1 text-[var(--text-3)] hover:text-red-500 hover:bg-red-50 rounded transition" title={t('common.delete')}><Trash2 size={15} strokeWidth={1.8}/></button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={total} limit={LIMIT} onPage={setPage} />
      </div>

      {modal === 'edit' && (
        <div className="modal-overlay">
          <div className="modal-card w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--border)] flex justify-between items-center">
              <h3 className="text-lg font-bold text-[var(--text)]">{t('products.editTitle')}</h3>
              <button onClick={closeModal} className="text-[var(--text-3)] hover:text-[var(--text)] p-1 rounded hover:bg-[var(--surface-2)]"><X size={20}/></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-5">
              <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-4 py-3 flex items-center justify-between">
                <span className="text-xs text-[var(--text-3)] uppercase tracking-wider">{t('products.articleAuto')}</span>
                <span className="text-[var(--text)] font-mono font-bold text-lg">{article || '—'}</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-2)] mb-1">{t('products.nameLabel')}</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} placeholder="Базальтовая вата" />
                <p className="text-[10px] text-[var(--text-3)] mt-1">{t('products.printPreview', { name: form.name || '—', density: form.density || '…', length: form.length || '…', width: form.width || '…', thickness: form.thickness || '…' })}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-2)] mb-1">{t('products.densityLabel')}</label>
                  <input required type="number" step="0.01" min="1" value={form.density}
                    onChange={e => setForm(f => ({...f, density: e.target.value}))} className={inp} placeholder="80"/>
                </div>
                <div className="flex items-end">
                  <p className="text-xs text-[var(--text-3)] pb-2.5">{t('products.densityHint')}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-2)] mb-1">{t('products.dimensionsLabel')}</label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <input required type="number" min="1" value={form.length}
                      onChange={e => setForm(f => ({...f, length: e.target.value}))} className={inp} placeholder={t('products.length')}/>
                    <p className="text-xs text-[var(--text-3)] mt-1 text-center">{t('products.length')}</p>
                  </div>
                  <div>
                    <input required type="number" min="1" value={form.width}
                      onChange={e => setForm(f => ({...f, width: e.target.value}))} className={inp} placeholder={t('products.width')}/>
                    <p className="text-xs text-[var(--text-3)] mt-1 text-center">{t('products.width')}</p>
                  </div>
                  <div>
                    <input required type="number" min="1" value={form.thickness}
                      onChange={e => setForm(f => ({...f, thickness: e.target.value}))} className={inp} placeholder={t('products.thickness')}/>
                    <p className="text-xs text-[var(--text-3)] mt-1 text-center">{t('products.thickness')}</p>
                  </div>
                </div>
              </div>

              {article && (
                <div className="grid grid-cols-3 gap-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-3">
                  <div className="text-center">
                    <p className="text-[10px] text-[var(--text-3)] mb-1">{t('products.perPceSqm')}</p>
                    <p className="text-xs font-bold text-[var(--text)] font-mono">{fmtD(units.sqmPerPce, 4)}</p>
                  </div>
                  <div className="text-center border-x border-[var(--border)]">
                    <p className="text-[10px] text-[var(--text-3)] mb-1">{t('products.perPceCbm')}</p>
                    <p className="text-xs font-bold text-[var(--text)] font-mono">{fmtD(units.cbmPerPce, 6)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-[var(--text-3)] mb-1">{t('products.perPceKg')}</p>
                    <p className="text-xs font-bold text-[var(--text)] font-mono">{fmtD(units.kgPerPce, 3)}</p>
                  </div>
                </div>
              )}

              <p className="text-[10px] text-[var(--text-3)] flex items-center gap-1.5 justify-center">
                <Calculator size={13} strokeWidth={2}/> {t('products.priceManagedHint')}
              </p>

              <div className="pt-4 border-t border-[var(--border)] flex justify-end gap-2">
                <button type="button" onClick={closeModal} className="px-3 py-1.5 text-xs font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] rounded-lg transition">{t('common.cancel')}</button>
                <button type="submit" disabled={saving} className="px-4 py-1.5 bg-[var(--accent)] hover:opacity-90 disabled:opacity-60 text-[var(--accent-text)] text-xs font-medium rounded-lg transition shadow-sm">
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
            <h3 className="text-lg font-bold text-[var(--text)] mb-2">{t('products.deleteTitle')}</h3>
            <p className="text-sm text-[var(--text-3)] mb-6">{t('products.deleteConfirm')}</p>
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
