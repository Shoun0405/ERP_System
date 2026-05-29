import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Box, ShoppingCart, CreditCard,
  Settings, Bell, TrendingUp, TrendingDown,
  ArrowUpRight, MessageSquare, FileText,
  ChevronLeft, ChevronRight, ChevronDown, HelpCircle,
  LogOut, Calendar, Download, Plus, Search, Sun, Moon
} from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import api from './lib/api';
import { fmt } from './lib/format';
import { useTheme } from './hooks/useTheme';

import Clients          from './pages/Clients';
import Products         from './pages/Products';
import Sales            from './pages/Sales';
import Payments         from './pages/Payments';
import Contracts        from './pages/Contracts';
import SettingsPage     from './pages/Settings';
import InteractionsPage from './pages/Interactions';
import Login            from './pages/Login';

// ─── Sidebar ───────────────────────────────────────────────────────────────
function Sidebar({ collapsed, onToggle }) {
  const location = useLocation();
  const navItems = [
    { name: 'Dashboard',    path: '/',               icon: LayoutDashboard },
    { name: 'Mijozlar',     path: '/clients',        icon: Users },
    { name: 'Mahsulotlar',  path: '/products',       icon: Box },
    { name: 'Shartnomalar', path: '/contracts',      icon: FileText },
    { name: 'Savdolar',     path: '/sales',          icon: ShoppingCart },
    { name: 'Tushumlar',    path: '/payments',       icon: CreditCard },
    { name: 'Muloqotlar',   path: '/interactions',   icon: MessageSquare },
    { name: 'Sozlamalar',   path: '/settings',       icon: Settings },
  ];

  return (
    <aside
      className="flex flex-col z-20 shrink-0 sidebar-container"
      style={{
        width: collapsed ? 64 : 224,
        background: 'var(--sb-bg)',
        borderRight: '1px solid var(--sb-border)',
      }}
    >
      {/* Brand logo section */}
      <div
        className="h-14 flex items-center px-4 shrink-0 gap-3"
        style={{
          justifyContent: collapsed ? 'center' : 'flex-start',
          borderBottom: '1px solid var(--sb-border)',
        }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'var(--accent)', boxShadow: '0 2px 8px var(--accent-bg)' }}
        >
          <span className="text-white text-base font-bold tracking-tighter">N</span>
        </div>
        {!collapsed && (
          <h2 className="text-sm font-semibold tracking-tight animate-in" style={{ color: 'var(--sb-text)' }}>
            NexERP
          </h2>
        )}
      </div>

      {/* Navigation menu list */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {!collapsed && (
          <div
            className="text-[10px] font-semibold uppercase tracking-wider px-3 py-1 mb-1"
            style={{ color: 'var(--sb-text-2)' }}
          >
            Asosiy Bo'limlar
          </div>
        )}
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              title={collapsed ? item.name : ''}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors relative"
              style={{
                color: isActive ? 'var(--sb-accent)' : 'var(--sb-text-2)',
                background: isActive ? 'var(--sb-active)' : 'transparent',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--sb-hover)'; e.currentTarget.style.color = 'var(--sb-text)'; }}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--sb-text-2)'; } }}
            >
              <Icon size={17} style={{ color: isActive ? 'var(--sb-accent)' : 'var(--sb-text-2)', flexShrink: 0 }} />
              {!collapsed && <span className="truncate">{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Sidebar toggle footer */}
      <div className="p-2" style={{ borderTop: '1px solid var(--sb-border)' }}>
        <button
          onClick={onToggle}
          className="w-full h-8 flex items-center gap-3 px-3 rounded-md text-xs font-medium transition-colors"
          style={{
            justifyContent: collapsed ? 'center' : 'flex-start',
            color: 'var(--sb-text-2)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--sb-hover)'; e.currentTarget.style.color = 'var(--sb-text)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--sb-text-2)'; }}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          {!collapsed && <span>Yopish</span>}
        </button>
      </div>
    </aside>
  );
}

