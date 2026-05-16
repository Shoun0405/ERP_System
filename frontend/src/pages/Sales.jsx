import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import { useModalKeys } from '../hooks/useModalKeys';
import { useInlineForm } from '../hooks/useInlineForm';
import Pagination from '../components/Pagination';
import { fmt, fmtDate } from '../lib/format';
import {
  Plus, X, Trash2, Package, Eye, Printer,
  FileText, Truck, User, Calendar, Hash, Search,
  Check, RefreshCw
} from 'lucide-react';

const TODAY = new Date().toISOString().split('T')[0];
const PACK_TYPES = { 1: '1 dona', 2: '2 dona', 4: '4 dona', 8: '8 dona', 16: '16 dona' };
const EMPTY_ROW = {
  productId: '', packType: 1, totalPieces: 0,
  totalCbm: 0, totalKg: 0, totalSqm: 0, priceCbm: 0, rowAmount: 0,
};

// ─── Print template ─────────────────────────────────────────────────────────
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
      <h3 style={{ textAlign: 'center', margin: '8px 0', fontSize: 14 }}>YUK XATI № {sale.nakladnoy}</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
        <tbody>
          <tr>
            <td style={td}><b>Mijoz:</b></td><td style={td}>{sale.client?.name}</td>
            <td style={td}><b>Sana:</b></td><td style={td}>{fmtDate(sale.date)}</td>
          </tr>
          <tr>
            <td style={td}><b>Sotuvchi:</b></td><td style={td}>{sale.sellerName}</td>
            <td style={td}><b>Transport:</b></td><td style={td}>{sale.transportNum || '—'}</td>
          </tr>
        </tbody>
      </table>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
        <thead>
          <tr>
            {['№','Mahsulot','Dona','m³','kg','Narx (1m³)','Summa'].map(h => (
              <th key={h} style={th}>{h}</th>
            ))}
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

// ─── ProductRow ──────────────────────────────────────────────────────────────
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
        <select value={row.productId} onChange={e => handleProductChange(e.target.value)} className={s}>
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
        <input type="number" min="0" value={row.totalPieces}
          onChange={e => handleChange('totalPieces', e.target.value)} className={s} />
      </td>
      <td className="p-2 w-24">
        <input readOnly value={row.totalCbm.toFixed(4)} className={`${s} bg-zinc-50 text-zinc-500`} />
      </td>
      <td className="p-2 w-24">
        <input readOnly value={row.totalKg.toFixed(2)} className={`${s} bg-zinc-50 text-zinc-500`} />
      </td>
      <td className="p-2 w-32">
        <input type="number" min="0" value={row.priceCbm}
          onChange={e => handleChange('priceCbm', e.target.value)} className={s} />
      </td>
      <td className="p-2 w-36 text-right">
        <span className="text-sm font-semibold text-zinc-900 pr-2">{fmt(row.rowAmount)}</span>
      </td>
      <td className="p-2 w-10">
        <button type="button" onClick={() => onRemove(idx)}
          className="p-1 text-zinc-300 hover:text-red-500 transition"><X size={15} /></button>
      </td>
    </tr>
  );
}

