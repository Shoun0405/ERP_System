import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const WEEKDAYS = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];

const pad = n => String(n).padStart(2, '0');
const toYMD = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYMD = (s) => {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

/**
 * Oraliq (range) tanlash kalendari.
 * 1-bosish → boshlanish sanasi; 2-bosish → tugash sanasi (teskari bo'lsa almashtiriladi);
 * ikkalasi to'lgach yangi bosish — yangi oraliqni boshlaydi.
 */
export default function Calendar({ from, to, onChange }) {
  const fromD = parseYMD(from);
  const toD = parseYMD(to);
  const fromT = fromD ? fromD.getTime() : null;
  const toT = toD ? toD.getTime() : null;
  const todayT = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();

  const initial = fromD || toD || new Date();
  const [view, setView] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));

  const y = view.getFullYear();
  const m = view.getMonth();

  const firstDow = (new Date(y, m, 1).getDay() + 6) % 7; // Dushanba = 0
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const handleClick = (d) => {
    const s = toYMD(d);
    if (!from || (from && to)) {
      onChange(s, '');                 // yangi oraliq boshlanishi
    } else if (d.getTime() < fromT) {
      onChange(s, from);               // teskari tartib — almashtirish
    } else {
      onChange(from, s);
    }
  };

  return (
    <div className="select-none">
      {/* Oy navigatsiyasi */}
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => setView(new Date(y, m - 1, 1))}
          className="p-1 rounded-md text-[var(--text-2)] hover:bg-[var(--surface-2)] transition">
          <ChevronLeft size={16} />
        </button>
        <span className="text-xs font-semibold text-[var(--text)]">{MONTHS[m]} {y}</span>
        <button type="button" onClick={() => setView(new Date(y, m + 1, 1))}
          className="p-1 rounded-md text-[var(--text-2)] hover:bg-[var(--surface-2)] transition">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Hafta kunlari */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {WEEKDAYS.map(w => (
          <div key={w} className="text-center text-[10px] font-semibold text-[var(--text-3)] py-0.5">{w}</div>
        ))}
      </div>

      {/* Kunlar */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const t = d.getTime();
          const isEdge = t === fromT || t === toT;
          const inRange = fromT && toT && t > fromT && t < toT;
          const isToday = t === todayT;
          return (
            <button
              key={i}
              type="button"
              onClick={() => handleClick(d)}
              className={`h-7 text-[11px] rounded-md transition font-medium
                ${isEdge
                  ? 'bg-[var(--accent)] text-[var(--accent-text)] font-bold'
                  : inRange
                    ? 'bg-[var(--accent-bg)] text-[var(--accent)]'
                    : 'text-[var(--text-2)] hover:bg-[var(--surface-2)]'}
                ${isToday && !isEdge ? 'ring-1 ring-inset ring-[var(--accent)]' : ''}`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
