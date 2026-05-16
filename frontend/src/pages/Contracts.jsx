import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, ChevronDown, ChevronRight, MoreVertical, Pencil, Trash2,
  FileText, FileSpreadsheet, X, Check, AlertTriangle,
  ShoppingCart, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { fmt, fmtDate } from '../lib/format';
import { calcRowTotal, calcVat } from '../lib/vat';
import { useInlineForm } from '../hooks/useInlineForm';
import { useModalKeys } from '../hooks/useModalKeys';
import Pagination from '../components/Pagination';

const STATUS_LABELS = { yangi: 'Yangi', amalda: 'Amalda', yopilgan: 'Yopilgan' };
const STATUS_COLORS = {
  yangi:    'bg-blue-50 text-blue-700',
  amalda:   'bg-emerald-50 text-emerald-700',
  yopilgan: 'bg-zinc-100 text-zinc-500',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-zinc-900">Yangi mijoz</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600"><X size={18} /></button>
        </div>
        <input
          autoFocus placeholder="Mijoz nomi *"
          value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <input
          placeholder="INN"
          value={form.inn} onChange={e => setForm(f => ({ ...f, inn: e.target.value }))}
          className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 rounded-md">Bekor</button>
          <button onClick={save} disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60">
            {saving ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SpecProductRow ─────────────────────────────────────────────────────────
function SpecProductRow({ row, products, onChange, onRemove }) {
  const rowTotal = calcRowTotal(Number(row.quantity) || 0, Number(row.unitPriceVat) || 0);
  const vatAmt   = calcVat(rowTotal);

  const update = (field, val) => onChange({ ...row, [field]: val });

  return (
    <tr className="border-t border-zinc-100">
      <td className="py-2 pr-2">
        <select
          value={row.productId}
          onChange={e => update('productId', e.target.value)}
          className="w-full border border-zinc-200 rounded px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
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
          className="w-full border border-zinc-200 rounded px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
        >
          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </td>
      <td className="py-2 pr-2">
        <input type="number" min="0" step="0.01"
          value={row.quantity}
          onChange={e => update('quantity', e.target.value)}
          className="w-full border border-zinc-200 rounded px-2 py-1.5 text-xs text-right focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </td>
      <td className="py-2 pr-2">
        <input type="number" min="0" step="0.01"
          value={row.unitPriceVat}
          onChange={e => update('unitPriceVat', e.target.value)}
          className="w-full border border-zinc-200 rounded px-2 py-1.5 text-xs text-right focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </td>
      <td className="py-2 pr-2 text-xs text-right text-zinc-500 whitespace-nowrap">{fmt(vatAmt)}</td>
      <td className="py-2 pr-2 text-xs text-right font-medium text-zinc-800 whitespace-nowrap">{fmt(rowTotal)}</td>
      <td className="py-2 text-center">
        <button onClick={onRemove} className="text-red-400 hover:text-red-600"><X size={14} /></button>
      </td>
    </tr>
  );
}

// ─── SpecForm (inline — shartnoma ichida) ──────────────────────────────────
function SpecForm({ contractId, spec, products, onSaved, onCancel }) {
  const editing = Boolean(spec);
  const [date, setDate]   = useState(spec?.date?.slice(0, 10) || TODAY);
  const [notes, setNotes] = useState(spec?.notes || '');
  const [rows, setRows]   = useState(
    spec?.products?.map(p => ({
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
        toast.success('Spets yangilandi');
        onSaved(data);
      } else {
        const { data } = await api.post('/api/specs', payload);
        toast.success('Spets qo\'shildi');
        onSaved(data);
      }
    } finally { setSaving(false); }
  };

  return (
    <div className="mt-3 border border-zinc-200 rounded-lg p-4 bg-zinc-50 space-y-3">
      <div className="flex gap-3">
        <div>
          <label className="text-xs font-medium text-zinc-500 block mb-1">Sana</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="border border-zinc-200 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white" />
        </div>
        <div className="flex-1">
          <label className="text-xs font-medium text-zinc-500 block mb-1">Izoh</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ixtiyoriy..."
            className="w-full border border-zinc-200 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white" />
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
            <tr className="text-zinc-500">
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
                onChange={val => updateRow(r._key, val)}
                onRemove={() => removeRow(r._key)}
              />
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="text-xs text-zinc-400 py-2 text-center">Mahsulot qo'shing</p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button onClick={addRow}
          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
          <Plus size={13} /> Mahsulot qo'shish
        </button>
        {rows.length > 0 && (
          <span className="text-sm font-bold text-zinc-800">
            Jami: {fmt(totalValue)} so'm
          </span>
        )}
      </div>

      <div className="flex gap-2 justify-end pt-1 border-t border-zinc-200">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-200 rounded-md">
          Bekor
        </button>
        <button onClick={save} disabled={saving}
          className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60 flex items-center gap-1.5">
          {saving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
          {editing ? 'Yangilash' : 'Spets saqlash'}
        </button>
      </div>
    </div>
  );
}

// ─── ContractRow (ro'yxat qatori + expand) ─────────────────────────────────
function ContractRow({ c, idx, products, onEdit, onDelete, onSpecSaved, onSpecDeleted }) {
  const navigate = useNavigate();
  const [expanded, setExpanded]  = useState(false);
  const [specs, setSpecs]        = useState(null);
  const [loadingSpec, setLoading] = useState(false);
  const [addingSpec, setAddingSpec] = useState(false);
  const [editSpec, setEditSpec]  = useState(null);
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

  return (
    <>
      <tr className="hover:bg-zinc-50 transition-colors cursor-pointer" onClick={toggleExpand}>
        <td className="px-4 py-3 text-sm text-zinc-400">{idx}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className={`shrink-0 rounded p-0.5 transition-colors ${expanded ? 'bg-blue-100 text-blue-600' : 'text-zinc-300 hover:text-zinc-500'}`}>
              {expanded
                ? <ChevronDown size={15} />
                : <ChevronRight size={15} />}
            </span>
            <span className="text-sm font-semibold text-zinc-800">{c.client?.name}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-zinc-500 tracking-wide">{fmtInn(c.client?.inn)}</td>
        <td className="px-4 py-3 text-sm font-bold text-zinc-900 font-mono">{c.number}</td>
        <td className="px-4 py-3 text-sm text-zinc-500">{fmtDate(c.date)}</td>
        <td className="px-4 py-3 text-sm text-right font-semibold text-zinc-800">{fmt(c.totalValue)}</td>
        <td className="px-4 py-3 text-sm text-right text-emerald-600 font-medium">{fmt(c.paidAmount)}</td>
        <td className="px-4 py-3 text-sm text-right text-blue-600 font-medium">{fmt(c.deliveredAmount)}</td>
        <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
          <button onClick={toggleExpand}
            className={`text-xs font-medium px-2 py-1 rounded-full transition-colors ${
              expanded ? 'bg-blue-100 text-blue-700' : 'bg-zinc-100 text-zinc-600 hover:bg-blue-50 hover:text-blue-600'
            }`}>
            {c.specCount} spets
          </button>
        </td>
        <td className="px-4 py-3 text-sm text-right text-zinc-400">—</td>
        <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] || STATUS_COLORS.yangi}`}>
            {STATUS_LABELS[c.status] || c.status}
          </span>
        </td>
        <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
          <button onClick={openMenu}
            className="p-1 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600">
            <MoreVertical size={15} />
          </button>
          {menuOpen && menuPos && (
            <div
              style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
              className="bg-white border border-zinc-200 rounded-lg shadow-xl w-44 py-1"
              onMouseDown={e => e.stopPropagation()}
            >
              <button onClick={() => { setMenuOpen(false); onEdit(c); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-zinc-50">
                <Pencil size={14} /> Tahrirlash
              </button>
              <a href={`/api/export/contracts/${c.id}/pdf`} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-zinc-50 text-zinc-700"
                onClick={() => setMenuOpen(false)}>
                <FileText size={14} /> PDF yuklab olish
              </a>
              <a href={`/api/export/contracts/${c.id}/excel`}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-zinc-50 text-zinc-700"
                onClick={() => setMenuOpen(false)}>
                <FileSpreadsheet size={14} /> Excel yuklab olish
              </a>
              <hr className="my-1 border-zinc-100" />
              <button onClick={() => { setMenuOpen(false); onDelete(c); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                <Trash2 size={14} /> O'chirish
              </button>
            </div>
          )}
        </td>
      </tr>

      {/* Expand panel — spetslar */}
      {expanded && (
        <tr>
          <td colSpan={12} className="px-6 pb-4 bg-zinc-50/60">
            <div className="border border-zinc-200 rounded-lg bg-white">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                  Spetsifikatsiyalar
                </span>
                <button onClick={() => { setAddingSpec(true); setEditSpec(null); }}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
                  <Plus size={13} /> Spets qo'shish
                </button>
              </div>

              {loadingSpec && (
                <div className="py-6 text-center text-sm text-zinc-400">Yuklanmoqda...</div>
              )}

              {!loadingSpec && specs?.length === 0 && !addingSpec && (
                <div className="py-6 text-center text-sm text-zinc-400">
                  Hozircha spets yo'q
                </div>
              )}

              {!loadingSpec && specs?.map(spec => (
                <div key={spec.id} className="px-4 py-3 border-b border-zinc-50 last:border-0">
                  {delSpecId === spec.id ? (
                    <div className="flex items-center gap-3 py-1">
                      <AlertTriangle size={15} className="text-amber-500" />
                      <span className="text-sm text-zinc-700">
                        Spets №{spec.number} o'chirilsinmi?
                      </span>
                      <button onClick={() => deleteSpec(spec.id)}
                        className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700">Ha</button>
                      <button onClick={() => setDelSpecId(null)}
                        className="px-3 py-1 text-xs border border-zinc-200 rounded hover:bg-zinc-100">Yo'q</button>
                    </div>
                  ) : editSpec?.id === spec.id ? (
                    <SpecForm
                      contractId={c.id}
                      spec={spec}
                      products={products}
                      onSaved={handleSpecSaved}
                      onCancel={() => setEditSpec(null)}
                    />
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="flex-1 grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-xs text-zinc-400">Spets №</div>
                          <div className="font-semibold text-zinc-800">{spec.number}</div>
                        </div>
                        <div>
                          <div className="text-xs text-zinc-400">Sana</div>
                          <div className="text-zinc-700">{fmtDate(spec.date)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-zinc-400">Summa</div>
                          <div className="font-medium text-zinc-800">{fmt(spec.totalValue)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-zinc-400">Yetkazilgan</div>
                          <div className="font-medium text-blue-600">{fmt(spec.deliveredAmount || 0)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
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
                          className="flex items-center gap-1 px-2 py-1 text-xs text-emerald-700 bg-emerald-50 rounded hover:bg-emerald-100 font-medium">
                          <ShoppingCart size={13} /> Savdo
                        </button>
                        <button onClick={e => openSpecMenu(spec.id, e)}
                          className="p-1 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600">
                          <MoreVertical size={14} />
                        </button>
                        {specMenuId === spec.id && specMenuPos && (
                          <div
                            style={{ position: 'fixed', top: specMenuPos.top, right: specMenuPos.right, zIndex: 9999 }}
                            className="bg-white border border-zinc-200 rounded-lg shadow-xl w-36 py-1"
                            onMouseDown={e => e.stopPropagation()}
                          >
                            <button onClick={() => { setEditSpec(spec); setSpecMenuId(null); setAddingSpec(false); }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-zinc-50">
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
                  )}
                </div>
              ))}

              {addingSpec && (
                <div className="px-4 pb-4">
                  <SpecForm
                    contractId={c.id}
                    spec={null}
                    products={products}
                    onSaved={handleSpecSaved}
                    onCancel={() => setAddingSpec(false)}
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
function ContractForm({ onSaved, onCancel, editContract, products = [] }) {
  const editing = Boolean(editContract);
  const [clients, setClients]       = useState([]);
  const [clientSearch, setClientSearch] = useState(editContract?.client?.name || '');
  const [clientId, setClientId]     = useState(editContract?.clientId || '');
  const [clientDropOpen, setClientDropOpen] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
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
    if (!date)    return toast.error('Sanani kiriting');
    // Spets tekshiruvi — agar bo'lim ochiq va qatorlar bor bo'lsa
    if (showSpec && specRows.length > 0) {
      if (specRows.some(r => !r.productId))   return toast.error('Barcha qatorlarda mahsulot tanlang');
      if (specRows.some(r => !Number(r.quantity)))      return toast.error('Soni kiritilmagan');
      if (specRows.some(r => !Number(r.unitPriceVat)))  return toast.error('Narx kiritilmagan');
    }
    const payload = {
      clientId,
      date,
      totalValue: Number(totalValue) || 0,
      notes,
      status,
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
      <div className="border border-blue-200 rounded-xl bg-blue-50/40 p-5 mb-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-800">
            {editing ? `Shartnoma №${editContract.number} tahrirlash` : 'Yangi shartnoma'}
          </h3>
          <button onClick={onCancel} className="text-zinc-400 hover:text-zinc-600"><X size={16} /></button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Mijoz */}
          <div className="col-span-2 md:col-span-1" ref={clientDropRef}>
            <label className="text-xs font-medium text-zinc-500 block mb-1">Mijoz *</label>
            <div className="relative">
              <input
                value={clientSearch}
                onChange={e => { setClientSearch(e.target.value); setClientDropOpen(true); setClientId(''); }}
                onFocus={() => setClientDropOpen(true)}
                placeholder="Mijoz qidiring..."
                className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              />
              {clientDropOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 z-40 bg-white border border-zinc-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {clients.map(cl => (
                    <button key={cl.id} onClick={() => selectClient(cl)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 flex items-center justify-between">
                      <span>{cl.name}</span>
                      <span className="text-xs text-zinc-400">{cl.inn}</span>
                    </button>
                  ))}
                  <button onClick={() => { setClientDropOpen(false); setShowAddClient(true); }}
                    className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-1 border-t border-zinc-100">
                    <Plus size={13} /> Yangi mijoz qo'shish
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* INN (read-only) */}
          <div>
            <label className="text-xs font-medium text-zinc-500 block mb-1">INN</label>
            <input readOnly
              value={clients.find(c => c.id === clientId)?.inn || ''}
              className="w-full border border-zinc-100 rounded-md px-3 py-2 text-sm bg-zinc-50 text-zinc-500 cursor-default"
            />
          </div>

          {/* Shartnoma raqami */}
          {!editing && (
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1">Shartnoma raqami</label>
              <div className="flex gap-2 items-center">
                <input
                  value={useAuto ? autoNumber : number}
                  onChange={e => setNumber(e.target.value)}
                  readOnly={useAuto}
                  placeholder="26-01"
                  className={`flex-1 border border-zinc-200 rounded-md px-3 py-2 text-sm outline-none ${
                    useAuto ? 'bg-zinc-50 text-zinc-400 cursor-default' : 'focus:ring-2 focus:ring-blue-500 bg-white'
                  }`}
                />
                <label className="flex items-center gap-1.5 text-xs text-zinc-500 cursor-pointer whitespace-nowrap">
                  <input type="checkbox" checked={useAuto} onChange={e => setUseAuto(e.target.checked)}
                    className="rounded" />
                  Avto
                </label>
              </div>
            </div>
          )}

          {/* Sana */}
          <div>
            <label className="text-xs font-medium text-zinc-500 block mb-1">Sana</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white" />
          </div>

          {/* Umumiy summa */}
          <div>
            <label className="text-xs font-medium text-zinc-500 block mb-1">Umumiy summa (so'm)</label>
            <input type="number" min="0" step="0.01"
              value={totalValue}
              onChange={e => setTotalValue(e.target.value)}
              placeholder="0"
              className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-right"
            />
          </div>

          {/* Status */}
          <div>
            <label className="text-xs font-medium text-zinc-500 block mb-1">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
              <option value="yangi">Yangi</option>
              <option value="amalda">Amalda</option>
              <option value="yopilgan">Yopilgan</option>
            </select>
          </div>

          {/* Izoh */}
          <div className="col-span-2">
            <label className="text-xs font-medium text-zinc-500 block mb-1">Izoh</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} placeholder="Ixtiyoriy..."
              className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white resize-none" />
          </div>
        </div>

        {/* ── Spetsifikatsiya bo'limi (faqat yangi shartnomada) ── */}
        {!editing && (
          <div className="border border-zinc-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => { setShowSpec(s => !s); if (!showSpec && specRows.length === 0) addSpecRow(); }}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-zinc-50 hover:bg-zinc-100 transition text-sm font-medium text-zinc-700"
            >
              <span className="flex items-center gap-2">
                <Plus size={15} className={`transition-transform ${showSpec ? 'rotate-45' : ''}`} />
                Spetsifikatsiya qo'shish
                {specRows.length > 0 && (
                  <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                    {specRows.length} mahsulot · {fmt(specTotal)} so'm
                  </span>
                )}
              </span>
              {showSpec
                ? <ChevronDown size={15} className="text-zinc-400" />
                : <ChevronRight size={15} className="text-zinc-400" />}
            </button>

            {showSpec && (
              <div className="p-4 space-y-3">
                <div className="flex gap-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-500 block mb-1">Spets sanasi</label>
                    <input type="date" value={specDate} onChange={e => setSpecDate(e.target.value)}
                      className="border border-zinc-200 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-medium text-zinc-500 block mb-1">Spets izohi</label>
                    <input value={specNotes} onChange={e => setSpecNotes(e.target.value)}
                      placeholder="Ixtiyoriy..."
                      className="w-full border border-zinc-200 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white" />
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
                      <tr className="text-zinc-500">
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
                          onChange={val => updateSpecRow(r._key, val)}
                          onRemove={() => removeSpecRow(r._key)}
                        />
                      ))}
                    </tbody>
                  </table>
                  {specRows.length === 0 && (
                    <p className="text-xs text-zinc-400 py-2 text-center">Mahsulot qo'shing</p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <button type="button" onClick={addSpecRow}
                    className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                    <Plus size={13} /> Mahsulot qo'shish
                  </button>
                  {specRows.length > 0 && (
                    <span className="text-sm font-bold text-zinc-800">
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
            className="px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 rounded-md">
            Bekor (Esc)
          </button>
          <button onClick={save} disabled={saving}
            className="px-5 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60 flex items-center gap-1.5">
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

export default function Contracts() {
  const [contracts, setContracts] = useState([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(false);
  const [search, setSearch]       = useState('');
  const [status, setStatus]       = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy]       = useState('createdAt');
  const [sortDir, setSortDir]     = useState('desc');
  const [products, setProducts]   = useState([]);
  const [editContract, setEditContract] = useState(null);
  const [delContract, setDelContract]  = useState(null);
  const form = useInlineForm();
  const LIMIT = 20;

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Mahsulotlar ro'yxati (spec forma uchun)
  useEffect(() => {
    api.get('/api/products?limit=200').then(r => setProducts(r.data.data || [])).catch(() => {});
  }, []);

  const load = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: p, limit: LIMIT, sortBy, sortDir,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(status          ? { status }                   : {}),
      });
      const { data } = await api.get(`/api/contracts?${params}`);
      setContracts(data.data);
      setTotal(data.total);
    } finally { setLoading(false); }
  }, [page, debouncedSearch, status, sortBy, sortDir]);

  const toggleSort = (col) => {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
    setPage(1);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(page); }, [page, debouncedSearch, status, sortBy, sortDir]); // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <div className="p-8 space-y-5">
      {/* Delete confirm modal */}
      {delContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="text-amber-500 shrink-0" size={22} />
              <div>
                <p className="font-semibold text-zinc-900">Shartnomani o'chirish</p>
                <p className="text-sm text-zinc-500 mt-0.5">
                  №{delContract.number} — {delContract.client?.name}
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDelContract(null)}
                className="px-3 py-2 text-sm border border-zinc-200 rounded-md hover:bg-zinc-50">
                Bekor
              </button>
              <button onClick={deleteContract}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700">
                O'chirish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Shartnomalar</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Jami: {total} ta</p>
        </div>
        <button onClick={() => { form.toggle(); setEditContract(null); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition">
          <Plus size={16} />
          {form.isOpen ? 'Yopish' : 'Yangi shartnoma'}
        </button>
      </div>

      {/* Inline form */}
      {form.isOpen && !editContract && (
        <ContractForm
          onSaved={handleSaved}
          onCancel={form.close}
          editContract={null}
          products={products}
        />
      )}
      {editContract && (
        <ContractForm
          onSaved={handleSaved}
          onCancel={() => setEditContract(null)}
          editContract={editContract}
          products={products}
        />
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <input
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Qidirish: mijoz, INN, raqam..."
          className="flex-1 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
        />
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
          className="border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
          <option value="">Barcha status</option>
          <option value="yangi">Yangi</option>
          <option value="amalda">Amalda</option>
          <option value="yopilgan">Yopilgan</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 w-10">#</th>
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
                      ${col ? 'cursor-pointer hover:text-zinc-700 text-zinc-400' : 'text-zinc-400'}`}
                    onClick={col ? () => toggleSort(col) : undefined}
                  >
                    <span className="inline-flex items-center gap-1">
                      {label}
                      {col && (
                        <span className={`text-[10px] ${sortBy === col ? 'text-blue-500' : 'text-zinc-300'}`}>
                          {sortBy === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                      )}
                    </span>
                  </th>
                ))}
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(12)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-zinc-100 animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : contracts.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-sm text-zinc-400">
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
                    onEdit={(c) => { setEditContract(c); form.close(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    onDelete={setDelContract}
                    onSpecSaved={() => load(page)}
                    onSpecDeleted={() => load(page)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {total > LIMIT && (
          <div className="border-t border-zinc-100 px-4 py-3">
            <Pagination page={page} total={total} limit={LIMIT} onChange={setPage} />
          </div>
        )}
      </div>

    </div>
  );
}
