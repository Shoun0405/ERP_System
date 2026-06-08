import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { LANGS } from '../i18n';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const code = (i18n.language || 'uz').split('-')[0];
  const current = LANGS.find(l => l.code === code) || LANGS[0];

  useEffect(() => {
    const onOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    if (open) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  const pick = (c) => { i18n.changeLanguage(c); setOpen(false); };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2 h-8 rounded-lg text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition text-xs font-medium"
        title="Til / Язык / 语言"
        aria-label="Language"
      >
        <Globe size={16} strokeWidth={2} />
        <span className="hidden sm:inline">{current.label}</span>
        <ChevronDown size={12} className="text-[var(--text-3)]" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-40 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-xl py-1.5 z-50 animate-in">
          {LANGS.map(l => (
            <button
              key={l.code}
              onClick={() => pick(l.code)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--text)] hover:bg-[var(--surface-2)] text-left"
            >
              <span className="text-base leading-none">{l.flag}</span>
              <span className="flex-1">{l.label}</span>
              {current.code === l.code && <Check size={13} className="text-[var(--accent)]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
