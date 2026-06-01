import { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { useDateFilter } from '../context/DateFilterContext';
import Calendar from './Calendar';

const PRESETS = [
  { key: 'today',     label: 'Bugun' },
  { key: 'yesterday', label: 'Kecha' },
  { key: 'week',      label: 'Shu hafta' },
  { key: 'month',     label: 'Shu oy' },
  { key: 'lastMonth', label: "O'tgan oy" },
  { key: 'quarter',   label: 'Shu chorak' },
  { key: 'year',      label: 'Shu yil' },
  { key: 'lastYear',  label: "O'tgan yil" },
  { key: 'all',       label: 'Barcha davr' },
];

const fmtD = (s) => (s ? s.split('-').reverse().join('.') : '');

function labelFor(preset, from, to) {
  if (preset === 'all') return 'Barcha davr';
  const p = PRESETS.find(x => x.key === preset);
  if (p) return p.label;
  if (from && to) return `${fmtD(from)} — ${fmtD(to)}`;
  if (from) return `${fmtD(from)} dan`;
  if (to)   return `${fmtD(to)} gacha`;
  return 'Davr';
}

export default function PeriodPicker() {
  const { preset, from, to, setPreset, setCustom } = useDateFilter();
  const [open, setOpen] = useState(false);
  const [cf, setCf] = useState(from);
  const [ct, setCt] = useState(to);
  const ref = useRef(null);

  // Popover ochilganda yoki global davr o'zgarganda local inputlarni sinxronlash
  useEffect(() => { setCf(from); setCt(to); }, [from, to, open]);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const pick = (key) => { setPreset(key); setOpen(false); };
  const applyCustom = () => { setCustom(cf, ct); setOpen(false); };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-3)] transition"
        title="Davrni tanlash"
      >
        <CalendarIcon size={14} className="text-[var(--text-3)]" />
        <span className="whitespace-nowrap max-w-[160px] truncate">{labelFor(preset, from, to)}</span>
        <ChevronDown size={13} className="text-[var(--text-3)]" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-72 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl p-2 animate-in">
          <div className="grid grid-cols-2 gap-1">
            {PRESETS.map(p => (
              <button
                key={p.key}
                onClick={() => pick(p.key)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium text-left transition ${
                  preset === p.key
                    ? 'bg-[var(--accent)] text-[var(--accent-text)]'
                    : 'text-[var(--text-2)] hover:bg-[var(--surface-2)]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="border-t border-[var(--border)] mt-2 pt-2">
            <p className="text-[10px] font-semibold text-[var(--text-3)] uppercase tracking-wider px-1 mb-1.5">
              Ixtiyoriy davr
            </p>
            <Calendar from={cf} to={ct} onChange={(f, t) => { setCf(f); setCt(t); }} />
            <div className="flex items-center justify-between gap-2 mt-2">
              <span className="text-[10px] text-[var(--text-3)] font-mono">
                {cf ? fmtD(cf) : '—'} → {ct ? fmtD(ct) : '—'}
              </span>
              <button
                onClick={applyCustom}
                disabled={!cf && !ct}
                className="px-3 py-1.5 btn-primary rounded-md text-xs font-medium disabled:opacity-50"
              >
                Qo'llash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