// ─── Top Header ────────────────────────────────────────────────────────────
function TopHeader({ user, theme, onToggleTheme }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const titles = {
    '/':             'Dashboard',
    '/clients':      'Mijozlar (CRM)',
    '/products':     'Mahsulotlar katalogi',
    '/contracts':    'Shartnomalar',
    '/sales':        'Savdolar (Yuk xatlari)',
    '/payments':     'Tushumlar reyestri',
    '/interactions': 'Muloqotlar tarixi',
    '/settings':     'Tizim sozlamalari',
  };

  useEffect(() => {
    const handleOutsideClick = () => setMenuOpen(false);
    if (menuOpen) {
      window.addEventListener('click', handleOutsideClick);
    }
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [menuOpen]);

  const handleLogout = async () => {
    try {
      await api.post('/api/auth/logout');
      toast.success('Xavfsiz ravishda tizimdan chiqildi.');
      window.location.href = '/login';
    } catch {
      // ignore
    }
  };

  const initials = user?.username ? user.username.slice(0, 2).toUpperCase() : 'US';
  const emailText = `${user?.username || 'user'}@nexerp.uz`;

  return (
    <header className="h-14 bg-[var(--surface)] border-b border-[var(--border)] flex items-center justify-between px-6 shrink-0 relative z-30">
      <div className="flex items-center gap-6">
        <h1 className="text-sm font-semibold text-[var(--text)]">
          {titles[location.pathname] || 'NexERP'}
        </h1>

        {/* Global Search Mockup */}
        <div className="hidden md:flex items-center gap-2 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-1.5 w-64 shadow-inner">
          <Search size={14} className="text-[var(--text-3)]" />
          <input
            type="text"
            placeholder="Qidiruv..."
            className="bg-transparent border-none outline-none text-xs w-full text-[var(--text)] placeholder-[var(--text-3)]"
          />
          <kbd className="text-[9px] px-1.5 py-0.5 border border-[var(--border)] rounded bg-[var(--surface)] font-mono text-[var(--text-3)]">
            ⌘K
          </kbd>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Theme toggle */}
        <button
          onClick={onToggleTheme}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition"
          title={theme === 'dark' ? "Yorug' rejim" : "Qorong'u rejim"}
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {/* Help button */}
        <button className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition" title="Yordam">
          <HelpCircle size={17} />
        </button>

        {/* Notification indicator */}
        <button className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition relative" title="Bildirishnomalar">
          <Bell size={17} />
          <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-red-500 rounded-full border border-[var(--surface)]" />
        </button>

        <div className="w-px h-6 bg-[var(--border)]" />

        {/* User administrative block */}
        <div className="relative" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-[var(--surface-2)] transition"
          >
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--border)' }}>
              {initials}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-medium text-[var(--text)] leading-none">{user?.username || 'Foydalanuvchi'}</div>
              <div className="text-[10px] text-[var(--text-3)] leading-tight mt-0.5">{emailText}</div>
            </div>
            <ChevronDown size={12} className="text-[var(--text-3)]" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-48 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-xl py-1.5 z-50 animate-in">
              <Link to="/settings" className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text)] hover:bg-[var(--surface-2)]">
                <Settings size={13} className="text-[var(--text-3)]" />
                Sozlamalar
              </Link>
              <div className="h-px bg-[var(--border)] my-1" />
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 text-left cursor-pointer animate-in"
              >
                <LogOut size={13} className="text-red-500" />
                Tizimdan chiqish
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// ─── Trend SVG Chart ────────────────────────────────────────────────────────
function TrendSVGChart({ data }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.amount), 1);
  const w = 600, h = 200, pad = { l: 48, r: 16, t: 16, b: 32 };
  
  const xs = (i) => pad.l + i * (w - pad.l - pad.r) / (data.length - 1);
  const ys = (v) => h - pad.b - (v / max) * (h - pad.t - pad.b);

  const pathStr = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xs(i).toFixed(1)} ${ys(d.amount).toFixed(1)}`).join(' ');
  const areaStr = `${pathStr} L ${xs(data.length-1).toFixed(1)} ${h-pad.b} L ${xs(0).toFixed(1)} ${h-pad.b} Z`;

  const ticks = [0, max * 0.25, max * 0.5, max * 0.75, max];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-48 select-none">
      {/* horizontal grid lines */}
      {ticks.map((t, i) => (
        <g key={i}>
          <line
            x1={pad.l}
            x2={w - pad.r}
            y1={ys(t)}
            y2={ys(t)}
            stroke="var(--border)"
            strokeDasharray="2 4"
          />
          <text
            x={pad.l - 8}
            y={ys(t) + 3}
            fontSize="10"
            textAnchor="end"
            fill="var(--text-3)"
            fontFamily="var(--mono)"
          >
            {fmt(Math.round(t))}
          </text>
        </g>
      ))}

      {/* Months */}
      {data.map((d, i) => (
        <text
          key={i}
          x={xs(i)}
          y={h - 10}
          fontSize="10"
          textAnchor="middle"
          fill="var(--text-3)"
        >
          {d.month}
        </text>
      ))}

      {/* Gradient Area Fill */}
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaStr} fill="url(#chartGrad)" />

      {/* Bold accent Line */}
      <path d={pathStr} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Node Points */}
      {data.map((d, i) => (
        <circle
          key={i}
          cx={xs(i)}
          cy={ys(d.amount)}
          r="3"
          fill="var(--accent)"
          stroke="var(--surface)"
          strokeWidth="1.5"
        />
      ))}
    </svg>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────────────────
function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let timer;

    const fetchDashboard = () => {
      api.get('/api/dashboard')
        .then(r => { setStats(r.data); setLoading(false); })
        .catch(() => setLoading(false));
    };

    const startPolling = () => {
      timer = setInterval(fetchDashboard, 30_000);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        clearInterval(timer);
      } else {
        fetchDashboard();
        startPolling();
      }
    };

    fetchDashboard();
    startPolling();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const cards = stats ? [
    {
      title: 'Umumiy Qarzdorlik',
      value: fmt(stats.totalDebt),
      unit: 'UZS',
      sub: 'Faol qarzdorlik oboroti',
      color: 'text-red-600',
      tone: 'danger',
      icon: TrendingDown,
      delta: -4.8,
    },
    {
      title: 'Bugungi Savdo',
      value: fmt(stats.todayTotal),
      unit: 'UZS',
      sub: 'Bugungi yuk xatlari summasi',
      color: 'text-emerald-600',
      tone: 'success',
      icon: TrendingUp,
      delta: 12.5,
    },
    {
      title: 'Faol Mijozlar',
      value: stats.clientsCount,
      unit: 'ta',
      sub: 'CRM ro\'yxatida',
      color: 'text-[var(--accent)]',
      tone: 'info',
      icon: Users,
      delta: 8.2,
    },
  ] : [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in">
      {/* Decorative Orbs inside Dashboard background */}
      <div className="relative overflow-hidden">
        {/* Header toolbar */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">Dashboard</h2>
            <p className="text-xs text-[var(--text-3)] mt-0.5">Tizim holati va real vaqt statistikasi</p>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-2)] text-[var(--text-2)] rounded-lg text-xs font-medium transition flex items-center gap-2">
              <Calendar size={13} /> Bugun · {new Date().toLocaleDateString('uz-UZ')}
            </button>
            <button className="px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-2" style={{ background: 'var(--accent)', color: 'var(--accent-text)', boxShadow: '0 1px 4px var(--accent-bg)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--accent)'}
            >
              <Plus size={13} /> Yangi Mijoz
            </button>
          </div>
        </div>

        {/* KPI Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {loading
            ? [...Array(3)].map((_, i) => (
                <div key={i} className="mini-card animate-pulse space-y-4">
                  <div className="h-4 bg-[var(--surface-2)] rounded w-1/3" />
                  <div className="h-8 bg-[var(--surface-2)] rounded w-3/4" />
                  <div className="h-3 bg-[var(--surface-2)] rounded w-1/2" />
                </div>
              ))
            : cards.map((c, i) => {
                const Icon = c.icon;
                const isPositive = c.delta > 0;
                return (
                  <div key={i} className="mini-card flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-medium text-[var(--text-2)]">{c.title}</span>
                        <div className="p-1 rounded-md bg-[var(--surface-2)] text-[var(--text-2)]">
                          <Icon size={14} className={c.color} />
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-xl font-bold font-mono tracking-tight text-[var(--text)]">{c.value}</span>
                        <span className="text-xs text-[var(--text-3)]">{c.unit}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-4 text-[11px]">
                      <span className={`font-semibold font-mono flex items-center gap-0.5 ${
                        isPositive ? 'text-emerald-600' : 'text-red-500'
                      }`}>
                        {isPositive ? '+' : ''}{c.delta}%
                      </span>
                      <span className="text-[var(--text-3)]">{c.sub}</span>
                    </div>
                  </div>
                );
              })
          }
        </div>

        {/* Dynamic graphics and reports lists */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Oylik chart container */}
          <div className="lg:col-span-2 mini-card flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start border-b border-[var(--border)] pb-3 mb-4">
                <div>
                  <h3 className="text-xs font-semibold text-[var(--text)]">Oylik Savdo</h3>
                  <p className="text-[10px] text-[var(--text-3)] mt-0.5">Oxirgi 6 oydagi sotuv dinamikasi (mln UZS)</p>
                </div>
                <button className="px-2 py-1 border border-[var(--border)] rounded text-[10px] hover:bg-[var(--surface-2)] text-[var(--text-2)] flex items-center gap-1.5">
                  <Download size={10} /> Eksport
                </button>
              </div>
              {loading ? (
                <div className="h-44 bg-[var(--surface-2)] animate-pulse rounded-lg" />
              ) : stats?.monthlyData ? (
                <TrendSVGChart data={stats.monthlyData} />
              ) : null}
            </div>
          </div>

          {/* Top Debtors Rank List */}
          <div className="mini-card p-0 flex flex-col">
            <div className="px-4 py-3 border-b border-[var(--border)]">
              <h3 className="text-xs font-semibold text-[var(--text)]">Eng yirik qarzdorlar</h3>
              <p className="text-[10px] text-[var(--text-3)] mt-0.5">Oborot bo'yicha eng yuqori qarzlar</p>
            </div>
            <div className="divide-y divide-[var(--border)] flex-1 overflow-y-auto">
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <div key={i} className="px-4 py-3 flex justify-between">
                    <div className="h-4 bg-[var(--surface-2)] animate-pulse rounded w-1/2" />
                    <div className="h-4 bg-[var(--surface-2)] animate-pulse rounded w-1/4" />
                  </div>
                ))
              ) : stats?.debtors?.length === 0 ? (
                <div className="px-4 py-8 text-center text-[var(--text-3)] text-xs">Qarzdorlar mavjud emas</div>
              ) : (
                stats?.debtors?.map((d, i) => {
                  const maxDebt = stats.debtors[0]?.debt || 1;
                  const ratio = Math.min(1, Math.max(0.05, d.debt / maxDebt));
                  return (
                    <div key={d.id} className="px-4 py-2.5 hover:bg-[var(--surface-2)] transition">
                      <div className="flex justify-between items-baseline mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded bg-[var(--surface-2)] text-[var(--text-2)] text-[10px] font-bold flex items-center justify-center shrink-0 border border-[var(--border)]">
                            {i + 1}
                          </span>
                          <span className="text-xs font-medium text-[var(--text)] truncate">{d.name}</span>
                        </div>
                        <span className="text-xs font-semibold font-mono text-red-500 shrink-0">{fmt(d.debt)}</span>
                      </div>
                      <div className="h-1 bg-[var(--surface-2)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-400 opacity-80"
                          style={{ width: `${ratio * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Recent sales table list */}
        <div className="mini-card p-0">
          <div className="px-5 py-3 border-b border-[var(--border)] flex justify-between items-center bg-[var(--surface-2)] rounded-t-lg">
            <div>
              <h3 className="text-xs font-semibold text-[var(--text)]">So'nggi savdolar</h3>
              <p className="text-[10px] text-[var(--text-3)] mt-0.5">Tizimga kiritilgan oxirgi yuk xatlari</p>
            </div>
            <Link to="/sales" className="text-[11px] text-[var(--accent)] font-medium hover:underline flex items-center gap-0.5">
              Barchasi <ArrowUpRight size={11} />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="px-5 py-2.5 text-[10.5px] font-semibold text-[var(--text-2)] uppercase tracking-wider">Sana</th>
                  <th className="px-5 py-2.5 text-[10.5px] font-semibold text-[var(--text-2)] uppercase tracking-wider">Yuk xati №</th>
                  <th className="px-5 py-2.5 text-[10.5px] font-semibold text-[var(--text-2)] uppercase tracking-wider">Mijoz nomi</th>
                  <th className="px-5 py-2.5 text-[10.5px] font-semibold text-[var(--text-2)] uppercase tracking-wider text-right">Summa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {loading ? (
                  [...Array(4)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(4)].map((_, j) => (
                        <td key={j} className="px-5 py-3"><div className="h-4 bg-[var(--surface-2)] animate-pulse rounded" /></td>
                      ))}
                    </tr>
                  ))
                ) : stats?.recentSales?.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-5 py-6 text-center text-[var(--text-3)] text-xs">Hozircha sotuvlar kiritilmagan</td>
                  </tr>
                ) : (
                  stats?.recentSales?.map(s => (
                    <tr key={s.id} className="hover:bg-[var(--surface-2)] transition-colors">
                      <td className="px-5 py-2.5 text-xs text-[var(--text-2)]">{new Date(s.date).toLocaleDateString('uz-UZ')}</td>
                      <td className="px-5 py-2.5 text-xs font-semibold font-mono text-[var(--text)]">{s.nakladnoy}</td>
                      <td className="px-5 py-2.5 text-xs text-[var(--text)]">{s.client?.name}</td>
                      <td className="px-5 py-2.5 text-xs text-right font-bold text-emerald-600 font-mono">{fmt(s.totalAmount)} UZS</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── App main component ────────────────────────────────────────────────────
export default function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { theme, toggle: toggleTheme } = useTheme();

  useEffect(() => {
    api.get('/api/auth/me')
      .then(res => {
        setUser(res.data.user);
        setLoading(false);
      })
      .catch(() => {
        setUser(null);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center font-sans">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-4 rounded-full animate-spin mx-auto" style={{ borderColor: 'var(--accent-bg)', borderTopColor: 'var(--accent)' }} />
          <p className="text-xs text-[var(--text-3)] font-semibold tracking-wider uppercase">Yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Router>
        <Toaster position="top-right" toastOptions={{ duration: 3500 }} />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Login />} />
        </Routes>
      </Router>
    );
  }

  return (
    <Router>
      <Toaster position="top-right" toastOptions={{ duration: 3500 }} />
      <div className="flex h-screen bg-[var(--bg)] overflow-hidden font-sans">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <TopHeader user={user} theme={theme} onToggleTheme={toggleTheme} />
          <div className="flex-1 overflow-y-auto pb-8">
            <Routes>
              <Route path="/"              element={<Dashboard />} />
              <Route path="/clients"       element={<Clients />} />
              <Route path="/products"      element={<Products />} />
              <Route path="/contracts"     element={<Contracts />} />
              <Route path="/sales"         element={<Sales />} />
              <Route path="/payments"      element={<Payments />} />
              <Route path="/interactions"  element={<InteractionsPage />} />
              <Route path="/settings"      element={<SettingsPage />} />
              <Route path="/login"         element={<Dashboard />} />
              <Route path="*"              element={<Dashboard />} />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
}
