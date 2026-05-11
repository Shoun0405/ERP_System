import axios from 'axios';
import toast from 'react-hot-toast';

// Dev: VITE_API_URL=http://localhost:3001 (.env)
// Production (Variant A): VITE_API_URL bo'sh → same-origin relative URL
export const API = import.meta.env.VITE_API_URL ?? '';

const api = axios.create({ baseURL: API });

api.interceptors.response.use(
  res => res,
  err => {
    const msg = err.response?.data?.error || err.message || 'Server xatosi';
    toast.error(msg);
    return Promise.reject(new Error(msg));
  }
);

export default api;
