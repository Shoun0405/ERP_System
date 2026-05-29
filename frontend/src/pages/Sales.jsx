import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api, { API } from '../lib/api';
import toast from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import { useModalKeys } from '../hooks/useModalKeys';
import { useInlineForm } from '../hooks/useInlineForm';
import Pagination from '../components/Pagination';
import { fmt, fmtDate } from '../lib/format';
import {
  Plus, X, Trash2, Package, Eye, Printer,
  FileText, Truck, User, Calendar, Hash, Search,
  Check, RefreshCw, ChevronDown, CheckCircle2, XCircle,
  FileSpreadsheet, Download
} from 'lucide-react';

const TODAY = new Date().toISOString().split('T')[0];

const EMPTY_ROW = {
  productId: '',
  packType: 1,
  unit: 'dona',
  amount: 0,
  price: 0,
  totalPieces: 0,
  totalCbm: 0,
  totalKg: 0,
  totalSqm: 0,
  priceCbm: 0,
  rowAmount: 0,
};

// Helper: Calculate converted physical dimensions based on product characteristics
function calculateRowValues(row, products) {
  const p = products.find(x => x.id === row.productId);
  if (!p) {
    return {
      ...row,
      totalPieces: 0,
      totalCbm: 0,
      totalKg: 0,
      totalSqm: 0,
      priceCbm: 0,
      rowAmount: 0
    };
  }

  const amount = parseFloat(row.amount) || 0;
  const price = parseFloat(row.price) || 0;
  const rowAmount = Math.round(amount * price);

  let totalPieces = 0;
  let totalCbm = 0;
  let totalKg = 0;
  let totalSqm = 0;

  if (row.unit === 'dona') {
    totalPieces = Math.round(amount);
    totalCbm = +(totalPieces * p.cbmPerPce).toFixed(6);
    totalKg = +(totalPieces * p.kgPerPce).toFixed(3);
    totalSqm = +(totalPieces * p.sqmPerPce).toFixed(4);
  } else if (row.unit === 'kg') {
    totalKg = amount;
    totalPieces = p.kgPerPce > 0 ? Math.round(amount / p.kgPerPce) : 0;
    totalCbm = +(totalPieces * p.cbmPerPce).toFixed(6);
    totalSqm = +(totalPieces * p.sqmPerPce).toFixed(4);
  } else if (row.unit === 'kv.m') {
    totalSqm = amount;
    totalPieces = p.sqmPerPce > 0 ? Math.round(amount / p.sqmPerPce) : 0;
    totalCbm = +(totalPieces * p.cbmPerPce).toFixed(6);
    totalKg = +(totalPieces * p.kgPerPce).toFixed(3);
  } else if (row.unit === 'kub.m') {
    totalCbm = amount;
    totalPieces = p.cbmPerPce > 0 ? Math.round(amount / p.cbmPerPce) : 0;
    totalKg = +(totalPieces * p.kgPerPce).toFixed(3);
    totalSqm = +(totalPieces * p.sqmPerPce).toFixed(4);
  }

  const priceCbm = totalCbm > 0 ? +(rowAmount / totalCbm).toFixed(2) : 0;

  return {
    ...row,
    totalPieces,
    totalCbm,
    totalKg,
    totalSqm,
    priceCbm,
    rowAmount
  };
}

