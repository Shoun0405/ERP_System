import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Lock, ArrowRight, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function Login() {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error(t('login.fillAll'));
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/api/auth/login', { username, password });
      if (res.data.success) {
        toast.success(t('login.welcome'));
        window.location.href = '/';
      }
    } catch {
      // error interceptor handles display
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden font-sans"
      style={{ background: 'var(--bg)' }}
    >
      {/* Warm ambient orbs */}
      <div
        className="absolute pointer-events-none rounded-full"
        style={{
          width: '480px', height: '480px',
          top: '-120px', left: '-120px',
          background: 'radial-gradient(circle, oklch(0.585 0.222 277 / 0.12), transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
      <div
        className="absolute pointer-events-none rounded-full"
        style={{
          width: '380px', height: '380px',
          bottom: '-80px', right: '-80px',
          background: 'radial-gradient(circle, oklch(0.700 0.180 277 / 0.10), transparent 70%)',
          filter: 'blur(60px)',
        }}
      />

      {/* Card */}
      <div
        className="w-full max-w-[400px] z-10 rounded-2xl p-8"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: '0 4px 24px oklch(0.16 0.012 55 / 0.08), 0 1px 4px oklch(0.16 0.012 55 / 0.06)',
        }}
      >
        {/* Top accent line */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[140px] h-[2px] rounded-b-full"
          style={{ background: 'linear-gradient(90deg, transparent, var(--accent), transparent)' }}
        />

        <div className="absolute top-4 right-4"><LanguageSwitcher /></div>

        {/* Brand */}
        <div className="text-center mb-8">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
            style={{
              background: 'var(--accent)',
              boxShadow: '0 4px 16px var(--accent-bg)',
            }}
          >
            <span className="text-xl font-bold tracking-tighter" style={{ color: 'var(--accent-text)' }}>N</span>
          </div>
          <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
            {t('login.title')}
          </h2>
          <p className="text-xs mt-1.5" style={{ color: 'var(--text-3)' }}>
            {t('login.subtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Username */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-2)' }}>
              {t('login.usernameLabel')}
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3" style={{ color: 'var(--text-3)' }}>
                <User size={15} />
              </span>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder={t('login.usernamePlaceholder')}
                className="w-full h-10 pl-10 pr-4 rounded-lg text-xs"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-2)' }}>
              {t('login.passwordLabel')}
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3" style={{ color: 'var(--text-3)' }}>
                <Lock size={15} />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-10 pl-10 pr-10 rounded-lg text-xs"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 transition cursor-pointer"
                style={{ color: 'var(--text-3)' }}
                disabled={loading}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Remember me */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="rounded w-3.5 h-3.5"
                style={{ accentColor: 'var(--accent)' }}
                defaultChecked
              />
              <span className="text-[11px]" style={{ color: 'var(--text-2)' }}>{t('login.remember')}</span>
            </label>
            <button
              type="button"
              onClick={() => toast(t('login.forgotMsg'), { icon: '🔑' })}
              className="text-[11px] cursor-pointer transition hover:underline bg-transparent border-0 p-0"
              style={{ color: 'var(--text-3)' }}
            >
              {t('login.forgot')}
            </button>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-lg text-xs font-semibold tracking-wide transition flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed group"
            style={{
              background: 'var(--accent)',
              color: 'var(--accent-text)',
              boxShadow: '0 2px 8px var(--accent-bg)',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--accent-hover)'; }}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--accent)'}
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {t('login.submit')}
                <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div
          className="mt-8 pt-5 flex items-center justify-center gap-2 text-[10px] select-none"
          style={{ borderTop: '1px solid var(--border)', color: 'var(--text-3)' }}
        >
          <ShieldCheck size={12} className="text-emerald-500" />
          <span>{t('login.ssl')}</span>
        </div>
      </div>
    </div>
  );
}
