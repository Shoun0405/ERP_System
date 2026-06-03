import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, ChevronDown, ChevronRight, MoreVertical, Pencil, Trash2,
  FileText, FileType, FileDown, FileSpreadsheet, X, Check, AlertTriangle,
  ShoppingCart, RefreshCw, Search, Printer, Copy
} from 'lucide-react';
import toast from 'react-hot-toast';
import api, { API } from '../lib/api';
import { downloadFile, openFile } from '../lib/download';
import { fmt, fmtDate } from '../lib/format';
import { calcRowTotal, calcVat, VAT_RATE } from '../lib/vat';
import { useInlineForm } from '../hooks/useInlineForm';
import { useModalKeys } from '../hooks/useModalKeys';
import { useSearchOnEnter } from '../hooks/useSearchOnEnter';
import { useDateFilter } from '../context/DateFilterContext';
import Pagination from '../components/Pagination';

const STATUS_LABELS = { yangi: 'Yangi', amalda: 'Amalda', yopilgan: 'Yopilgan' };
const STATUS_COLORS = {
  yangi:    'bg-[oklch(0.96_0.03_250)] text-[var(--accent)] border-[oklch(0.88_0.05_250)] border',
  amalda:   'bg-[oklch(0.96_0.04_155)] text-[oklch(0.38_0.10_155)] border-[oklch(0.88_0.06_155)] border',
  yopilgan: 'bg-[var(--surface-2)] text-[var(--text-3)] border border-[var(--border)]',
};
const UNITS = ['kv.m', 'kub.m', 'kg'];
const TODAY = new Date().toISOString().slice(0, 10);