// ─── Print template (Single) ────────────────────────────────────────────────
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
            {['№','Mahsulot','Dona','m³','kg','m²','Narx','Summa'].map(h => (
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
              <td style={{ ...td, textAlign: 'center' }}>{p.totalSqm?.toFixed(2)}</td>
              <td style={{ ...td, textAlign: 'right' }}>{fmt(p.rowAmount / (p.totalPieces || 1))}</td>
              <td style={{ ...td, textAlign: 'right' }}>{fmt(p.rowAmount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={7} style={{ ...th, textAlign: 'right' }}>Jami:</td>
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

// Printable templates for multiple invoices (bulk printing)
function PrintableInvoices({ sales, company }) {
  if (!sales || sales.length === 0) return null;
  return (
    <div>
      {sales.map((sale, idx) => (
        <div key={sale.id} style={{ pageBreakAfter: idx < sales.length - 1 ? 'always' : 'auto' }}>
          <PrintableInvoice sale={sale} company={company} />
        </div>
      ))}
    </div>
  );
}

// ─── ProductRow ──────────────────────────────────────────────────────────────
function ProductRow({ row, products, onUpdate, onRemove, idx }) {
  const handleProductChange = (productId) => {
    const p = products.find(x => x.id === productId);
    if (!p) return;
    onUpdate(idx, {
      ...row,
      productId,
      unit: 'dona',
      amount: 0,
      price: p.priceCbm || 0,
      packType: 1,
      totalPieces: 0,
      totalCbm: 0,
      totalKg: 0,
      totalSqm: 0,
      rowAmount: 0
    });
  };

  const handleChange = (field, val) => {
    const updated = { ...row, [field]: val };
    const calculated = calculateRowValues(updated, products);
    onUpdate(idx, calculated);
  };

  const s = 'w-full px-2.5 py-1.5 border border-zinc-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white';
  const p = products.find(x => x.id === row.productId);

  return (
    <tr className="border-b border-zinc-100 hover:bg-zinc-50/50">
      <td className="p-2 text-center text-sm text-zinc-400 font-medium">{idx + 1}</td>
      <td className="p-2">
        <select value={row.productId} onChange={e => handleProductChange(e.target.value)} className={s}>
          <option value="">— Tanlang —</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.article}</option>)}
        </select>
      </td>
      <td className="p-2 w-28">
        <select value={row.unit} onChange={e => handleChange('unit', e.target.value)} className={s}>
          <option value="dona">dona</option>
          <option value="kg">kg</option>
          <option value="kv.m">kv.m</option>
          <option value="kub.m">kub.m</option>
        </select>
      </td>
      <td className="p-2 w-24">
        <input type="number" min="0" step="any" value={row.amount || ''}
          onChange={e => handleChange('amount', e.target.value)} className={s} placeholder="Miqdor" />
      </td>
      <td className="p-2 w-32">
        <input type="number" min="0" value={row.price || ''}
          onChange={e => handleChange('price', e.target.value)} className={s} placeholder="Narx" />
      </td>
      <td className="p-2 text-xs text-zinc-600">
        {p ? (
          <div className="space-y-0.5 bg-zinc-50 p-1.5 rounded border border-zinc-150">
            <div><span className="font-semibold text-zinc-700">{row.totalPieces}</span> dona</div>
            <div className="text-[10px] text-zinc-400">
              {row.totalKg.toFixed(1)} kg | {row.totalCbm.toFixed(3)} m³ | {row.totalSqm.toFixed(1)} m²
            </div>
          </div>
        ) : (
          <span className="text-zinc-300">—</span>
        )}
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

  // Load contracts and specifications if initial values are provided
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
            const row = {
              productId: sp.productId,
              unit: sp.unit || 'dona',
              amount: sp.quantity || 0,
              price: sp.unitPriceVat || 0,
              packType: 1,
              totalPieces: 0,
              totalCbm: 0,
              totalKg: 0,
              totalSqm: 0,
              priceCbm: 0,
              rowAmount: 0
            };
            return calculateRowValues(row, products);
          }),
        }));
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totalAmount = form.rows.reduce((s, r) => s + (parseFloat(r.rowAmount) || 0), 0);

  // On client selection, fetch contracts and default seller if any attached
  const selectedClient = clients.find(c => c.id === form.clientId);
  const clientSellers = selectedClient?.seller ? selectedClient.seller.split(',').map(s => s.trim()) : [];

  const prevClientId = useRef(initialValues?.clientId || '');
  useEffect(() => {
    if (prevClientId.current === form.clientId) return;
    prevClientId.current = form.clientId;
    setContracts([]);
    setSpecs([]);
    setForm(f => ({ ...f, contractId: '', specId: '', sellerName: clientSellers[0] || '' }));
    if (!form.clientId) return;
    api.get(`/api/contracts?clientId=${form.clientId}&limit=100`)
      .then(r => setContracts(r.data.data || []))
      .catch(() => {});
  }, [form.clientId]);

  const prevContractId = useRef(initialValues?.contractId || '');
  useEffect(() => {
    if (prevContractId.current === form.contractId) return;
    prevContractId.current = form.contractId;
    setSpecs([]);
    setForm(f => ({ ...f, specId: '' }));
    if (!form.contractId) return;
    api.get(`/api/specs?contractId=${form.contractId}`)
      .then(r => setSpecs(r.data.data || []))
      .catch(() => {});
  }, [form.contractId]);

  // Pre-fill products from spec
  useEffect(() => {
    if (!form.specId) return;
    const spec = specs.find(s => s.id === form.specId);
    if (!spec?.products?.length) return;
    const rows = spec.products.map(sp => {
      const row = {
        productId: sp.productId,
        unit: sp.unit || 'dona',
        amount: sp.quantity || 0,
        price: sp.unitPriceVat || 0,
        packType: 1,
        totalPieces: 0,
        totalCbm: 0,
        totalKg: 0,
        totalSqm: 0,
        priceCbm: 0,
        rowAmount: 0
      };
      return calculateRowValues(row, products);
    });
    setForm(f => ({ ...f, rows }));
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
        products:     form.rows.map(r => ({
          productId: r.productId,
          packType: r.packType,
          totalPieces: r.totalPieces,
          totalCbm: r.totalCbm,
          totalKg: r.totalKg,
          totalSqm: r.totalSqm,
          priceCbm: r.priceCbm,
          rowAmount: r.rowAmount
        })),
        facturaStatus: 'yuborilmagan'
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

      {/* Basic fields */}
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
              <span className="text-zinc-400 font-normal">(mahsulotlar to'ldiriladi)</span>
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
          {clientSellers.length > 0 ? (
            <select value={form.sellerName} onChange={e => setForm(f => ({ ...f, sellerName: e.target.value }))} className={inp}>
              <option value="">— Sotuvchini tanlang —</option>
              {clientSellers.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <input type="text" value={form.sellerName} placeholder="F.I.O."
              onChange={e => setForm(f => ({ ...f, sellerName: e.target.value }))} className={inp} />
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-500 block mb-1"><Truck size={11} className="inline mr-1"/>Transport</label>
          <input type="text" value={form.transportNum} placeholder="01 A 123 BC"
            onChange={e => setForm(f => ({ ...f, transportNum: e.target.value }))} className={inp} />
        </div>
      </div>

      {/* Products table */}
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
        <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white">
          <table className="w-full">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="p-2 w-8 text-center text-xs font-semibold text-zinc-500">#</th>
                <th className="p-2 text-left text-xs font-semibold text-zinc-500">Mahsulot</th>
                <th className="p-2 text-left text-xs font-semibold text-zinc-500 w-28">Birlik</th>
                <th className="p-2 text-left text-xs font-semibold text-zinc-500 w-24">Miqdor</th>
                <th className="p-2 text-left text-xs font-semibold text-zinc-500 w-32">Narx</th>
                <th className="p-2 text-left text-xs font-semibold text-zinc-500">Konvertatsiya (Haqiqiy hajmi)</th>
                <th className="p-2 text-right text-xs font-semibold text-zinc-500 w-36">Jami (UZS)</th>
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
  const [filterContract,  setFilterContract] = useState('');
  const [filterSpec,      setFilterSpec]     = useState('');
  const [filterContracts, setFilterContracts] = useState([]);
  const [filterSpecs,     setFilterSpecs]     = useState([]);
  const [dateFrom,        setDateFrom]       = useState('');
  const [dateTo,          setDateTo]         = useState('');
  const [facturaFilter,   setFacturaFilter]   = useState('barchasi');

  const [detail,        setDetail]        = useState(null);
  const [delId,         setDelId]         = useState(null);
  const [initialValues, setInitialValues] = useState(null);

  const [selectedSales, setSelectedSales] = useState([]);
  const [activeStatusDropdown, setActiveStatusDropdown] = useState(null);
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  const toggleSort = (col) => {
    if (sortBy === col) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
    setPage(1);
  };
  const [bulkPrintSales, setBulkPrintSales] = useState([]);

  const inlineForm = useInlineForm();

  const printRef = useRef();

  // Print handle
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: bulkPrintSales.length > 0 ? 'Ommaviy yuk xatlari' : `Yuk xati ${detail?.nakladnoy || ''}`,
  });

  // Trigger bulk printing when state populated
  useEffect(() => {
    if (bulkPrintSales.length > 0) {
      handlePrint();
      setTimeout(() => setBulkPrintSales([]), 1000);
    }
  }, [bulkPrintSales]); // eslint-disable-line react-hooks/exhaustive-deps

  // Quick range date setups
  const prevMonth = () => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const to = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    setDateFrom(from); setDateTo(to);
  };
  const monthStart = () => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const to = now.toISOString().split('T')[0];
    setDateFrom(from); setDateTo(to);
  };
  const yearStart = () => {
    const now = new Date();
    const from = `${now.getFullYear()}-01-01`;
    const to = now.toISOString().split('T')[0];
    setDateFrom(from); setDateTo(to);
  };
  const prevYear = () => {
    const now = new Date();
    const from = `${now.getFullYear() - 1}-01-01`;
    const to = `${now.getFullYear() - 1}-12-31`;
    setDateFrom(from); setDateTo(to);
  };

  // Cascading drop-down loading for filters
  useEffect(() => {
    setFilterContract('');
    setFilterSpec('');
    setFilterContracts([]);
    setFilterSpecs([]);
    if (!filterClient) return;
    api.get(`/api/contracts?clientId=${filterClient}&limit=100`)
      .then(r => setFilterContracts(r.data.data || []))
      .catch(() => {});
  }, [filterClient]);

  useEffect(() => {
    setFilterSpec('');
    setFilterSpecs([]);
    if (!filterContract) return;
    api.get(`/api/specs?contractId=${filterContract}`)
      .then(r => setFilterSpecs(r.data.data || []))
      .catch(() => {});
  }, [filterContract]);

  // Initial forms triggers from dashboard or contracts
  useEffect(() => {
    if (!location.state?.specId && !location.state?.contractId) return;
    setInitialValues(location.state);
    inlineForm.open();
    navigate('/sales', { replace: true, state: null });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [filterClient, filterContract, filterSpec, dateFrom, dateTo, facturaFilter]);

  const fetchSales = useCallback(() => {
    setLoading(true);
    const params = {
      page,
      limit: LIMIT,
      search: debouncedSearch,
      clientId: filterClient,
      contractId: filterContract,
      specId: filterSpec,
      from: dateFrom,
      to: dateTo,
      facturaStatus: facturaFilter === 'barchasi' ? '' : facturaFilter,
      sortBy,
      sortDir
    };
    api.get('/api/sales', { params })
      .then(r => { setSales(r.data.data); setTotal(r.data.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, debouncedSearch, filterClient, filterContract, filterSpec, dateFrom, dateTo, facturaFilter, sortBy, sortDir]);

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
      toast.success('Yuk xati o\'chirildi');
    } catch { /* Toast handled by interceptor */ }
  };

  // Toggle single row factura status
  const toggleFacturaStatus = async (saleId, newStatus) => {
    try {
      const { data } = await api.put(`/api/sales/${saleId}`, { facturaStatus: newStatus });
      setSales(prev => prev.map(s => s.id === saleId ? { ...s, facturaStatus: data.facturaStatus } : s));
      toast.success("Faktura holati o'zgartirildi");
    } catch { /* Toast handled by interceptor */ }
    finally {
      setActiveStatusDropdown(null);
    }
  };

  // Checkbox select/deselect row
  const toggleSelectSale = (id) => {
    setSelectedSales(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedSales.length === sales.length) {
      setSelectedSales([]);
    } else {
      setSelectedSales(sales.map(s => s.id));
    }
  };

  // Bulk Actions Handlers
  const handleBulkDelete = async () => {
    if (!window.confirm(`Haqiqatan ham ${selectedSales.length} ta yuk xatini o'chirmoqchimisiz?`)) return;
    try {
      await api.post('/api/sales/bulk-delete', { ids: selectedSales });
      toast.success("Yuk xatlari o'chirildi");
      setSelectedSales([]);
      fetchSales();
    } catch {}
  };

  const handleBulkFactura = async (status) => {
    try {
      await api.post('/api/sales/bulk-factura', { ids: selectedSales, status });
      toast.success("Faktura holatlari yangilandi");
      setSelectedSales([]);
      fetchSales();
    } catch {}
  };

  const handleBulkPrint = () => {
    const listToPrint = sales.filter(s => selectedSales.includes(s.id));
    if (listToPrint.length === 0) return;
    setBulkPrintSales(listToPrint);
  };

  const handleBulkExport = (type) => {
    if (selectedSales.length === 0) return;
    const url = `${API}/api/export/sales/${type}?ids=${selectedSales.join(',')}`;
    if (type === 'pdf') {
      window.open(url, '_blank');
    } else {
      window.location.href = url;
    }
  };

  // Nusxa olib qo'shish (Copy & Add) handler
  const handleCopyAndAdd = (sale) => {
    setInitialValues({
      clientId: sale.clientId,
      contractId: sale.contractId || '',
      specId: sale.specId || '',
    });
    // Hydrate form rows with values
    setTimeout(() => {
      setFormRowsFromSale(sale);
    }, 100);
    inlineForm.open();
  };

  const setFormRowsFromSale = (sale) => {
    // Locate the DOM elements or wait for state hydration
    // For react state, let's keep a state that sets form fields in SaleForm when it mounts
    setInitialValues({
      clientId: sale.clientId,
      contractId: sale.contractId || '',
      specId: sale.specId || '',
      rows: sale.products?.map(p => ({
        productId: p.productId,
        unit: 'dona',
        amount: p.totalPieces,
        price: p.rowAmount / (p.totalPieces || 1),
        packType: p.packType || 1,
        totalPieces: p.totalPieces,
        totalCbm: p.totalCbm,
        totalKg: p.totalKg,
        totalSqm: p.totalSqm,
        priceCbm: p.priceCbm,
        rowAmount: p.rowAmount
      }))
    });
  };

  const openDetail = async (s) => {
    try {
      const r = await api.get(`/api/sales/${s.id}`);
      setDetail(r.data);
    } catch { setDetail(s); }
  };

  const clearFilters = () => {
    setFilterClient('');
    setFilterContract('');
    setFilterSpec('');
    setDateFrom('');
    setDateTo('');
    setSearch('');
    setFacturaFilter('barchasi');
  };
  const hasFilter = filterClient || filterContract || filterSpec || dateFrom || dateTo || search || facturaFilter !== 'barchasi';

  useModalKeys(!!detail, null, () => setDetail(null));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in">
      {/* Hidden print area */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div ref={printRef}>
          {bulkPrintSales && bulkPrintSales.length > 0 ? (
            <PrintableInvoices sales={bulkPrintSales} company={settings} />
          ) : (
            <PrintableInvoice sale={detail} company={settings} />
          )}
        </div>
      </div>

      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">Savdolar (Yuk xatlari)</h2>
            <p className="text-xs text-[var(--text-3)] mt-0.5">{total} ta yuk xati</p>
          </div>
          <button onClick={inlineForm.toggle}
            className="px-3 py-1.5 bg-[var(--accent)] hover:opacity-90 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition shadow-sm shadow-blue-500/10">
            <Plus size={14} />
            {inlineForm.isOpen ? 'Yopish' : 'Yangi Yuk Xati'}
          </button>
        </div>
      </div>

      {/* Submenu Quick Filters */}
      <div className="flex border-b border-[var(--border)] gap-2">
        {[
          { key: 'barchasi', label: 'Barchasi' },
          { key: 'yuborildi', label: 'Faktura berilgan' },
          { key: 'yuborilmagan', label: 'Faktura berilmagan' }
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setFacturaFilter(t.key)}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all duration-200 -mb-[1px] ${
              facturaFilter === t.key
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-3)] hover:text-[var(--text-2)] hover:border-zinc-300'
            }`}
          >
            {t.label}
          </button>
        ))}
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

      {/* Filters Card */}
      <div className="bg-[var(--surface-2)] p-4 rounded-xl border border-[var(--border)] space-y-3 shadow-sm">
        <div className="flex gap-3 flex-wrap items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] w-4 h-4" />
            <input type="text" placeholder="Yuk xati №, mijoz, sotuvchi..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] outline-none transition text-[var(--text)] placeholder-[var(--text-3)]" />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs outline-none focus:border-[var(--accent)] text-[var(--text)]" title="Dan" />
            <span className="text-xs text-[var(--text-3)]">—</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs outline-none focus:border-[var(--accent)] text-[var(--text)]" title="Gacha" />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={prevMonth} className="px-2.5 py-1.5 bg-[var(--surface)] hover:bg-zinc-100 border border-[var(--border)] rounded-lg text-xs font-semibold text-[var(--text-2)] transition">O'tgan oy</button>
            <button onClick={monthStart} className="px-2.5 py-1.5 bg-[var(--surface)] hover:bg-zinc-100 border border-[var(--border)] rounded-lg text-xs font-semibold text-[var(--text-2)] transition">Oy boshidan</button>
            <button onClick={yearStart} className="px-2.5 py-1.5 bg-[var(--surface)] hover:bg-zinc-100 border border-[var(--border)] rounded-lg text-xs font-semibold text-[var(--text-2)] transition">Yil boshidan</button>
            <button onClick={prevYear} className="px-2.5 py-1.5 bg-[var(--surface)] hover:bg-zinc-100 border border-[var(--border)] rounded-lg text-xs font-semibold text-[var(--text-2)] transition">O'tgan yil</button>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap items-center">
          <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
            className="px-3 py-1.5 border border-[var(--border)] rounded-lg text-xs bg-[var(--surface)] focus:border-[var(--accent)] outline-none transition text-[var(--text)] min-w-40">
            <option value="">Barcha mijozlar</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select value={filterContract} onChange={e => setFilterContract(e.target.value)} disabled={!filterClient}
            className="px-3 py-1.5 border border-[var(--border)] rounded-lg text-xs bg-[var(--surface)] focus:border-[var(--accent)] outline-none transition text-[var(--text)] disabled:opacity-50 min-w-40">
            <option value="">Barcha shartnomalar</option>
            {filterContracts.map(c => <option key={c.id} value={c.id}>№{c.number}</option>)}
          </select>

          <select value={filterSpec} onChange={e => setFilterSpec(e.target.value)} disabled={!filterContract}
            className="px-3 py-1.5 border border-[var(--border)] rounded-lg text-xs bg-[var(--surface)] focus:border-[var(--accent)] outline-none transition text-[var(--text)] disabled:opacity-50 min-w-40">
            <option value="">Barcha spetsifikatsiyalar</option>
            {filterSpecs.map(s => (
              <option key={s.id} value={s.id}>Spets №{s.number} — {fmt(s.totalValue)} so'm</option>
            ))}
          </select>

          {hasFilter && (
            <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700 font-semibold flex items-center gap-1 transition">
              <X size={12} /> Filtrlarni tozalash
            </button>
          )}
          <span className="ml-auto text-xs text-[var(--text-3)]">{total} ta yuk xati topildi</span>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="px-4 py-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={sales.length > 0 && selectedSales.length === sales.length}
                    onChange={toggleSelectAll}
                    className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-400 w-12 text-center">#</th>
                {[
                  { label: 'Sana', col: 'date', align: 'left' },
                  { label: 'Yuk xati №', col: 'nakladnoy', align: 'left font-mono' },
                  { label: 'Mijoz', col: 'client', align: 'left' },
                  { label: 'Shartnoma', col: 'contract', align: 'left' },
                  { label: 'Spets', col: 'spec', align: 'left' },
                  { label: 'Sotuvchi', col: 'sellerName', align: 'left' },
                  { label: 'Faktura', col: 'facturaStatus', align: 'left' },
                  { label: 'Jami Summa', col: 'totalAmount', align: 'right' }
                ].map(({ label, col, align }) => (
                  <th key={label}
                    className={`px-4 py-3 text-${align.split(' ')[0]} text-xs font-semibold select-none uppercase tracking-wider
                      ${col ? 'cursor-pointer hover:text-zinc-700 text-zinc-500' : 'text-zinc-500'}`}
                    onClick={col ? () => toggleSort(col) : undefined}
                  >
                    <span className={`inline-flex items-center gap-1 ${align.includes('right') ? 'justify-end w-full' : ''}`}>
                      {label}
                      {col && (
                        <span className={`text-[10px] ${sortBy === col ? 'text-blue-500 font-bold' : 'text-zinc-300'}`}>
                          {sortBy === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                      )}
                    </span>
                  </th>
                ))}
                <th className="px-4 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(11)].map((_, j) => (
                      <td key={j} className="px-4 py-4">
                        <div className="h-4 bg-zinc-100 animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-zinc-400 text-sm">
                    {hasFilter ? 'Topilmadi' : 'Hozircha yuk xatlari yo\'q'}
                  </td>
                </tr>
              ) : sales.map((s, idx) => (
                <tr key={s.id} className="hover:bg-zinc-50 transition-colors group">
                  <td className="px-4 py-3.5 text-center">
                    <input
                      type="checkbox"
                      checked={selectedSales.includes(s.id)}
                      onChange={() => toggleSelectSale(s.id)}
                      className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3.5 text-center text-sm text-zinc-400 font-medium">
                    {(page - 1) * LIMIT + idx + 1}
                  </td>
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

                  {/* Faktura status column (interactive with position: fixed viewport escaping) */}
                  <td className="px-4 py-3.5 text-sm relative">
                    <div className="inline-block text-left">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (activeStatusDropdown?.id === s.id) {
                            setActiveStatusDropdown(null);
                          } else {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setActiveStatusDropdown({ id: s.id, rect });
                          }
                        }}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 transition ${
                          s.facturaStatus === 'yuborildi'
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                        }`}
                      >
                        {s.facturaStatus === 'yuborildi' ? 'Yuborildi' : 'Yuborilmagan'}
                        <ChevronDown size={11} />
                      </button>

                      {activeStatusDropdown?.id === s.id && activeStatusDropdown.rect && (
                        <>
                          {/* Fullscreen transparent backdrop for robust click-outside detection without bubbling bugs */}
                          <div
                            className="fixed inset-0 z-30 bg-transparent cursor-default"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveStatusDropdown(null);
                            }}
                          />
                          {/* Viewport fixed dropdown: completely escapes overflow auto/hidden container clipping */}
                          <div
                            style={{
                              position: 'fixed',
                              top: activeStatusDropdown.rect.bottom + 4,
                              left: activeStatusDropdown.rect.left,
                              zIndex: 40
                            }}
                            className="bg-white border border-zinc-200 rounded-lg shadow-xl py-1 text-xs w-36 animate-in fade-in duration-100"
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFacturaStatus(s.id, 'yuborildi');
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-zinc-50 flex items-center gap-1.5 text-emerald-700 font-semibold cursor-pointer"
                            >
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                              Yuborildi
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFacturaStatus(s.id, 'yuborilmagan');
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-zinc-50 flex items-center gap-1.5 text-rose-700 font-semibold cursor-pointer"
                            >
                              <span className="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
                              Yuborilmagan
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3.5 text-sm text-right font-bold text-zinc-950">{fmt(s.totalAmount)} UZS</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openDetail(s)}
                        className="p-1.5 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition" title="Ko'rish">
                        <Eye size={14} />
                      </button>
                      <button onClick={() => handleCopyAndAdd(s)}
                        className="p-1.5 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition" title="Nusxa olib qo'shish">
                        <Download size={14} className="rotate-180" />
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
          <Pagination page={page} total={total} limit={LIMIT} onPage={setPage} />
        </div>
      </div>

      {/* Floating Bulk Actions Panel */}
      {selectedSales.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-4 duration-300">
          <span className="text-xs font-semibold text-zinc-300 border-r border-zinc-700 pr-6">
            {selectedSales.length} ta yuk xati belgilandi
          </span>
          <div className="flex items-center gap-3">
            <button onClick={handleBulkPrint} className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-full text-xs font-medium transition">
              <Printer size={13} /> Chop etish
            </button>
            <button onClick={() => handleBulkExport('pdf')} className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-full text-xs font-medium transition text-red-400">
              <FileText size={13} /> PDF Yuklash
            </button>
            <button onClick={() => handleBulkExport('excel')} className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-full text-xs font-medium transition text-emerald-400">
              <FileSpreadsheet size={13} /> Excel Yuklash
            </button>
            <button onClick={() => handleBulkFactura('yuborildi')} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 rounded-full text-xs font-medium transition text-emerald-100">
              <CheckCircle2 size={13} /> Faktura: Yuborildi
            </button>
            <button onClick={() => handleBulkFactura('yuborilmagan')} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-800 hover:bg-red-700 rounded-full text-xs font-medium transition text-red-100">
              <XCircle size={13} /> Faktura: Yuborilmagan
            </button>
            <button onClick={handleBulkDelete} className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-red-650 rounded-full text-xs font-medium transition text-zinc-300 hover:text-white">
              <Trash2 size={13} /> O'chirish
            </button>
          </div>
          <button onClick={() => setSelectedSales([])} className="text-zinc-400 hover:text-white pl-3 border-l border-zinc-700">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Delete single confirm */}
      {delId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <p className="font-semibold text-zinc-900">Yuk xatini o'chirish</p>
            <p className="text-sm text-zinc-500">Bu yuk xati tizimdan butunlay o'chiriladi. Bu amalni qaytarib bo'lmaydi.</p>
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
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
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
                  <div><span className="text-zinc-500">Spetsifikatsiya:</span> <span className="font-medium">№{detail.spec.number}</span></div>
                )}
                <div>
                  <span className="text-zinc-500">Faktura statusi:</span>{' '}
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    detail.facturaStatus === 'yuborildi' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                  }`}>
                    {detail.facturaStatus === 'yuborildi' ? 'Yuborildi' : 'Yuborilmagan'}
                  </span>
                </div>
              </div>
              <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 border-b border-zinc-200">
                    <tr>
                      <th className="px-4 py-2.5 text-center font-semibold text-zinc-500 w-10">#</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-zinc-500">Mahsulot</th>
                      <th className="px-4 py-2.5 text-center font-semibold text-zinc-500">Dona</th>
                      <th className="px-4 py-2.5 text-center font-semibold text-zinc-500">m³</th>
                      <th className="px-4 py-2.5 text-center font-semibold text-zinc-500">kg</th>
                      <th className="px-4 py-2.5 text-center font-semibold text-zinc-500">m²</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-zinc-500">Jami (UZS)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {detail.products?.map((p, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2.5 text-center text-zinc-400">{i + 1}</td>
                        <td className="px-4 py-2.5 font-mono text-xs font-semibold text-zinc-700">
                          {p.product?.article || p.productId?.slice(0, 8)}
                        </td>
                        <td className="px-4 py-2.5 text-center">{p.totalPieces}</td>
                        <td className="px-4 py-2.5 text-center">{p.totalCbm?.toFixed(4)}</td>
                        <td className="px-4 py-2.5 text-center">{p.totalKg?.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-center">{p.totalSqm?.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-zinc-900">{fmt(p.rowAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end">
                <p className="text-lg font-bold text-zinc-950">Jami: {fmt(detail.totalAmount)} UZS</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
