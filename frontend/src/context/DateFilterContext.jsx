/* eslint-disable react-refresh/only-export-components -- context fayli: provider + hook birga */
import { createContext, useContext, useState, useCallback } from 'react';

const pad = n => String(n).padStart(2, '0');
const toYMD = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// 1C 8.3 uslubidagi "standartlangan davr" — preset kalitidan {from,to} hisoblaydi
export function computeRange(preset) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  switch (preset) {
    case 'today':     { const t = toYMD(now); return { from: t, to: t }; }
    case 'yesterday': { const t = toYMD(new Date(y, m, d - 1)); return { from: t, to: t }; }
    case 'week': {
      const dow = (now.getDay() + 6) % 7; // 0 = Dushanba
      return { from: toYMD(new Date(y, m, d - dow)), to: toYMD(new Date(y, m, d - dow + 6)) };
    }
    case 'month':     return { from: toYMD(new Date(y, m, 1)),   to: toYMD(new Date(y, m + 1, 0)) };
    case 'lastMonth': return { from: toYMD(new Date(y, m - 1, 1)), to: toYMD(new Date(y, m, 0)) };
    case 'quarter': {
      const q = Math.floor(m / 3);
      return { from: toYMD(new Date(y, q * 3, 1)), to: toYMD(new Date(y, q * 3 + 3, 0)) };
    }
    case 'year':      return { from: `${y}-01-01`,     to: `${y}-12-31` };
    case 'lastYear':  return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    case 'all':
    default:          return { from: '', to: '' };
  }
}

const STORAGE_KEY = 'erp.dateFilter';

function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const v = JSON.parse(raw);
      if (v && typeof v.preset === 'string') return v;
    }
  } catch { /* localStorage yo'q — default */ }
  return { preset: 'all', from: '', to: '' };
}

const DateFilterContext = createContext(null);

export function DateFilterProvider({ children }) {
  const [state, setState] = useState(loadInitial);

  const persist = useCallback((next) => {
    setState(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);

  const setPreset = useCallback((preset) => persist({ preset, ...computeRange(preset) }), [persist]);
  const setCustom = useCallback((from, to) => persist({ preset: 'custom', from, to }), [persist]);

  return (
    <DateFilterContext.Provider value={{ ...state, setPreset, setCustom }}>
      {children}
    </DateFilterContext.Provider>
  );
}

export function useDateFilter() {
  return useContext(DateFilterContext)
    || { preset: 'all', from: '', to: '', setPreset: () => {}, setCustom: () => {} };
}
