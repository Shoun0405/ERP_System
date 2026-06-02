import axios from 'axios';
import toast from 'react-hot-toast';

// Dev: VITE_API_URL=http://localhost:3001 (.env)
// Production (Variant A): VITE_API_URL bo'sh → same-origin relative URL
export const API = import.meta.env.VITE_API_URL ?? '';

const api = axios.create({ 
  baseURL: API,
  withCredentials: true 
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      if (!window.location.pathname.includes('/login')) {
        // Silent redirect on initial /me check, but toast for other protected endpoints
        if (err.config && !err.config.url.endsWith('/me')) {
          toast.error('Sessiya muddati tugadi. Iltimos, qayta tizimga kiring.');
        }
        window.location.href = '/login';
      }
    } else if (!err.config?.skipErrorToast) {
      // Blob yuklab olishlar xatoni o'zi parse qiladi (lib/download.js) —
      // bu yerda umumiy toast ko'rsatmaymiz (ikki marta chiqmasligi uchun).
      const msg = err.response?.data?.error || err.message || 'Server xatosi';
      toast.error(msg);
    }
    return Promise.reject(err);
  }
);

export default api;
