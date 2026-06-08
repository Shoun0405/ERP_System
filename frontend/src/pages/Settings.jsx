import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api, { API } from '../lib/api';
import toast from 'react-hot-toast';
import { useModalKeys } from '../hooks/useModalKeys';
import { fmtDateTime } from '../lib/format';
import { Save, Plus, Trash2, Building2, Users, Database, Percent } from 'lucide-react';

const EMPTY = {
  companyName: '', companyAddress: '', companyInn: '',
  companyPhone: '', companyBank: '', companyMfo: '', companyAccount: '',
  companyDirector: '',
  sellers: [],
  vatRate: 0.12,
};

export default function Settings() {
  const { t } = useTranslation();
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
      toast.success(t('settings.saved'));
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
          <h2 className="text-lg font-semibold text-[var(--text)]">{t('settings.title')}</h2>
          <p className="text-xs text-[var(--text-3)] mt-0.5">
            {data.updatedAt
              ? t('settings.lastUpdate', { date: fmtDateTime(data.updatedAt) })
              : t('settings.systemConfig')}
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Kompaniya ma'lumotlari */}
        <div className="mini-card space-y-4">
          <h3 className="text-xs font-semibold text-[var(--text)] flex items-center gap-2 border-b border-[var(--border)] pb-3">
            <Building2 size={18} strokeWidth={2.2} className="text-[var(--accent)]" /> {t('settings.companyInfo')}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-[11px] font-medium text-[var(--text-2)] mb-1">{t('settings.companyName')}</label>
              <input type="text" value={data.companyName} onChange={e => setData(d => ({ ...d, companyName: e.target.value }))} className={inp} placeholder={t('settings.companyNamePlaceholder')} />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-2)] mb-1">{t('settings.inn')}</label>
              <input type="text" value={data.companyInn} onChange={e => setData(d => ({ ...d, companyInn: e.target.value }))} className={inp} placeholder="123456789" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-2)] mb-1">{t('settings.phone')}</label>
              <input type="text" value={data.companyPhone} onChange={e => setData(d => ({ ...d, companyPhone: e.target.value }))} className={inp} placeholder="+998 ..." />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] font-medium text-[var(--text-2)] mb-1">{t('settings.address')}</label>
              <input type="text" value={data.companyAddress} onChange={e => setData(d => ({ ...d, companyAddress: e.target.value }))} className={inp} placeholder={t('settings.addressPlaceholder')} />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-2)] mb-1">{t('settings.bankName')}</label>
              <input type="text" value={data.companyBank} onChange={e => setData(d => ({ ...d, companyBank: e.target.value }))} className={inp} placeholder={t('settings.bankPlaceholder')} />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-2)] mb-1">{t('settings.mfo')}</label>
              <input type="text" value={data.companyMfo} onChange={e => setData(d => ({ ...d, companyMfo: e.target.value }))} className={inp} placeholder="01234" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-2)] mb-1">{t('settings.account')}</label>
              <input type="text" value={data.companyAccount} onChange={e => setData(d => ({ ...d, companyAccount: e.target.value }))} className={inp} placeholder="2020..." />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] font-medium text-[var(--text-2)] mb-1">{t('settings.director')}</label>
              <input type="text" value={data.companyDirector} onChange={e => setData(d => ({ ...d, companyDirector: e.target.value }))} className={inp} placeholder={t('settings.directorPlaceholder')} />
            </div>
          </div>
        </div>

        {/* QQS (VAT) stavkasi */}
        <div className="mini-card space-y-4">
          <h3 className="text-xs font-semibold text-[var(--text)] flex items-center gap-2 border-b border-[var(--border)] pb-3">
            <Percent size={18} strokeWidth={2.2} className="text-[var(--accent)]" /> {t('settings.vat')}
          </h3>
          <div className="flex items-end gap-3">
            <div className="w-40">
              <label className="block text-[11px] font-medium text-[var(--text-2)] mb-1">{t('settings.vatRate')}</label>
              <div className="relative">
                <input
                  type="number" min="0" max="100" step="0.1"
                  value={Math.round((data.vatRate ?? 0) * 1000) / 10}
                  onChange={e => {
                    const pct = e.target.value === '' ? 0 : Number(e.target.value);
                    const rate = Math.min(1, Math.max(0, pct / 100));
                    setData(d => ({ ...d, vatRate: rate }));
                  }}
                  className={`${inp} pr-7 text-right`}
                  placeholder="12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-3)] pointer-events-none">%</span>
              </div>
            </div>
            <p className="text-[11px] text-[var(--text-3)] pb-2">
              {t('settings.vatHint')}
            </p>
          </div>
        </div>

        {/* Sotuvchilar */}
        <div className="mini-card space-y-4">
          <h3 className="text-xs font-semibold text-[var(--text)] flex items-center gap-2 border-b border-[var(--border)] pb-3">
            <Users size={18} strokeWidth={2.2} className="text-[var(--accent)]" /> {t('settings.sellersTitle')}
          </h3>
          <div className="flex gap-2">
            <input
              type="text" value={newSeller}
              onChange={e => setNewSeller(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSeller())}
              className={`${inp} flex-1`}
              placeholder={t('settings.sellerPlaceholder')}
            />
            <button type="button" onClick={addSeller} className="px-3 py-1.5 btn-primary rounded-lg text-xs font-medium transition flex items-center gap-1.5 shadow-sm">
              <Plus size={16} strokeWidth={2.2} /> {t('common.add')}
            </button>
          </div>
          {data.sellers.length === 0 ? (
            <p className="text-xs text-[var(--text-3)] text-center py-4">{t('settings.noSellers')}</p>
          ) : (
            <div className="space-y-2">
              {data.sellers.map((s, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-1.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg">
                  <span className="text-xs text-[var(--text)] font-medium">{i + 1}. {s}</span>
                  <button
                    type="button" onClick={() => removeSeller(s)}
                    className="text-[var(--text-3)] hover:text-red-500 transition p-1 rounded"
                  ><Trash2 size={15} strokeWidth={1.8} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ma'lumotlar zaxirasi */}
        <div className="mini-card space-y-3">
          <h3 className="text-xs font-semibold text-[var(--text)] flex items-center gap-2 border-b border-[var(--border)] pb-3">
            <Database size={18} strokeWidth={2.2} className="text-[var(--accent)]" /> {t('settings.backupTitle')}
          </h3>
          <p className="text-xs text-[var(--text-3)]">{t('settings.backupHint')}</p>
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
              {t('common.download')}
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
            <Save size={16} strokeWidth={2.2} />
            {saving ? t('common.saving') : saved ? t('settings.savedBtn') : t('common.saveChanges')}
          </button>
        </div>
      </form>
    </div>
  );
}
