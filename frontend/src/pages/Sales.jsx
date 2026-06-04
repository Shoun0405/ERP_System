import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { downloadFile, openFile } from '../lib/download';
import { useReactToPrint } from 'react-to-print';
import { useModalKeys } from '../hooks/useModalKeys';
import { useInlineForm } from '../hooks/useInlineForm';
import { useSearchOnEnter } from '../hooks/useSearchOnEnter';
import { useDateFilter } from '../context/DateFilterContext';
import Pagination from '../components/Pagination';
import AuditCell from '../components/AuditCell';
import { useUsersLookup } from '../hooks/useUsersLookup';
import { fmt, fmtDate } from '../lib/format';
import {
  Plus, X, Trash2, Package, Eye, Printer,
  FileText, Truck, User, Calendar, Hash, Search,
  Check, RefreshCw, ChevronDown, CheckCircle2, XCircle,
  FileSpreadsheet, Download, Pencil, FileArchive, Globe
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

// Print "Nomi" uchun: "Базальтовая вата 120 кг/м³, 1200x600x50 мм"
function prodFullName(prod) {
  if (!prod) return '';
  const parts = [prod.name];
  if (prod.density != null) parts.push(`${prod.density} кг/м³,`);
  if (prod.length != null && prod.width != null && prod.thickness != null) {
    parts.push(`${prod.length}x${prod.width}x${prod.thickness} мм`);
  }
  return parts.filter(Boolean).join(' ').trim();
}

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
  const price = parseFloat(row.price) || 0; // narx — DOIMO 1 tonna (1000 kg) uchun

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

  // Pul og'irlikdan: summa = (kg / 1000) × narx. Kurs frontendda qo'llanmaydi
  // (kiritish valyutasida ko'rsatiladi; UZS bazaga server o'tkazadi).
  const rowAmount = Math.round((totalKg / 1000) * price);
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
            {['№','Nomi','Dona','m³','kg','m²','Narx','Summa'].map(h => (
              <th key={h} style={th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sale.products?.map((p, i) => (
            <tr key={i}>
              <td style={{ ...td, textAlign: 'center' }}>{i + 1}</td>
              <td style={{ ...td, fontSize: 13, fontWeight: 600 }}>{prodFullName(p.product) || p.product?.article || p.productId?.slice(0, 8)}</td>
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

// ─── ProductRow (ikki qatorli jadval qatori) ─────────────────────────────────
// 1-qator: artikul + Birlik/Miqdor/1 t narxi + Jami.
// 2-qator: rangli o'lchov chiplari (dona/kg/m³/m²) + narx/m³ & narx/m².
function ProductRow({ row, products, onUpdate, onRemove, idx, isUsd, canRemove }) {
  const handleProductChange = (productId) => {
    const p = products.find(x => x.id === productId);
    if (!p) return;
    onUpdate(idx, {
      ...row,
      productId,
      unit: 'dona',
      amount: 0,
      price: p.priceTon || 0, // narx 1 tonna (1000 kg) uchun
      packType: 1,
      totalPieces: 0,
      totalCbm: 0,
      totalKg: 0,
      totalSqm: 0,
      rowAmount: 0
    });
  };

  const handleChange = (field, val) => {
    onUpdate(idx, calculateRowValues({ ...row, [field]: val }, products));
  };

  const s = 'w-full px-2 py-1.5 border border-[var(--border)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none bg-[var(--surface)]';
  const p = products.find(x => x.id === row.productId);
  const cur = isUsd ? 'USD' : "so'm";

  // 1 dona / 1 kg narxi ko'rsatilmaydi (narx 1 tonna uchun berilgan). Faqat m³/m².
  const perSqm = row.totalSqm > 0 ? row.rowAmount / row.totalSqm : 0;
  const perCbm = row.totalCbm > 0 ? row.rowAmount / row.totalCbm : 0;

  return (
    <>
      <tr className="border-t border-[var(--border)]">
        <td className="px-2 py-2 text-center text-xs text-[var(--text-3)] font-medium align-middle">{idx + 1}</td>
        <td className="px-2 py-2 align-middle">
          <select data-testid="row-product" value={row.productId} onChange={e => handleProductChange(e.target.value)} className={`${s} font-semibold`}>
            <option value="">— Mahsulot tanlang —</option>
            {products.map(pr => <option key={pr.id} value={pr.id}>{pr.article}</option>)}
          </select>
        </td>
        <td className="px-2 py-2 w-24 align-middle">
          <select value={row.unit} onChange={e => handleChange('unit', e.target.value)} className={s}>
            <option value="dona">dona</option>
            <option value="kg">kg</option>
            <option value="kv.m">kv.m</option>
            <option value="kub.m">kub.m</option>
          </select>
        </td>
        <td className="px-2 py-2 w-20 align-middle">
          <input data-testid="row-amount" type="number" min="0" step="any" value={row.amount || ''}
            onChange={e => handleChange('amount', e.target.value)} className={s} placeholder="Miqdor" />
        </td>
        <td className="px-2 py-2 w-32 align-middle">
          <input type="number" min="0" value={row.price || ''}
            onChange={e => handleChange('price', e.target.value)} className={s} placeholder="1 tonna narxi" />
        </td>
        <td className="px-3 py-2 w-32 text-right align-middle">
          <span className="text-sm font-bold text-[var(--text)] whitespace-nowrap">
            {fmt(row.rowAmount)} <span className="text-[10px] font-normal text-[var(--text-3)]">{cur}</span>
          </span>
        </td>
        <td className="px-1 py-2 w-8 align-middle">
          {canRemove && (
            <button type="button" onClick={() => onRemove(idx)}
              className="p-1 text-[var(--text-3)] hover:text-red-500 transition"><X size={15} /></button>
          )}
        </td>
      </tr>
      {p && (
        <tr>
          <td></td>
          <td colSpan={6} className="px-2 pb-3 pt-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold bg-[var(--accent-bg)] text-[var(--accent)]">
                <Hash size={11} /> {row.totalPieces} dona
              </span>
              <span className="rounded-md px-2 py-1 text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400">{fmt(row.totalKg)} kg</span>
              <span className="rounded-md px-2 py-1 text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">{Number(row.totalCbm || 0).toFixed(2)} m³</span>
              <span className="rounded-md px-2 py-1 text-xs font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400">{fmt(row.totalSqm)} m²</span>
              <span className="ml-auto flex items-center gap-2">
                <span className="inline-flex items-baseline gap-1.5 rounded-md px-2.5 py-1 bg-[var(--surface-2)] border border-[var(--border)]">
                  <span className="text-[11px] text-[var(--text-3)]">narx/m³</span>
                  <b className="text-sm text-emerald-600 dark:text-emerald-400">{fmt(perCbm)}</b>
                </span>
                <span className="inline-flex items-baseline gap-1.5 rounded-md px-2.5 py-1 bg-[var(--surface-2)] border border-[var(--border)]">
                  <span className="text-[11px] text-[var(--text-3)]">narx/m²</span>
                  <b className="text-sm text-blue-600 dark:text-blue-400">{fmt(perSqm)}</b>
                </span>
              </span>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── SaleForm (inline accordion) ────────────────────────────────────────────
function SaleForm({ onSaved, onCancel, clients, products, editSale = null, initialValues = null }) {
  const editing = Boolean(editSale);

  const [form, setForm] = useState(() => {
    if (editing) {
      return {
        date: editSale.date.slice(0, 10),
        nakladnoy: editSale.nakladnoy,
        sellerName: editSale.sellerName,
        transportNum: editSale.transportNum || '',
        clientId: editSale.clientId,
        contractId: editSale.contractId || '',
        specId: editSale.specId || '',
        exchangeRate: editSale.exchangeRate || '',
        rows: editSale.products?.map(p => ({
          productId: p.productId,
          unit: 'dona',
          amount: p.totalPieces,
          price: p.totalKg > 0 ? Math.round((Number(p.rowAmount) * 1000) / p.totalKg) : 0, // so'm/tonna
          packType: p.packType || 1,
          totalPieces: p.totalPieces,
          totalCbm: p.totalCbm,
          totalKg: p.totalKg,
          totalSqm: p.totalSqm,
          priceCbm: p.priceCbm,
          rowAmount: p.rowAmount
        })) || [{ ...EMPTY_ROW }]
      };
    }
    return {
      date: TODAY,
      nakladnoy: '',
      sellerName: '',
      transportNum: '',
      clientId:   initialValues?.clientId   || '',
      contractId: initialValues?.contractId || '',
      specId:     initialValues?.specId     || '',
      exchangeRate: '',
      rows:       initialValues?.rows       || [{ ...EMPTY_ROW }],
    };
  });

  const [contracts, setContracts] = useState([]);
  const [specs, setSpecs]         = useState([]);
  const [saving, setSaving]       = useState(false);
  const initRef = useRef(false);

  // Load contracts and specifications if initial values or editSale are provided
  useEffect(() => {
    const cid = editing ? editSale.clientId : initialValues?.clientId;
    if (!cid || initRef.current) return;
    initRef.current = true;

    api.get(`/api/contracts?clientId=${cid}&limit=100`)
      .then(r => setContracts(r.data.data || []))
      .catch(() => {});

    const contractId = editing ? editSale.contractId : initialValues?.contractId;
    if (!contractId) return;

    api.get(`/api/specs?contractId=${contractId}`)
      .then(r => {
        const specsData = r.data.data || [];
        setSpecs(specsData);
        if (editing) return; // If editing, we keep the sale rows, do not override
        if (!initialValues?.specId) return;
        const spec = specsData.find(s => s.id === initialValues.specId);
        if (!spec?.products?.length) return;
        if (initialValues.rows) {
          setForm(f => ({ ...f, rows: initialValues.rows }));
        } else {
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
        }
      })
      .catch(() => {});
  }, [editing, editSale, initialValues, products]);

  const totalAmount = form.rows.reduce((s, r) => s + (parseFloat(r.rowAmount) || 0), 0);

  // Pastki yig'indi: jami dona/kg/m³/m² (4-5 mahsulot uchun yuk og'irligi/hajmi)
  const totals = form.rows.reduce((a, r) => ({
    pieces: a.pieces + (Number(r.totalPieces) || 0),
    kg:     a.kg     + (Number(r.totalKg)     || 0),
    cbm:    a.cbm    + (Number(r.totalCbm)    || 0),
    sqm:    a.sqm    + (Number(r.totalSqm)    || 0),
  }), { pieces: 0, kg: 0, cbm: 0, sqm: 0 });

  // Shartnoma valyutasiga qarab USD rejimi (narxlar USD da kiritiladi, kurs majburiy)
  const selectedContract = contracts.find(c => c.id === form.contractId);
  const isUsd = selectedContract?.currency === 'USD';

  // On client selection, fetch contracts and default seller if any attached
  const selectedClient = clients.find(c => c.id === form.clientId);
  const clientSellers = selectedClient?.seller ? selectedClient.seller.split(',').map(s => s.trim()) : [];

  const prevClientId = useRef(editing ? editSale.clientId : (initialValues?.clientId || ''));
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

  const prevContractId = useRef(editing ? editSale.contractId : (initialValues?.contractId || ''));
  useEffect(() => {
    if (prevContractId.current === form.contractId) return;
    prevContractId.current = form.contractId;
    setSpecs([]);
    // Sotuvchi shartnomadan default keladi (tahrirlanadi); shartnoma tozalansa mijozning birinchisi
    const contractSeller = contracts.find(c => c.id === form.contractId)?.seller;
    setForm(f => ({ ...f, specId: '', sellerName: contractSeller || clientSellers[0] || '' }));
    if (!form.contractId) return;
    api.get(`/api/specs?contractId=${form.contractId}`)
      .then(r => setSpecs(r.data.data || []))
      .catch(() => {});
  }, [form.contractId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-fill products from spec
  useEffect(() => {
    if (editing) return; // Never override rows with spec if editing existing sale
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
  }, [form.specId]);

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
    const selContract = contracts.find(c => c.id === form.contractId);
    if (selContract && form.date < selContract.date.slice(0, 10)) {
      return toast.error('Yuk xati sanasi shartnoma sanasidan oldin bo\'lmasligi kerak');
    }
    if (isUsd && (!form.exchangeRate || Number(form.exchangeRate) <= 0)) {
      return toast.error('USD shartnoma uchun kursni kiriting');
    }
    setSaving(true);
    try {
      const payload = {
        date:         form.date,
        nakladnoy:    form.nakladnoy,
        sellerName:   form.sellerName,
        transportNum: form.transportNum || null,
        clientId:     form.clientId,
        contractId:   form.contractId || null,
        specId:       form.specId     || null,
        ...(isUsd ? { exchangeRate: Number(form.exchangeRate) } : {}),
        // C-2: faqat xom kirish — summa/fizik qiymatlarni server hosil qiladi
        products:     form.rows.map(r => ({
          productId: r.productId,
          unit:      r.unit,
          amount:    r.amount,
          price:     r.price,
          packType:  r.packType,
        })),
        facturaStatus: editing ? editSale.facturaStatus : 'yuborilmagan'
      };

      let res;
      if (editing) {
        res = await api.put(`/api/sales/${editSale.id}`, payload);
        toast.success('Yuk xati yangilandi');
      } else {
        res = await api.post('/api/sales', payload);
        toast.success('Yuk xati saqlandi');
      }
      onSaved(res.data);
    } finally { setSaving(false); }
  };

  useModalKeys(!saving, save, onCancel);

  const inp = 'w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none bg-[var(--surface)]';

  return (
    <div data-testid="sale-form" className="mini-card rounded-xl p-5 mb-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text)] flex items-center gap-2">
          <FileText size={15} className="text-[var(--accent)]" /> {editing ? "Yuk Xatini Tahrirlash" : "Yangi Yuk Xati"}
        </h3>
        <button onClick={onCancel} className="text-[var(--text-3)] hover:text-[var(--text)]"><X size={16} /></button>
      </div>

      {/* Basic fields */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-[var(--text-3)] block mb-1"><User size={11} className="inline mr-1"/>Mijoz *</label>
          <select data-testid="sale-client" value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))} className={inp}>
            <option value="">— Tanlang —</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-[var(--text-3)] block mb-1">Shartnoma</label>
          <select data-testid="sale-contract" value={form.contractId}
            onChange={e => setForm(f => ({ ...f, contractId: e.target.value }))}
            disabled={!form.clientId} className={inp}>
            <option value="">— Ixtiyoriy —</option>
            {contracts.map(c => <option key={c.id} value={c.id}>№{c.number}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-[var(--text-3)] block mb-1 flex items-center gap-1">
            Spetsifikatsiya
            {form.contractId && (
              <span className="text-[var(--text-3)] font-normal">(mahsulotlar to'ldiriladi)</span>
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
          <label className="text-xs font-medium text-[var(--text-3)] block mb-1"><Calendar size={11} className="inline mr-1"/>Sana *</label>
          <input type="date" value={form.date}
            min={contracts.find(c => c.id === form.contractId)?.date?.slice(0, 10) || undefined}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inp} />
        </div>

        <div>
          <label className="text-xs font-medium text-[var(--text-3)] block mb-1"><Hash size={11} className="inline mr-1"/>Yuk xati № *</label>
          <input data-testid="sale-nakladnoy" type="text" value={form.nakladnoy} placeholder="НГ-1234"
            onChange={e => setForm(f => ({ ...f, nakladnoy: e.target.value }))} className={inp} />
        </div>

        <div>
          <label className="text-xs font-medium text-[var(--text-3)] block mb-1">Sotuvchi *</label>
          {clientSellers.length > 0 ? (
            <select data-testid="sale-seller" value={form.sellerName} onChange={e => setForm(f => ({ ...f, sellerName: e.target.value }))} className={inp}>
              <option value="">— Sotuvchini tanlang —</option>
              {clientSellers.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <input data-testid="sale-seller" type="text" value={form.sellerName} placeholder="F.I.O."
              onChange={e => setForm(f => ({ ...f, sellerName: e.target.value }))} className={inp} />
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-[var(--text-3)] block mb-1"><Truck size={11} className="inline mr-1"/>Transport</label>
          <input type="text" value={form.transportNum} placeholder="01 A 123 BC"
            onChange={e => setForm(f => ({ ...f, transportNum: e.target.value }))} className={inp} />
        </div>

        {isUsd && (
          <div>
            <label className="text-xs font-medium text-[var(--text-3)] block mb-1">Kurs (USD→UZS) *</label>
            <input type="number" min="0" step="any" value={form.exchangeRate} placeholder="12700"
              onChange={e => setForm(f => ({ ...f, exchangeRate: e.target.value }))} className={inp} />
            <p className="text-[10px] text-[var(--accent)] mt-1">Narxlar USD da kiritiladi</p>
          </div>
        )}
      </div>

      {/* Products table (ikki qatorli) */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-semibold text-[var(--text-2)] flex items-center gap-2">
            <Package size={14} className="text-[var(--accent)]" /> Mahsulotlar <span className="text-[var(--text-3)] font-normal">({form.rows.length})</span>
          </p>
          <button type="button" onClick={addRow}
            className="text-xs text-[var(--accent)] hover:opacity-80 font-medium flex items-center gap-1">
            <Plus size={13} /> Qator qo'shish
          </button>
        </div>
        <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--surface)]">
          <table className="w-full">
            <thead className="bg-[var(--surface-2)] border-b border-[var(--border)]">
              <tr>
                <th className="px-2 py-2 w-8 text-center text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wide">#</th>
                <th className="px-2 py-2 text-left text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wide">Mahsulot</th>
                <th className="px-2 py-2 w-24 text-left text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wide">Birlik</th>
                <th className="px-2 py-2 w-20 text-left text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wide">Miqdor</th>
                <th className="px-2 py-2 w-32 text-left text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wide">1 t narxi</th>
                <th className="px-3 py-2 w-32 text-right text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wide">Jami</th>
                <th className="px-1 py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {form.rows.map((row, idx) => (
                <ProductRow key={idx} idx={idx} row={row} products={products}
                  onUpdate={updateRow} onRemove={removeRow}
                  isUsd={isUsd} canRemove={form.rows.length > 1} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pastki yig'indi: jami dona/kg/m³/m² + summa */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-[var(--text-2)]">Jami:</span>
          <span className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-sm font-bold bg-[var(--accent-bg)] text-[var(--accent)]"><Hash size={12} /> {fmt(totals.pieces)} dona</span>
          <span className="rounded-md px-2.5 py-1 text-sm font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400">{fmt(totals.kg)} kg</span>
          <span className="rounded-md px-2.5 py-1 text-sm font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">{totals.cbm.toFixed(2)} m³</span>
          <span className="rounded-md px-2.5 py-1 text-sm font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400">{fmt(totals.sqm)} m²</span>
        </div>
        <div className="rounded-lg px-5 py-2 text-right" style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}>
          <p className="text-[11px] opacity-80 leading-none mb-0.5">Jami summa</p>
          {isUsd ? (
            <>
              <p className="text-lg font-bold leading-none">{fmt(totalAmount)} <span className="text-xs font-normal opacity-80">USD</span></p>
              {Number(form.exchangeRate) > 0 && (
                <p className="text-[11px] font-normal opacity-80 mt-0.5">≈ {fmt(totalAmount * Number(form.exchangeRate))} UZS</p>
              )}
            </>
          ) : (
            <p className="text-lg font-bold leading-none">{fmt(totalAmount)} <span className="text-xs font-normal opacity-80">UZS</span></p>
          )}
        </div>
      </div>

      {/* Tugmalar */}
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-[var(--text-2)] hover:bg-[var(--surface-2)] rounded-md">
          Bekor (Esc)
        </button>
        <button onClick={save} disabled={saving}
          className="px-6 py-2 btn-primary disabled:opacity-60 text-sm font-medium rounded-md flex items-center gap-2">
          {saving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
          {editing ? "Yangilash" : "Yuk xatini saqlash"}
        </button>
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function Sales({ user }) {
  const canCreate = user?.role === 'admin' || user?.permissions?.sales?.create !== false;
  const canUpdate = user?.role === 'admin' || user?.permissions?.sales?.update !== false;
  const canDelete = user?.role === 'admin' || user?.permissions?.sales?.delete === true;
  const canHardDelete = user?.role === 'superAdmin';
  const location = useLocation();
  const navigate  = useNavigate();

  const auditUsers = useUsersLookup();

  const [sales,   setSales]   = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const LIMIT = 50;

  const [clients,  setClients]  = useState([]);
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading,  setLoading]  = useState(true);

  const { text: search, query: debouncedSearch, reset: resetSearch, inputProps: searchInput } = useSearchOnEnter('', () => setPage(1));
  const [filterClient,    setFilterClient]   = useState('');
  const [filterContract,  setFilterContract] = useState('');
  const [filterSpec,      setFilterSpec]     = useState('');
  const [filterContracts, setFilterContracts] = useState([]);
  const [filterSpecs,     setFilterSpecs]     = useState([]);
  const { from: dateFrom, to: dateTo } = useDateFilter();
  const [facturaFilter,   setFacturaFilter]   = useState('barchasi');
  const [currencyTab,     setCurrencyTab]     = useState('UZS');

  const [detail,        setDetail]        = useState(null);
  const [delId,         setDelId]         = useState(null);
  const [initialValues, setInitialValues] = useState(null);
  const [editSale,      setEditSale]      = useState(null);

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
  const [bulkDelOpen, setBulkDelOpen] = useState(false);

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

  useEffect(() => { setPage(1); }, [filterClient, filterContract, filterSpec, dateFrom, dateTo, facturaFilter, currencyTab]);

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
      currency: currencyTab,
      sortBy,
      sortDir
    };
    api.get('/api/sales', { params })
      .then(r => { setSales(r.data.data); setTotal(r.data.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, debouncedSearch, filterClient, filterContract, filterSpec, dateFrom, dateTo, facturaFilter, currencyTab, sortBy, sortDir]);

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
    if (editSale) {
      setSales(prev => prev.map(s => s.id === saved.id ? saved : s));
      setEditSale(null);
    } else {
      setSales(prev => [saved, ...prev]);
      setTotal(t => t + 1);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/api/sales/${delId}`);
      setDelId(null);
      fetchSales();
      toast.success('Yuk xati o\'chirildi');
    } catch { /* Toast handled by interceptor */ }
  };

  const handleRestore = async (rec) => {
    try { await api.post(`/api/sales/${rec.id}/restore`); toast.success('Tiklandi'); fetchSales(); }
    catch { /* interceptor toast */ }
  };
  const handleHardDelete = async (rec) => {
    if (!window.confirm('Butunlay o\'chirilsinmi? Bu amalni qaytarib bo\'lmaydi.')) return;
    try { await api.delete(`/api/sales/${rec.id}/hard`); toast.success('Butunlay o\'chirildi'); fetchSales(); }
    catch { /* interceptor toast */ }
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
    const currentPageIds = sales.map(s => s.id);
    const allSelectedOnCurrentPage = currentPageIds.every(id => selectedSales.includes(id));
    if (allSelectedOnCurrentPage) {
      setSelectedSales(prev => prev.filter(id => !currentPageIds.includes(id)));
    } else {
      setSelectedSales(prev => {
        const next = [...prev];
        currentPageIds.forEach(id => {
          if (!next.includes(id)) next.push(id);
        });
        return next;
      });
    }
  };

  // Bulk Actions Handlers
  const handleBulkDelete = async () => {
    try {
      await api.post('/api/sales/bulk-delete', { ids: selectedSales });
      toast.success("Yuk xatlari o'chirildi");
      setSelectedSales([]);
      setBulkDelOpen(false);
      fetchSales();
    } catch { /* interceptor shows toast */ }
  };

  const handleBulkFactura = async (status) => {
    try {
      await api.post('/api/sales/bulk-factura', { ids: selectedSales, status });
      toast.success("Faktura holatlari yangilandi");
      setSelectedSales([]);
      fetchSales();
    } catch { /* interceptor shows toast */ }
  };

  const handleBulkPrint = async () => {
    if (selectedSales.length === 0) return;
    setLoading(true);
    try {
      const detailedSales = await Promise.all(
        selectedSales.map(id => api.get(`/api/sales/${id}`).then(r => r.data))
      );
      setBulkPrintSales(detailedSales);
    } catch {
      toast.error("Ommaviy yuk xatlarini chop etish uchun yuklashda xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkExport = (type) => {
    if (selectedSales.length === 0) return;
    const url = `/api/export/sales/${type}?ids=${selectedSales.join(',')}`;
    if (type === 'pdf') {
      openFile(url);
    } else {
      const ext = type === 'zip' ? 'zip' : 'xlsx';
      downloadFile(url, `savdolar-hisoboti.${ext}`);
    }
  };

  // Nusxa olib qo'shish (Copy & Add) handler
  const handleCopyAndAdd = async (sale) => {
    setLoading(true);
    try {
      // Securely fetch full product line details on-demand
      const fullSale = await api.get(`/api/sales/${sale.id}`).then(r => r.data);
      setInitialValues({
        clientId: fullSale.clientId,
        contractId: fullSale.contractId || '',
        specId: fullSale.specId || '',
        rows: fullSale.products?.map(p => ({
          productId: p.productId,
          unit: 'dona',
          amount: p.totalPieces,
          price: p.totalKg > 0 ? Math.round((Number(p.rowAmount) * 1000) / p.totalKg) : 0, // so'm/tonna
          packType: p.packType || 1,
          totalPieces: p.totalPieces,
          totalCbm: p.totalCbm,
          totalKg: p.totalKg,
          totalSqm: p.totalSqm,
          priceCbm: p.priceCbm,
          rowAmount: p.rowAmount
        })) || [{ ...EMPTY_ROW }]
      });
      inlineForm.open();
    } catch {
      toast.error("Yuk xatini nusxalashda xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
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
    resetSearch();
    setFacturaFilter('barchasi');
  };
  const hasFilter = filterClient || filterContract || filterSpec || search || facturaFilter !== 'barchasi';

  useModalKeys(!!detail, null, () => setDetail(null));
  useModalKeys(bulkDelOpen, handleBulkDelete, () => setBulkDelOpen(false));

  // USD rejimida 2 ta qo'shimcha ustun (Kurs, USD jami) bo'ladi
  const tableColSpan = currencyTab === 'USD' ? 15 : 13;

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

      {/* Combined Header & Sleek Filters Control Center */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-5 transition-all duration-300">
        
        {/* Left Side: Title & Action Button */}
        <div className="flex items-center gap-4 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-[var(--text)] tracking-tight">Savdolar</h2>
            <p className="text-[11px] font-semibold text-[var(--text-3)]">{total} ta yuk xati</p>
          </div>
          {canCreate && (
            <button onClick={inlineForm.toggle}
              className="px-3.5 py-2 btn-primary rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 shadow-sm cursor-pointer hover:scale-[1.02] active:scale-[0.98]">
              <Plus size={16} strokeWidth={2.2} />
              {inlineForm.isOpen ? 'Yopish' : 'Yangi Yuk Xati'}
            </button>
          )}
        </div>

        {/* Right Side: Ultra-compact, Artistic Filters Toolbar */}
        <div className="flex flex-wrap items-center gap-3 xl:justify-end flex-1 min-w-0">
          
          {/* Search bar */}
          <div className="relative w-full sm:w-48 shrink-0">
            <Search size={16} strokeWidth={2.2} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
            <input type="text" placeholder="Qidirish (Enter)..." {...searchInput}
              className="w-full pl-9 pr-4 py-1.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl text-xs focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] outline-none transition text-[var(--text)] placeholder-[var(--text-3)]" />
          </div>

          {/* Cascading Dropdowns */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
              className="px-2.5 py-1.5 border border-[var(--border)] rounded-xl text-xs bg-[var(--surface)] focus:border-[var(--accent)] outline-none transition text-[var(--text-2)] max-w-[130px] font-semibold cursor-pointer">
              <option value="">Mijozlar</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <select value={filterContract} onChange={e => setFilterContract(e.target.value)} disabled={!filterClient}
              className="px-2.5 py-1.5 border border-[var(--border)] rounded-xl text-xs bg-[var(--surface)] focus:border-[var(--accent)] outline-none transition text-[var(--text-2)] disabled:opacity-50 max-w-[130px] font-semibold cursor-pointer">
              <option value="">Shartnomalar</option>
              {filterContracts.map(c => <option key={c.id} value={c.id}>№{c.number}</option>)}
            </select>

            <select value={filterSpec} onChange={e => setFilterSpec(e.target.value)} disabled={!filterContract}
              className="px-2.5 py-1.5 border border-[var(--border)] rounded-xl text-xs bg-[var(--surface)] focus:border-[var(--accent)] outline-none transition text-[var(--text-2)] disabled:opacity-50 max-w-[130px] font-semibold cursor-pointer">
              <option value="">Spetsifikatsiyalar</option>
              {filterSpecs.map(s => (
                <option key={s.id} value={s.id}>Spets №{s.number}</option>
              ))}
            </select>
          </div>

          {/* Clear button */}
          {hasFilter && (
            <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-0.5 transition shrink-0 cursor-pointer">
              <X size={13} /> Tozalash
            </button>
          )}
        </div>
      </div>

      {/* Submenu Quick Filters */}
      <div className="flex items-center border-b border-[var(--border)] gap-2">
        {[
          { key: 'barchasi', label: 'Barchasi' },
          { key: 'yuborildi', label: 'Faktura berilgan' },
          { key: 'yuborilmagan', label: 'Faktura berilmagan' }
        ].map(t => (
          <button
            key={t.key}
            onClick={() => { setCurrencyTab('UZS'); setFacturaFilter(t.key); }}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all duration-200 -mb-[1px] ${
              currencyTab === 'UZS' && facturaFilter === t.key
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-3)] hover:text-[var(--text)] hover:border-[var(--border)]'
            }`}
          >
            {t.label}
          </button>
        ))}
        {/* Eksport (USD) — valyuta ko'rinishi, faktura filtrlari yonida */}
        <button
          onClick={() => { setCurrencyTab('USD'); setFacturaFilter('barchasi'); }}
          className={`ml-auto px-4 py-2 text-xs font-semibold border-b-2 transition-all duration-200 -mb-[1px] flex items-center gap-1.5 ${
            currencyTab === 'USD'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-3)] hover:text-[var(--text)] hover:border-[var(--border)]'
          }`}
        >
          <Globe size={13} /> Eksport (USD)
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



      {/* Aggregates Summary Cards */}
      {(() => {
        let totalAmount = 0;
        let totalCbm = 0;
        let totalKg = 0;
        let totalSqm = 0;

        sales.forEach(s => {
          totalAmount += s.totalAmount || 0;
          s.products?.forEach(p => {
            totalCbm += p.totalCbm || 0;
            totalKg += p.totalKg || 0;
            totalSqm += p.totalSqm || 0;
          });
        });

        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-300">
            {/* Jami Summa */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-sm flex items-center gap-3 transition-all duration-200 hover:shadow-md hover:scale-[1.01]">
              <span className="p-2.5 rounded-lg bg-[var(--accent-bg)] text-[var(--accent)] shrink-0 flex items-center justify-center">
                <FileSpreadsheet size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-3)]">Jami Summa</p>
                <p className="text-sm md:text-base font-bold text-[var(--text)] truncate">{fmt(totalAmount)} UZS</p>
              </div>
            </div>

            {/* Jami Kub */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-sm flex items-center gap-3 transition-all duration-200 hover:shadow-md hover:scale-[1.01]">
              <span className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 shrink-0 flex items-center justify-center">
                <Package size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-3)]">Jami Hajm (Kub.m)</p>
                <p className="text-sm md:text-base font-bold text-[var(--text)] truncate">{totalCbm.toFixed(2)} m³</p>
              </div>
            </div>

            {/* Jami Og'irlik */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-sm flex items-center gap-3 transition-all duration-200 hover:shadow-md hover:scale-[1.01]">
              <span className="p-2.5 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400 shrink-0 flex items-center justify-center">
                <Truck size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-3)]">Jami Og'irlik (Kg)</p>
                <p className="text-sm md:text-base font-bold text-[var(--text)] truncate">
                  {Math.round(totalKg).toLocaleString('ru-RU')} kg
                </p>
              </div>
            </div>

            {/* Jami Kvadrat */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-sm flex items-center gap-3 transition-all duration-200 hover:shadow-md hover:scale-[1.01]">
              <span className="p-2.5 rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-400 shrink-0 flex items-center justify-center">
                <FileText size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-3)]">Jami Yuza (Kv.m)</p>
                <p className="text-sm md:text-base font-bold text-[var(--text)] truncate">
                  {Math.round(totalSqm).toLocaleString('ru-RU')} m²
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Table Card */}
      <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                <th className="px-4 py-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={sales.length > 0 && sales.every(s => selectedSales.includes(s.id))}
                    onChange={toggleSelectAll}
                    className="rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-[var(--text-3)] w-12 text-center">#</th>
                {[
                  { label: 'Sana', col: 'date', align: 'left w-24' },
                  { label: 'Yuk xati №', col: 'nakladnoy', align: 'left font-mono w-28' },
                  { label: 'Mijoz', col: 'client', align: 'left w-44' },
                  { label: 'Mahsulotlar', col: null, align: 'left' },
                  { label: 'Shartnoma', col: 'contract', align: 'left text-xs' },
                  { label: 'Spets', col: 'spec', align: 'left text-xs' },
                  { label: 'Sotuvchi', col: 'sellerName', align: 'left text-xs text-[var(--text-3)]' },
                  { label: 'Faktura', col: 'facturaStatus', align: 'left text-xs' },
                  { label: 'Jami Summa', col: 'totalAmount', align: 'right font-bold' }
                ].map(({ label, col, align }) => (
                  <th key={label}
                    className={`px-4 py-3 text-${align.split(' ')[0]} text-xs font-semibold select-none uppercase tracking-wider
                      ${col ? 'cursor-pointer hover:text-[var(--text)] text-[var(--text-3)]' : 'text-[var(--text-3)]'}`}
                    onClick={col ? () => toggleSort(col) : undefined}
                  >
                    <span className={`inline-flex items-center gap-1 ${align.includes('right') ? 'justify-end w-full' : ''}`}>
                      {label}
                      {col && (
                        <span className={`text-[10px] ${sortBy === col ? 'text-[var(--accent)] font-bold' : 'text-[var(--text-3)]'}`}>
                          {sortBy === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                      )}
                    </span>
                  </th>
                ))}
                {currencyTab === 'USD' && (
                  <>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider whitespace-nowrap">Kurs</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider whitespace-nowrap">USD jami</th>
                  </>
                )}
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider whitespace-nowrap">Kim / Qachon</th>
                <th className="px-4 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(tableColSpan)].map((_, j) => (
                      <td key={j} className="px-4 py-4">
                        <div className="h-4 bg-[var(--surface-2)] animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={tableColSpan} className="px-4 py-12 text-center text-[var(--text-3)] text-sm">
                    {hasFilter ? 'Topilmadi' : 'Hozircha yuk xatlari yo\'q'}
                  </td>
                </tr>
              ) : sales.map((s, idx) => (
                <tr key={s.id} className={`hover:bg-[var(--surface-2)] transition-colors group${s.deletedAt?' opacity-60 bg-red-50 dark:bg-red-950/20':''}`}>
                  <td className="px-4 py-3.5 text-center">
                    <input
                      type="checkbox"
                      checked={selectedSales.includes(s.id)}
                      onChange={() => toggleSelectSale(s.id)}
                      className="rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3.5 text-center text-sm text-[var(--text-3)] font-medium">
                    {(page - 1) * LIMIT + idx + 1}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-[var(--text-2)]">{fmtDate(s.date)}</td>
                  <td className="px-4 py-3.5 text-sm font-semibold text-[var(--text)] font-mono">{s.nakladnoy}</td>
                  <td className="px-4 py-3.5 text-sm text-[var(--text-2)]">{s.client?.name}</td>
                  
                  {/* Mahsulotlar Column with Badges */}
                  <td className="px-4 py-3.5 text-sm">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {s.products?.map((p, pIdx) => (
                        <span key={pIdx} className="inline-flex items-center gap-1 text-[10px] bg-[var(--surface-2)] border border-[var(--border)] px-1.5 py-0.5 rounded font-mono text-[var(--text)] whitespace-nowrap shadow-sm">
                          <Package size={10} className="text-[var(--accent)] shrink-0" />
                          <span>{p.product?.article || p.productId?.slice(0, 8)}</span>
                          <span className="text-[var(--text-3)] font-semibold">({p.totalPieces} dona)</span>
                        </span>
                      ))}
                    </div>
                  </td>

                  <td className="px-4 py-3.5 text-sm">
                    {s.contract ? (
                      <span className="font-mono text-xs bg-[var(--surface-2)] text-[var(--text-2)] px-1.5 py-0.5 rounded">
                        №{s.contract.number}
                      </span>
                    ) : <span className="text-[var(--text-3)]">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-sm">
                    {s.spec ? (
                      <span className="text-xs bg-[var(--accent-bg)] text-[var(--accent)] px-1.5 py-0.5 rounded">
                        №{s.spec.number}
                      </span>
                    ) : <span className="text-[var(--text-3)]">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-[var(--text-3)]">{s.sellerName}</td>

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
                            className="bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-xl py-1 text-xs w-36 animate-in fade-in duration-100"
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFacturaStatus(s.id, 'yuborildi');
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-[var(--surface-2)] flex items-center gap-1.5 text-emerald-700 font-semibold cursor-pointer"
                            >
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                              Yuborildi
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFacturaStatus(s.id, 'yuborilmagan');
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-[var(--surface-2)] flex items-center gap-1.5 text-rose-700 font-semibold cursor-pointer"
                            >
                              <span className="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
                              Yuborilmagan
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3.5 text-sm text-right">
                    <div className="font-bold text-[var(--text)]">{fmt(s.totalAmount)} UZS</div>
                    {(() => {
                      const totalCbm = s.products?.reduce((sum, p) => sum + (p.totalCbm || 0), 0) || 0;
                      const totalKg  = s.products?.reduce((sum, p) => sum + (p.totalKg  || 0), 0) || 0;
                      const totalSqm = s.products?.reduce((sum, p) => sum + (p.totalSqm || 0), 0) || 0;
                      if (totalCbm === 0 && totalKg === 0 && totalSqm === 0) return null;
                      return (
                        <div className="text-[10px] text-[var(--text-3)] font-normal mt-0.5 whitespace-nowrap">
                          {totalCbm > 0 && `${totalCbm.toFixed(2)} m³`}
                          {totalKg > 0 && `${totalCbm > 0 ? ' | ' : ''}${Math.round(totalKg).toLocaleString('ru-RU')} kg`}
                          {totalSqm > 0 && `${(totalCbm > 0 || totalKg > 0) ? ' | ' : ''}${Math.round(totalSqm).toLocaleString('ru-RU')} m²`}
                        </div>
                      );
                    })()}
                  </td>
                  {currencyTab === 'USD' && (
                    <>
                      <td className="px-4 py-3.5 text-sm text-right font-mono text-[var(--text-2)]">
                        {s.exchangeRate ? fmt(s.exchangeRate) : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-right font-bold text-[var(--text)]">
                        {fmt(s.exchangeRate ? s.totalAmount / s.exchangeRate : 0)} <span className="text-[10px] font-normal text-[var(--text-3)]">USD</span>
                      </td>
                    </>
                  )}
                  <td className="px-4 py-3.5"><AuditCell record={s} users={auditUsers}/></td>
                  <td className="px-4 py-3.5">
                    {s.deletedAt ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-[10px] text-red-500 font-semibold">O'chirilgan</span>
                        {canHardDelete && (
                          <>
                            <button onClick={() => handleRestore(s)} className="text-[10px] text-[var(--accent)] font-semibold hover:underline px-1" title="Tiklash">Tiklash</button>
                            <button onClick={() => handleHardDelete(s)} className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition" title="Butunlay o'chirish">
                              <Trash2 size={15} strokeWidth={1.8} />
                            </button>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openDetail(s)}
                          className="p-1.5 text-[var(--text-3)] hover:text-[var(--accent)] hover:bg-[var(--accent-bg)] rounded-md transition" title="Ko'rish">
                          <Eye size={15} strokeWidth={1.8} />
                        </button>
                        {canUpdate && (
                          <button onClick={() => setEditSale(s)}
                            className="p-1.5 text-[var(--text-3)] hover:text-[var(--accent)] hover:bg-[var(--accent-bg)] rounded-md transition" title="Tahrirlash">
                            <Pencil size={15} strokeWidth={1.8} />
                          </button>
                        )}
                        {canCreate && (
                          <button onClick={() => handleCopyAndAdd(s)}
                            className="p-1.5 text-[var(--text-3)] hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition" title="Nusxa olib qo'shish">
                            <Download size={15} strokeWidth={1.8} className="rotate-180" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => setDelId(s.id)}
                            className="p-1.5 text-[var(--text-3)] hover:text-red-600 hover:bg-red-50 rounded-md transition" title="O'chirish">
                            <Trash2 size={15} strokeWidth={1.8} />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-[var(--border)]">
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
            <button onClick={() => handleBulkExport('zip')} className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-full text-xs font-medium transition text-amber-400">
              <FileArchive size={13} /> ZIP (PDF) Yuklash
            </button>
            <button onClick={() => handleBulkFactura('yuborildi')} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 rounded-full text-xs font-medium transition text-emerald-100">
              <CheckCircle2 size={13} /> Faktura: Yuborildi
            </button>
            <button onClick={() => handleBulkFactura('yuborilmagan')} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-800 hover:bg-red-700 rounded-full text-xs font-medium transition text-red-100">
              <XCircle size={13} /> Faktura: Yuborilmagan
            </button>
            {canDelete && (
              <button onClick={() => setBulkDelOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-red-700 rounded-full text-xs font-medium transition text-zinc-300 hover:text-white">
                <Trash2 size={13} /> O'chirish
              </button>
            )}
          </div>
          <button onClick={() => setSelectedSales([])} className="text-zinc-400 hover:text-white pl-3 border-l border-zinc-700">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Delete single confirm */}
      {delId && (
        <div className="modal-overlay">
          <div className="modal-card p-6 w-full max-w-sm space-y-4">
            <p className="font-semibold text-[var(--text)]">Yuk xatini o'chirish</p>
            <p className="text-sm text-[var(--text-3)]">Bu yuk xati tizimdan butunlay o'chiriladi. Bu amalni qaytarib bo'lmaydi.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDelId(null)}
                className="px-3 py-2 text-sm border border-[var(--border)] rounded-md hover:bg-[var(--surface-2)]">Bekor</button>
              <button onClick={handleDelete}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700">O'chirish</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk delete confirm */}
      {bulkDelOpen && (
        <div className="modal-overlay">
          <div className="modal-card p-6 w-full max-w-sm space-y-4">
            <p className="font-semibold text-[var(--text)]">{selectedSales.length} ta yuk xatini o'chirish</p>
            <p className="text-sm text-[var(--text-3)]">Belgilangan {selectedSales.length} ta yuk xati tizimdan butunlay o'chiriladi. Bu amalni qaytarib bo'lmaydi.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setBulkDelOpen(false)}
                className="px-3 py-2 text-sm border border-[var(--border)] rounded-md hover:bg-[var(--surface-2)]">Bekor</button>
              <button onClick={handleBulkDelete}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700">O'chirish</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <div className="modal-overlay">
          <div className="modal-card w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-[var(--border)] flex justify-between items-center sticky top-0 bg-[var(--surface)]">
              <h3 className="text-lg font-bold text-[var(--text)]">Yuk xati: {detail.nakladnoy}</h3>
              <div className="flex items-center gap-2">
                <button onClick={handlePrint}
                  className="px-3 py-1.5 text-sm font-medium border border-[var(--border)] rounded-md hover:bg-[var(--surface-2)] flex items-center gap-1.5">
                  <Printer size={14} /> Chop etish
                </button>
                <button onClick={() => setDetail(null)}
                  className="text-[var(--text-3)] hover:text-[var(--text)] p-1 rounded-md hover:bg-[var(--surface-2)]">
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-[var(--text-3)]">Mijoz:</span> <span className="font-medium">{detail.client?.name}</span></div>
                <div><span className="text-[var(--text-3)]">Sana:</span> <span className="font-medium">{fmtDate(detail.date)}</span></div>
                <div><span className="text-[var(--text-3)]">Sotuvchi:</span> <span className="font-medium">{detail.sellerName}</span></div>
                <div><span className="text-[var(--text-3)]">Transport:</span> <span className="font-medium">{detail.transportNum || '—'}</span></div>
                {detail.contract && (
                  <div><span className="text-[var(--text-3)]">Shartnoma:</span> <span className="font-mono font-medium">№{detail.contract.number}</span></div>
                )}
                {detail.spec && (
                  <div><span className="text-[var(--text-3)]">Spetsifikatsiya:</span> <span className="font-medium">№{detail.spec.number}</span></div>
                )}
                <div>
                  <span className="text-[var(--text-3)]">Faktura statusi:</span>{' '}
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    detail.facturaStatus === 'yuborildi' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                  }`}>
                    {detail.facturaStatus === 'yuborildi' ? 'Yuborildi' : 'Yuborilmagan'}
                  </span>
                </div>
              </div>
              <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--surface)]">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                    <tr>
                      <th className="px-4 py-2.5 text-center font-semibold text-[var(--text-3)] w-10">#</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-[var(--text-3)]">Mahsulot</th>
                      <th className="px-4 py-2.5 text-center font-semibold text-[var(--text-3)]">Dona</th>
                      <th className="px-4 py-2.5 text-center font-semibold text-[var(--text-3)]">m³</th>
                      <th className="px-4 py-2.5 text-center font-semibold text-[var(--text-3)]">kg</th>
                      <th className="px-4 py-2.5 text-center font-semibold text-[var(--text-3)]">m²</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-[var(--text-3)]">Jami (UZS)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {detail.products?.map((p, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2.5 text-center text-[var(--text-3)]">{i + 1}</td>
                        <td className="px-4 py-2.5 font-mono text-xs font-semibold text-[var(--text-2)]">
                          {p.product?.article || p.productId?.slice(0, 8)}
                        </td>
                        <td className="px-4 py-2.5 text-center">{p.totalPieces}</td>
                        <td className="px-4 py-2.5 text-center">{p.totalCbm?.toFixed(4)}</td>
                        <td className="px-4 py-2.5 text-center">{p.totalKg?.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-center">{p.totalSqm?.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-[var(--text)]">{fmt(p.rowAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end">
                <p className="text-lg font-bold text-[var(--text)]">Jami: {fmt(detail.totalAmount)} UZS</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Sale Popup Modal */}
      {editSale && (
        <div className="modal-overlay">
          <div className="modal-card w-full max-w-5xl overflow-hidden animate-in">
            <div className="max-h-[85vh] overflow-y-auto p-6">
              <SaleForm
                onSaved={handleSaved}
                onCancel={() => setEditSale(null)}
                clients={clients}
                products={products}
                editSale={editSale}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