// ─── SaleForm (inline accordion) ────────────────────────────────────────────
function SaleForm({ onSaved, onCancel, clients, products, initialValues = null }) {
  const [form, setForm] = useState({
    date: TODAY, nakladnoy: '', sellerName: '', transportNum: '',
    clientId:   initialValues?.clientId   || '',
    contractId: initialValues?.contractId || '',
    specId:     initialValues?.specId     || '',
    rows: [{ ...EMPTY_ROW }],
  });
  const [contracts, setContracts] = useState([]);
  const [specs, setSpecs]         = useState([]);
  const [saving, setSaving]       = useState(false);
  const initRef = useRef(false);

  // Agar initialValues berilgan bo'lsa — contracts + specs + prefill bir zarbada yuklanadi
  useEffect(() => {
    if (!initialValues?.clientId || initRef.current) return;
    initRef.current = true;

    api.get(`/api/contracts?clientId=${initialValues.clientId}&limit=100`)
      .then(r => setContracts(r.data.data || []))
      .catch(() => {});

    if (!initialValues.contractId) return;
    api.get(`/api/specs?contractId=${initialValues.contractId}`)
      .then(r => {
        const specsData = r.data.data || [];
        setSpecs(specsData);
        if (!initialValues.specId) return;
        const spec = specsData.find(s => s.id === initialValues.specId);
        if (!spec?.products?.length) return;
        setForm(f => ({
          ...f,
          rows: spec.products.map(sp => {
            const prod = products.find(p => p.id === sp.productId);
            return {
              productId: sp.productId, packType: 1, totalPieces: 0,
              totalCbm: 0, totalKg: 0, totalSqm: 0,
              priceCbm: prod?.priceCbm || 0, rowAmount: 0,
            };
          }),
        }));
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totalAmount = form.rows.reduce((s, r) => s + (parseFloat(r.rowAmount) || 0), 0);

  // clientId o'zgarganda (foydalanuvchi qo'lda o'zgartirsa) — contracts qayta yuklanadi
  const prevClientId = useRef(initialValues?.clientId || '');
  useEffect(() => {
    if (prevClientId.current === form.clientId) return; // initial yoki o'zgarisssiz
    prevClientId.current = form.clientId;
    setContracts([]);
    setSpecs([]);
    setForm(f => ({ ...f, contractId: '', specId: '' }));
    if (!form.clientId) return;
    api.get(`/api/contracts?clientId=${form.clientId}&limit=100`)
      .then(r => setContracts(r.data.data || []))
      .catch(() => {});
  }, [form.clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const prevContractId = useRef(initialValues?.contractId || '');
  useEffect(() => {
    if (prevContractId.current === form.contractId) return;
    prevContractId.current = form.contractId;
    setSpecs([]); // eslint-disable-line react-hooks/set-state-in-effect
    setForm(f => ({ ...f, specId: '' })); // eslint-disable-line react-hooks/set-state-in-effect
    if (!form.contractId) return;
    api.get(`/api/specs?contractId=${form.contractId}`)
      .then(r => setSpecs(r.data.data || []))
      .catch(() => {});
  }, [form.contractId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Spets tanlanganda — mahsulotlarni prefill
  useEffect(() => {
    if (!form.specId) return;
    const spec = specs.find(s => s.id === form.specId);
    if (!spec?.products?.length) return;
    const rows = spec.products.map(sp => {
      const prod = products.find(p => p.id === sp.productId);
      return {
        productId: sp.productId,
        packType: 1,
        totalPieces: 0,
        totalCbm: 0,
        totalKg: 0,
        totalSqm: 0,
        priceCbm: prod?.priceCbm || 0,
        rowAmount: 0,
      };
    });
    setForm(f => ({ ...f, rows })); // eslint-disable-line react-hooks/set-state-in-effect
  }, [form.specId]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateRow = (idx, updated) => {
    setForm(f => { const rows = [...f.rows]; rows[idx] = updated; return { ...f, rows }; });
  };
  const removeRow = (idx) => {
    if (form.rows.length === 1) return;
    setForm(f => ({ ...f, rows: f.rows.filter((_, i) => i !== idx) }));
  };
  const addRow = () => setForm(f => ({ ...f, rows: [...f.rows, { ...EMPTY_ROW }] }));

  const save = async () => {
    if (!form.clientId)   return toast.error('Mijozni tanlang');
    if (!form.nakladnoy)  return toast.error('Yuk xati raqamini kiriting');
    if (!form.sellerName) return toast.error('Sotuvchi ismini kiriting');
    if (form.rows.some(r => !r.productId || r.totalPieces <= 0)) {
      return toast.error('Barcha qatorlarni to\'ldiring');
    }
    setSaving(true);
    try {
      const { data } = await api.post('/api/sales', {
        date:         form.date,
        nakladnoy:    form.nakladnoy,
        sellerName:   form.sellerName,
        transportNum: form.transportNum || null,
        clientId:     form.clientId,
        contractId:   form.contractId || null,
        specId:       form.specId     || null,
        products:     form.rows,
      });
      toast.success('Yuk xati saqlandi');
      onSaved(data);
    } finally { setSaving(false); }
  };

  useModalKeys(!saving, save, onCancel);

  const inp = 'w-full px-3 py-2 border border-zinc-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white';

  return (
    <div className="border border-blue-200 rounded-xl bg-blue-50/30 p-5 mb-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-800 flex items-center gap-2">
          <FileText size={15} className="text-blue-600" /> Yangi Yuk Xati
        </h3>
        <button onClick={onCancel} className="text-zinc-400 hover:text-zinc-600"><X size={16} /></button>
      </div>

      {/* 1-qator: asosiy ma'lumotlar */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-zinc-500 block mb-1"><User size={11} className="inline mr-1"/>Mijoz *</label>
          <select value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))} className={inp}>
            <option value="">— Tanlang —</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-500 block mb-1">Shartnoma</label>
          <select value={form.contractId}
            onChange={e => setForm(f => ({ ...f, contractId: e.target.value }))}
            disabled={!form.clientId} className={inp}>
            <option value="">— Ixtiyoriy —</option>
            {contracts.map(c => <option key={c.id} value={c.id}>№{c.number}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-500 block mb-1 flex items-center gap-1">
            Spetsifikatsiya
            {form.contractId && (
              <span className="text-zinc-400 font-normal">(mahsulotlar prefill bo'ladi)</span>
            )}
          </label>
          <select value={form.specId}
            onChange={e => setForm(f => ({ ...f, specId: e.target.value }))}
            disabled={!form.contractId} className={inp}>
            <option value="">— Ixtiyoriy —</option>
            {specs.map(s => (
              <option key={s.id} value={s.id}>
                Spets №{s.number} — {fmt(s.totalValue)} so'm
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-500 block mb-1"><Calendar size={11} className="inline mr-1"/>Sana *</label>
          <input type="date" value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inp} />
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-500 block mb-1"><Hash size={11} className="inline mr-1"/>Yuk xati № *</label>
          <input type="text" value={form.nakladnoy} placeholder="НГ-1234"
            onChange={e => setForm(f => ({ ...f, nakladnoy: e.target.value }))} className={inp} />
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-500 block mb-1">Sotuvchi *</label>
          <input type="text" value={form.sellerName} placeholder="F.I.O."
            onChange={e => setForm(f => ({ ...f, sellerName: e.target.value }))} className={inp} />
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-500 block mb-1"><Truck size={11} className="inline mr-1"/>Transport</label>
          <input type="text" value={form.transportNum} placeholder="01 A 123 BC"
            onChange={e => setForm(f => ({ ...f, transportNum: e.target.value }))} className={inp} />
        </div>
      </div>

      {/* Mahsulotlar jadvali */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-semibold text-zinc-700 flex items-center gap-2">
            <Package size={14} className="text-blue-600" /> Mahsulotlar
          </p>
          <button type="button" onClick={addRow}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
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
                <th className="p-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {form.rows.map((row, idx) => (
                <ProductRow key={idx} idx={idx} row={row} products={products}
                  onUpdate={updateRow} onRemove={removeRow} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <div className="bg-zinc-900 text-white rounded-lg px-5 py-3">
          <p className="text-xs text-zinc-400 mb-0.5">Jami summa</p>
          <p className="text-xl font-bold">{fmt(totalAmount)} <span className="text-xs font-normal text-zinc-400">UZS</span></p>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 rounded-md">
            Bekor (Esc)
          </button>
          <button onClick={save} disabled={saving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-md flex items-center gap-2">
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
            Yuk xatini saqlash
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function Sales() {
  const location = useLocation();
  const navigate  = useNavigate();

  const [sales,   setSales]   = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const LIMIT = 50;

  const [clients,  setClients]  = useState([]);
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading,  setLoading]  = useState(true);

  const [search,          setSearch]         = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterClient,    setFilterClient]   = useState('');
  const [dateFrom,        setDateFrom]       = useState('');
  const [dateTo,          setDateTo]         = useState('');

  const [detail,        setDetail]        = useState(null);
  const [delId,         setDelId]         = useState(null);
  const [initialValues, setInitialValues] = useState(null);

  const inlineForm = useInlineForm();

  // Contracts sahifasidan navigate bilan kelgan bo'lsa — forma ochiladi
  useEffect(() => {
    if (!location.state?.specId && !location.state?.contractId) return;
    setInitialValues(location.state);
    inlineForm.open();
    // History dan state ni tozalaymiz (back bosilganda qaytadan ochilmasin)
    navigate('/sales', { replace: true, state: null });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const printRef   = useRef();
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Yuk xati ${detail?.nakladnoy || ''}`,
  });

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [filterClient, dateFrom, dateTo]);

  const fetchSales = useCallback(() => {
    setLoading(true);
    api.get('/api/sales', {
      params: { page, limit: LIMIT, search: debouncedSearch, clientId: filterClient, from: dateFrom, to: dateTo },
    })
      .then(r => { setSales(r.data.data); setTotal(r.data.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, debouncedSearch, filterClient, dateFrom, dateTo]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchSales(); }, [fetchSales]);

  useEffect(() => {
    Promise.all([
      api.get('/api/clients',  { params: { limit: 200 } }),
      api.get('/api/products', { params: { limit: 200 } }),
      api.get('/api/settings'),
    ]).then(([c, p, s]) => {
      setClients(c.data.data || []);
      setProducts(p.data.data || []);
      setSettings(s.data);
    }).catch(() => {});
  }, []);

  const handleSaved = (saved) => {
    inlineForm.close();
    setInitialValues(null);
    setSales(prev => [saved, ...prev]);
    setTotal(t => t + 1);
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

  useModalKeys(!!detail, null, () => setDetail(null));

  return (
    <div className="p-8 space-y-5">
      {/* Hidden print area */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div ref={printRef}><PrintableInvoice sale={detail} company={settings} /></div>
      </div>

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">Savdolar (Yuk xatlari)</h2>
          <p className="text-sm text-zinc-500 mt-0.5">{total} ta yuk xati</p>
        </div>
        <button onClick={inlineForm.toggle}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition">
          <Plus size={16} />
          {inlineForm.isOpen ? 'Yopish' : 'Yangi Yuk Xati'}
        </button>
      </div>

      {/* Inline form */}
      {inlineForm.isOpen && (
        <SaleForm
          onSaved={handleSaved}
          onCancel={() => { inlineForm.close(); setInitialValues(null); }}
          clients={clients}
          products={products}
          initialValues={initialValues}
        />
      )}

      {/* Table card */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm">
        {/* Filters */}
        <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50/50 flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" />
            <input type="text" placeholder="Yuk xati №, mijoz..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-1.5 bg-white border border-zinc-200 rounded-md text-sm w-48 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition" />
          </div>
          <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
            className="px-3 py-1.5 border border-zinc-200 rounded-md text-sm bg-white focus:border-blue-500 outline-none">
            <option value="">Barcha mijozlar</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-1.5 border border-zinc-200 rounded-md text-sm bg-white focus:border-blue-500 outline-none" title="Dan" />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-3 py-1.5 border border-zinc-200 rounded-md text-sm bg-white focus:border-blue-500 outline-none" title="Gacha" />
          {hasFilter && (
            <button onClick={clearFilters} className="text-xs text-zinc-500 hover:text-zinc-700 flex items-center gap-1">
              <X size={12} /> Tozalash
            </button>
          )}
          <span className="ml-auto text-xs text-zinc-500">{total} natija</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Sana</th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Yuk xati №</th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Mijoz</th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Shartnoma</th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Spets</th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Sotuvchi</th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Jami Summa</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(8)].map((_, j) => (
                      <td key={j} className="px-4 py-4">
                        <div className="h-4 bg-zinc-100 animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-zinc-400 text-sm">
                    {hasFilter ? 'Topilmadi' : 'Hozircha yuk xatlari yo\'q'}
                  </td>
                </tr>
              ) : sales.map(s => (
                <tr key={s.id} className="hover:bg-zinc-50 transition-colors group">
                  <td className="px-4 py-3.5 text-sm text-zinc-600">{fmtDate(s.date)}</td>
                  <td className="px-4 py-3.5 text-sm font-semibold text-zinc-900 font-mono">{s.nakladnoy}</td>
                  <td className="px-4 py-3.5 text-sm text-zinc-700">{s.client?.name}</td>
                  <td className="px-4 py-3.5 text-sm">
                    {s.contract ? (
                      <span className="font-mono text-xs bg-zinc-100 text-zinc-700 px-1.5 py-0.5 rounded">
                        №{s.contract.number}
                      </span>
                    ) : <span className="text-zinc-300">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-sm">
                    {s.spec ? (
                      <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                        №{s.spec.number}
                      </span>
                    ) : <span className="text-zinc-300">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-zinc-500">{s.sellerName}</td>
                  <td className="px-4 py-3.5 text-sm text-right font-bold text-emerald-600">{fmt(s.totalAmount)} UZS</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openDetail(s)}
                        className="p-1.5 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition" title="Ko'rish">
                        <Eye size={14} />
                      </button>
                      <button onClick={() => setDelId(s.id)}
                        className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-md transition" title="O'chirish">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-zinc-100">
          <Pagination page={page} total={total} limit={LIMIT} onChange={setPage} />
        </div>
      </div>

      {/* Delete confirm */}
      {delId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <p className="font-semibold text-zinc-900">Yuk xatini o'chirish</p>
            <p className="text-sm text-zinc-500">Bu amalni qaytarib bo'lmaydi.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDelId(null)}
                className="px-3 py-2 text-sm border border-zinc-200 rounded-md hover:bg-zinc-50">Bekor</button>
              <button onClick={handleDelete}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700">O'chirish</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-zinc-200 flex justify-between items-center sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-zinc-900">Yuk xati: {detail.nakladnoy}</h3>
              <div className="flex items-center gap-2">
                <button onClick={handlePrint}
                  className="px-3 py-1.5 text-sm font-medium border border-zinc-200 rounded-md hover:bg-zinc-50 flex items-center gap-1.5">
                  <Printer size={14} /> Chop etish
                </button>
                <button onClick={() => setDetail(null)}
                  className="text-zinc-400 hover:text-zinc-600 p-1 rounded-md hover:bg-zinc-100">
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-zinc-500">Mijoz:</span> <span className="font-medium">{detail.client?.name}</span></div>
                <div><span className="text-zinc-500">Sana:</span> <span className="font-medium">{fmtDate(detail.date)}</span></div>
                <div><span className="text-zinc-500">Sotuvchi:</span> <span className="font-medium">{detail.sellerName}</span></div>
                <div><span className="text-zinc-500">Transport:</span> <span className="font-medium">{detail.transportNum || '—'}</span></div>
                {detail.contract && (
                  <div><span className="text-zinc-500">Shartnoma:</span> <span className="font-mono font-medium">№{detail.contract.number}</span></div>
                )}
                {detail.spec && (
                  <div><span className="text-zinc-500">Spets:</span> <span className="font-medium">№{detail.spec.number}</span></div>
                )}
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
                        <td className="px-4 py-2 font-mono text-xs font-semibold text-zinc-700">
                          {p.product?.article || p.productId?.slice(0, 8)}
                        </td>
                        <td className="px-4 py-2 text-center">{p.totalPieces}</td>
                        <td className="px-4 py-2 text-center">{p.totalCbm?.toFixed(4)}</td>
                        <td className="px-4 py-2 text-right font-semibold">{fmt(p.rowAmount)}</td>
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
    </div>
  );
}
