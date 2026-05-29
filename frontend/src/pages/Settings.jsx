import { useState, useEffect, useCallback } from 'react';
import api, { API } from '../lib/api';
import toast from 'react-hot-toast';
import { useModalKeys } from '../hooks/useModalKeys';
import { Save, Plus, Trash2, Building2, Users, Database } from 'lucide-react';

const EMPTY = {
  companyName: '', companyAddress: '', companyInn: '',
  companyPhone: '', companyBank: '', companyMfo: '', companyAccount: '',
  sellers: [],
};

export default function Settings() {
  const [data, setData]       = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [newSeller, setNewSeller] = useState('');

  const fetchSettings = useCallback(() => {
    api.get('/api/settings')
      .then(r => { setData({ ...EMPTY, ...r.data }); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/api/settings', data);
      setSaved(true);
      toast.success('Sozlamalar saqlandi');
      setTimeout(() => setSaved(false), 2500);
    } catch { /* interceptor shows toast */
    } finally {
      setSaving(false);
    }
  };

  const addSeller = () => {
    const name = newSeller.trim();
    if (!name || data.sellers.includes(name)) return;
    setData(d => ({ ...d, sellers: [...d.sellers, name] }));
    setNewSeller('');
  };

  const removeSeller = (name) => {
    setData(d => ({ ...d, sellers: d.sellers.filter(s => s !== name) }));
  };

  // Ctrl+Enter → sozlamalarni saqlash (Settings da modal yo'q, shuning uchun har doim true)
  useModalKeys(true, handleSave, null);

  const inp = 'w-full px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] outline-none transition text-[var(--text)]';

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-6 animate-in">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="mini-card space-y-3">
            {[...Array(3)].map((_, j) => (
              <div key={j} className="h-8 bg-[var(--surface-2)] animate-pulse rounded" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6 animate-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text)]">Sozlamalar</h2>
          <p className="text-xs text-[var(--text-3)] mt-0.5">
            {data.updatedAt
              ? `Oxirgi yangilanish: ${new Date(data.updatedAt).toLocaleString('uz-UZ')}`
              : 'Tizim konfiguratsiyasi'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Kompaniya ma'lumotlari */}
        <div className="mini-card space-y-4">
          <h3 className="text-xs font-semibold text-[var(--text)] flex items-center gap-2 border-b border-[var(--border)] pb-3">
            <Building2 size={14} className="text-[var(--accent)]" /> Kompaniya ma'lumotlari
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-[11px] font-medium text-[var(--text-2)] mb-1">Kompaniya nomi</label>
              <input type="text" value={data.companyName} onChange={e => setData(d => ({ ...d, companyName: e.target.value }))} className={inp} placeholder="MChJ nomi..." />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-2)] mb-1">STIR (INN)</label>
              <input type="text" value={data.companyInn} onChange={e => setData(d => ({ ...d, companyInn: e.target.value }))} className={inp} placeholder="123456789" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-2)] mb-1">Telefon</label>
              <input type="text" value={data.companyPhone} onChange={e => setData(d => ({ ...d, companyPhone: e.target.value }))} className={inp} placeholder="+998 ..." />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] font-medium text-[var(--text-2)] mb-1">Manzil</label>
              <input type="text" value={data.companyAddress} onChange={e => setData(d => ({ ...d, companyAddress: e.target.value }))} className={inp} placeholder="Shahar, ko'cha, uy..." />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-2)] mb-1">Bank nomi</label>
              <input type="text" value={data.companyBank} onChange={e => setData(d => ({ ...d, companyBank: e.target.value }))} className={inp} placeholder="Ipak Yo'li Banki..." />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-2)] mb-1">MFO</label>
              <input type="text" value={data.companyMfo} onChange={e => setData(d => ({ ...d, companyMfo: e.target.value }))} className={inp} placeholder="01234" />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] font-medium text-[var(--text-2)] mb-1">Hisob raqam</label>
              <input type="text" value={data.companyAccount} onChange={e => setData(d => ({ ...d, companyAccount: e.target.value }))} className={inp} placeholder="2020..." />
            </div>
          </div>
        </div>

        {/* Sotuvchilar */}
        <div className="mini-card space-y-4">
          <h3 className="text-xs font-semibold text-[var(--text)] flex items-center gap-2 border-b border-[var(--border)] pb-3">
            <Users size={14} className="text-[var(--accent)]" /> Sotuvchilar ro'yxati
          </h3>
          <div className="flex gap-2">
            <input
              type="text" value={newSeller}
              onChange={e => setNewSeller(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSeller())}
              className={`${inp} flex-1`}
              placeholder="Sotuvchi F.I.O. va Enter bosing..."
            />
            <button type="button" onClick={addSeller} className="px-3 py-1.5 btn-primary rounded-lg text-xs font-medium transition flex items-center gap-1.5 shadow-sm">
              <Plus size={13} /> Qo'shish
            </button>
          </div>
          {data.sellers.length === 0 ? (
            <p className="text-xs text-[var(--text-3)] text-center py-4">Hozircha sotuvchilar yo'q</p>
          ) : (
            <div className="space-y-2">
              {data.sellers.map((s, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-1.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg">
                  <span className="text-xs text-[var(--text)] font-medium">{i + 1}. {s}</span>
                  <button
                    type="button" onClick={() => removeSeller(s)}
                    className="text-[var(--text-3)] hover:text-red-500 transition p-1 rounded"
                  ><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ma'lumotlar zaxirasi */}
        <div className="mini-card space-y-3">
          <h3 className="text-xs font-semibold text-[var(--text)] flex items-center gap-2 border-b border-[var(--border)] pb-3">
            <Database size={14} className="text-[var(--accent)]" /> Ma'lumotlar zaxirasi
          </h3>
          <p className="text-xs text-[var(--text-3)]">PostgreSQL bazasi zaxirasini yuklab olish (pg_dump format):</p>
          <div className="flex items-center gap-2 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-1.5">
            <code className="text-xs text-[var(--text-2)] font-mono flex-1">erp_db — PostgreSQL</code>
            <button
              type="button"
              onClick={() => {
                const a = document.createElement('a');
                a.href = `${API}/api/backup`;
                a.click();
              }}
              className="text-xs text-[var(--accent)] hover:underline font-medium"
            >
              Yuklab olish
            </button>
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 shadow-sm ${
              saved
                ? 'bg-emerald-600 text-white'
                : 'btn-primary disabled:opacity-60'
            }`}
          >
            <Save size={13} />
            {saving ? 'Saqlanmoqda...' : saved ? '✓ Saqlandi!' : 'O\'zgarishlarni saqlash'}
          </button>
        </div>
      </form>
    </div>
  );
}