// ─── QuickAddClientModal ────────────────────────────────────────────────────
function QuickAddClientModal({ onSaved, onClose }) {
  const [form, setForm] = useState({ name: '', inn: '' });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name.trim()) return toast.error('Nom majburiy');
    setSaving(true);
    try {
      const { data } = await api.post('/api/clients', { name: form.name, inn: form.inn || '' });
      toast.success('Mijoz qo\'shildi');
      onSaved(data);
    } finally { setSaving(false); }
  };

  useModalKeys(true, save, onClose);

  return (
    <div className="modal-overlay">
      <div className="modal-card p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-[var(--text)]">Yangi mijoz</h3>
          <button onClick={onClose} className="text-[var(--text-3)] hover:text-[var(--text-2)]"><X size={18} /></button>
        </div>
        <input
          autoFocus placeholder="Mijoz nomi *"
          value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none"
        />
        <input
          placeholder="INN"
          value={form.inn} onChange={e => setForm(f => ({ ...f, inn: e.target.value }))}
          className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-2 text-sm text-[var(--text-2)] hover:bg-[var(--surface-2)] rounded-md">Bekor</button>
          <button onClick={save} disabled={saving}
            className="px-4 py-2 text-sm btn-primary rounded-md disabled:opacity-60">
            {saving ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SpecProductRow ─────────────────────────────────────────────────────────
function SpecProductRow({ row, products, vatRate = VAT_RATE, onChange, onRemove }) {
  const rowTotal = calcRowTotal(Number(row.quantity) || 0, Number(row.unitPriceVat) || 0);
  const vatAmt   = calcVat(rowTotal, vatRate);

  const update = (field, val) => onChange({ ...row, [field]: val });

  return (
    <tr className="border-t border-[var(--border)]">
      <td className="py-2 pr-2">
        <select
          value={row.productId}
          onChange={e => update('productId', e.target.value)}
          className="w-full border border-[var(--border)] rounded px-2 py-1.5 text-xs focus:ring-2 focus:ring-[var(--accent)] outline-none"
        >
          <option value="">— Mahsulot —</option>
          {products.map(p => (
            <option key={p.id} value={p.id}>{p.article}</option>
          ))}
        </select>
      </td>
      <td className="py-2 pr-2">
        <select
          value={row.unit}
          onChange={e => update('unit', e.target.value)}
          className="w-full border border-[var(--border)] rounded px-2 py-1.5 text-xs focus:ring-2 focus:ring-[var(--accent)] outline-none"
        >
          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </td>
      <td className="py-2 pr-2">
        <input type="number" min="0" step="0.01"
          value={row.quantity}
          onChange={e => update('quantity', e.target.value)}
          className="w-full border border-[var(--border)] rounded px-2 py-1.5 text-xs text-right focus:ring-2 focus:ring-[var(--accent)] outline-none"
        />
      </td>
      <td className="py-2 pr-2">
        <input type="number" min="0" step="0.01"
          value={row.unitPriceVat}
          onChange={e => update('unitPriceVat', e.target.value)}
          className="w-full border border-[var(--border)] rounded px-2 py-1.5 text-xs text-right focus:ring-2 focus:ring-[var(--accent)] outline-none"
        />
      </td>
      <td className="py-2 pr-2 text-xs text-right text-[var(--text-3)] whitespace-nowrap">{fmt(vatAmt)}</td>
      <td className="py-2 pr-2 text-xs text-right font-medium text-[var(--text)] whitespace-nowrap">{fmt(rowTotal)}</td>
      <td className="py-2 text-center">
        <button onClick={onRemove} className="text-red-400 hover:text-red-600"><X size={14} /></button>
      </td>
    </tr>
  );
}

// ─── SpecForm (inline — shartnoma ichida) ──────────────────────────────────
function SpecForm({ contractId, spec, copiedSpec, nextNumber, contractNumber, products, vatRate = VAT_RATE, contractTotalValue = 0, otherSpecsTotal = 0, onSaved, onCancel }) {
  const editing = Boolean(spec);
  const [date, setDate]   = useState(spec?.date?.slice(0, 10) || TODAY);
  const [notes, setNotes] = useState(spec?.notes || '');
  const [rows, setRows]   = useState(
    (spec || copiedSpec)?.products?.map(p => ({
      _key: crypto.randomUUID(),
      productId:    p.productId,
      unit:         p.unit,
      quantity:     String(p.quantity),
      unitPriceVat: String(p.unitPriceVat),
    })) || []
  );
  const [saving, setSaving] = useState(false);

  const addRow = () => setRows(r => [...r, { _key: crypto.randomUUID(), productId: '', unit: 'kv.m', quantity: '', unitPriceVat: '' }]);
  const updateRow = (key, val) => setRows(r => r.map(x => x._key === key ? { ...x, ...val } : x));
  const removeRow = (key) => setRows(r => r.filter(x => x._key !== key));

  const totalValue = rows.reduce((s, r) => s + calcRowTotal(Number(r.quantity)||0, Number(r.unitPriceVat)||0), 0);

  const save = async () => {
    if (rows.length === 0) return toast.error('Kamida 1 ta mahsulot kerak');
    if (rows.some(r => !r.productId)) return toast.error('Mahsulotni tanlang');
    // Spetslar yig'indisi shartnoma summasidan oshsa — ogohlantirish (bloklamaydi)
    const projected = otherSpecsTotal + totalValue;
    if (contractTotalValue > 0 && projected > contractTotalValue) {
      toast(`Diqqat: spetslar yig'indisi (${fmt(projected)}) shartnoma summasidan (${fmt(contractTotalValue)}) oshib ketdi`,
        { icon: '⚠️', duration: 5000 });
    }
    setSaving(true);
    try {
      const payload = {
        contractId,
        date,
        notes,
        products: rows.map(r => ({
          productId:    r.productId,
          unit:         r.unit,
          quantity:     Number(r.quantity),
          unitPriceVat: Number(r.unitPriceVat),
        })),
      };
      if (editing) {
        const { data } = await api.put(`/api/specs/${spec.id}`, payload);
        toast.success('Spetsifikatsiya yangilandi');
        onSaved(data);
      } else {
        const { data } = await api.post('/api/specs', payload);
        toast.success(`Shartnoma № ${contractNumber || ''} bo'yicha Spetsifikatsiya № ${data.number} qo'shildi`);
        onSaved(data);
      }
    } finally { setSaving(false); }
  };

  return (
    <div className="mt-3 border border-[var(--border)] rounded-lg p-4 bg-[var(--surface-2)] space-y-3">
      <div className="flex items-center gap-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 py-2 flex-wrap">
        <span className="text-[10px] text-[var(--text-3)] uppercase tracking-wider font-semibold">Spetsifikatsiya</span>
        <span className="text-[var(--accent)] font-mono font-bold text-sm bg-[var(--accent-bg)] px-2 py-0.5 rounded border border-[var(--border)]">
          {editing ? `№ ${spec?.number}` : `Keyingi № ${nextNumber || '—'}`}
        </span>
      </div>

      <div className="flex gap-3">
        <div>
          <label className="text-xs font-medium text-[var(--text-3)] block mb-1">Sana</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="border border-[var(--border)] rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none bg-[var(--surface)]" />
        </div>
        <div className="flex-1">
          <label className="text-xs font-medium text-[var(--text-3)] block mb-1">Izoh</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ixtiyoriy..."
            className="w-full border border-[var(--border)] rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none bg-[var(--surface)]" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-xs">
          <colgroup>
            <col style={{width:'32%'}} /><col style={{width:'10%'}} />
            <col style={{width:'11%'}} /><col style={{width:'17%'}} />
            <col style={{width:'13%'}} /><col style={{width:'13%'}} />
            <col style={{width:'4%'}} />
          </colgroup>
          <thead>
            <tr className="text-[var(--text-3)]">
              <th className="text-left pb-1.5 pr-2 font-medium">Mahsulot</th>
              <th className="text-left pb-1.5 pr-2 font-medium">Birlik</th>
              <th className="text-right pb-1.5 pr-2 font-medium">Soni</th>
              <th className="text-right pb-1.5 pr-2 font-medium">Narx (QQS bilan)</th>
              <th className="text-right pb-1.5 pr-2 font-medium">QQS</th>
              <th className="text-right pb-1.5 pr-2 font-medium">Jami</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <SpecProductRow key={r._key}
                row={r}
                products={products}
                vatRate={vatRate}
                onChange={val => updateRow(r._key, val)}
                onRemove={() => removeRow(r._key)}
              />
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="text-xs text-[var(--text-3)] py-2 text-center">Mahsulot qo'shing</p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button onClick={addRow}
          className="text-xs text-[var(--accent)] hover:opacity-80 flex items-center gap-1">
          <Plus size={13} /> Mahsulot qo'shish
        </button>
        {rows.length > 0 && (
          <span className="text-sm font-bold text-[var(--text)]">
            Jami: {fmt(totalValue)} so'm
          </span>
        )}
      </div>

      <div className="flex gap-2 justify-end pt-1 border-t border-[var(--border)]">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm text-[var(--text-2)] hover:bg-[var(--surface-2)] rounded-md">
          Bekor
        </button>
        <button onClick={save} disabled={saving}
          className="px-4 py-1.5 text-sm btn-primary rounded-md disabled:opacity-60 flex items-center gap-1.5">
          {saving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
          {editing ? 'Yangilash' : 'Spets saqlash'}
        </button>
      </div>
    </div>
  );
}

// ─── ContractRow (ro'yxat qatori + expand) ─────────────────────────────────
function ContractRow({ c, idx, products, vatRate, onEdit, onDelete, onRestore, onHardDelete, onSpecSaved, onSpecDeleted, user }) {
  const canUpdate = user?.role === 'admin' || user?.permissions?.contracts?.update !== false;
  const canDelete = user?.role === 'admin' || user?.permissions?.contracts?.delete === true;
  const canHardDelete = user?.role === 'superAdmin';
  const navigate = useNavigate();
  const [expanded, setExpanded]  = useState(false);
  const [specs, setSpecs]        = useState(null);
  const [loadingSpec, setLoading] = useState(false);
  const [addingSpec, setAddingSpec] = useState(false);
  const [editSpec, setEditSpec]  = useState(null);
  const [copiedSpec, setCopiedSpec] = useState(null);
  const [menuOpen, setMenuOpen]  = useState(false);
  const [menuPos, setMenuPos]    = useState(null);
  const [specMenuId, setSpecMenuId] = useState(null);
  const [specMenuPos, setSpecMenuPos] = useState(null);
  const [delSpecId, setDelSpecId] = useState(null);

  const openMenu = (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setMenuOpen(m => !m);
  };

  const openSpecMenu = (specId, e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setSpecMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setSpecMenuId(id => id === specId ? null : specId);
  };

  const loadSpecs = useCallback(async () => {
    if (specs !== null) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/api/specs?contractId=${c.id}`);
      setSpecs(data.data);
    } finally { setLoading(false); }
  }, [c.id, specs]);

  const toggleExpand = () => {
    if (!expanded) loadSpecs();
    setExpanded(e => !e);
  };

  // Tashqariga bosilsa menyular yopilsin
  useEffect(() => {
    if (!menuOpen && !specMenuId) return;
    const handler = () => { setMenuOpen(false); setSpecMenuId(null); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen, specMenuId]);

  const handleSpecSaved = (saved) => {
    setSpecs(prev => {
      if (!prev) return [saved];
      const idx = prev.findIndex(s => s.id === saved.id);
      return idx >= 0 ? prev.map(s => s.id === saved.id ? saved : s) : [...prev, saved];
    });
    setAddingSpec(false);
    setEditSpec(null);
    setCopiedSpec(null);
    onSpecSaved();
  };

  const deleteSpec = async (specId) => {
    try {
      await api.delete(`/api/specs/${specId}`);
      setSpecs(prev => prev.filter(s => s.id !== specId));
      toast.success('Spets o\'chirildi');
      onSpecDeleted();
    } catch { /* toast shown by interceptor */ }
    setDelSpecId(null);
  };

  const specsSum = (specs || []).reduce((s, x) => s + (x.totalValue || 0), 0);

  return (
    <>
      <tr className={`hover:bg-[var(--surface-2)] transition-colors cursor-pointer${c.deletedAt?' opacity-60 bg-red-50 dark:bg-red-950/20':''}`} onClick={toggleExpand}>
        <td className="px-4 py-3 text-sm text-[var(--text-3)]">{idx}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className={`shrink-0 rounded p-0.5 transition-colors ${expanded ? 'bg-[var(--accent-bg)] text-[var(--accent)]' : 'text-[var(--text-3)] hover:text-[var(--text-2)]'}`}>
              {expanded
                ? <ChevronDown size={17} strokeWidth={2.2} />
                : <ChevronRight size={17} strokeWidth={2.2} />}
            </span>
            <span className="text-sm font-semibold text-[var(--text)]">{c.client?.name}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-[var(--text-3)] tracking-wide">{fmtInn(c.client?.inn)}</td>
        <td className="px-4 py-3 text-sm font-bold text-[var(--text)] font-mono">{c.number}</td>
        <td className="px-4 py-3 text-sm text-[var(--text-3)]">{fmtDate(c.date)}</td>
        <td className="px-4 py-3 text-sm text-right font-semibold text-[var(--text)]">{fmt(c.totalValue)}</td>
        <td className="px-4 py-3 text-sm text-right text-emerald-600 font-medium">{fmt(c.paidAmount)}</td>
        <td className="px-4 py-3 text-sm text-right text-[var(--accent)] font-medium">{fmt(c.deliveredAmount)}</td>
        <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
          <button onClick={toggleExpand}
            className={`text-xs font-medium px-2 py-1 rounded-full transition-colors ${
              expanded ? 'bg-[var(--accent-bg)] text-[var(--accent)]' : 'bg-[var(--surface-2)] text-[var(--text-2)] hover:bg-[var(--accent-bg)] hover:text-[var(--accent)]'
            }`}>
            {c.specCount} spets
          </button>
        </td>
        <td className="px-4 py-3 text-sm text-right font-medium">
          {c.invoiceAmount > c.totalValue && c.totalValue > 0 ? (
            <span title="Spetslar yig'indisi shartnoma summasidan oshib ketgan"
              className="inline-flex items-center justify-end gap-1 text-amber-600 font-semibold">
              <AlertTriangle size={13} /> {fmt(c.invoiceAmount)}
            </span>
          ) : (
            <span className="text-[var(--text-2)]">{fmt(c.invoiceAmount || 0)}</span>
          )}
        </td>
        <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] || STATUS_COLORS.yangi}`}>
            {STATUS_LABELS[c.status] || c.status}
          </span>
        </td>
        <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
          {c.deletedAt ? (
            <div className="flex items-center justify-end gap-2">
              <span className="text-[10px] text-red-500 font-semibold">O'chirilgan</span>
              {canHardDelete && (
                <>
                  <button onClick={() => onRestore(c)} className="text-[10px] text-[var(--accent)] font-semibold hover:underline px-1" title="Tiklash">Tiklash</button>
                  <button onClick={() => onHardDelete(c)} className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition" title="Butunlay o'chirish"><Trash2 size={15} strokeWidth={1.8}/></button>
                </>
              )}
            </div>
          ) : (
          <>
          <button onClick={openMenu}
            className="p-1 rounded hover:bg-[var(--surface-2)] text-[var(--text-3)] hover:text-[var(--text-2)]">
            <MoreVertical size={18} strokeWidth={2} />
          </button>
          {menuOpen && menuPos && (
            <div
              style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-xl w-44 py-1"
              onMouseDown={e => e.stopPropagation()}
            >
              {canUpdate && (
                <button onClick={() => { setMenuOpen(false); onEdit(c); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-[var(--surface-2)]">
                  <Pencil size={15} strokeWidth={1.8} /> Tahrirlash
                </button>
              )}
              {canDelete && (
                <button onClick={() => { setMenuOpen(false); onDelete(c); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                  <Trash2 size={15} strokeWidth={1.8} /> O'chirish
                </button>
              )}
              <button
                onClick={() => { setMenuOpen(false); openFile(`${API}/api/export/contracts/${c.id}/pdf`); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-[var(--surface-2)] text-[var(--text-2)] text-left">
                <FileText size={15} strokeWidth={1.8} className="text-red-500" /> PDF yuklab olish
              </button>
              <button
                onClick={() => { setMenuOpen(false); downloadFile(`${API}/api/export/contracts/${c.id}/word`, `shartnoma-${c.number}.docx`); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-[var(--surface-2)] text-[var(--text-2)] text-left">
                <FileType size={15} strokeWidth={1.8} className="text-blue-500" /> Word (.docx) yuklash
              </button>
              <button
                onClick={() => { setMenuOpen(false); openFile(`${API}/api/export/contracts/${c.id}/pdf-with-specs`); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-[var(--surface-2)] text-[var(--text-2)] text-left">
                <FileDown size={15} strokeWidth={1.8} className="text-[var(--accent)]" /> Barcha spetsifikatsiyalar bilan PDF
              </button>
              <a href={`${API}/api/export/contracts/${c.id}/excel`}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-[var(--surface-2)] text-[var(--text-2)]"
                onClick={() => setMenuOpen(false)}>
                <FileSpreadsheet size={15} strokeWidth={1.8} className="text-emerald-600" /> Excel yuklab olish
              </a>
            </div>
          )}
          </>
          )}
        </td>
      </tr>

      {/* Expand panel — spetslar */}
      {expanded && (
        <tr>
          <td colSpan={12} className="px-6 pb-4 bg-[var(--surface-2)]/60">
            <div className="border border-[var(--border)] rounded-lg bg-[var(--surface)]">
              <div className="flex items-center gap-4 px-4 py-2.5 border-b border-[var(--border)]">
                <button onClick={() => { setAddingSpec(true); setEditSpec(null); setCopiedSpec(null); }}
                  className="flex items-center gap-1 text-xs text-[var(--accent)] hover:opacity-80 font-medium bg-[var(--accent-bg)] px-2.5 py-1 rounded-md">
                  <Plus size={13} /> Spets qo'shish
                </button>
                <span className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wide">
                  Spetsifikatsiyalar
                </span>
              </div>

              {loadingSpec && (
                <div className="py-6 text-center text-sm text-[var(--text-3)]">Yuklanmoqda...</div>
              )}

              {!loadingSpec && specs?.length === 0 && !addingSpec && !copiedSpec && (
                <div className="py-6 text-center text-sm text-[var(--text-3)]">
                  Hozircha spets yo'q
                </div>
              )}

              {!loadingSpec && specs?.map(spec => (
                <div key={spec.id} className="px-4 py-3 border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]/30 transition-colors">
                  {delSpecId === spec.id ? (
                    <div className="flex items-center gap-3 py-1">
                      <AlertTriangle size={15} className="text-amber-500" />
                      <span className="text-sm text-[var(--text-2)]">
                        Spets №{spec.number} o'chirilsinmi?
                      </span>
                      <button onClick={() => deleteSpec(spec.id)}
                        className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700">Ha</button>
                      <button onClick={() => setDelSpecId(null)}
                        className="px-3 py-1 text-xs border border-[var(--border)] rounded hover:bg-[var(--surface-2)]">Yo'q</button>
                    </div>
                  ) : editSpec?.id === spec.id ? (
                    <SpecForm
                      contractId={c.id}
                      spec={spec}
                      copiedSpec={null}
                      products={products}
                      vatRate={vatRate}
                      contractTotalValue={c.totalValue}
                      otherSpecsTotal={specsSum - (spec.totalValue || 0)}
                      onSaved={handleSpecSaved}
                      onCancel={() => setEditSpec(null)}
                    />
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-4">
                        <div className="flex-1 flex items-center gap-2 text-sm">
                          <span className="inline-flex items-center justify-center min-w-[26px] h-[22px] px-1.5 rounded-md bg-[var(--surface-2)] text-[var(--text)] text-xs font-bold">
                            №{spec.number}
                          </span>
                          <span className="text-xs text-[var(--text-3)]">{fmtDate(spec.date)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-[var(--surface)] border border-[var(--border)] p-1 rounded-lg shadow-sm">
                          <button
                            onClick={() => navigate('/sales', {
                              state: {
                                clientId:       c.clientId,
                                contractId:     c.id,
                                contractNumber: c.number,
                                specId:         spec.id,
                                specNumber:     spec.number,
                              },
                            })}
                            title="Bu spets bo'yicha savdo yaratish"
                            className="flex items-center gap-1 px-2 py-1 text-xs text-emerald-700 bg-emerald-50 rounded hover:bg-emerald-100 font-medium mr-2">
                            <ShoppingCart size={13} /> Savdo
                          </button>
                          
                          {/* Export / Print Icons */}
                          <button onClick={() => openFile(`${API}/api/export/specs/${spec.id}/pdf`)} title="PDF ko'rish/yuklash" className="p-1 text-[var(--text-3)] hover:text-red-500 rounded hover:bg-[var(--surface-2)] transition">
                            <FileText size={13} />
                          </button>
                          <button onClick={() => downloadFile(`${API}/api/export/specs/${spec.id}/word`, `spetsifikatsiya-${spec.number}.docx`)} title="Word (.docx) yuklash" className="p-1 text-[var(--text-3)] hover:text-blue-500 rounded hover:bg-[var(--surface-2)] transition">
                            <FileType size={13} />
                          </button>
                          <a href={`${API}/api/export/specs/${spec.id}/excel`} title="Excel yuklash" className="p-1 text-[var(--text-3)] hover:text-emerald-600 rounded hover:bg-[var(--surface-2)] transition">
                            <FileSpreadsheet size={13} />
                          </a>
                          <button onClick={() => openFile(`${API}/api/export/specs/${spec.id}/pdf`)} title="Chop etish" className="p-1 text-[var(--text-3)] hover:text-[var(--text)] rounded hover:bg-[var(--surface-2)] transition">
                            <Printer size={13} />
                          </button>
                          <button onClick={() => { setCopiedSpec(spec); setAddingSpec(true); }} title="Nusxalash" className="p-1 text-[var(--text-3)] hover:text-[var(--accent)] rounded hover:bg-[var(--surface-2)] transition">
                            <Copy size={13} />
                          </button>

                          <button onClick={e => openSpecMenu(spec.id, e)}
                            className="p-1 rounded hover:bg-[var(--surface-2)] text-[var(--text-3)] hover:text-[var(--text-2)] ml-1">
                            <MoreVertical size={14} />
                          </button>
                          {specMenuId === spec.id && specMenuPos && (
                            <div
                              style={{ position: 'fixed', top: specMenuPos.top, right: specMenuPos.right, zIndex: 9999 }}
                              className="bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-xl w-36 py-1"
                              onMouseDown={e => e.stopPropagation()}
                            >
                              <button onClick={() => { setEditSpec(spec); setSpecMenuId(null); setAddingSpec(false); }}
                                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-[var(--surface-2)]">
                                <Pencil size={13} /> Tahrirlash
                              </button>
                              <button onClick={() => { setDelSpecId(spec.id); setSpecMenuId(null); }}
                                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                                <Trash2 size={13} /> O'chirish
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Nested products details list */}
                      {spec.products && spec.products.length > 0 && (
                        <div className="pl-4 pr-12 pb-2">
                          <table className="w-full text-left border border-[var(--border)] rounded-lg overflow-hidden">
                            <thead>
                              <tr className="bg-[var(--surface-2)] border-b border-[var(--border)] text-[10px] text-[var(--text-3)] font-semibold uppercase">
                                <th className="px-3 py-1.5 w-1/3">Mahsulot</th>
                                <th className="px-3 py-1.5">O'lchov birligi</th>
                                <th className="px-3 py-1.5 text-right">Miqdor (Soni)</th>
                                <th className="px-3 py-1.5 text-right">Narxi (QQS bilan)</th>
                                <th className="px-3 py-1.5 text-right">Jami summa</th>
                              </tr>
                            </thead>
                            <tbody className="text-xs divide-y divide-[var(--border)] bg-[var(--surface)]">
                              {spec.products.map(sp => (
                                <tr key={sp.id} className="hover:bg-[var(--surface-2)]/50">
                                  <td className="px-3 py-1.5 font-mono font-semibold text-[var(--text)]">{sp.product?.article || '—'}</td>
                                  <td className="px-3 py-1.5 text-[var(--text-3)] font-mono">{sp.unit}</td>
                                  <td className="px-3 py-1.5 text-right font-mono font-semibold text-[var(--text)]">{fmt(sp.quantity)}</td>
                                  <td className="px-3 py-1.5 text-right font-mono text-[var(--text-3)]">{fmt(sp.unitPriceVat)} UZS</td>
                                  <td className="px-3 py-1.5 text-right font-mono font-bold text-emerald-600">{fmt(sp.rowTotal)} UZS</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Spets jami — summa va yetkazilgan pastda */}
                      <div className="pl-4 pr-12 flex items-center justify-end gap-8 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[var(--text-3)]">Yetkazilgan:</span>
                          <span className="font-semibold text-[var(--accent)]">{fmt(spec.deliveredAmount || 0)} UZS</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[var(--text-3)]">Summa:</span>
                          <span className="font-bold text-[var(--text)]">{fmt(spec.totalValue)} UZS</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {(addingSpec || copiedSpec) && (
                <div className="px-4 pb-4">
                  <SpecForm
                    contractId={c.id}
                    spec={null}
                    copiedSpec={copiedSpec}
                    nextNumber={specs ? (Math.max(0, ...specs.map(s => s.number)) + 1) : 1}
                    contractNumber={c.number}
                    products={products}
                    vatRate={vatRate}
                    contractTotalValue={c.totalValue}
                    otherSpecsTotal={specsSum}
                    onSaved={handleSpecSaved}
                    onCancel={() => { setAddingSpec(false); setCopiedSpec(null); }}
                  />
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── ContractForm (inline accordion) ───────────────────────────────────────
function ContractForm({ onSaved, onCancel, editContract, products = [], vatRate = VAT_RATE }) {
  const editing = Boolean(editContract);
  const [clients, setClients]       = useState([]);
  const [clientSearch, setClientSearch] = useState(editContract?.client?.name || '');
  const [clientId, setClientId]     = useState(editContract?.clientId || '');
  const [clientDropOpen, setClientDropOpen] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [seller, setSeller]         = useState(editContract?.seller || '');
  const [autoNumber, setAutoNumber] = useState('');
  const [number, setNumber]         = useState(editContract?.number || '');
  const [useAuto, setUseAuto]       = useState(!editing);
  const [date, setDate]             = useState(editContract?.date?.slice(0, 10) || TODAY);
  const [totalValue, setTotalValue] = useState(editContract?.totalValue ?? '');
  const [notes, setNotes]           = useState(editContract?.notes || '');
  const [status, setStatus]         = useState(editContract?.status || 'yangi');
  const [saving, setSaving]         = useState(false);
  const clientDropRef = useRef(null);
  // Spetsifikatsiya bo'limi (faqat yangi shartnomada)
  const [showSpec, setShowSpec]     = useState(false);
  const [specRows, setSpecRows]     = useState([]);
  const [specDate, setSpecDate]     = useState(TODAY);
  const [specNotes, setSpecNotes]   = useState('');

  const addSpecRow = () => setSpecRows(r => [
    ...r, { _key: crypto.randomUUID(), productId: '', unit: 'kv.m', quantity: '', unitPriceVat: '' }
  ]);
  const updateSpecRow = (key, val) => setSpecRows(r => r.map(x => x._key === key ? { ...x, ...val } : x));
  const removeSpecRow = (key) => setSpecRows(r => r.filter(x => x._key !== key));
  const specTotal = specRows.reduce((s, r) => s + calcRowTotal(Number(r.quantity)||0, Number(r.unitPriceVat)||0), 0);

  // Auto raqam olish
  useEffect(() => {
    if (editing) return;
    api.get('/api/contracts/next-number').then(r => {
      setAutoNumber(r.data.number);
    }).catch(() => {});
  }, [editing]);

  // Mijozlar ro'yxati
  useEffect(() => {
    api.get(`/api/clients?limit=200&search=${encodeURIComponent(clientSearch)}`).then(r => {
      setClients(r.data.data || []);
    }).catch(() => {});
  }, [clientSearch]);

  // Dropdown tashqarisini yopish
  useEffect(() => {
    const handler = (e) => {
      if (!clientDropRef.current?.contains(e.target)) setClientDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectClient = (cl) => {
    if (cl.id !== clientId) setSeller('');  // sotuvchilar ro'yxati mijozga bog'liq
    setClientId(cl.id);
    setClientSearch(cl.name);
    setClientDropOpen(false);
  };

  const handleClientAdded = (cl) => {
    setShowAddClient(false);
    setClients(prev => [cl, ...prev]);
    selectClient(cl);
  };

  const save = async () => {
    if (!clientId) return toast.error('Mijozni tanlang');
    if (!seller)  return toast.error('Sotuvchini tanlang');
    if (!date)    return toast.error('Sanani kiriting');
    // Tahrirda biznes ogohlantirishlari (bloklamaydi)
    if (editing) {
      const tv        = Number(totalValue) || 0;
      const delivered = editContract.deliveredAmount || 0;
      const paid      = editContract.paidAmount || 0;
      if (tv > 0 && tv < delivered) {
        toast(`Diqqat: shartnoma summasi (${fmt(tv)}) yetkazilgan summadan (${fmt(delivered)}) past`,
          { icon: '⚠️', duration: 5000 });
      }
      if (status === 'yopilgan' && delivered - paid > 0) {
        toast(`Diqqat: shartnomada qarz qolgan (${fmt(delivered - paid)}), lekin 'Yopilgan' qilinmoqda`,
          { icon: '⚠️', duration: 5000 });
      }
    }
    // Spets tekshiruvi — agar bo'lim ochiq va qatorlar bor bo'lsa
    if (showSpec && specRows.length > 0) {
      if (specRows.some(r => !r.productId))   return toast.error('Barcha qatorlarda mahsulot tanlang');
      if (specRows.some(r => !Number(r.quantity)))      return toast.error('Soni kiritilmagan');
      if (specRows.some(r => !Number(r.unitPriceVat)))  return toast.error('Narx kiritilmagan');
      const tv = Number(totalValue) || 0;
      if (tv > 0 && specTotal > tv) {
        toast(`Diqqat: spetsifikatsiya summasi (${fmt(specTotal)}) shartnoma summasidan (${fmt(tv)}) oshib ketdi`,
          { icon: '⚠️', duration: 5000 });
      }
    }
    const payload = {
      clientId,
      date,
      totalValue: Number(totalValue) || 0,
      notes,
      status,
      seller: seller || null,
      ...(!editing && !useAuto && number ? { number } : {}),
    };
    setSaving(true);
    try {
      let res;
      if (editing) {
        res = await api.put(`/api/contracts/${editContract.id}`, payload);
        toast.success('Shartnoma yangilandi');
      } else {
        res = await api.post('/api/contracts', payload);
        // Spets bo'lsa — shartnomadan keyin saqlaymiz
        if (showSpec && specRows.length > 0) {
          await api.post('/api/specs', {
            contractId: res.data.id,
            date: specDate,
            notes: specNotes,
            products: specRows.map(r => ({
              productId:    r.productId,
              unit:         r.unit,
              quantity:     Number(r.quantity),
              unitPriceVat: Number(r.unitPriceVat),
            })),
          });
          toast.success(`Shartnoma № ${res.data.number} va spetsifikatsiya yaratildi`);
        } else {
          toast.success(`Shartnoma № ${res.data.number} yaratildi`);
        }
      }
      onSaved(res.data);
    } finally { setSaving(false); }
  };

  useModalKeys(!saving, save, onCancel);

  return (
    <>
      {showAddClient && (
        <QuickAddClientModal onSaved={handleClientAdded} onClose={() => setShowAddClient(false)} />
      )}
      <div className="mini-card rounded-xl p-5 mb-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text)]">
            {editing ? `Shartnoma №${editContract.number} tahrirlash` : 'Yangi shartnoma'}
          </h3>
          <button onClick={onCancel} className="text-[var(--text-3)] hover:text-[var(--text-2)]"><X size={16} /></button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Mijoz */}
          <div className="col-span-2 md:col-span-1" ref={clientDropRef}>
            <label className="text-xs font-medium text-[var(--text-3)] block mb-1">Mijoz *</label>
            <div className="relative">
              <input
                value={clientSearch}
                onChange={e => { setClientSearch(e.target.value); setClientDropOpen(true); setClientId(''); setSeller(''); }}
                onFocus={() => setClientDropOpen(true)}
                placeholder="Mijoz qidiring..."
                className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none bg-[var(--surface)]"
              />
              {clientDropOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 z-40 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {clients.map(cl => (
                    <button key={cl.id} onClick={() => selectClient(cl)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--surface-2)] flex items-center justify-between">
                      <span>{cl.name}</span>
                      <span className="text-xs text-[var(--text-3)]">{cl.inn}</span>
                    </button>
                  ))}
                  <button onClick={() => { setClientDropOpen(false); setShowAddClient(true); }}
                    className="w-full text-left px-3 py-2 text-sm text-[var(--accent)] hover:bg-[var(--accent-bg)] flex items-center gap-1 border-t border-[var(--border)]">
                    <Plus size={13} /> Yangi mijoz qo'shish
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* INN (read-only) */}
          <div>
            <label className="text-xs font-medium text-[var(--text-3)] block mb-1">INN</label>
            <input readOnly
              value={clients.find(c => c.id === clientId)?.inn || ''}
              className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--surface-2)] text-[var(--text-3)] cursor-default"
            />
          </div>

          {/* Sotuvchi */}
          <div>
            <label className="text-xs font-medium text-[var(--text-3)] block mb-1">Sotuvchi *</label>
            <select
              required
              value={seller}
              onChange={e => setSeller(e.target.value)}
              disabled={!clientId}
              className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none bg-[var(--surface)]"
            >
              <option value="">— Sotuvchini tanlang —</option>
              {(clients.find(c => c.id === clientId)?.seller || editContract?.client?.seller || '')
                .split(', ')
                .filter(Boolean)
                .map(s => <option key={s} value={s}>{s}</option>)
              }
            </select>
            {clientId && !(clients.find(c => c.id === clientId)?.seller || editContract?.client?.seller) && (
              <p className="text-[10px] text-red-500 mt-1">Bu mijozga sotuvchilar biriktirilmagan (CRM-sozlamalardan kiriting)</p>
            )}
          </div>

          {/* Shartnoma raqami */}
          {!editing && (
            <div>
              <label className="text-xs font-medium text-[var(--text-3)] block mb-1">Shartnoma raqami</label>
              <div className="flex gap-2 items-center">
                <input
                  value={useAuto ? autoNumber : number}
                  onChange={e => setNumber(e.target.value)}
                  readOnly={useAuto}
                  placeholder="26-01"
                  className={`flex-1 border border-[var(--border)] rounded-md px-3 py-2 text-sm outline-none ${
                    useAuto ? 'bg-[var(--surface-2)] text-[var(--text-3)] cursor-default' : 'focus:ring-2 focus:ring-[var(--accent)] bg-[var(--surface)]'
                  }`}
                />
                <label className="flex items-center gap-1.5 text-xs text-[var(--text-3)] cursor-pointer whitespace-nowrap">
                  <input type="checkbox" checked={useAuto} onChange={e => setUseAuto(e.target.checked)}
                    className="rounded" />
                  Avto
                </label>
              </div>
            </div>
          )}

          {/* Sana */}
          <div>
            <label className="text-xs font-medium text-[var(--text-3)] block mb-1">Sana</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none bg-[var(--surface)]" />
          </div>

          {/* Umumiy summa */}
          <div>
            <label className="text-xs font-medium text-[var(--text-3)] block mb-1">Umumiy summa (so'm)</label>
            <input type="number" min="0" step="0.01"
              value={totalValue}
              onChange={e => setTotalValue(e.target.value)}
              placeholder="0"
              className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none bg-[var(--surface)] text-right"
            />
          </div>

          {/* Status */}
          <div>
            <label className="text-xs font-medium text-[var(--text-3)] block mb-1">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none bg-[var(--surface)]">
              <option value="yangi">Yangi</option>
              <option value="amalda">Amalda</option>
              <option value="yopilgan">Yopilgan</option>
            </select>
          </div>

          {/* Izoh */}
          <div className="col-span-2">
            <label className="text-xs font-medium text-[var(--text-3)] block mb-1">Izoh</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} placeholder="Ixtiyoriy..."
              className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none bg-[var(--surface)] resize-none" />
          </div>
        </div>

        {/* ── Spetsifikatsiya bo'limi (faqat yangi shartnomada) ── */}
        {!editing && (
          <div className="border border-[var(--border)] rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => { setShowSpec(s => !s); if (!showSpec && specRows.length === 0) addSpecRow(); }}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-[var(--surface-2)] hover:bg-[var(--surface-2)] transition text-sm font-medium text-[var(--text-2)]"
            >
              <span className="flex items-center gap-2">
                <Plus size={15} className={`transition-transform ${showSpec ? 'rotate-45' : ''}`} />
                Spetsifikatsiya qo'shish
                {specRows.length > 0 && (
                  <span className="bg-[var(--accent-bg)] text-[var(--accent)] text-xs px-2 py-0.5 rounded-full">
                    {specRows.length} mahsulot · {fmt(specTotal)} so'm
                  </span>
                )}
              </span>
              {showSpec
                ? <ChevronDown size={15} className="text-[var(--text-3)]" />
                : <ChevronRight size={15} className="text-[var(--text-3)]" />}
            </button>

            {showSpec && (
              <div className="p-4 space-y-3">
                <div className="flex gap-3">
                  <div>
                    <label className="text-xs font-medium text-[var(--text-3)] block mb-1">Spets sanasi</label>
                    <input type="date" value={specDate} onChange={e => setSpecDate(e.target.value)}
                      className="border border-[var(--border)] rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none bg-[var(--surface)]" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-medium text-[var(--text-3)] block mb-1">Spets izohi</label>
                    <input value={specNotes} onChange={e => setSpecNotes(e.target.value)}
                      placeholder="Ixtiyoriy..."
                      className="w-full border border-[var(--border)] rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none bg-[var(--surface)]" />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full table-fixed text-xs">
                    <colgroup>
                      <col style={{width:'32%'}} /><col style={{width:'10%'}} />
                      <col style={{width:'11%'}} /><col style={{width:'17%'}} />
                      <col style={{width:'13%'}} /><col style={{width:'13%'}} />
                      <col style={{width:'4%'}} />
                    </colgroup>
                    <thead>
                      <tr className="text-[var(--text-3)]">
                        <th className="text-left pb-1.5 pr-2 font-medium">Mahsulot</th>
                        <th className="text-left pb-1.5 pr-2 font-medium">Birlik</th>
                        <th className="text-right pb-1.5 pr-2 font-medium">Soni</th>
                        <th className="text-right pb-1.5 pr-2 font-medium">Narx (QQS bilan)</th>
                        <th className="text-right pb-1.5 pr-2 font-medium">QQS</th>
                        <th className="text-right pb-1.5 pr-2 font-medium">Jami</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {specRows.map(r => (
                        <SpecProductRow key={r._key}
                          row={r}
                          products={products}
                          vatRate={vatRate}
                          onChange={val => updateSpecRow(r._key, val)}
                          onRemove={() => removeSpecRow(r._key)}
                        />
                      ))}
                    </tbody>
                  </table>
                  {specRows.length === 0 && (
                    <p className="text-xs text-[var(--text-3)] py-2 text-center">Mahsulot qo'shing</p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <button type="button" onClick={addSpecRow}
                    className="text-xs text-[var(--accent)] hover:opacity-80 flex items-center gap-1">
                    <Plus size={13} /> Mahsulot qo'shish
                  </button>
                  {specRows.length > 0 && (
                    <span className="text-sm font-bold text-[var(--text)]">
                      Jami: {fmt(specTotal)} so'm
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onCancel}
            className="px-4 py-2 text-sm text-[var(--text-2)] hover:bg-[var(--surface-2)] rounded-md">
            Bekor (Esc)
          </button>
          <button onClick={save} disabled={saving}
            className="px-5 py-2 text-sm btn-primary rounded-md disabled:opacity-60 flex items-center gap-1.5">
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
            {editing ? 'Yangilash' : 'Shartnoma yaratish'}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Contracts (main page) ──────────────────────────────────────────────────
const fmtInn = (inn) => {
  if (!inn) return '—';
  const d = inn.replace(/\D/g, '');
  // 3-3-3 yoki qolgan raqamlar
  return d.replace(/(\d{3})(?=\d)/g, '$1 ');
};

export default function Contracts({ user }) {
  // Mijoz/tahrirlash/o'chirish ruxsatlari ContractRow ichida tekshiriladi
  const canCreate = user?.role === 'admin' || user?.permissions?.contracts?.create !== false;
  const [contracts, setContracts] = useState([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(false);
  const { query: debouncedSearch, inputProps: searchInput } = useSearchOnEnter('', () => setPage(1));
  const [status, setStatus]       = useState('');
  const [sortBy, setSortBy]       = useState('createdAt');
  const [sortDir, setSortDir]     = useState('desc');
  const [products, setProducts]   = useState([]);
  const [vatRate, setVatRate]     = useState(VAT_RATE);
  const [editContract, setEditContract] = useState(null);
  const [delContract, setDelContract]  = useState(null);
  const form = useInlineForm();
  const { from: dateFrom, to: dateTo } = useDateFilter();
  const [debtFilter, setDebtFilter] = useState('barchasi');
  const LIMIT = 20;

  // Mahsulotlar ro'yxati (spec forma uchun)
  useEffect(() => {
    api.get('/api/products?limit=200').then(r => setProducts(r.data.data || [])).catch(() => {});
  }, []);

  // QQS stavkasi — global Sozlamalardan (spec qatorlari hisobi backend bilan bir xil bo'lishi uchun)
  useEffect(() => {
    api.get('/api/settings')
      .then(r => { if (typeof r.data?.vatRate === 'number') setVatRate(r.data.vatRate); })
      .catch(() => {});
  }, []);

  const load = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: p, limit: LIMIT, sortBy, sortDir,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(status          ? { status }                   : {}),
        ...(dateFrom        ? { from: dateFrom }           : {}),
        ...(dateTo          ? { to: dateTo }               : {}),
        ...(debtFilter && debtFilter !== 'barchasi' ? { debtFilter } : {}),
      });
      const { data } = await api.get(`/api/contracts?${params}`);
      setContracts(data.data);
      setTotal(data.total);
    } finally { setLoading(false); }
  }, [page, debouncedSearch, status, sortBy, sortDir, dateFrom, dateTo, debtFilter]);

  const toggleSort = (col) => {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
    setPage(1);
  };

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [dateFrom, dateTo, debtFilter]);

  const handleSaved = (saved) => {
    if (editContract) {
      setContracts(prev => prev.map(c => c.id === saved.id ? { ...c, ...saved } : c));
      setEditContract(null);
    } else {
      form.close();
      load(1);
      setPage(1);
    }
  };

  const deleteContract = async () => {
    try {
      await api.delete(`/api/contracts/${delContract.id}`);
      toast.success('Shartnoma o\'chirildi');
      setDelContract(null);
      load(page);
    } catch { /* toast shown by interceptor */ }
  };

  const handleRestore = async (rec) => {
    try { await api.post(`/api/contracts/${rec.id}/restore`); toast.success('Tiklandi'); load(page); }
    catch { /* interceptor toast */ }
  };
  const handleHardDelete = async (rec) => {
    if (!window.confirm('Butunlay o\'chirilsinmi? Bu amalni qaytarib bo\'lmaydi.')) return;
    try { await api.delete(`/api/contracts/${rec.id}/hard`); toast.success('Butunlay o\'chirildi'); load(page); }
    catch { /* interceptor toast */ }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in">
      {/* Delete confirm modal */}
      {delContract && (
        <div className="modal-overlay">
          <div className="bg-[var(--surface)] rounded-xl shadow-2xl p-6 w-full max-w-sm border border-[var(--border)] text-center animate-in">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={22} className="text-red-600"/></div>
            <h3 className="text-sm font-bold text-[var(--text)] mb-1">Shartnomani o'chirish</h3>
            <p className="text-xs text-[var(--text-3)] mb-6">
              №{delContract.number} — {delContract.client?.name}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDelContract(null)}
                className="flex-1 px-3 py-1.5 text-xs border border-[var(--border)] rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-2)] transition">
                Bekor
              </button>
              <button onClick={deleteContract}
                className="flex-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition">
                O'chirish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">Shartnomalar</h2>
            <p className="text-xs text-[var(--text-3)] mt-0.5">Jami: {total} ta</p>
          </div>
          {canCreate && (
            <button onClick={() => { form.isOpen ? form.close() : form.open(); setEditContract(null); }}
              className="flex items-center gap-1.5 px-3 py-1.5 btn-primary text-xs font-medium rounded-lg transition shadow-sm">
              <Plus size={16} strokeWidth={2.2} />
              {form.isOpen ? 'Yopish' : 'Yangi shartnoma'}
            </button>
          )}
        </div>
      </div>

      {/* Submenu Quick Filters */}
      <div className="flex border-b border-[var(--border)] gap-2">
        {[
          { key: 'barchasi', label: 'Barchasi' },
          { key: 'qarzdorlar', label: 'Qarzdorlar' },
          { key: 'haqdorlar', label: 'Haqdorlar' },
          { key: 'yangi', label: 'Yangi' }
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setDebtFilter(t.key)}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all duration-200 -mb-[1px] ${
              debtFilter === t.key
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-3)] hover:text-[var(--text-2)] hover:border-[var(--border)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Inline creation form */}
      {form.isOpen && !editContract && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
          <ContractForm
            onSaved={handleSaved}
            onCancel={form.close}
            editContract={null}
            products={products}
            vatRate={vatRate}
          />
        </div>
      )}

      {/* Edit Contract Popup Modal */}
      {editContract && (
        <div className="modal-overlay">
          <div className="modal-card w-full max-w-4xl overflow-hidden animate-in">
            <div className="max-h-[85vh] overflow-y-auto p-6">
              <ContractForm
                onSaved={handleSaved}
                onCancel={() => setEditContract(null)}
                editContract={editContract}
                products={products}
                vatRate={vatRate}
              />
            </div>
          </div>
        </div>
      )}

      {/* Filters & Advanced Date Range */}
      <div className="bg-[var(--surface-2)] p-4 rounded-xl border border-[var(--border)] space-y-3">
        <div className="flex gap-3 flex-wrap items-center">
          <div className="relative flex-1 min-w-48">
            <Search size={16} strokeWidth={2.2} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
            <input
              {...searchInput}
              placeholder="Qidirish: mijoz, INN, raqam (Enter)..."
              className="w-full pl-9 pr-4 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] outline-none transition text-[var(--text)] placeholder-[var(--text-3)]"
            />
          </div>
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs bg-[var(--surface)] focus:border-[var(--accent)] outline-none transition text-[var(--text)]">
            <option value="">Barcha status</option>
          <option value="yangi">Yangi</option>
          <option value="amalda">Amalda</option>
          <option value="yopilgan">Yopilgan</option>
        </select>
      </div>
    </div>

      {/* Table */}
      <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-3)] w-10">#</th>
                {[
                  { label: 'Mijoz',      col: 'client',      align: 'left'   },
                  { label: 'INN',        col: null,          align: 'left'   },
                  { label: 'Raqam',      col: 'number',      align: 'left'   },
                  { label: 'Sana',       col: 'date',        align: 'left'   },
                  { label: 'Summa',      col: 'totalValue',  align: 'right'  },
                  { label: "To'landi",   col: null,          align: 'right'  },
                  { label: 'Yetkazildi', col: null,          align: 'right'  },
                  { label: 'Spets',      col: null,          align: 'center' },
                  { label: 'Faktura',    col: null,          align: 'right'  },
                  { label: 'Status',     col: 'status',      align: 'center' },
                ].map(({ label, col, align }) => (
                  <th key={label}
                    className={`px-4 py-3 text-${align} text-xs font-semibold select-none
                      ${col ? 'cursor-pointer hover:text-[var(--text)] text-[var(--text-3)]' : 'text-[var(--text-3)]'}`}
                    onClick={col ? () => toggleSort(col) : undefined}
                  >
                    <span className="inline-flex items-center gap-1">
                      {label}
                      {col && (
                        <span className={`text-[10px] ${sortBy === col ? 'text-[var(--accent)]' : 'text-[var(--text-3)]'}`}>
                          {sortBy === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                      )}
                    </span>
                  </th>
                ))}
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(12)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-[var(--surface-2)] animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : contracts.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-sm text-[var(--text-3)]">
                    Shartnomalar topilmadi
                  </td>
                </tr>
              ) : (
                contracts.map((c, i) => (
                  <ContractRow
                    key={c.id}
                    c={c}
                    idx={(page - 1) * LIMIT + i + 1}
                    products={products}
                    vatRate={vatRate}
                    onEdit={(c) => { setEditContract(c); form.close(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    onDelete={setDelContract}
                    onRestore={handleRestore}
                    onHardDelete={handleHardDelete}
                    onSpecSaved={() => load(page)}
                    onSpecDeleted={() => load(page)}
                    user={user}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {total > LIMIT && (
          <div className="border-t border-[var(--border)] px-4 py-3">
            <Pagination page={page} total={total} limit={LIMIT} onPage={setPage} />
          </div>
        )}
      </div>

    </div>
  );
}
