import { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Box, ShoppingCart, CreditCard,
  Settings, TrendingUp, TrendingDown,
  ArrowUpRight, MessageSquare, FileText,
  ChevronLeft, ChevronRight, ChevronDown,
  LogOut, Calendar, Download, Plus, Search, Sun, Moon,
  Shield, Menu
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Toaster, toast } from 'react-hot-toast';
import api from './lib/api';
import { fmt } from './lib/format';
import { useTheme } from './hooks/useTheme';
import TrendChart from './components/TrendChart';
import PeriodPicker from './components/PeriodPicker';
import { DateFilterProvider } from './context/DateFilterContext';

// Global davr filtri ko'rinadigan sahifalar (1C 8.3 "Период" uslubi)
const DATE_ROUTES = ['/sales', '/payments', '/contracts', '/reports'];

import Clients          from './pages/Clients';
import Products         from './pages/Products';
import Sales            from './pages/Sales';
import Payments         from './pages/Payments';
import Contracts        from './pages/Contracts';
import SettingsPage     from './pages/Settings';
import InteractionsPage from './pages/Interactions';
import Login            from './pages/Login';
import UsersPage        from './pages/Users';
import Reports          from './pages/Reports';

// ─── Sidebar ───────────────────────────────────────────────────────────────
function Sidebar({ collapsed, onToggle, user, mobileOpen, onMobileClose }) {
  const location = useLocation();
  // On mobile the drawer always shows the full-width expanded nav
  const width = mobileOpen ? 224 : (collapsed ? 64 : 224);
  const isCollapsed = mobileOpen ? false : collapsed;
  const rawNavItems = [
    { name: 'Dashboard',    path: '/',               icon: LayoutDashboard },
    { name: 'Mijozlar',     path: '/clients',        icon: Users,           module: 'clients' },
    { name: 'Mahsulotlar',  path: '/products',       icon: Box,             module: 'products' },
    { name: 'Shartnomalar', path: '/contracts',      icon: FileText,        module: 'contracts' },
    { name: 'Savdolar',     path: '/sales',          icon: ShoppingCart,    module: 'sales' },
    { name: 'Tushumlar',    path: '/payments',       icon: CreditCard,     module: 'payments' },
    { name: 'Muloqotlar',   path: '/interactions',   icon: MessageSquare,   module: 'interactions' },
    { name: 'Hisobotlar',   path: '/reports',        icon: TrendingUp,      module: 'reports' },
    { name: 'Sozlamalar',   path: '/settings',       icon: Settings,        module: 'settings' },
  ];

  const navItems = rawNavItems.filter(item => {
    if (item.path === '/') return true;
    if (user?.role === 'admin') return true;
    return user?.permissions?.[item.module]?.read !== false;
  });

  if (user?.role === 'admin') {
    navItems.push({ name: 'Foydalanuvchilar', path: '/users', icon: Shield });
  }

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div onClick={onMobileClose} className="fixed inset-0 bg-black/50 z-30 lg:hidden" />
      )}
      <aside
        className={`flex flex-col z-40 shrink-0 sidebar-container fixed inset-y-0 left-0 lg:static lg:translate-x-0 transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{
          width,
          background: 'var(--sb-bg)',
          borderRight: '1px solid var(--sb-border)',
        }}
      >
      {/* Brand logo section */}
      <div
        className="h-14 flex items-center px-4 shrink-0 gap-3"
        style={{
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          borderBottom: '1px solid var(--sb-border)',
        }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'var(--accent)', boxShadow: '0 2px 8px var(--accent-bg)' }}
        >
          <span className="text-white text-base font-bold tracking-tighter">N</span>
        </div>
        {!isCollapsed && (
          <h2 className="text-sm font-semibold tracking-tight animate-in" style={{ color: 'var(--sb-text)' }}>
            NexERP
          </h2>
        )}
      </div>

      {/* Navigation menu list */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {!isCollapsed && (
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
              onClick={onMobileClose}
              title={isCollapsed ? item.name : ''}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors relative"
              style={{
                color: isActive ? 'var(--sb-accent)' : 'var(--sb-text-2)',
                background: isActive ? 'var(--sb-active)' : 'transparent',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--sb-hover)'; e.currentTarget.style.color = 'var(--sb-text)'; }}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--sb-text-2)'; } }}
            >
              <Icon size={19} strokeWidth={isActive ? 2.2 : 1.8} style={{ color: isActive ? 'var(--sb-accent)' : 'var(--sb-text-2)', flexShrink: 0 }} />
              {!isCollapsed && <span className="truncate">{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Sidebar toggle footer — desktop only */}
      <div className="p-2 hidden lg:block" style={{ borderTop: '1px solid var(--sb-border)' }}>
        <button
          onClick={onToggle}
          className="w-full h-8 flex items-center gap-3 px-3 rounded-md text-xs font-medium transition-colors"
          style={{
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            color: 'var(--sb-text-2)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--sb-hover)'; e.currentTarget.style.color = 'var(--sb-text)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--sb-text-2)'; }}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          {!isCollapsed && <span>Yopish</span>}
        </button>
      </div>
      </aside>
    </>
  );
}

// ─── Top Header ────────────────────────────────────────────────────────────
function TopHeader({ user, theme, onToggleTheme, onMobileMenu }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const searchRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  const titles = {
    '/':             'Dashboard',
    '/clients':      'Mijozlar (CRM)',
    '/products':     'Mahsulotlar katalogi',
    '/contracts':    'Shartnomalar',
    '/sales':        'Savdolar (Yuk xatlari)',
    '/payments':     'Tushumlar reyestri',
    '/interactions': 'Muloqotlar tarixi',
    '/reports':      'Tizim hisobotlari',
    '/settings':     'Tizim sozlamalari',
    '/users':        'Foydalanuvchilar (RBAC)',
  };

  useEffect(() => {
    const handleOutsideClick = () => setMenuOpen(false);
    if (menuOpen) {
      window.addEventListener('click', handleOutsideClick);
    }
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [menuOpen]);

  // ⌘K / Ctrl+K — global qidiruvga fokus
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submitSearch = (e) => {
    e.preventDefault();
    const q = searchValue.trim();
    if (!q) return;
    navigate(`/clients?q=${encodeURIComponent(q)}`);
    setSearchValue('');
    searchRef.current?.blur();
  };

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
      <div className="flex items-center gap-3 md:gap-6 min-w-0">
        {/* Mobile hamburger */}
        <button
          onClick={onMobileMenu}
          className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition shrink-0"
          title="Menyu"
        >
          <Menu size={20} strokeWidth={2} />
        </button>

        <h1 className="text-sm font-semibold text-[var(--text)] truncate">
          {titles[location.pathname] || 'NexERP'}
        </h1>

        {/* Global Search — mijoz qidirish (Enter → Mijozlar sahifasi) */}
        <form onSubmit={submitSearch} className="hidden md:flex items-center gap-2 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-1.5 w-64 focus-within:border-[var(--accent)] transition-colors">
          <Search size={14} className="text-[var(--text-3)]" />
          <input
            ref={searchRef}
            type="text"
            value={searchValue}
            onChange={e => setSearchValue(e.target.value)}
            placeholder="Mijoz qidirish..."
            className="bg-transparent border-none outline-none text-xs w-full text-[var(--text)] placeholder-[var(--text-3)]"
          />
          <kbd className="text-[9px] px-1.5 py-0.5 border border-[var(--border)] rounded bg-[var(--surface)] font-mono text-[var(--text-3)]">
            ⌘K
          </kbd>
        </form>
      </div>

      <div className="flex items-center gap-4">
        {/* Global davr filtri — faqat sana bilan ishlaydigan sahifalarda */}
        {DATE_ROUTES.includes(location.pathname) && <PeriodPicker />}

        {/* Theme toggle */}
        <button
          onClick={onToggleTheme}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition"
          title={theme === 'dark' ? "Yorug' rejim" : "Qorong'u rejim"}
        >
          {theme === 'dark' ? <Sun size={19} strokeWidth={2} /> : <Moon size={19} strokeWidth={2} />}
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

// ─── Dashboard ─────────────────────────────────────────────────────────────
function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const handleExportMonthly = () => {
    if (!stats?.monthlyData?.length) return;
    const rows = stats.monthlyData.map(d => ({ Oy: d.month, 'Summa (UZS)': Math.round(d.amount) }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Oylik savdo');
    XLSX.writeFile(wb, `oylik_savdo_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

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
      tone: 'danger',
      badgeClass: 'icon-badge-danger',
      icon: TrendingDown,
    },
    {
      title: 'Bugungi Savdo',
      value: fmt(stats.todayTotal),
      unit: 'UZS',
      sub: 'Bugungi yuk xatlari summasi',
      tone: 'success',
      badgeClass: 'icon-badge-success',
      icon: TrendingUp,
    },
    {
      title: 'Faol Mijozlar',
      value: stats.clientsCount,
      unit: 'ta',
      sub: 'CRM ro\'yxatida',
      tone: 'info',
      badgeClass: 'icon-badge-info',
      icon: Users,
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
            <div className="px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--text-2)] rounded-lg text-xs font-medium flex items-center gap-2 select-none">
              <Calendar size={13} /> Bugun · {new Date().toLocaleDateString('uz-UZ')}
            </div>
            <button onClick={() => navigate('/clients')} className="px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-2" style={{ background: 'var(--accent)', color: 'var(--accent-text)', boxShadow: '0 1px 4px var(--accent-bg)' }}
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
                return (
                  <div key={i} className="mini-card flex flex-col justify-between group hover:scale-[1.01] hover:shadow-md transition-all duration-200 cursor-default">
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-[10px] font-bold text-[var(--text-2)] uppercase tracking-wider">{c.title}</span>
                        <div className={`icon-badge ${c.badgeClass} group-hover:scale-110 transition-transform duration-200`}>
                          <Icon size={20} strokeWidth={2.2} />
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-2xl font-bold font-mono tracking-tight text-[var(--text)]">{c.value}</span>
                        <span className="text-xs font-semibold text-[var(--text-3)]">{c.unit}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-5 border-t border-[var(--border)] pt-3">
                      <span className="text-[var(--text-3)] text-[10px] font-medium">{c.sub}</span>
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
                <button onClick={handleExportMonthly} className="px-2 py-1 border border-[var(--border)] rounded text-[10px] hover:bg-[var(--surface-2)] text-[var(--text-2)] flex items-center gap-1.5">
                  <Download size={10} /> Eksport
                </button>
              </div>
              {loading ? (
                <div className="h-44 bg-[var(--surface-2)] animate-pulse rounded-lg" />
              ) : stats?.monthlyData ? (
                <TrendChart
                  data={stats.monthlyData.map(d => ({ amount: d.amount, label: d.month }))}
                  ticks={5}
                  gradientId="dashboardTrendGrad"
                />
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
  const [mobileOpen, setMobileOpen] = useState(false);
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
      <DateFilterProvider>
      <Toaster position="top-right" toastOptions={{ duration: 3500 }} />
      <div className="flex h-screen bg-[var(--bg)] overflow-hidden font-sans">
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          user={user}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <TopHeader user={user} theme={theme} onToggleTheme={toggleTheme} onMobileMenu={() => setMobileOpen(true)} />
          <div className="flex-1 overflow-y-auto pb-8">
            <Routes>
              <Route path="/"              element={<Dashboard />} />
              {(user?.role === 'admin' || user?.permissions?.clients?.read !== false) && <Route path="/clients"       element={<Clients user={user} />} />}
              {(user?.role === 'admin' || user?.permissions?.products?.read !== false) && <Route path="/products"      element={<Products user={user} />} />}
              {(user?.role === 'admin' || user?.permissions?.contracts?.read !== false) && <Route path="/contracts"     element={<Contracts user={user} />} />}
              {(user?.role === 'admin' || user?.permissions?.sales?.read !== false) && <Route path="/sales"         element={<Sales user={user} />} />}
              {(user?.role === 'admin' || user?.permissions?.payments?.read !== false) && <Route path="/payments"      element={<Payments user={user} />} />}
              {(user?.role === 'admin' || user?.permissions?.interactions?.read !== false) && <Route path="/interactions"  element={<InteractionsPage user={user} />} />}
              {(user?.role === 'admin' || user?.permissions?.settings?.read !== false) && <Route path="/settings"      element={<SettingsPage user={user} />} />}
              {(user?.role === 'admin' || user?.permissions?.reports?.read !== false) && <Route path="/reports"       element={<Reports user={user} />} />}
              {user?.role === 'admin' && <Route path="/users" element={<UsersPage user={user} />} />}
              <Route path="/login"         element={<Dashboard />} />
              <Route path="*"              element={<Dashboard />} />
            </Routes>
          </div>
        </div>
      </div>
      </DateFilterProvider>
    </Router>
  );
}
