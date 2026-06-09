import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useModalKeys } from '../hooks/useModalKeys';
import { X, Upload, CheckCircle2, AlertTriangle, Copy, Ban } from 'lucide-react';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const CAT_STYLE = {
  valid:      { cls: 'text-emerald-600',  Icon: CheckCircle2 },
  incomplete: { cls: 'text-blue-600',     Icon: AlertTriangle },
  duplicate:  { cls: 'text-amber-600',    Icon: Copy },
  error:      { cls: 'text-red-600',      Icon: Ban },
};

export default function ClientImportModal({ onClose, onDone }) {
  const { t } = useTranslation();
  const [preview, setPreview]       = useState(null);   // { summary, rows }
  const [selected, setSelected]     = useState(() => new Set()); // tanlangan rowNum'lar
  const [loading, setLoading]       = useState(false);
  const [committing, setCommitting] = useState(false);

  const importable = preview ? preview.rows.filter(r => r.category === 'valid' || r.category === 'incomplete') : [];

  const onConfirm = useCallback(async () => {
    if (!preview || selected.size === 0) {
      toast.error(t('clients.import.nothingSelected'));
      return;
    }
    // Faqat haqiqiy data'li (valid/incomplete) qatorlar — error/duplicate data:null,
    // ular commit'ga tushib opaque "Validatsiya xatosi" bermasin.
    const clients = preview.rows.filter(r => selected.has(r.rowNum) && r.data).map(r => r.data);
    if (clients.length === 0) {
      toast.error(t('clients.import.nothingSelected'));
      return;
    }
    setCommitting(true);
    try {
      const { data } = await api.post('/api/clients/import/commit', { clients });
      toast.success(t('clients.import.done', { inserted: data.inserted, skipped: data.skippedDuplicate }));
      onDone();
    } catch (err) {
      // api interceptor faqat err.response bo'lsa toast qiladi; aks holda o'zimiz.
      if (!err?.response) toast.error(t('errors.server'));
    } finally {
      setCommitting(false);
    }
  }, [preview, selected, t, onDone]);

  useModalKeys(true, onConfirm, onClose);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setPreview(null);
    try {
      const buf = await file.arrayBuffer();
      const { data } = await api.post('/api/clients/import/preview', buf, {
        headers: { 'Content-Type': XLSX_MIME },
      });
      setPreview(data);
      // Default: faqat 'valid' belgilangan (yangi preview eski tanlovni almashtiradi)
      setSelected(new Set(data.rows.filter(r => r.category === 'valid').map(r => r.rowNum)));
    } catch (err) {
      if (!err?.response) toast.error(t('errors.server'));
    } finally {
      setLoading(false);
      e.target.value = ''; // bir faylni qayta tanlash mumkin bo'lsin
    }
  }

  function toggleRow(row) {
    if (row.category !== 'valid' && row.category !== 'incomplete') return;
    setSelected(prev => {
      const next = new Set(prev);
      next.has(row.rowNum) ? next.delete(row.rowNum) : next.add(row.rowNum);
      return next;
    });
  }

  function toggleAll() {
    setSelected(prev =>
      prev.size === importable.length ? new Set() : new Set(importable.map(r => r.rowNum))
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <div
        className="bg-[var(--surface)] rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col"
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center border-b border-[var(--border)] px-5 py-3">
          <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
            <Upload size={18} strokeWidth={2.2} className="text-[var(--accent)]" />
            {t('clients.import.title')}
          </h3>
          <button onClick={onClose} className="text-[var(--text-3)] hover:text-[var(--text)] p-1 rounded-md hover:bg-[var(--surface-2)]">
            <X size={18} strokeWidth={2.2} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1">
          {!preview && (
            <div className="space-y-3">
              <p className="text-xs text-[var(--text-2)]">{t('clients.import.downloadTemplateHint')}</p>
              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[var(--border)] rounded-lg py-10 cursor-pointer hover:bg-[var(--surface-2)] transition">
                <Upload size={28} className="text-[var(--text-3)]" />
                <span className="text-xs font-medium text-[var(--text-2)]">{t('clients.import.selectFile')}</span>
                <input type="file" accept=".xlsx" className="hidden" onChange={handleFile} disabled={loading} />
              </label>
              {loading && <p className="text-xs text-center text-[var(--text-3)]">{t('clients.import.parsing')}</p>}
            </div>
          )}

          {preview && (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-4 gap-2">
                {['valid', 'incomplete', 'duplicate', 'error'].map(cat => {
                  const { cls } = CAT_STYLE[cat];
                  return (
                    <div key={cat} className="rounded-lg border border-[var(--border)] p-2 text-center">
                      <div className={`text-lg font-bold ${cls}`}>{preview.summary[cat]}</div>
                      <div className="text-[10px] text-[var(--text-3)]">{t(`clients.import.summary.${cat}`)}</div>
                    </div>
                  );
                })}
              </div>

              {/* Rows table */}
              <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-[var(--surface-2)] text-[var(--text-3)]">
                    <tr>
                      <th className="p-2 w-8 text-center">
                        <input
                          type="checkbox"
                          checked={importable.length > 0 && selected.size === importable.length}
                          onChange={toggleAll}
                          style={{ accentColor: 'var(--accent)' }}
                        />
                      </th>
                      <th className="p-2 text-left w-10">{t('clients.import.th.row')}</th>
                      <th className="p-2 text-left">{t('clients.import.th.name')}</th>
                      <th className="p-2 text-left">{t('clients.import.th.inn')}</th>
                      <th className="p-2 text-left">{t('clients.import.th.status')}</th>
                      <th className="p-2 text-left">{t('clients.import.th.reason')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map(row => {
                      const { cls, Icon } = CAT_STYLE[row.category];
                      const canPick = row.category === 'valid' || row.category === 'incomplete';
                      return (
                        <tr key={row.rowNum} className="border-t border-[var(--border)]">
                          <td className="p-2 text-center">
                            <input
                              type="checkbox"
                              checked={selected.has(row.rowNum)}
                              disabled={!canPick}
                              onChange={() => toggleRow(row)}
                              style={{ accentColor: 'var(--accent)' }}
                            />
                          </td>
                          <td className="p-2 text-[var(--text-3)]">{row.rowNum}</td>
                          <td className="p-2 text-[var(--text)]">{row.name || '—'}</td>
                          <td className="p-2 text-[var(--text-2)]">{row.inn || '—'}</td>
                          <td className={`p-2 ${cls}`}>
                            <span className="inline-flex items-center gap-1">
                              <Icon size={13} /> {t(`clients.import.cat.${row.category}`)}
                            </span>
                          </td>
                          <td className="p-2 text-[var(--text-3)]">{row.reason || ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {preview && (
          <div className="border-t border-[var(--border)] px-5 py-3 flex justify-between items-center">
            <span className="text-xs text-[var(--text-2)]">
              {t('clients.import.willImport', { count: selected.size })}
            </span>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-3 py-1.5 text-xs font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] rounded-lg border border-[var(--border)] transition">
                {t('common.cancel')}
              </button>
              <button
                onClick={onConfirm}
                disabled={committing || selected.size === 0}
                className="px-4 py-1.5 bg-[var(--accent)] hover:opacity-90 disabled:opacity-60 text-[var(--accent-text)] text-xs font-medium rounded-lg transition shadow-sm"
              >
                {committing ? t('common.saving') : t('clients.import.confirm')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
