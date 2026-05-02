import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useModalKeys } from '../hooks/useModalKeys';
import { Save, Plus, Trash2, Building2, Users, Database } from 'lucide-react';

const API = 'http://localhost:3001';

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
    axios.get(`${API}/api/settings`)
      .then(r => { setData({ ...EMPTY, ...r.data }); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.put(`${API}/api/settings`, data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      alert('Xatolik: ' + (err.response?.data?.error || err.message));
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

  const inp = 'w-full px-3 py-2 border border-zinc-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none transition';

  if (loading) {
    return (
      <div className="p-8 max-w-3xl mx-auto space-y-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="mini-card space-y-3">
            {[...Array(3)].map((_, j) => (
              <div key={j} className="h-8 bg-zinc-100 animate-pulse rounded" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">Sozlamalar</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Tizim konfiguratsiyasi</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Kompaniya ma'lumotlari */}
        <div className="mini-card space-y-4">
          <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2 border-b border-zinc-200 pb-3">
            <Building2 size={15} className="text-blue-600" /> Kompaniya ma'lumotlari
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-zinc-700 mb-1">Kompaniya nomi</label>
              <input type="text" value={data.companyName} onChange={e => setData(d => ({ ...d, companyName: e.target.value }))} className={inp} placeholder="MChJ nomi..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">STIR (INN)</label>
              <input type="text" value={data.companyInn} onChange={e => setData(d => ({ ...d, companyInn: e.target.value }))} className={inp} placeholder="123456789" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Telefon</label>
              <input type="text" value={data.companyPhone} onChange={e => setData(d => ({ ...d, companyPhone: e.target.value }))} className={inp} placeholder="+998 ..." />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-zinc-700 mb-1">Manzil</label>
              <input type="text" value={data.companyAddress} onChange={e => setData(d => ({ ...d, companyAddress: e.target.value }))} className={inp} placeholder="Shahar, ko'cha, uy..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Bank nomi</label>
              <input type="text" value={data.companyBank} onChange={e => setData(d => ({ ...d, companyBank: e.target.value }))} className={inp} placeholder="Ipak Yo'li Banki..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">MFO</label>
              <input type="text" value={data.companyMfo} onChange={e => setData(d => ({ ...d, companyMfo: e.target.value }))} className={inp} placeholder="01234" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-zinc-700 mb-1">Hisob raqam</label>
              <input type="text" value={data.companyAccount} onChange={e => setData(d => ({ ...d, companyAccount: e.target.value }))} className={inp} placeholder="2020..." />
            </div>
          </div>
        </div>

        {/* Sotuvchilar */}
        <div className="mini-card space-y-4">
          <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2 border-b border-zinc-200 pb-3">
            <Users size={15} className="text-blue-600" /> Sotuvchilar ro'yxati
          </h3>
          <div className="flex gap-2">
            <input
              type="text" value={newSeller}
              onChange={e => setNewSeller(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSeller())}
              className={`${inp} flex-1`}
              placeholder="Sotuvchi F.I.O. va Enter bosing..."
            />
            <button type="button" onClick={addSeller} className="px-4 py-2 bg-zinc-900 hover:bg-zinc-700 text-white rounded-md text-sm font-medium transition flex items-center gap-1.5">
              <Plus size={14} /> Qo'shish
            </button>
          </div>
          {data.sellers.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-4">Hozircha sotuvchilar yo'q</p>
          ) : (
            <div className="space-y-2">
              {data.sellers.map((s, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-md">
                  <span className="text-sm text-zinc-700">{i + 1}. {s}</span>
                  <button
                    type="button" onClick={() => removeSeller(s)}
                    className="text-zinc-400 hover:text-red-600 transition p-1 rounded"
                  ><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ma'lumotlar zaxirasi */}
        <div className="mini-card space-y-3">
          <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2 border-b border-zinc-200 pb-3">
            <Database size={15} className="text-blue-600" /> Ma'lumotlar zaxirasi
          </h3>
          <p className="text-sm text-zinc-500">SQLite database faylini yuklab olish uchun quyidagi manzilga o'ting:</p>
          <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-md px-3 py-2">
            <code className="text-xs text-zinc-600 flex-1">backend/prisma/dev.db</code>
            <button
              type="button"
              onClick={() => {
                const a = document.createElement('a');
                a.href = 'http://localhost:3001/api/backup';
                a.click();
              }}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
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
            className={`px-6 py-2.5 rounded-md text-sm font-medium transition flex items-center gap-2 shadow-sm ${
              saved
                ? 'bg-emerald-600 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60'
            }`}
          >
            <Save size={15} />
            {saving ? 'Saqlanmoqda...' : saved ? '✓ Saqlandi!' : 'O\'zgarishlarni saqlash'}
          </button>
        </div>
      </form>
    </div>
  );
}
