import { useState } from 'react';

// Qidiruv matni (text) va tasdiqlangan so'rov (query) ni ajratadi.
// `query` faqat Enter bosilganda yoki maydon tozalanganda yangilanadi —
// shu bilan har harf bosilganda serverga so'rov yuborilmaydi (yuklama kam).
// onCommit — query o'zgarganda chaqiriladi (odatda setPage(1) uchun).
export function useSearchOnEnter(initial = '', onCommit) {
  const [text, setText]   = useState(initial);
  const [query, setQuery] = useState(initial);

  const commit = (v) => {
    const val = (v ?? text).trim();
    setQuery(val);
    onCommit?.(val);
  };

  const inputProps = {
    value: text,
    onChange: (e) => {
      const v = e.target.value;
      setText(v);
      if (v === '') commit('');          // tozalanganda darhol reset
    },
    onKeyDown: (e) => {
      if (e.key === 'Enter') commit(e.currentTarget.value);
    },
  };

  const reset = () => { setText(''); commit(''); };

  // setQuery o'rniga commit qaytariladi — tashqi o'rnatish ham onCommit'ni ishga tushiradi
  return { text, setText, query, setQuery: commit, reset, inputProps };
}
