import { useState, useCallback, useEffect } from 'react';

// Accordion/inline forma uchun hook — popup emas, sahifada ochiladi
// Esc — yopadi
export function useInlineForm(initialOpen = false) {
  const [isOpen, setIsOpen] = useState(initialOpen);

  const open   = useCallback(() => setIsOpen(true),       []);
  const close  = useCallback(() => setIsOpen(false),      []);
  const toggle = useCallback(() => setIsOpen(o => !o),    []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  return { isOpen, open, close, toggle };
}
