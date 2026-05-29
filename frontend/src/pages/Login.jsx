import { useState } from 'react';
import { User, Lock, ArrowRight, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error('Iltimos, barcha maydonlarni to\'ldiring!');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/api/auth/login', { username, password });
      if (res.data.success) {
        toast.success('Xush kelibsiz!');
        // Redirect to dashboard
        window.location.href = '/';
      }
    } catch {
      // Axios error interceptor will handle standard display, 
      // but in case of manual handling we keep loading state off
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Premium background decorative blur circles */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-blue-400/10 blur-[120px] pointer-events-none animate-pulse duration-[8000ms]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-indigo-400/10 blur-[120px] pointer-events-none animate-pulse duration-[6000ms]" />

      {/* Main glassmorphism card */}
      <div className="w-full max-w-[420px] bg-white border border-[var(--border)] rounded-2xl shadow-xl shadow-zinc-200/50 p-8 z-10 transition-all duration-300 hover:shadow-2xl hover:shadow-zinc-200/70 relative">
        
        {/* Glow overlay at the top */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[3px] bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-b-full shadow-sm" />

        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-md shadow-blue-500/20 mb-4 transform hover:scale-105 transition-transform duration-200">
            <span className="text-white text-xl font-bold tracking-tighter">N</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-[var(--text)]">NexERP Tizimiga Kirish</h2>
          <p className="text-xs text-[var(--text-3)] mt-1.5">Davom etish uchun hisob ma'lumotlaringizni kiriting</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Username block */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-[var(--text-2)] uppercase tracking-wider block">
              Foydalanuvchi nomi
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-[var(--text-3)]">
                <User size={15} />
              </span>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Masalan: admin"
                className="w-full h-10 pl-10 pr-4 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] placeholder-[var(--text-3)] outline-none focus:border-blue-500 focus:bg-white transition-all duration-200"
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Password block */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-[var(--text-2)] uppercase tracking-wider block">
              Parol
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-[var(--text-3)]">
                <Lock size={15} />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-10 pl-10 pr-10 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] placeholder-[var(--text-3)] outline-none focus:border-blue-500 focus:bg-white transition-all duration-200"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-[var(--text-3)] hover:text-[var(--text)] transition cursor-pointer flex items-center justify-center"
                disabled={loading}
                title={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Remember me / forgot password option (Mocked for premium feel) */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input 
                type="checkbox" 
                className="rounded border-[var(--border)] text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                defaultChecked
              />
              <span className="text-[11px] text-[var(--text-2)]">Eslab qolish</span>
            </label>
            <span className="text-[11px] text-[var(--text-3)] hover:text-[var(--text)] cursor-pointer transition">
              Parolni unutdingizmi?
            </span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 text-white rounded-lg text-xs font-semibold tracking-wide transition flex items-center justify-center gap-2 shadow-md shadow-blue-500/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group mt-2"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Tizimga Kirish 
                <ArrowRight size={14} className="transform group-hover:translate-x-0.5 transition-transform duration-200" />
              </>
            )}
          </button>
        </form>

        {/* Footer info badge */}
        <div className="mt-8 pt-5 border-t border-[var(--border)] flex items-center justify-center gap-2 text-[10px] text-[var(--text-3)] select-none">
          <ShieldCheck size={12} className="text-emerald-500" />
          <span>SSL Himoyalangan & Shifrlangan Aloqa</span>
        </div>

      </div>
    </div>
  );
}
