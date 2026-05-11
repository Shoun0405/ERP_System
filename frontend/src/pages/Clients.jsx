import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useModalKeys } from '../hooks/useModalKeys';
import api from '../lib/api';
import toast from 'react-hot-toast';
import Pagination from '../components/Pagination';
import * as XLSX from 'xlsx';
import { Search, Plus, X, Edit2, Trash2, ChevronDown, ChevronUp, ArrowUpDown, ArrowUp, ArrowDown, Download } from 'lucide-react';

const EMPTY = { name:'', inn:'', phone:'', director:'', address:'', category:'', status:'Yangi', account:'', mfo:'', seller:'' };
const SC = { 'Faol':'bg-emerald-50 text-emerald-700 border-emerald-200', "Muddati o'tgan":'bg-red-50 text-red-700 border-red-200', 'Yangi':'bg-blue-50 text-blue-700 border-blue-200', 'Kutilmoqda':'bg-amber-50 text-amber-700 border-amber-200' };
const fmt = n => (!n && n!==0)?'0':Math.round(n).toLocaleString('ru-RU');

const fmtINN = v => { const d=v.replace(/\D/g,'').slice(0,9); return d.replace(/(\d{3})(\d{3})(\d{1,3})/,'$1 $2 $3').trim(); };
const rawINN = v => v.replace(/\D/g,'');
const fmtPhone = raw => {
  if(!raw) return '';
  const d = raw.replace(/\D/g,'').replace(/^998/,'').slice(0,9);
  let s=''; if(d.length>0)s=d.slice(0,2); if(d.length>2)s+=' '+d.slice(2,5); if(d.length>5)s+=' '+d.slice(5,7); if(d.length>7)s+=' '+d.slice(7,9);
  return s ? '+998 '+s : '';
};
const rawPhone = v => { const d=v.replace(/\D/g,'').replace(/^998/,'').slice(0,9); return d ? '+998'+d : ''; };

function SortIcon({ col, sort }) {
  if(sort.col!==col) return <ArrowUpDown size={12} className="text-zinc-400 ml-1 inline"/>;
  return sort.dir==='asc' ? <ArrowUp size={12} className="text-blue-500 ml-1 inline"/> : <ArrowDown size={12} className="text-blue-500 ml-1 inline"/>;
}

