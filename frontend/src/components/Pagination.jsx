import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Pagination({ page, total, limit, onPage }) {
  const { t } = useTranslation();
  const pages = Math.ceil(total / limit);
  if (pages <= 1) return null;

  const start = (page - 1) * limit + 1;
  const end   = Math.min(page * limit, total);

  const getPageNumbers = () => {
    if (pages <= 5) return Array.from({ length: pages }, (_, i) => i + 1);
    if (page <= 3)         return [1, 2, 3, 4, 5];
    if (page >= pages - 2) return [pages - 4, pages - 3, pages - 2, pages - 1, pages];
    return [page - 2, page - 1, page, page + 1, page + 2];
  };

  return (
    <div className="flex items-center justify-between px-6 py-3 border-t border-[var(--border)] bg-[var(--surface-2)]/50">
      <p className="text-sm text-[var(--text-3)]">
        {t('pagination.range', { start, end, count: total })}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className="p-1.5 rounded-md text-[var(--text-3)] hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <ChevronLeft size={16} />
        </button>
        {getPageNumbers().map(n => (
          <button
            key={n}
            onClick={() => onPage(n)}
            className={`w-8 h-8 rounded-md text-sm font-medium transition ${
              n === page
                ? 'bg-[var(--accent)] text-[var(--accent-text)]'
                : 'text-[var(--text-2)] hover:bg-[var(--surface-2)]'
            }`}
          >
            {n}
          </button>
        ))}
        <button
          onClick={() => onPage(page + 1)}
          disabled={page === pages}
          className="p-1.5 rounded-md text-[var(--text-3)] hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
