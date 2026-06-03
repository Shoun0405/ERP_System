import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useModalKeys } from '../hooks/useModalKeys';
import { useSearchOnEnter } from '../hooks/useSearchOnEnter';
import api from '../lib/api';
import toast from 'react-hot-toast';
import Pagination from '../components/Pagination';
import AuditCell from '../components/AuditCell';
import { useUsersLookup } from '../hooks/useUsersLookup';
import { downloadFile } from '../lib/download';
import { fmt } from '../lib/format';
import { Search, Plus, X, Edit2, Trash2, ChevronDown, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Download, FileText, Copy } from 'lucide-react';

const EMPTY = { name:'', inn:'', phone:'', director:'', address:'', category:'', status:'Yangi', account:'', mfo:'', bank:'', seller:'' };
const SC = {
  'Faol': 'bg-[oklch(0.96_0.04_155)] text-[oklch(0.38_0.10_155)] border-[oklch(0.88_0.06_155)]',
  "Muddati o'tgan": 'bg-[oklch(0.96_0.04_25)] text-[oklch(0.42_0.13_25)] border-[oklch(0.88_0.07_25)]',
  'Yangi': 'bg-[oklch(0.96_0.03_250)] text-[var(--accent)] border-[oklch(0.88_0.05_250)]',
  'Kutilmoqda': 'bg-[oklch(0.96_0.05_80)] text-[oklch(0.40_0.12_70)] border-[oklch(0.88_0.08_80)]'
};

const fmtINN = v => { if (!v) return ''; const d=v.replace(/\D/g,'').slice(0,9); return d.replace(/(\d{3})(\d{3})(\d{1,3})/,'$1 $2 $3').trim(); };
const rawINN = v => v.replace(/\D/g,'');
const fmtPhone = raw => {
  if(!raw) return '';
  const d = raw.replace(/\D/g,'').replace(/^998/,'').slice(0,9);
  let s=''; if(d.length>0)s=d.slice(0,2); if(d.length>2)s+=' '+d.slice(2,5); if(d.length>5)s+=' '+d.slice(5,7); if(d.length>7)s+=' '+d.slice(7,9);
  return s ? '+998 '+s : '';
};
const rawPhone = v => { const d=v.replace(/\D/g,'').replace(/^998/,'').slice(0,9); return d ? '+998'+d : ''; };

function SortIcon({ col, sort }) {
  if(sort.col!==col) return <ArrowUpDown size={12} className="text-[var(--text-3)] ml-1 inline"/>;
  return sort.dir==='asc' ? <ArrowUp size={12} className="text-[var(--accent)] ml-1 inline"/> : <ArrowDown size={12} className="text-[var(--accent)] ml-1 inline"/>;
}

