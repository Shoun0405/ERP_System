import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Box, ShoppingCart, CreditCard,
  Settings, Search, Bell, TrendingUp, TrendingDown,
  ArrowUpRight, MoreHorizontal, BarChart2
} from 'lucide-react';
import axios from 'axios';

import Clients  from './pages/Clients';
import Products from './pages/Products';
import Sales    from './pages/Sales';
import Payments from './pages/Payments';
import SettingsPage from './pages/Settings';

const API = 'http://localhost:3001';

function fmt(n) {
  if (!n && n !== 0) return '0';
  return Math.round(n).toLocaleString('ru-RU');
}

// ─── Sidebar ───────────────────────────────────────────────────────────────
function Sidebar() {
  const location = useLocation();
  const navItems = [
    { name: 'Bosh sahifa',  path: '/',          icon: LayoutDashboard },
    { name: 'Mijozlar',     path: '/clients',   icon: Users },
    { name: 'Mahsulotlar',  path: '/products',  icon: Box },
    { name: 'Savdolar',     path: '/sales',     icon: ShoppingCart },
    { name: 'Tushumlar',    path: '/payments',  icon: CreditCard },
    { name: 'Sozlamalar',   path: '/settings',  icon: Settings },
  ];

  return (
    <div className="w-60 bg-[#09090b] flex flex-col z-20 shrink-0">
      <div className="h-16 flex items-center px-5 border-b border-white/10">
        <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
          <BarChart2 size={16} className="text-white" />
        </div>
        <h2 className="text-base font-bold text-white tracking-tight">ERP System</h2>
      </div>
      <nav className="flex-1 py-5 px-3 space-y-0.5">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm font-medium ${
                isActive
                  ? 'bg-blue-600/15 text-blue-400'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
              }`}
            >
              <Icon size={17} className={isActive ? 'text-blue-400' : 'text-zinc-500'} />
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="px-4 py-4 border-t border-white/10">
        <p className="text-xs text-zinc-600">v2.0.0 — Full-Stack</p>
      </div>
    </div>
  );
}

// ─── Top Header ────────────────────────────────────────────────────────────
function TopHeader() {
  const location = useLocation();
  const titles = {
    '/':          'Bosh sahifa',
    '/clients':   'Mijozlar (CRM)',
    '/products':  'Mahsulotlar bazasi',
    '/sales':     'Savdolar (Yuk xatlari)',
    '/payments':  'Tushumlar',
    '/settings':  'Sozlamalar',
  };

  return (
    <header className="h-14 bg-white border-b border-zinc-200 flex items-center justify-between px-8 shrink-0">
      <h1 className="text-base font-semibold text-zinc-900">
        {titles[location.pathname] || 'ERP System'}
      </h1>
      <div className="flex items-center gap-4">
        <button className="text-zinc-400 hover:text-zinc-900 transition relative">
          <Bell size={18} />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold cursor-pointer">
          A
        </div>
      </div>
    </header>
  );
}

// ─── Mini bar chart (svg) ───────────────────────────────────────────────────
function MiniBarChart({ data }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.amount), 1);
  const W = 400, H = 80, barW = 36, gap = (W - data.length * barW) / (data.length + 1);

  return (
    <svg viewBox={`0 0 ${W} ${H + 24}`} className="w-full">
      {data.map((d, i) => {
        const barH = max > 0 ? (d.amount / max) * H : 0;
        const x = gap + i * (barW + gap);
        const y = H - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} rx={4}
              fill={i === data.length - 1 ? '#2563eb' : '#e4e4e7'} />
            <text x={x + barW / 2} y={H + 16} textAnchor="middle"
              fontSize="10" fill="#a1a1aa">{d.month}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────────────────
function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/api/dashboard`)
      .then(r => { setStats(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const cards = stats ? [
    {
      title: 'Umumiy Qarzdorlik',
      value: fmt(stats.totalDebt) + ' UZS',
      sub: 'Barcha mijozlar bo\'yicha',
      color: 'text-red-600',
      bar: 'bg-red-500',
      icon: TrendingDown,
    },
    {
      title: 'Bugungi Savdo',
      value: fmt(stats.todayTotal) + ' UZS',
      sub: 'Bugun tuzilgan yuk xatlari',
      color: 'text-emerald-600',
      bar: 'bg-emerald-500',
      icon: TrendingUp,
    },
    {
      title: 'Faol Mijozlar',
      value: stats.clientsCount,
      sub: 'Ro\'yxatda',
      color: 'text-blue-600',
      bar: 'bg-blue-500',
      icon: Users,
    },
  ] : [];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {loading
          ? [...Array(3)].map((_, i) => (
              <div key={i} className="mini-card animate-pulse space-y-3">
                <div className="h-4 bg-zinc-100 rounded w-1/2" />
                <div className="h-8 bg-zinc-100 rounded w-3/4" />
              </div>
            ))
          : cards.map((c, i) => {
              const Icon = c.icon;
              return (
                <div key={i} className="mini-card relative overflow-hidden group hover:border-zinc-300 transition-colors">
                  <div className={`absolute top-0 left-0 w-1 h-full ${c.bar}`} />
                  <div className="pl-3">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm font-medium text-zinc-500">{c.title}</p>
                      <div className={`p-1.5 rounded-md bg-zinc-50`}>
                        <Icon size={15} className={c.color} />
                      </div>
                    </div>
                    <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
                    <p className="text-xs text-zinc-400 mt-1">{c.sub}</p>
                  </div>
                </div>
              );
            })
        }
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Oylik grafik */}
        <div className="lg:col-span-2 mini-card">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-zinc-900">Oylik savdo (oxirgi 6 oy)</h3>
          </div>
          {loading ? (
            <div className="h-24 bg-zinc-50 animate-pulse rounded-lg" />
          ) : stats?.monthlyData ? (
            <MiniBarChart data={stats.monthlyData} />
          ) : null}
        </div>

        {/* Eng katta qarzdorlar */}
        <div className="mini-card p-0">
          <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/50">
            <h3 className="text-sm font-semibold text-zinc-900">Eng yirik qarzdorlar</h3>
          </div>
          <div className="divide-y divide-zinc-100">
            {loading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="px-5 py-3 flex justify-between">
                  <div className="h-4 bg-zinc-100 animate-pulse rounded w-1/2" />
                  <div className="h-4 bg-zinc-100 animate-pulse rounded w-1/4" />
                </div>
              ))
            ) : stats?.debtors?.length === 0 ? (
              <div className="px-5 py-8 text-center text-zinc-400 text-sm">Qarzdorlar yo'q 🎉</div>
            ) : (
              stats?.debtors?.map((d, i) => (
                <div key={d.id} className="px-5 py-3 flex items-center justify-between hover:bg-zinc-50 transition">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-6 h-6 rounded bg-zinc-100 flex items-center justify-center text-xs font-bold text-zinc-500 shrink-0">
                      {i + 1}
                    </div>
                    <p className="text-sm font-medium text-zinc-900 truncate">{d.name}</p>
                  </div>
                  <p className="text-sm font-semibold text-red-600 shrink-0 ml-2">{fmt(d.debt)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* So'nggi savdolar */}
      <div className="mini-card p-0">
        <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50/50 flex justify-between items-center">
          <h3 className="text-sm font-semibold text-zinc-900">So'nggi savdolar</h3>
          <Link to="/sales" className="text-xs text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1">
            Barchasi <ArrowUpRight size={12} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Sana</th>
                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Yuk xati №</th>
                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Mijoz</th>
                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Summa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(4)].map((_, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-4 bg-zinc-100 animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : stats?.recentSales?.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-zinc-400 text-sm">Hozircha savdolar yo'q</td>
                </tr>
              ) : (
                stats?.recentSales?.map(s => (
                  <tr key={s.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-6 py-3.5 text-sm text-zinc-500">{new Date(s.date).toLocaleDateString('ru-RU')}</td>
                    <td className="px-6 py-3.5 text-sm font-semibold text-zinc-900 font-mono">{s.nakladnoy}</td>
                    <td className="px-6 py-3.5 text-sm text-zinc-700">{s.client?.name}</td>
                    <td className="px-6 py-3.5 text-sm text-right font-bold text-emerald-600">{fmt(s.totalAmount)} UZS</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── App ───────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <Router>
      <div className="flex h-screen bg-[#fafafa] overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <TopHeader />
          <div className="flex-1 overflow-y-auto pb-10">
            <Routes>
              <Route path="/"          element={<Dashboard />} />
              <Route path="/clients"   element={<Clients />} />
              <Route path="/products"  element={<Products />} />
              <Route path="/sales"     element={<Sales />} />
              <Route path="/payments"  element={<Payments />} />
              <Route path="/settings"  element={<SettingsPage />} />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
}
