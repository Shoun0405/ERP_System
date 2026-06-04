import { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Drawer — F-07: yagona o'ngdan chiquvchi panel.
 *
 * MUAMMO: "detalni ko'rish" har joyda boshqacha — Clients'da satr ichida
 * akkordeon ochiladi, Sales/Contracts'da turli kenglikdagi markaziy modal
 * (max-w-3xl / 4xl / 5xl). Bir xil emas.
 *
 * YECHIM: yozuv detallarini KO'RISH uchun doim shu Drawer ishlatiladi
 * (o'ngdan sirpanib chiqadi). Forma/tasdiq uchun esa modal qoladi (lekin
 * kengliklari standartlashtiriladi — README-PHASE2 ga qarang).
 *
 * Props:
 *   open      boolean
 *   onClose   ()=>void
 *   title     string
 *   subtitle  string (ixtiyoriy)
 *   width     'sm'|'md'|'lg'   (default 'md' = 480px)
 *   footer    ReactNode (ixtiyoriy — pastki amal tugmalari)
 *   children  panel kontenti
 */
const WIDTHS = { sm: 380, md: 480, lg: 640 };

export default function Drawer({ open, onClose, title, subtitle, width = 'md', footer, children }) {
  // Esc bilan yopish + body scroll lock
  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  return (
    <div
      aria-hidden={!open}
      className={`fixed inset-0 z-50 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0"
        style={{ background: 'oklch(0.21 0.04 265 / 0.45)', backdropFilter: 'blur(3px)' }}
      />
      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        className={`absolute top-0 right-0 h-full flex flex-col bg-[var(--surface)] border-l border-[var(--border)] shadow-[var(--shadow-lg)] transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ width: `min(${WIDTHS[width]}px, 92vw)` }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[var(--border)] shrink-0">
          <div className="min-w-0">
            <h2 className="t-h2 truncate">{title}</h2>
            {subtitle && <p className="t-caption mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-md text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
            aria-label="Yopish"
          >
            <X size={18} strokeWidth={2.2} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {/* Footer (ixtiyoriy) */}
        {footer && (
          <div className="shrink-0 px-5 py-3.5 border-t border-[var(--border)] flex justify-end gap-2 bg-[var(--surface-2)]">
            {footer}
          </div>
        )}
      </aside>
    </div>
  );
}