function MultiSellerSelect({ sellers, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  
  const selectedList = value ? value.split(', ').filter(Boolean) : [];
  
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const toggleSeller = (s) => {
    let newList;
    if (selectedList.includes(s)) {
      newList = selectedList.filter(x => x !== s);
    } else {
      newList = [...selectedList, s];
    }
    onChange(newList.join(', '));
  };

  return (
    <div ref={ref} className="relative text-left">
      <div
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 rounded-md text-sm cursor-pointer min-h-[38px] flex flex-wrap gap-1 items-center justify-between"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
      >
        <div className="flex flex-wrap gap-1">
          {selectedList.length === 0 ? (
            <span style={{ color: 'var(--text-3)' }}>Sotuvchilarni tanlang...</span>
          ) : (
            selectedList.map(s => (
              <span key={s} className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--border)' }}>
                {s}
              </span>
            ))
          )}
        </div>
        <ChevronDown size={14} style={{ color: 'var(--text-3)' }} />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md shadow-lg max-h-48 overflow-y-auto" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {sellers.map(s => {
            const isSelected = selectedList.includes(s);
            return (
              <div
                key={s}
                onClick={() => toggleSeller(s)}
                className="px-3 py-2 text-sm cursor-pointer flex items-center gap-2 transition-colors"
                style={{ color: 'var(--text)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  readOnly
                  className="rounded"
                  style={{ accentColor: 'var(--accent)' }}
                />
                <span>{s}</span>
              </div>
            );
          })}
          {sellers.length === 0 && (
            <div className="px-3 py-4 text-center text-xs" style={{ color: 'var(--text-3)' }}>
              Sotuvchilar topilmadi (sozlamalardan qo&#8217;shing)
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Clients({ user }) {
  const canCreate = user?.role === 'admin' || user?.permissions?.clients?.create !== false;
  const canUpdate = user?.role === 'admin' || user?.permissions?.clients?.update !== false;
  const canDelete = user?.role === 'admin' || user?.permissions?.clients?.delete === true;
  const canHardDelete = user?.role === 'superAdmin';

  const canCreateContract = user?.role === 'admin' || user?.permissions?.contracts?.create !== false;
  const canUpdateContract = user?.role === 'admin' || user?.permissions?.contracts?.update !== false;
  const canDeleteContract = user?.role === 'admin' || user?.permissions?.contracts?.delete === true;

  const auditUsers = useUsersLookup();

  const [clients,  setClients]  = useState([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const LIMIT = 50;

  const [loading,  setLoading]  = useState(true);
  const [sellers,  setSellers]  = useState([]);
  const [searchParams] = useSearchParams();
  const { text: search, setText: setSearch, query: debouncedSearch, setQuery: commitSearch, inputProps: searchInput } = useSearchOnEnter(searchParams.get('q') || '', () => setPage(1));
  const [sort,     setSort]     = useState({ col:'createdAt', dir:'desc' });
  const [debtFilter, setDebtFilter] = useState('barchasi');
  const [expanded, setExpanded] = useState(null);
  const [expandContracts, setExpandContracts] = useState({});
  const [modal,    setModal]    = useState(null);
  const [editId,   setEditId]   = useState(null);
  const [form,     setForm]     = useState(EMPTY);
  const [errors,   setErrors]   = useState({});
  const [saving,   setSaving]   = useState(false);
  const [delId,    setDelId]    = useState(null);
  const [phoneInput, setPhoneInput] = useState('');

  // Shartnoma CRUD state
  const EMPTY_CONTRACT = { number: '', date: '', totalValue: '', seller: '' };
  const [contractModal,  setContractModal]  = useState(null); // 'add' | 'edit' | null
  const [contractForm,   setContractForm]   = useState(EMPTY_CONTRACT);
  const [contractEditId, setContractEditId] = useState(null);
  const [contractClientId, setContractClientId] = useState(null);
  const [contractSaving, setContractSaving] = useState(false);
  const [delContractId,  setDelContractId]  = useState(null);

  // Global header ?q= param — qidiruvni darhol qo'llaydi (text + query birga)
  useEffect(() => {
    const q = searchParams.get('q');
    if (q !== null) { setSearch(q); commitSearch(q); }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPage(1);
  }, [debtFilter]);

  const fetchClients = useCallback(() => {
    setLoading(true);
    api.get('/api/clients', {
      params: { page, limit: LIMIT, search: debouncedSearch, sortBy: sort.col, sortDir: sort.dir, debtFilter },
    }).then(r => {
      setClients(r.data.data);
      setTotal(r.data.total);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [page, debouncedSearch, sort, debtFilter]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  useEffect(() => {
    api.get('/api/settings').then(r => setSellers(r.data.sellers || [])).catch(() => {});
  }, []);

  const validate = () => {
    const e={};
    if(!form.name.trim()) e.name='Nom majburiy';
    const inn=rawINN(form.inn);
    if(inn&&inn.length!==9) e.inn='INN aynan 9 ta raqam bo\'lishi kerak';
    if(form.account&&form.account.replace(/\D/g,'').length!==20) e.account='Hisob raqam aynan 20 ta raqam bo\'lishi kerak';
    if(form.mfo&&form.mfo.replace(/\D/g,'').length!==5) e.mfo='MFO aynan 5 ta raqam bo\'lishi kerak';
    const phone=rawPhone(phoneInput);
    if(phoneInput&&phone.replace(/\D/g,'').replace(/^998/,'').length!==9) e.phone='Telefon +998 dan keyin 9 ta raqam bo\'lishi kerak';
    return e;
  };

  const openAdd = () => { setForm(EMPTY); setPhoneInput(''); setEditId(null); setErrors({}); setModal('add'); };
  const openEdit = c => {
    setForm({ name:c.name||'', inn:fmtINN(c.inn||''), phone:c.phone||'', director:c.director||'', address:c.address||'', category:c.category||'', status:c.status||'Yangi', account:c.account||'', mfo:c.mfo||'', bank:c.bank||'', seller:c.seller||'' });
    setPhoneInput(fmtPhone(c.phone||''));
    setEditId(c.id); setErrors({}); setModal('edit');
  };
  const handleCopy = c => {
    setForm({ name:(c.name||'') + ' - KOPYA', inn:fmtINN(c.inn||''), phone:c.phone||'', director:c.director||'', address:c.address||'', category:c.category||'', status:c.status||'Yangi', account:c.account||'', mfo:c.mfo||'', bank:c.bank||'', seller:c.seller||'' });
    setPhoneInput(fmtPhone(c.phone||''));
    setEditId(null); setErrors({}); setModal('add');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const closeModal = () => { setModal(null); setEditId(null); };

  const handleSave = async e => {
    if(e) e.preventDefault();
    const errs = validate();
    if(Object.keys(errs).length){ setErrors(errs); return; }
    setSaving(true);
    const payload = { ...form, inn:fmtINN(form.inn), phone:rawPhone(phoneInput) };
    try {
      if(modal==='add') await api.post('/api/clients', payload);
      else await api.put(`/api/clients/${editId}`, payload);
      toast.success(modal==='add' ? 'Mijoz qo\'shildi' : 'Mijoz yangilandi');
      fetchClients(); closeModal();
    } catch { /* interceptor shows toast */ }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try { await api.delete(`/api/clients/${delId}`); setDelId(null); fetchClients(); toast.success('O\'chirildi'); }
    catch { /* interceptor shows toast */ }
  };

  const handleRestore = async (rec) => {
    try { await api.post(`/api/clients/${rec.id}/restore`); toast.success('Tiklandi'); fetchClients(); }
    catch { /* interceptor toast */ }
  };
  const handleHardDelete = async (rec) => {
    if (!window.confirm('Butunlay o\'chirilsinmi? Bu amalni qaytarib bo\'lmaydi.')) return;
    try { await api.delete(`/api/clients/${rec.id}/hard`); toast.success('Butunlay o\'chirildi'); fetchClients(); }
    catch { /* interceptor toast */ }
  };

  const handleExport = () => {
    const qs = new URLSearchParams({
      search: debouncedSearch, sortBy: sort.col, sortDir: sort.dir, debtFilter,
    }).toString();
    downloadFile(`/api/export/clients/excel?${qs}`, `mijozlar_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const toggleSort = col => {
    setSort(s => ({ col, dir: s.col===col && s.dir==='asc' ? 'desc' : 'asc' }));
    setPage(1);
  };

  const loadContracts = async (id, force = false) => {
    if(!force && expandContracts[id]) return;
    try { const r=await api.get(`/api/contracts?clientId=${id}`); setExpandContracts(p=>({...p,[id]:r.data.data||[]})); }
    catch{ setExpandContracts(p=>({...p,[id]:[]})); }
  };

  const toggleExpand = async id => {
    if(expanded===id){ setExpanded(null); return; }
    setExpanded(id); await loadContracts(id);
  };

  const openContractAdd = (clientId) => {
    setContractForm(EMPTY_CONTRACT);
    setContractEditId(null);
    setContractClientId(clientId);
    setContractModal('add');
  };
  const openContractEdit = (ct, clientId) => {
    setContractForm({ number: ct.number, date: ct.date.split('T')[0], totalValue: String(ct.totalValue), seller: ct.seller || '' });
    setContractEditId(ct.id);
    setContractClientId(clientId);
    setContractModal('edit');
  };
  const closeContractModal = () => { setContractModal(null); setContractEditId(null); setContractClientId(null); };

  const handleContractSave = async (e) => {
    if (e) e.preventDefault();
    if (!contractForm.number.trim()) { toast.error('Shartnoma raqami majburiy!'); return; }
    if (!contractForm.date)          { toast.error('Sanani kiriting!'); return; }
    if (!contractForm.totalValue || parseFloat(contractForm.totalValue) < 0) { toast.error('Summani kiriting!'); return; }
    if (!contractForm.seller)        { toast.error('Sotuvchini tanlang!'); return; }
    setContractSaving(true);
    const payload = { number: contractForm.number, date: contractForm.date, totalValue: parseFloat(contractForm.totalValue), seller: contractForm.seller, clientId: contractClientId };
    try {
      if (contractModal === 'edit') {
        await api.put(`/api/contracts/${contractEditId}`, payload);
        toast.success('Shartnoma yangilandi');
      } else {
        await api.post('/api/contracts', payload);
        toast.success("Shartnoma qo'shildi");
      }
      closeContractModal();
      await loadContracts(contractClientId, true);
    } catch { /* interceptor shows toast */ } finally { setContractSaving(false); }
  };

  const handleContractDelete = async () => {
    const { id, clientId } = delContractId;
    try {
      await api.delete(`/api/contracts/${id}`);
      setDelContractId(null);
      toast.success("O'chirildi");
      await loadContracts(clientId, true);
    } catch { /* interceptor shows toast */ }
  };

  useModalKeys(!!modal, handleSave, closeModal);
  useModalKeys(!!contractModal, handleContractSave, closeContractModal);

  const inp = (field) => `w-full px-3 py-2 bg-[var(--surface)] border ${errors[field]?'border-red-400':'border-[var(--border)]'} rounded-lg text-xs focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] outline-none transition text-[var(--text)]`;
  const COLS = 9;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">Mijozlar (CRM)</h2>
            <p className="text-xs text-[var(--text-3)] mt-0.5">{total} ta mijoz</p>
          </div>
          {canCreate && (
            <button onClick={openAdd} className="px-3 py-1.5 btn-primary rounded-lg text-xs font-medium transition flex items-center gap-2 shadow-sm">
              <Plus size={16} strokeWidth={2.2}/> Yangi Mijoz
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-2)] text-[var(--text-2)] rounded-lg text-xs font-medium transition flex items-center gap-2 shadow-sm">
            <Download size={16} strokeWidth={2.2}/> Excel
          </button>
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

      {/* Inline Accordion Form for adding Client */}
      {modal === 'add' && (
        <div className="mini-card p-6 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex justify-between items-center border-b border-[var(--border)] pb-3">
            <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
              <Plus size={18} strokeWidth={2.2} className="text-[var(--accent)]"/>
              Yangi Mijoz Qo'shish
            </h3>
            <button onClick={closeModal} className="text-[var(--text-3)] hover:text-[var(--text)] p-1 rounded-md hover:bg-[var(--surface-2)]">
              <X size={18} strokeWidth={2.2}/>
            </button>
          </div>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-[var(--text-2)] mb-1">Tashkilot nomi *</label>
                <input autoFocus type="text" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className={inp('name')} placeholder="MChJ, XK..."/>
                {errors.name&&<p className="text-[10px] text-red-500 mt-0.5">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-2)] mb-1">STIR (INN)</label>
                <input type="text" value={form.inn} onChange={e=>setForm(f=>({...f,inn:fmtINN(e.target.value)}))} className={inp('inn')} placeholder="123 456 789"/>
                {errors.inn&&<p className="text-[10px] text-red-500 mt-0.5">{errors.inn}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-2)] mb-1">Direktor</label>
                <input type="text" value={form.director} onChange={e=>setForm(f=>({...f,director:e.target.value}))} className={inp('director')} placeholder="F.I.O."/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-2)] mb-1">Telefon</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] text-xs font-medium pointer-events-none">+998</span>
                  <input type="text" value={phoneInput.replace('+998 ','')} onChange={e=>{
                    const d=e.target.value.replace(/\D/g,'').slice(0,9);
                    let s=''; if(d.length>0)s=d.slice(0,2); if(d.length>2)s+=' '+d.slice(2,5); if(d.length>5)s+=' '+d.slice(5,7); if(d.length>7)s+=' '+d.slice(7,9);
                    setPhoneInput(s?'+998 '+s:'');
                  }} className={`${inp('phone')} pl-12`} placeholder="90 123 45 67"/>
                </div>
                {errors.phone&&<p className="text-[10px] text-red-500 mt-0.5">{errors.phone}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-2)] mb-1">Holati</label>
                <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} className={inp('status')}>
                  <option>Yangi</option><option>Faol</option><option>Kutilmoqda</option><option>Muddati o'tgan</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-2)] mb-1">Kategoriya</label>
                <input type="text" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} className={inp('category')} placeholder="Qurilish, Savdo..."/>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-[var(--text-2)] mb-1">Manzil</label>
                <input type="text" value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} className={inp('address')} placeholder="Shahar, ko'cha, uy..."/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-2)] mb-1">Hisob raqam</label>
                <input type="text" value={form.account} onChange={e=>setForm(f=>({...f,account:e.target.value.replace(/\D/g,'').slice(0,20)}))} className={inp('account')} placeholder="20200000000000000000"/>
                {errors.account&&<p className="text-[10px] text-red-500 mt-0.5">{errors.account}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-2)] mb-1">MFO</label>
                <input type="text" value={form.mfo} onChange={e=>setForm(f=>({...f,mfo:e.target.value.replace(/\D/g,'').slice(0,5)}))} className={inp('mfo')} placeholder="01234"/>
                {errors.mfo&&<p className="text-[10px] text-red-500 mt-0.5">{errors.mfo}</p>}
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-[var(--text-2)] mb-1">Bank nomi</label>
                <input type="text" value={form.bank} onChange={e=>setForm(f=>({...f,bank:e.target.value}))} className={inp('bank')} placeholder="Bank nomi (shartnoma rekvizitlarida)"/>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-[var(--text-2)] mb-1">Mas'ul sotuvchi</label>
                <MultiSellerSelect sellers={sellers} value={form.seller} onChange={v=>setForm(f=>({...f,seller:v}))}/>
              </div>
            </div>
            <div className="pt-3 border-t border-[var(--border)] flex justify-end gap-2">
              <button type="button" onClick={closeModal} className="px-3 py-1.5 text-xs font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] rounded-lg border border-[var(--border)] transition">Bekor qilish</button>
              <button type="submit" disabled={saving} className="px-4 py-1.5 bg-[var(--accent)] hover:opacity-90 disabled:opacity-60 text-[var(--accent-text)] text-xs font-medium rounded-lg transition shadow-sm">
                {saving?'Saqlanmoqda...':'Saqlash'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="mini-card p-0">
        <div className="px-5 py-3 border-b border-[var(--border)] bg-[var(--surface-2)] flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={16} strokeWidth={2.2} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]"/>
            <input type="text" placeholder="Mijoz, STIR, telefon, sotuvchi (Enter)..." {...searchInput}
              className="pl-9 pr-4 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs w-full focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] outline-none transition text-[var(--text)] placeholder-[var(--text-3)]"/>
          </div>
          {search&&<span className="text-xs text-[var(--text-3)]">{total} natija</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {[['name','Mijoz / Tashkilot'],['inn','STIR'],['phone','Telefon'],['seller','Sotuvchi'],['status','Holati'],['debt','Qarzdorlik']].map(([col,label])=>(
                  <th key={col} onClick={()=>toggleSort(col)} className="px-5 py-3 text-[10.5px] font-semibold text-[var(--text-2)] uppercase tracking-wider cursor-pointer hover:text-[var(--text)] select-none whitespace-nowrap">
                    {label}<SortIcon col={col} sort={sort}/>
                  </th>
                ))}
                <th className="px-5 py-3 text-[10.5px] font-semibold text-[var(--text-2)] uppercase tracking-wider whitespace-nowrap">Kim / Qachon</th>
                <th className="px-5 py-3 w-24 bg-[var(--surface-2)]"/>
              </tr>
            </thead>
            <tbody>
              {loading ? [...Array(5)].map((_,i)=>(
                <tr key={i}>{[...Array(COLS)].map((_,j)=>(
                  <td key={j} className="px-5 py-3"><div className="h-4 bg-[var(--surface-2)] animate-pulse rounded"/></td>
                ))}</tr>
              )) : clients.length===0 ? (
                <tr><td colSpan={COLS} className="px-5 py-12 text-center">
                  {search ? (
                    <span className="text-[var(--text-3)] text-xs">Topilmadi</span>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <span className="text-[var(--text-3)] text-xs">Hozircha mijozlar yo'q</span>
                      {canCreate && (
                        <button onClick={openAdd} className="px-3 py-1.5 btn-primary rounded-lg text-xs font-medium inline-flex items-center gap-2 shadow-sm">
                          <Plus size={15} strokeWidth={2.2}/> Birinchi mijozni qo'shing
                        </button>
                      )}
                    </div>
                  )}
                </td></tr>
              ) : clients.map(c=>(
                <Fragment key={c.id}>
                  <tr onClick={()=>toggleExpand(c.id)} className={`hover:bg-[var(--surface-2)] border-b border-[var(--border)] transition-colors group cursor-pointer ${expanded===c.id?'bg-[var(--surface-2)]':''}${c.deletedAt?' opacity-60 bg-red-50 dark:bg-red-950/20':''}`}>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className={`shrink-0 rounded p-0.5 transition-colors ${expanded===c.id ? 'text-[var(--accent)]' : 'text-[var(--text-3)] group-hover:text-[var(--text-2)]'}`}>
                          {expanded===c.id ? <ChevronDown size={16} strokeWidth={2.2}/> : <ChevronRight size={16} strokeWidth={2.2}/>}
                        </span>
                        <div className="w-7 h-7 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] text-[11px] font-semibold shrink-0">{c.name.charAt(0).toUpperCase()}</div>
                        <div>
                          <p className="text-xs font-semibold text-[var(--text)]">{c.name}</p>
                          {c.director&&<p className="text-[10px] text-[var(--text-3)] mt-0.5">{c.director}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-2.5 text-xs text-[var(--text-2)] font-mono tracking-tight">{fmtINN(c.inn||'')}</td>
                    <td className="px-5 py-2.5 text-xs text-[var(--text)]">{fmtPhone(c.phone||'')||<span className="text-[var(--text-3)]">—</span>}</td>
                    <td className="px-5 py-2.5 text-xs text-[var(--text-2)]">{c.seller||<span className="text-[var(--text-3)]">—</span>}</td>
                    <td className="px-5 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${SC[c.status]||SC['Yangi']}`}>{c.status||'Yangi'}</span>
                    </td>
                    <td className="px-5 py-2.5 text-xs text-right font-semibold font-mono">
                      {c.debt>0?<span className="text-red-500">{fmt(c.debt)} UZS</span>:c.debt<0?<span className="text-emerald-600">+{fmt(Math.abs(c.debt))} UZS</span>:<span className="text-[var(--text-3)]">0</span>}
                    </td>
                    <td className="px-5 py-2.5"><AuditCell record={c} users={auditUsers} /></td>
                    <td className="px-5 py-2.5" onClick={e=>e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {c.deletedAt ? (
                          <>
                            <span className="text-[10px] text-red-500 font-semibold">O'chirilgan</span>
                            {canHardDelete && (
                              <>
                                <button onClick={()=>handleRestore(c)} className="text-[10px] text-[var(--accent)] font-semibold hover:underline px-1" title="Tiklash">Tiklash</button>
                                <button onClick={()=>handleHardDelete(c)} className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition" title="Butunlay o'chirish"><Trash2 size={15} strokeWidth={1.8}/></button>
                              </>
                            )}
                          </>
                        ) : (
                          <>
                            <button onClick={()=>handleCopy(c)} className="p-1 text-[var(--text-3)] hover:text-[var(--accent)] hover:bg-[var(--surface-2)] rounded transition opacity-0 group-hover:opacity-100" title="Nusxa olish"><Copy size={15} strokeWidth={1.8}/></button>
                            {canUpdate && (
                              <button onClick={()=>openEdit(c)} className="p-1 text-[var(--text-3)] hover:text-[var(--accent)] hover:bg-[var(--surface-2)] rounded transition opacity-0 group-hover:opacity-100" title="Tahrirlash"><Edit2 size={15} strokeWidth={1.8}/></button>
                            )}
                            {canDelete && (
                              <button onClick={()=>setDelId(c.id)} className="p-1 text-[var(--text-3)] hover:text-red-500 hover:bg-red-50 rounded transition opacity-0 group-hover:opacity-100" title="O'chirish"><Trash2 size={15} strokeWidth={1.8}/></button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expanded===c.id&&(
                    <tr className="bg-[var(--surface-2)]/60">
                      <td colSpan={COLS} className="px-5 py-3 border-b border-[var(--border)]">
                        <div className="grid grid-cols-3 gap-6 animate-in">
                          <div className="col-span-2 space-y-3">
                            <p className="text-[10px] font-semibold text-[var(--text-3)] uppercase tracking-wider mb-2">Rekvizitlar</p>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                              {[['STIR',fmtINN(c.inn||'')],['Telefon',fmtPhone(c.phone||'')],['Manzil',c.address],['Kategoriya',c.category],['Hisob raqam',c.account],['MFO',c.mfo],['Direktor',c.director],['Sotuvchi',c.seller]].map(([label,val])=>val?(
                                <div key={label} className="flex gap-2">
                                  <span className="text-[var(--text-3)] shrink-0">{label}:</span>
                                  <span className="text-[var(--text)] font-medium font-mono text-[11px]">{val}</span>
                                </div>
                              ):null)}
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              {canCreateContract && (
                                <button onClick={() => openContractAdd(c.id)}
                                  className="flex items-center gap-0.5 text-xs text-[var(--accent)] hover:underline font-medium">
                                  <Plus size={11}/> Yangi shartnoma qo'shish
                                </button>
                              )}
                              <span className="text-[10px] font-semibold text-[var(--text-3)] uppercase tracking-wider">Shartnomalar</span>
                            </div>
                            {!expandContracts[c.id] ? (
                              <p className="text-xs text-[var(--text-3)]">Yuklanmoqda...</p>
                            ) : expandContracts[c.id].length === 0 ? (
                              <p className="text-xs text-[var(--text-3)]">Shartnomalar yo'q</p>
                            ) : (
                              <div className="space-y-1.5">
                                {expandContracts[c.id].map(ct => (
                                  <div key={ct.id} className="flex items-center justify-between text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 group/ct shadow-sm">
                                    <span className="font-semibold text-[var(--text)]">№{ct.number}</span>
                                    <span className="text-[var(--text-3)] font-mono text-[10px]">{new Date(ct.date).toLocaleDateString('uz-UZ')}</span>
                                    <span className="text-[var(--accent)] font-semibold font-mono">{fmt(ct.totalValue)}</span>
                                    <div className="flex gap-1 opacity-0 group-hover/ct:opacity-100 transition-opacity">
                                      {canUpdateContract && (
                                        <button onClick={() => openContractEdit(ct, c.id)} className="p-0.5 text-[var(--text-3)] hover:text-[var(--accent)] rounded"><Edit2 size={10}/></button>
                                      )}
                                      {canDeleteContract && (
                                        <button onClick={() => setDelContractId({ id: ct.id, clientId: c.id })} className="p-0.5 text-[var(--text-3)] hover:text-red-500 rounded"><Trash2 size={10}/></button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={total} limit={LIMIT} onPage={p => { setPage(p); setExpanded(null); }} />
      </div>

      {modal === 'edit' && (
        <div className="modal-overlay">
          <div className="modal-card w-full max-w-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--border)] flex justify-between items-center">
              <h3 className="text-lg font-bold text-[var(--text)]">Mijozni tahrirlash</h3>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--text-3)]">Ctrl+Enter — saqlash · Esc — yopish</span>
                <button onClick={closeModal} className="text-[var(--text-3)] hover:text-[var(--text)] p-1 rounded-md hover:bg-[var(--surface-2)]"><X size={20}/></button>
              </div>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-[var(--text-2)] mb-1">Tashkilot nomi *</label>
                  <input autoFocus type="text" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className={inp('name')} placeholder="MChJ, XK..."/>
                  {errors.name&&<p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-2)] mb-1">STIR (INN) <span className="text-[var(--text-3)] font-normal">— ixtiyoriy, 9 xona</span></label>
                  <input type="text" value={form.inn} onChange={e=>setForm(f=>({...f,inn:fmtINN(e.target.value)}))} className={inp('inn')} placeholder="123 456 789"/>
                  {errors.inn&&<p className="text-xs text-red-500 mt-1">{errors.inn}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-2)] mb-1">Direktor</label>
                  <input type="text" value={form.director} onChange={e=>setForm(f=>({...f,director:e.target.value}))} className={inp('director')} placeholder="F.I.O."/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-2)] mb-1">Telefon <span className="text-[var(--text-3)] font-normal">— max 9 raqam</span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] text-sm font-medium pointer-events-none">+998</span>
                    <input type="text" value={phoneInput.replace('+998 ','')} onChange={e=>{
                      const d=e.target.value.replace(/\D/g,'').slice(0,9);
                      let s=''; if(d.length>0)s=d.slice(0,2); if(d.length>2)s+=' '+d.slice(2,5); if(d.length>5)s+=' '+d.slice(5,7); if(d.length>7)s+=' '+d.slice(7,9);
                      setPhoneInput(s?'+998 '+s:'');
                    }} className={`${inp('phone')} pl-12`} placeholder="90 123 45 67"/>
                  </div>
                  {errors.phone&&<p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-2)] mb-1">Holati</label>
                  <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} className={inp('status')}>
                    <option>Yangi</option><option>Faol</option><option>Kutilmoqda</option><option>Muddati o'tgan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-2)] mb-1">Kategoriya</label>
                  <input type="text" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} className={inp('category')} placeholder="Qurilish, Savdo..."/>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-[var(--text-2)] mb-1">Manzil</label>
                  <input type="text" value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} className={inp('address')} placeholder="Shahar, ko'cha, uy..."/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-2)] mb-1">Hisob raqam <span className="text-[var(--text-3)] font-normal">— 20 xona</span></label>
                  <input type="text" value={form.account} onChange={e=>setForm(f=>({...f,account:e.target.value.replace(/\D/g,'').slice(0,20)}))} className={inp('account')} placeholder="20200000000000000000"/>
                  {errors.account&&<p className="text-xs text-red-500 mt-1">{errors.account}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-2)] mb-1">MFO <span className="text-[var(--text-3)] font-normal">— 5 xona</span></label>
                  <input type="text" value={form.mfo} onChange={e=>setForm(f=>({...f,mfo:e.target.value.replace(/\D/g,'').slice(0,5)}))} className={inp('mfo')} placeholder="01234"/>
                  {errors.mfo&&<p className="text-xs text-red-500 mt-1">{errors.mfo}</p>}
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-[var(--text-2)] mb-1">Bank nomi</label>
                  <input type="text" value={form.bank} onChange={e=>setForm(f=>({...f,bank:e.target.value}))} className={inp('bank')} placeholder="Bank nomi (shartnoma rekvizitlarida)"/>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-[var(--text-2)] mb-1">Mas'ul sotuvchi</label>
                  <MultiSellerSelect sellers={sellers} value={form.seller} onChange={v=>setForm(f=>({...f,seller:v}))}/>
                </div>
              </div>
              <div className="pt-4 border-t border-[var(--border)] flex justify-end gap-3">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] rounded-md transition">Bekor qilish</button>
                <button type="submit" disabled={saving} className="px-5 py-2 btn-primary disabled:opacity-60 text-sm font-medium rounded-md transition shadow-sm">
                  {saving?'Saqlanmoqda...':'Saqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {delId&&(
        <div className="modal-overlay">
          <div className="modal-card w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={22} className="text-red-600"/></div>
            <h3 className="text-lg font-bold text-[var(--text)] mb-2">Mijozni o'chirish</h3>
            <p className="text-sm text-[var(--text-3)] mb-6">Bu amalni ortga qaytarib bo'lmaydi.</p>
            <div className="flex gap-3">
              <button onClick={()=>setDelId(null)} className="flex-1 px-4 py-2 text-sm font-medium border border-[var(--border)] rounded-md hover:bg-[var(--surface-2)] transition">Bekor</button>
              <button onClick={handleDelete} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition">O'chirish</button>
            </div>
          </div>
        </div>
      )}

      {contractModal && (
        <div className="modal-overlay">
          <div className="modal-card w-full max-w-md">
            <div className="px-6 py-4 border-b border-[var(--border)] flex justify-between items-center">
              <h3 className="text-lg font-bold text-[var(--text)] flex items-center gap-2">
                <FileText size={18} className="text-[var(--accent)]"/>
                {contractModal === 'edit' ? 'Shartnomani tahrirlash' : 'Yangi shartnoma'}
              </h3>
              <button onClick={closeContractModal} className="text-[var(--text-3)] hover:text-[var(--text)] p-1 rounded-md hover:bg-[var(--surface-2)]"><X size={20}/></button>
            </div>
            <form onSubmit={handleContractSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-2)] mb-1">Shartnoma raqami *</label>
                <input type="text" value={contractForm.number} onChange={e => setContractForm(f => ({ ...f, number: e.target.value }))}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none transition"
                  placeholder="2024/001"/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-2)] mb-1">Sana *</label>
                  <input type="date" value={contractForm.date} onChange={e => setContractForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none transition"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-2)] mb-1">Summa (UZS) *</label>
                  <input type="number" min="0" value={contractForm.totalValue} onChange={e => setContractForm(f => ({ ...f, totalValue: e.target.value }))}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none transition"
                    placeholder="0"/>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-2)] mb-1">Sotuvchi *</label>
                <select value={contractForm.seller} onChange={e => setContractForm(f => ({ ...f, seller: e.target.value }))}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none transition bg-[var(--surface)]">
                  <option value="">— Sotuvchini tanlang —</option>
                  {(clients.find(c => c.id === contractClientId)?.seller || '')
                    .split(',').map(s => s.trim()).filter(Boolean)
                    .map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {contractClientId && !(clients.find(c => c.id === contractClientId)?.seller || '').trim() && (
                  <p className="text-[11px] text-red-500 mt-1">Bu mijozga sotuvchilar biriktirilmagan (mijozni tahrirlab qo'shing)</p>
                )}
              </div>
              <div className="pt-4 border-t border-[var(--border)] flex justify-end gap-3">
                <button type="button" onClick={closeContractModal} className="px-4 py-2 text-sm font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] rounded-md transition">Bekor</button>
                <button type="submit" disabled={contractSaving} className="px-5 py-2 btn-primary disabled:opacity-60 text-sm font-medium rounded-md transition shadow-sm">
                  {contractSaving ? 'Saqlanmoqda...' : 'Saqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {delContractId && (
        <div className="modal-overlay">
          <div className="modal-card w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={22} className="text-red-600"/></div>
            <h3 className="text-lg font-bold text-[var(--text)] mb-2">Shartnomani o'chirish</h3>
            <p className="text-sm text-[var(--text-3)] mb-6">Bog'langan savdo yoki to'lov bo'lsa o'chirib bo'lmaydi.</p>
            <div className="flex gap-3">
              <button onClick={() => setDelContractId(null)} className="flex-1 px-4 py-2 text-sm font-medium border border-[var(--border)] rounded-md hover:bg-[var(--surface-2)] transition">Bekor</button>
              <button onClick={handleContractDelete} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition">O'chirish</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
