import { useEffect } from 'react';

/**
 * Modal uchun global keyboard shortcut:
 * - Ctrl+Enter → onSave()
 * - Escape     → onClose()
 *
 * @param {boolean} active  - Modal ochiqmi?
 * @param {Function} onSave  - Ctrl+Enter bosilganda
 * @param {Function} onClose - Esc bosilganda
 */
export function useModalKeys(active, onSave, onClose) {
  useEffect(() => {
    if (!active) return;
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        onSave?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active, onSave, onClose]);
}
