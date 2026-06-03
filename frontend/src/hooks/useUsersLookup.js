import { useState, useEffect } from 'react';
import api from '../lib/api';

// /api/users/lookup ni bir marta o'qib Map(id → { fullName, role }) qaytaradi.
// Audit "kim/qachon" ustunida foydalanuvchi nomini yechish uchun (5 sahifada ishlatiladi).
export function useUsersLookup() {
  const [map, setMap] = useState(() => new Map());

  useEffect(() => {
    api.get('/api/users/lookup')
      .then(r => setMap(new Map((r.data || []).map(u => [u.id, u]))))
      .catch(() => { /* ruxsat yo'q / xato — bo'sh map, "—" ko'rinadi */ });
  }, []);

  return map;
}
