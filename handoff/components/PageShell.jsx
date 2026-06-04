import { Search, SlidersHorizontal, Rows3, Rows4 } from 'lucide-react';

/**
 * PageShell — barcha modul sahifalari uchun yagona karkas.
 * Tartibi har doim bir xil:  Sarlavha → Submenu (tabs) → Filtr/Sort qatori → Kontent (jadval).
 *
 * Audit topilmalari: F-01 (har sahifada boshqacha header+filter), F-02 (submenu/sort yo'q),
 * F-03 (sarlavha ikki joyda takror) — shu bitta komponent uchchalasini hal qiladi.
 *
 * Props:
 *   title      string                 — sahifa sarlavhasi (yagona manba; TopHeader takrorlamasin)
 *   subtitle   string                 — kichik izoh (masalan "128 ta mijoz")
 *   actions    ReactNode              — o'ng-tepadagi tugmalar (doim shu joyda)
 *   tabs       [{key,label,count?}]   — submenu; bo'sh bo'lsa qator chiqmaydi
 *   activeTab  string
 *   onTab      (key)=>void
 *   search     {value,onChange,placeholder,inputProps?}  — ixtiyoriy qidiruv inputi.
 *              inputProps — useSearchOnEnter() dan kelgan Enter-qidiruv propslari (ixtiyoriy);
 *              berilsa, value/onChange o'rniga shu ishlatiladi (Enter bosilganda qidiradi).
 *   filters    ReactNode              — qo'shimcha filtr selektlari (ixtiyoriy)
 *   sort       {value,onChange,options:[{value,label}]}  — saralash dropdown (ixtiyoriy)
 *   density    'comfortable'|'compact'  — jadval zichligi (ixtiyoriy)
 *   onDensity  (val)=>void
 *   children   — jadval yoki boshqa kontent
 */
export default function PageShell({
  title, subtitle, actions,
  tabs = [], activeTab, onTab,
  search, filters, sort,
  density, onDensity,
  children,
}) {
  const showToolbar = search || filters || sort || density;

  return (
    <div className="p-6 max-w-7xl mx-auto animate-in">
      {/* ── Zona 1: Sarlavha + amallar ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text)] tracking-tight">{title}</h1>
          {subtitle && <p className="text-xs text-[var(--text-3)] mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>

      {/* ── Zona 2: Submenu (tabs) ── */}
      {tabs.length > 0 && (
        <div className="flex gap-1 border-b border-[var(--border)] mt-4">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => onTab?.(t.key)}
              className={`px-3.5 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors ${
                activeTab === t.key
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-transparent text-[var(--text-3)] hover:text-[var(--text-2)]'
              }`}
            >
              {t.label}
              {t.count != null && (
                <span className="ml-1.5 text-[11px] font-medium text-[var(--text-3)]">{t.count}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Zona 3: Filtr / Sort qatori ── */}
      {showToolbar && (
        <div className="flex items-center gap-2.5 flex-wrap mt-4 mb-4">
          {search && (
            <div className="flex items-center gap-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 h-[38px] flex-1 min-w-[200px] focus-within:border-[var(--accent)] transition-colors">
              <Search size={15} className="text-[var(--text-3)] shrink-0" />
              <input
                {...(search.inputProps || { value: search.value, onChange: e => search.onChange(e.target.value) })}
                placeholder={search.placeholder || 'Qidirish...'}
                className="bg-transparent border-none outline-none text-[13px] w-full text-[var(--text)] placeholder-[var(--text-3)]"
              />
            </div>
          )}

          {filters}

          {sort && (
            <select
              value={sort.value}
              onChange={e => sort.onChange(e.target.value)}
              className="h-[38px] px-3 rounded-lg text-[13px] text-[var(--text)] bg-[var(--surface)] border border-[var(--border)] cursor-pointer min-w-[180px]"
            >
              {sort.options.map(o => (
                <option key={o.value} value={o.value}>Saralash: {o.label}</option>
              ))}
            </select>
          )}

          {density && (
            <div className="flex border border-[var(--border)] rounded-lg overflow-hidden">
              <DensityBtn icon={Rows3} label="Qulay"  on={density === 'comfortable'} onClick={() => onDensity?.('comfortable')} />
              <DensityBtn icon={Rows4} label="Ixcham" on={density === 'compact'}     onClick={() => onDensity?.('compact')} />
            </div>
          )}
        </div>
      )}

      {/* ── Zona 4: Kontent ── */}
      {children}
    </div>
  );
}

function DensityBtn({ icon: Icon, label, on, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`h-[38px] px-2.5 text-[12px] font-medium flex items-center gap-1.5 transition-colors ${
        on ? 'bg-[var(--accent-bg)] text-[var(--accent)]' : 'bg-[var(--surface)] text-[var(--text-3)] hover:text-[var(--text-2)]'
      }`}
    >
      <Icon size={14} /> {label}
    </button>
  );
}