function SellerSearch({ sellers, value, onChange }) {
  const [q, setQ] = useState(value||'');
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const list = sellers.filter(s=>s.toLowerCase().includes(q.toLowerCase()));
  useEffect(()=>{ const h=e=>{ if(ref.current&&!ref.current.contains(e.target))setOpen(false); }; document.addEventListener('mousedown',h); return()=>document.removeEventListener('mousedown',h); },[]);
  return (
    <div ref={ref} className="relative">
      <input value={q} onChange={e=>{setQ(e.target.value);setOpen(true);onChange('');}} onFocus={()=>setOpen(true)}
        className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Sotuvchini qidiring..."/>
      {open&&list.length>0&&(
        <div className="absolute z-50 mt-1 w-full bg-white border border-zinc-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
          {list.map(s=>(
            <div key={s} onMouseDown={()=>{onChange(s);setQ(s);setOpen(false);}}
              className={`px-3 py-2 text-sm cursor-pointer hover:bg-zinc-50 ${value===s?'bg-blue-50 text-blue-700':''}`}>{s}</div>
          ))}
        </div>
      )}
      {q&&!sellers.includes(q)&&<p className="text-xs text-amber-600 mt-1">Sozlamalarda yo'q — baribir saqlanadi</p>}
    </div>
  );
}

export default function Clients() {
  const [clients,  setClients]  = useState([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const LIMIT = 50;

  const [loading,  setLoading]  = useState(true);
  const [sellers,  setSellers]  = useState([]);
  const [search,   setSearch]   = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort,     setSort]     = useState({ col:'createdAt', dir:'desc' });
  const [expanded, setExpanded] = useState(null);
  const [expandContracts, setExpandContracts] = useState({});
  const [modal,    setModal]    = useState(null);
  const [editId,   setEditId]   = useState(null);
  const [form,     setForm]     = useState(EMPTY);
  const [errors,   setErrors]   = useState({});
  const [saving,   setSaving]   = useState(false);
  const [delId,    setDelId]    = useState(null);
  const [phoneInput, setPhoneInput] = useState('');

  // 300ms debounce for search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchClients = useCallback(() => {
    setLoading(true);
    api.get('/api/clients', {
      params: { page, limit: LIMIT, search: debouncedSearch, sortBy: sort.col, sortDir: sort.dir },
    }).then(r => {
      setClients(r.data.data);
      setTotal(r.data.total);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [page, debouncedSearch, sort]);

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
    setForm({ name:c.name||'', inn:fmtINN(c.inn||''), phone:c.phone||'', director:c.director||'', address:c.address||'', category:c.category||'', status:c.status||'Yangi', account:c.account||'', mfo:c.mfo||'', seller:c.seller||'' });
    setPhoneInput(fmtPhone(c.phone||''));
    setEditId(c.id); setErrors({}); setModal('edit');
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

  const handleExport = async () => {
    try {
      const r = await api.get('/api/clients', {
        params: { limit: 1000, search: debouncedSearch, sortBy: sort.col, sortDir: sort.dir },
      });
      const rows = r.data.data.map(c => ({
        'Nomi': c.name, 'STIR': c.inn, 'Telefon': c.phone,
        'Direktor': c.director, 'Manzil': c.address,
        'Kategoriya': c.category, 'Holati': c.status,
        'Sotuvchi': c.seller, 'Qarzdorlik (UZS)': Math.round(c.debt),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Mijozlar');
      XLSX.writeFile(wb, `mijozlar_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch { /* interceptor shows toast */ }
  };

  const toggleSort = col => {
    setSort(s => ({ col, dir: s.col===col && s.dir==='asc' ? 'desc' : 'asc' }));
    setPage(1);
  };

  const loadContracts = async id => {
    if(expandContracts[id]) return;
    try { const r=await api.get(`/api/contracts?clientId=${id}`); setExpandContracts(p=>({...p,[id]:r.data})); }
    catch{ setExpandContracts(p=>({...p,[id]:[]})); }
  };

  const toggleExpand = async id => {
    if(expanded===id){ setExpanded(null); return; }
    setExpanded(id); await loadContracts(id);
  };

  useModalKeys(!!modal, handleSave, closeModal);

  const inp = (field) => `w-full px-3 py-2 border ${errors[field]?'border-red-400':'border-zinc-300'} rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none transition`;
  const COLS = 8;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">Mijozlar (CRM)</h2>
          <p className="text-sm text-zinc-500 mt-0.5">{total} ta mijoz</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="px-4 py-2 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 rounded-md text-sm font-medium transition flex items-center gap-2 shadow-sm">
            <Download size={16}/> Excel
          </button>
          <button onClick={openAdd} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition flex items-center gap-2 shadow-sm">
            <Plus size={16}/> Yangi Mijoz
          </button>
        </div>
      </div>

      <div className="mini-card p-0">
        <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50/50 flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4"/>
            <input type="text" placeholder="Mijoz, STIR, telefon, sotuvchi..." value={search} onChange={e=>setSearch(e.target.value)}
              className="pl-9 pr-4 py-1.5 bg-white border border-zinc-200 rounded-md text-sm w-full focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"/>
          </div>
          {search&&<span className="text-xs text-zinc-500">{total} natija</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200">
                {[['name','Mijoz / Tashkilot'],['inn','STIR'],['phone','Telefon'],['seller','Sotuvchi'],['status','Holati'],['debt','Qarzdorlik']].map(([col,label])=>(
                  <th key={col} onClick={()=>toggleSort(col)} className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-700 select-none whitespace-nowrap">
                    {label}<SortIcon col={col} sort={sort}/>
                  </th>
                ))}
                <th className="px-6 py-3 w-24"/>
              </tr>
            </thead>
            <tbody>
              {loading ? [...Array(5)].map((_,i)=>(
                <tr key={i}>{[...Array(COLS)].map((_,j)=>(
                  <td key={j} className="px-6 py-4"><div className="h-4 bg-zinc-100 animate-pulse rounded"/></td>
                ))}</tr>
              )) : clients.length===0 ? (
                <tr><td colSpan={COLS} className="px-6 py-12 text-center text-zinc-400 text-sm">{search?'Topilmadi':'Hozircha mijozlar yo\'q'}</td></tr>
              ) : clients.map(c=>(
                <React.Fragment key={c.id}>
                  <tr className={`hover:bg-zinc-50 transition-colors group ${expanded===c.id?'bg-zinc-50':''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-600/10 flex items-center justify-center text-blue-600 text-xs font-bold shrink-0">{c.name.charAt(0).toUpperCase()}</div>
                        <div>
                          <p className="text-sm font-semibold text-zinc-900">{c.name}</p>
                          {c.director&&<p className="text-xs text-zinc-400">{c.director}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-500 font-mono">{fmtINN(c.inn||'')}</td>
                    <td className="px-6 py-4 text-sm text-zinc-600">{fmtPhone(c.phone||'')||<span className="text-zinc-300">—</span>}</td>
                    <td className="px-6 py-4 text-sm text-zinc-500">{c.seller||<span className="text-zinc-300">—</span>}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${SC[c.status]||SC['Yangi']}`}>{c.status||'Yangi'}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-semibold">
                      {c.debt>0?<span className="text-red-600">{fmt(c.debt)} UZS</span>:c.debt<0?<span className="text-emerald-600">+{fmt(Math.abs(c.debt))} UZS</span>:<span className="text-zinc-400">0</span>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={()=>openEdit(c)} className="p-1.5 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition opacity-0 group-hover:opacity-100" title="Tahrirlash"><Edit2 size={14}/></button>
                        <button onClick={()=>setDelId(c.id)} className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-md transition opacity-0 group-hover:opacity-100" title="O'chirish"><Trash2 size={14}/></button>
                        <button onClick={()=>toggleExpand(c.id)} className={`p-1.5 rounded-md transition ${expanded===c.id?'text-blue-600 bg-blue-50':'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100'}`} title="Batafsil">
                          {expanded===c.id?<ChevronUp size={14}/>:<ChevronDown size={14}/>}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expanded===c.id&&(
                    <tr className="bg-zinc-50">
                      <td colSpan={COLS} className="px-6 py-4 border-b border-zinc-200">
                        <div className="grid grid-cols-3 gap-6">
                          <div className="col-span-2 space-y-3">
                            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Rekvizitlar</p>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                              {[['STIR',fmtINN(c.inn||'')],['Telefon',fmtPhone(c.phone||'')],['Manzil',c.address],['Kategoriya',c.category],['Hisob raqam',c.account],['MFO',c.mfo],['Direktor',c.director],['Sotuvchi',c.seller]].map(([label,val])=>val?(
                                <div key={label} className="flex gap-2">
                                  <span className="text-zinc-400 shrink-0">{label}:</span>
                                  <span className="text-zinc-800 font-medium font-mono text-xs">{val}</span>
                                </div>
                              ):null)}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Shartnomalar</p>
                            {!expandContracts[c.id]?<p className="text-xs text-zinc-400">Yuklanmoqda...</p>:expandContracts[c.id].length===0?<p className="text-xs text-zinc-400">Shartnomalar yo'q</p>:(
                              <div className="space-y-1.5">
                                {expandContracts[c.id].map(ct=>(
                                  <div key={ct.id} className="flex justify-between text-xs bg-white border border-zinc-200 rounded px-2.5 py-1.5">
                                    <span className="font-semibold text-zinc-700">№{ct.number}</span>
                                    <span className="text-zinc-400">{new Date(ct.date).toLocaleDateString('ru-RU')}</span>
                                    <span className="text-blue-600 font-medium">{fmt(ct.totalValue)} UZS</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={total} limit={LIMIT} onPage={p => { setPage(p); setExpanded(null); }} />
      </div>

      {modal&&(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-zinc-900">{modal==='add'?'Yangi Mijoz':'Mijozni tahrirlash'}</h3>
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-400">Ctrl+Enter — saqlash · Esc — yopish</span>
                <button onClick={closeModal} className="text-zinc-400 hover:text-zinc-600 p-1 rounded-md hover:bg-zinc-100"><X size={20}/></button>
              </div>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Tashkilot nomi *</label>
                  <input type="text" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className={inp('name')} placeholder="MChJ, XK..."/>
                  {errors.name&&<p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">STIR (INN) <span className="text-zinc-400 font-normal">— ixtiyoriy, 9 xona</span></label>
                  <input type="text" value={form.inn} onChange={e=>setForm(f=>({...f,inn:fmtINN(e.target.value)}))} className={inp('inn')} placeholder="123 456 789"/>
                  {errors.inn&&<p className="text-xs text-red-500 mt-1">{errors.inn}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Direktor</label>
                  <input type="text" value={form.director} onChange={e=>setForm(f=>({...f,director:e.target.value}))} className={inp('director')} placeholder="F.I.O."/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Telefon <span className="text-zinc-400 font-normal">— max 9 raqam</span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-medium pointer-events-none">+998</span>
                    <input type="text" value={phoneInput.replace('+998 ','')} onChange={e=>{
                      const d=e.target.value.replace(/\D/g,'').slice(0,9);
                      let s=''; if(d.length>0)s=d.slice(0,2); if(d.length>2)s+=' '+d.slice(2,5); if(d.length>5)s+=' '+d.slice(5,7); if(d.length>7)s+=' '+d.slice(7,9);
                      setPhoneInput(s?'+998 '+s:'');
                    }} className={`${inp('phone')} pl-12`} placeholder="90 123 45 67"/>
                  </div>
                  {errors.phone&&<p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Holati</label>
                  <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} className={inp('status')}>
                    <option>Yangi</option><option>Faol</option><option>Kutilmoqda</option><option>Muddati o'tgan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Kategoriya</label>
                  <input type="text" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} className={inp('category')} placeholder="Qurilish, Savdo..."/>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Manzil</label>
                  <input type="text" value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} className={inp('address')} placeholder="Shahar, ko'cha, uy..."/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Hisob raqam <span className="text-zinc-400 font-normal">— 20 xona</span></label>
                  <input type="text" value={form.account} onChange={e=>setForm(f=>({...f,account:e.target.value.replace(/\D/g,'').slice(0,20)}))} className={inp('account')} placeholder="20200000000000000000"/>
                  {errors.account&&<p className="text-xs text-red-500 mt-1">{errors.account}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">MFO <span className="text-zinc-400 font-normal">— 5 xona</span></label>
                  <input type="text" value={form.mfo} onChange={e=>setForm(f=>({...f,mfo:e.target.value.replace(/\D/g,'').slice(0,5)}))} className={inp('mfo')} placeholder="01234"/>
                  {errors.mfo&&<p className="text-xs text-red-500 mt-1">{errors.mfo}</p>}
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Mas'ul sotuvchi</label>
                  <SellerSearch sellers={sellers} value={form.seller} onChange={v=>setForm(f=>({...f,seller:v}))}/>
                </div>
              </div>
              <div className="pt-4 border-t border-zinc-200 flex justify-end gap-3">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 rounded-md transition">Bekor qilish</button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-md transition shadow-sm">
                  {saving?'Saqlanmoqda...':'Saqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {delId&&(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={22} className="text-red-600"/></div>
            <h3 className="text-lg font-bold text-zinc-900 mb-2">Mijozni o'chirish</h3>
            <p className="text-sm text-zinc-500 mb-6">Bu amalni ortga qaytarib bo'lmaydi.</p>
            <div className="flex gap-3">
              <button onClick={()=>setDelId(null)} className="flex-1 px-4 py-2 text-sm font-medium border border-zinc-300 rounded-md hover:bg-zinc-50 transition">Bekor</button>
              <button onClick={handleDelete} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition">O'chirish</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
