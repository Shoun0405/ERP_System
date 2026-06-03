import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { fmt, fmtDate } from '../lib/format';
import TrendChart from '../components/TrendChart';
import { useDateFilter } from '../context/DateFilterContext';
import {
  LayoutDashboard, TrendingUp, Wallet, Settings2,
  ChevronDown, ChevronRight, Users, Package,
  FileText, BarChart3, ShoppingBag, AlertTriangle, CreditCard,
  Percent, UserCheck
} from 'lucide-react';

// ── Widget config (localStorage) ─────────────────────────────────────────────
const WIDGET_DEFAULTS = {
  kpi_cards: true,
  sales_trend: true,
  top_products: true,
  debtors: true,
  client_ledger: false,
};
const WIDGET_META = [
  { key: 'kpi_cards',     label: "KPI kartalar (savdo, hujjatlar, top mahsulot)" },
  { key: 'sales_trend',   label: "Savdo aylanmasi trendc grafigi" },
  { key: 'top_products',  label: "Top 5 mahsulot (dona bo'yicha)" },
  { key: 'debtors',       label: "Eng yirik qarzdorlar" },
  { key: 'client_ledger', label: "Mijoz analitik kartasi (Ledger)" },
];

function loadWidgets() {
  try {
    return { ...WIDGET_DEFAULTS, ...JSON.parse(localStorage.getItem('reports_widgets') || '{}') };
  } catch { return { ...WIDGET_DEFAULTS }; }
}

// ── Menu ─────────────────────────────────────────────────────────────────────
const MENU = [
  { id: 'home',           label: 'Bosh sahifa',              Icon: LayoutDashboard },
  {
    group: 'Savdo hisobotlari', Icon: TrendingUp,
    children: [
      { id: 'sales_period',     label: 'Davriy savdo',          Icon: BarChart3 },
      { id: 'sales_by_client',  label: "Mijozlar bo'yicha",      Icon: Users },
      { id: 'sales_by_product', label: "Mahsulotlar bo'yicha",   Icon: Package },
      { id: 'sales_by_seller',  label: "Sotuvchilar bo'yicha",   Icon: UserCheck },
    ]
  },
  {
    group: 'Moliyaviy hisobotlar', Icon: Wallet,
    children: [
      { id: 'debtors',          label: 'Qarzdorlar',             Icon: AlertTriangle },
      { id: 'client_statement', label: 'Mijoz kartasi',          Icon: FileText },
      { id: 'payments',         label: "To'lovlar hisoboti",     Icon: CreditCard },
      { id: 'vat_report',       label: 'QQS hisoboti',           Icon: Percent },
    ]
  },
  { id: 'widget_settings', label: 'Bosh sahifa sozlamalari', Icon: Settings2 },
];

// ── Shared helpers ────────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle }) {
  return (
    <div className="mb-5">
      <h2 className="text-base font-semibold text-[var(--text)]">{title}</h2>
      {subtitle && <p className="text-xs text-[var(--text-3)] mt-0.5">{subtitle}</p>}
    </div>
  );
}

function SkeletonRows({ n = 4 }) {
  return [...Array(n)].map((_, i) => (
    <div key={i} className="space-y-1">
      <div className="h-3 bg-[var(--surface-2)] animate-pulse rounded w-1/3" />
      <div className="h-2 bg-[var(--surface-2)] animate-pulse rounded" />
    </div>
  ));
}

// ── HOME ──────────────────────────────────────────────────────────────────────
function HomeSection({ fromDate, toDate, widgets }) {
  const [salesSummary, setSalesSummary]     = useState(null);
  const [topProducts, setTopProducts]       = useState([]);
  const [debtors, setDebtors]               = useState([]);
  const [clients, setClients]               = useState([]);
  const [selClientId, setSelClientId]       = useState('');
  const [clientStatement, setClientStatement] = useState(null);
  const [loadS, setLoadS] = useState(true);
  const [loadP, setLoadP] = useState(true);
  const [loadD, setLoadD] = useState(true);
  const [loadLS, setLoadLS] = useState(false);

  const fetchSales = useCallback(async () => {
    setLoadS(true);
    try {
      const r = await api.get('/api/reports/sales-by-period', { params: { from: fromDate, to: toDate } });
      setSalesSummary(r.data);
    } catch {} finally { setLoadS(false); }
  }, [fromDate, toDate]);

  const fetchProducts = useCallback(async () => {
    setLoadP(true);
    try {
      const r = await api.get('/api/reports/products-top', { params: { limit: 5 } });
      setTopProducts(r.data);
    } catch {} finally { setLoadP(false); }
  }, []);

  const fetchDebtors = useCallback(async () => {
    setLoadD(true);
    try {
      const r = await api.get('/api/reports/debtors');
      setDebtors(r.data);
    } catch {} finally { setLoadD(false); }
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      const r = await api.get('/api/clients', { params: { limit: 1000 } });
      const list = r.data.data || [];
      setClients(list);
      if (list.length) setSelClientId(list[0].id);
    } catch {}
  }, []);

  const fetchStatement = useCallback(async () => {
    if (!selClientId) return;
    setLoadLS(true);
    try {
      const r = await api.get(`/api/reports/client-statement/${selClientId}`);
      setClientStatement(r.data);
    } catch {} finally { setLoadLS(false); }
  }, [selClientId]);

  useEffect(() => {
    fetchSales(); fetchProducts(); fetchDebtors(); fetchClients();
  }, [fetchSales, fetchProducts, fetchDebtors, fetchClients]);

  useEffect(() => { fetchStatement(); }, [fetchStatement]);

  return (
    <div className="space-y-6 animate-in">
      <SectionHeader title="Bosh sahifa" subtitle="Konfiguratsiyalanadigan asosiy ko'rsatkichlar" />

      {/* KPI Cards */}
      {widgets.kpi_cards && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card flex items-center justify-between p-5 border border-[var(--border)]">
            <div className="space-y-1">
              <h4 className="text-[11px] font-bold text-[var(--text-3)] uppercase tracking-wider">Tanlangan Davr Savdosi</h4>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-extrabold text-[var(--text)] font-mono">{loadS ? '...' : fmt(salesSummary?.totalAmount || 0)}</span>
                <span className="text-[10px] font-bold text-[var(--text-3)] uppercase">UZS</span>
              </div>
              <p className="text-[10px] text-[var(--text-3)]">Jami yuk xatlari aylanmasi</p>
            </div>
            <div className="icon-badge icon-badge-success p-3 rounded-xl"><TrendingUp size={20} strokeWidth={2.2} /></div>
          </div>
          <div className="card flex items-center justify-between p-5 border border-[var(--border)]">
            <div className="space-y-1">
              <h4 className="text-[11px] font-bold text-[var(--text-3)] uppercase tracking-wider">Hujjatlar Soni</h4>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-extrabold text-[var(--text)] font-mono">{loadS ? '...' : salesSummary?.salesCount || 0}</span>
                <span className="text-[10px] font-bold text-[var(--text-3)] uppercase">ta</span>
              </div>
              <p className="text-[10px] text-[var(--text-3)]">Davrdagi rasmiylashtirilgan yuk xatlari</p>
            </div>
            <div className="icon-badge icon-badge-info p-3 rounded-xl"><ShoppingBag size={20} strokeWidth={2.2} /></div>
          </div>
          <div className="card flex items-center justify-between p-5 border border-[var(--border)]">
            <div className="space-y-1">
              <h4 className="text-[11px] font-bold text-[var(--text-3)] uppercase tracking-wider">Top Mahsulot</h4>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-extrabold text-[var(--text)] font-mono">{loadP ? '...' : topProducts[0] ? fmt(topProducts[0].totalPieces) : '0'}</span>
                <span className="text-[10px] font-bold text-[var(--text-3)] uppercase">dona</span>
              </div>
              <p className="text-[10px] text-[var(--text-3)]">{topProducts[0]?.article || '—'}</p>
            </div>
            <div className="icon-badge icon-badge-warn p-3 rounded-xl"><BarChart3 size={20} strokeWidth={2.2} /></div>
          </div>
        </div>
      )}

      {/* Trend + Top products */}
      {(widgets.sales_trend || widgets.top_products) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {widgets.sales_trend && (
            <div className="card lg:col-span-2 flex flex-col border border-[var(--border)]">
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-[var(--text)]">Savdo aylanmasi dinamikasi</h3>
                <p className="text-[10px] text-[var(--text-3)] mt-0.5">Kunlik yoki davriy savdo o'zgarishi</p>
              </div>
              <div className="flex-1 bg-[var(--surface-2)] rounded-xl p-3 border border-[var(--border)] flex items-center justify-center min-h-[160px]">
                {loadS ? (
                  <div className="text-xs text-[var(--text-3)]">Yuklanmoqda...</div>
                ) : !salesSummary?.salesByDay?.length ? (
                  <div className="text-xs text-[var(--text-3)]">Tanlangan davrda savdolar mavjud emas</div>
                ) : (
                  <TrendChart
                    data={salesSummary.salesByDay.map(d => ({ amount: d.amount, title: `${fmtDate(d.day)}: ${fmt(d.amount)} UZS` }))}
                    ticks={3} yUnit="UZS" showXLabels={false} nodeMax={29} gradientId="homeTrendGrad"
                  />
                )}
              </div>
            </div>
          )}
          {widgets.top_products && (
            <div className="card border border-[var(--border)] flex flex-col">
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-[var(--text)]">Top 5 Mahsulot</h3>
                <p className="text-[10px] text-[var(--text-3)] mt-0.5">Dona bo'yicha eng ko'p sotilganlar</p>
              </div>
              <div className="space-y-4 flex-1">
                {loadP ? <SkeletonRows n={4} /> : topProducts.length === 0 ? (
                  <div className="text-center py-8 text-xs text-[var(--text-3)]">Sotilgan mahsulotlar yo'q</div>
                ) : topProducts.map(p => {
                  const ratio = p.totalPieces / (topProducts[0]?.totalPieces || 1);
                  return (
                    <div key={p.id} className="space-y-1">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs font-medium text-[var(--text)] truncate max-w-[160px]">{p.article}</span>
                        <span className="text-[10.5px] font-bold font-mono text-[var(--text-2)]">{fmt(p.totalPieces)} dona</span>
                      </div>
                      <div className="h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden border border-[var(--border)]">
                        <div className="h-full bg-indigo-500 opacity-90 transition-all duration-500" style={{ width: `${ratio * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Debtors + Ledger */}
      {(widgets.debtors || widgets.client_ledger) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {widgets.debtors && (
            <div className="card border border-[var(--border)] flex flex-col">
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-[var(--text)]">Eng yirik qarzdorlar</h3>
                <p className="text-[10px] text-[var(--text-3)] mt-0.5">Faol debitor qarzdorliklar</p>
              </div>
              <div className="space-y-3.5 flex-1">
                {loadD ? [...Array(4)].map((_, i) => (
                  <div key={i} className="h-8 bg-[var(--surface-2)] animate-pulse rounded" />
                )) : debtors.length === 0 ? (
                  <div className="text-center py-8 text-xs text-[var(--text-3)]">Faol qarzdorliklar yo'q</div>
                ) : debtors.slice(0, 5).map(d => {
                  const ratio = d.debt / (debtors[0]?.debt || 1);
                  return (
                    <div key={d.id} className="space-y-1">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs font-medium text-[var(--text)] truncate max-w-[160px]">{d.name}</span>
                        <span className="text-xs font-bold font-mono text-red-500">{fmt(d.debt)} UZS</span>
                      </div>
                      <div className="h-1 bg-[var(--surface-2)] rounded-full overflow-hidden">
                        <div className="h-full bg-red-400 opacity-80" style={{ width: `${ratio * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {widgets.client_ledger && (
            <div className={`card border border-[var(--border)] flex flex-col p-0 ${widgets.debtors ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
              <div className="px-5 py-3 border-b border-[var(--border)] flex flex-col sm:flex-row justify-between items-stretch sm:items-center bg-[var(--surface-2)] rounded-t-xl gap-2">
                <div>
                  <h3 className="text-xs font-semibold text-[var(--text)]">Mijozning analitik aylanma kartasi</h3>
                  <p className="text-[10px] text-[var(--text-3)] mt-0.5">Xronologik savdolar, to'lovlar va balans</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-bold text-[var(--text-2)] uppercase">Mijoz:</span>
                  <select
                    value={selClientId}
                    onChange={e => setSelClientId(e.target.value)}
                    className="px-2.5 py-1 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--accent)] max-w-[180px]"
                  >
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex-1 overflow-x-auto min-h-[200px]">
                {loadLS ? (
                  <div className="p-8 text-center text-xs text-[var(--text-3)]">Yuklanmoqda...</div>
                ) : !clientStatement?.statement?.length ? (
                  <div className="p-8 text-center text-xs text-[var(--text-3)]">Aylanmalar topilmadi</div>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--surface)] text-[10px] font-semibold text-[var(--text-2)] uppercase tracking-wider">
                        <th className="px-4 py-2">Sana</th>
                        <th className="px-4 py-2">Tavsif</th>
                        <th className="px-4 py-2 text-right">Debet</th>
                        <th className="px-4 py-2 text-right">Kredit</th>
                        <th className="px-4 py-2 text-right">Balans</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {clientStatement.statement.map((item, idx) => (
                        <tr key={idx} className="hover:bg-[var(--surface-2)]">
                          <td className="px-4 py-2 text-[11px] font-mono text-[var(--text-2)]">{fmtDate(item.date)}</td>
                          <td className="px-4 py-2 text-xs text-[var(--text)]">{item.desc}</td>
                          <td className="px-4 py-2 text-[11px] text-right font-mono text-slate-700 dark:text-slate-300">{item.debit > 0 ? `${fmt(item.debit)} UZS` : '—'}</td>
                          <td className="px-4 py-2 text-[11px] text-right font-mono text-emerald-600">{item.credit > 0 ? `${fmt(item.credit)} UZS` : '—'}</td>
                          <td className={`px-4 py-2 text-[11px] text-right font-mono font-bold ${item.balance > 0 ? 'text-red-500' : 'text-emerald-600'}`}>{fmt(item.balance)} UZS</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── DAVRIY SAVDO ──────────────────────────────────────────────────────────────
function SalesPeriodSection({ fromDate, toDate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await api.get('/api/reports/sales-by-period', { params: { from: fromDate, to: toDate } });
        setData(r.data);
      } catch {} finally { setLoading(false); }
    })();
  }, [fromDate, toDate]);

  return (
    <div className="space-y-6 animate-in">
      <SectionHeader title="Davriy savdo" subtitle="Tanlangan davr bo'yicha savdo tahlili va kunlik dinamika" />

      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4 border border-[var(--border)]">
          <p className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">Jami savdo summasi</p>
          <p className="text-xl font-extrabold font-mono text-[var(--text)]">
            {loading ? '...' : fmt(data?.totalAmount || 0)} <span className="text-xs font-semibold text-[var(--text-3)]">UZS</span>
          </p>
        </div>
        <div className="card p-4 border border-[var(--border)]">
          <p className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">Hujjatlar soni</p>
          <p className="text-xl font-extrabold font-mono text-[var(--text)]">
            {loading ? '...' : data?.salesCount || 0} <span className="text-xs font-semibold text-[var(--text-3)]">ta</span>
          </p>
        </div>
      </div>

      <div className="card border border-[var(--border)]">
        <h3 className="text-xs font-semibold text-[var(--text)] mb-3">Kunlik savdo trendc</h3>
        <div className="bg-[var(--surface-2)] rounded-xl p-3 border border-[var(--border)] min-h-[200px] flex items-center justify-center">
          {loading ? (
            <div className="text-xs text-[var(--text-3)]">Yuklanmoqda...</div>
          ) : !data?.salesByDay?.length ? (
            <div className="text-xs text-[var(--text-3)]">Tanlangan davrda savdolar mavjud emas</div>
          ) : (
            <TrendChart
              data={data.salesByDay.map(d => ({ amount: d.amount, title: `${fmtDate(d.day)}: ${fmt(d.amount)} UZS` }))}
              ticks={5} yUnit="UZS" showXLabels={false} nodeMax={40} gradientId="salesPeriodGrad"
            />
          )}
        </div>
      </div>

      {!loading && !!data?.salesByDay?.length && (
        <div className="card border border-[var(--border)] p-0">
          <div className="px-5 py-3 border-b border-[var(--border)] bg-[var(--surface-2)] rounded-t-xl">
            <h3 className="text-xs font-semibold text-[var(--text)]">Kunlik jadval</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--border)] text-[10px] font-semibold text-[var(--text-2)] uppercase tracking-wider">
                  <th className="px-5 py-2">Sana</th>
                  <th className="px-5 py-2 text-right">Hujjatlar</th>
                  <th className="px-5 py-2 text-right">Savdo summasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.salesByDay.map((row, i) => (
                  <tr key={i} className="hover:bg-[var(--surface-2)]">
                    <td className="px-5 py-2.5 text-xs font-mono text-[var(--text-2)]">{fmtDate(row.day)}</td>
                    <td className="px-5 py-2.5 text-xs text-right font-mono text-[var(--text)]">{row.count} ta</td>
                    <td className="px-5 py-2.5 text-xs text-right font-mono font-bold text-[var(--text)]">{fmt(row.amount)} UZS</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MIJOZLAR BO'YICHA ─────────────────────────────────────────────────────────
function SalesByClientSection({ fromDate, toDate }) {
  const [data, setData]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await api.get('/api/reports/sales-by-client', { params: { from: fromDate, to: toDate } });
        setData(r.data);
      } catch {} finally { setLoading(false); }
    })();
  }, [fromDate, toDate]);

  const maxAmount = data[0]?.totalAmount || 1;
  const total = data.reduce((s, d) => s + d.totalAmount, 0);

  return (
    <div className="space-y-6 animate-in">
      <SectionHeader title="Mijozlar bo'yicha savdo" subtitle="Tanlangan davrda har bir mijozning savdo ulushi va summasi" />

      <div className="card border border-[var(--border)] p-0">
        <div className="px-5 py-3 border-b border-[var(--border)] bg-[var(--surface-2)] rounded-t-xl flex justify-between items-center">
          <h3 className="text-xs font-semibold text-[var(--text)]">Mijozlar reytingi</h3>
          <div className="flex items-center gap-4">
            {!loading && total > 0 && (
              <span className="text-[11px] font-bold font-mono text-[var(--text-2)]">Jami: {fmt(total)} UZS</span>
            )}
            <span className="text-[11px] text-[var(--text-3)]">{data.length} ta mijoz</span>
          </div>
        </div>
        {loading ? (
          <div className="p-8 text-center text-xs text-[var(--text-3)]">Yuklanmoqda...</div>
        ) : data.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--text-3)]">Tanlangan davrda savdolar topilmadi</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--border)] text-[10px] font-semibold text-[var(--text-2)] uppercase tracking-wider">
                  <th className="px-5 py-2 w-8">#</th>
                  <th className="px-5 py-2">Mijoz</th>
                  <th className="px-5 py-2 text-right">Hujjatlar</th>
                  <th className="px-5 py-2 text-right">Jami summa</th>
                  <th className="px-5 py-2 w-32">Ulush</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.map((row, i) => (
                  <tr key={row.id} className="hover:bg-[var(--surface-2)]">
                    <td className="px-5 py-2.5 text-[11px] font-mono text-[var(--text-3)]">{i + 1}</td>
                    <td className="px-5 py-2.5">
                      <div className="text-xs font-medium text-[var(--text)]">{row.name}</div>
                      {row.phone && <div className="text-[10px] text-[var(--text-3)] mt-0.5">{row.phone}</div>}
                    </td>
                    <td className="px-5 py-2.5 text-xs text-right font-mono text-[var(--text-2)]">{row.salesCount} ta</td>
                    <td className="px-5 py-2.5 text-xs text-right font-mono font-bold text-[var(--text)]">{fmt(row.totalAmount)} UZS</td>
                    <td className="px-5 py-2.5">
                      <div className="h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden border border-[var(--border)]">
                        <div className="h-full bg-indigo-500 opacity-80" style={{ width: `${(row.totalAmount / maxAmount) * 100}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {total > 0 && (
                <tfoot>
                  <tr className="bg-[var(--surface-2)] font-bold text-xs border-t-2 border-[var(--border)]">
                    <td colSpan="3" className="px-5 py-2.5 text-[var(--text)]">Jami:</td>
                    <td className="px-5 py-2.5 text-right font-mono font-extrabold text-[var(--text)]">{fmt(total)} UZS</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── MAHSULOTLAR BO'YICHA ──────────────────────────────────────────────────────
function SalesByProductSection({ fromDate, toDate }) {
  const [data, setData]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await api.get('/api/reports/products-top', { params: { limit: 50, from: fromDate, to: toDate } });
        setData(r.data);
      } catch {} finally { setLoading(false); }
    })();
  }, [fromDate, toDate]);

  const maxPieces = data[0]?.totalPieces || 1;

  return (
    <div className="space-y-6 animate-in">
      <SectionHeader title="Mahsulotlar bo'yicha savdo" subtitle="Tanlangan davrda eng ko'p sotilgan mahsulotlar ro'yxati" />

      <div className="card border border-[var(--border)] p-0">
        <div className="px-5 py-3 border-b border-[var(--border)] bg-[var(--surface-2)] rounded-t-xl flex justify-between items-center">
          <h3 className="text-xs font-semibold text-[var(--text)]">Mahsulotlar reytingi</h3>
          <span className="text-[11px] text-[var(--text-3)]">{data.length} ta mahsulot</span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-xs text-[var(--text-3)]">Yuklanmoqda...</div>
        ) : data.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--text-3)]">Tanlangan davrda mahsulotlar topilmadi</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--border)] text-[10px] font-semibold text-[var(--text-2)] uppercase tracking-wider">
                  <th className="px-5 py-2 w-8">#</th>
                  <th className="px-5 py-2">Artikul</th>
                  <th className="px-5 py-2 text-right">Dona</th>
                  <th className="px-5 py-2 text-right">M³ (CBM)</th>
                  <th className="px-5 py-2 text-right">Jami summa</th>
                  <th className="px-5 py-2 w-28">Dona ulushi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.map((row, i) => (
                  <tr key={row.id} className="hover:bg-[var(--surface-2)]">
                    <td className="px-5 py-2.5 text-[11px] font-mono text-[var(--text-3)]">{i + 1}</td>
                    <td className="px-5 py-2.5 text-xs font-medium text-[var(--text)]">{row.article}</td>
                    <td className="px-5 py-2.5 text-xs text-right font-mono text-[var(--text)]">{fmt(row.totalPieces)}</td>
                    <td className="px-5 py-2.5 text-xs text-right font-mono text-[var(--text-2)]">{row.totalCbm?.toFixed(2) || '—'}</td>
                    <td className="px-5 py-2.5 text-xs text-right font-mono font-bold text-[var(--text)]">{fmt(row.totalAmount)} UZS</td>
                    <td className="px-5 py-2.5">
                      <div className="h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden border border-[var(--border)]">
                        <div className="h-full bg-emerald-500 opacity-80" style={{ width: `${(row.totalPieces / maxPieces) * 100}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── QARZDORLAR ────────────────────────────────────────────────────────────────
function DebtorsSection() {
  const [data, setData]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await api.get('/api/reports/debtors');
        setData(r.data);
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const filtered = data.filter(d => !search || d.name.toLowerCase().includes(search.toLowerCase()));
  const totalDebt = data.reduce((s, d) => s + d.debt, 0);

  return (
    <div className="space-y-6 animate-in">
      <SectionHeader title="Qarzdorlar hisoboti" subtitle="Barcha faol debitor qarzdorliklar — savdo minus to'lov" />

      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4 border border-[var(--border)]">
          <p className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">Jami debitor qarz</p>
          <p className="text-xl font-extrabold font-mono text-red-500">
            {loading ? '...' : fmt(totalDebt)} <span className="text-xs font-semibold text-[var(--text-3)]">UZS</span>
          </p>
        </div>
        <div className="card p-4 border border-[var(--border)]">
          <p className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">Qarzdorlar soni</p>
          <p className="text-xl font-extrabold font-mono text-[var(--text)]">
            {loading ? '...' : data.length} <span className="text-xs font-semibold text-[var(--text-3)]">ta</span>
          </p>
        </div>
      </div>

      <div className="card border border-[var(--border)] p-0">
        <div className="px-5 py-3 border-b border-[var(--border)] bg-[var(--surface-2)] rounded-t-xl flex justify-between items-center gap-4">
          <h3 className="text-xs font-semibold text-[var(--text)]">Barcha qarzdorlar</h3>
          <input
            type="text"
            placeholder="Mijoz nomi bo'yicha..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3 py-1.5 border border-[var(--border)] rounded text-xs bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] w-52"
          />
        </div>
        {loading ? (
          <div className="p-8 text-center text-xs text-[var(--text-3)]">Yuklanmoqda...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--text-3)]">
            {search ? 'Qidiruv bo\'yicha topilmadi' : 'Faol qarzdorliklar mavjud emas'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--border)] text-[10px] font-semibold text-[var(--text-2)] uppercase tracking-wider">
                  <th className="px-5 py-2 w-8">#</th>
                  <th className="px-5 py-2">Mijoz</th>
                  <th className="px-5 py-2 text-right">Jami savdo</th>
                  <th className="px-5 py-2 text-right">To'langan</th>
                  <th className="px-5 py-2 text-right">Qarz (Balans)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map((row, i) => (
                  <tr key={row.id} className="hover:bg-[var(--surface-2)]">
                    <td className="px-5 py-2.5 text-[11px] font-mono text-[var(--text-3)]">{i + 1}</td>
                    <td className="px-5 py-2.5">
                      <div className="text-xs font-medium text-[var(--text)]">{row.name}</div>
                      {row.phone && <div className="text-[10px] text-[var(--text-3)] mt-0.5">{row.phone}</div>}
                    </td>
                    <td className="px-5 py-2.5 text-xs text-right font-mono text-[var(--text-2)]">{fmt(row.totalSales)} UZS</td>
                    <td className="px-5 py-2.5 text-xs text-right font-mono text-emerald-600">{fmt(row.totalPayments)} UZS</td>
                    <td className="px-5 py-2.5 text-xs text-right font-mono font-bold text-red-500">{fmt(row.debt)} UZS</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[var(--surface-2)] font-bold text-xs border-t-2 border-[var(--border)]">
                  <td colSpan="4" className="px-5 py-2.5 text-[var(--text)]">Jami debitor qarz:</td>
                  <td className="px-5 py-2.5 text-right font-mono font-extrabold text-red-500">{fmt(totalDebt)} UZS</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── MIJOZ KARTASI ─────────────────────────────────────────────────────────────

// Bitta shartnoma uchun jadval
function ContractLedgerTable({ group }) {
  const { contract, statement, finalBalance } = group;
  const totalDebit  = statement.reduce((s, i) => s + i.debit, 0);
  const totalCredit = statement.reduce((s, i) => s + i.credit, 0);

  return (
    <div className="card border border-[var(--border)] p-0">
      {/* Header */}
      <div className={`px-5 py-2.5 border-b border-[var(--border)] flex justify-between items-center rounded-t-xl ${
        contract ? 'bg-indigo-50 dark:bg-indigo-950/30' : 'bg-[var(--surface-2)]'
      }`}>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
            contract ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                     : 'bg-[var(--border)] text-[var(--text-3)]'
          }`}>
            {contract ? `Shartnoma` : 'Shartnoma yo\'q'}
          </span>
          {contract && (
            <span className="text-xs font-semibold text-[var(--text)]">
              № {contract.number}
              {contract.date && (
                <span className="text-[10px] font-normal text-[var(--text-3)] ml-1.5">
                  ({fmtDate(contract.date)})
                </span>
              )}
            </span>
          )}
          <span className="text-[10px] text-[var(--text-3)]">{statement.length} ta yozuv</span>
        </div>
        <div className={`text-xs font-extrabold font-mono ${finalBalance > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
          Saldo: {fmt(finalBalance)} UZS
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[var(--border)] text-[10px] font-semibold text-[var(--text-2)] uppercase tracking-wider">
              <th className="px-5 py-2">Sana</th>
              <th className="px-5 py-2">Tavsif</th>
              <th className="px-5 py-2 text-right">Savdo (Debet)</th>
              <th className="px-5 py-2 text-right">To'lov (Kredit)</th>
              <th className="px-5 py-2 text-right">Balans</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {statement.map((item, idx) => (
              <tr key={idx} className="hover:bg-[var(--surface-2)]">
                <td className="px-5 py-2.5 text-[11px] font-mono text-[var(--text-2)]">{fmtDate(item.date)}</td>
                <td className="px-5 py-2.5 text-xs text-[var(--text)]">{item.desc}</td>
                <td className="px-5 py-2.5 text-[11px] text-right font-mono text-slate-700 dark:text-slate-300">
                  {item.debit > 0 ? `${fmt(item.debit)} UZS` : '—'}
                </td>
                <td className="px-5 py-2.5 text-[11px] text-right font-mono text-emerald-600">
                  {item.credit > 0 ? `${fmt(item.credit)} UZS` : '—'}
                </td>
                <td className={`px-5 py-2.5 text-[11px] text-right font-mono font-bold ${item.balance > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                  {fmt(item.balance)} UZS
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[var(--surface-2)] font-bold text-xs border-t border-[var(--border)]">
              <td colSpan="2" className="px-5 py-2 text-[var(--text)]">Jami:</td>
              <td className="px-5 py-2 text-right font-mono text-slate-700 dark:text-slate-300">{fmt(totalDebit)} UZS</td>
              <td className="px-5 py-2 text-right font-mono text-emerald-600">{fmt(totalCredit)} UZS</td>
              <td className={`px-5 py-2 text-right font-mono font-extrabold ${finalBalance > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                {fmt(finalBalance)} UZS
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function ClientStatementSection() {
  const [clients, setClients]       = useState([]);
  const [selId, setSelId]           = useState('');
  const [byContract, setByContract] = useState(false);
  const [stmt, setStmt]             = useState(null);
  const [contractData, setContractData] = useState(null);
  const [loading, setLoading]       = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/api/clients', { params: { limit: 1000 } });
        const list = r.data.data || [];
        setClients(list);
        if (list.length) setSelId(list[0].id);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!selId) return;
    setStmt(null);
    setContractData(null);
    setLoading(true);
    const url = byContract
      ? `/api/reports/client-by-contracts/${selId}`
      : `/api/reports/client-statement/${selId}`;
    (async () => {
      try {
        const r = await api.get(url);
        if (byContract) setContractData(r.data);
        else setStmt(r.data);
      } catch {} finally { setLoading(false); }
    })();
  }, [selId, byContract]);

  const totalDebit  = stmt?.statement?.reduce((s, i) => s + i.debit, 0) || 0;
  const totalCredit = stmt?.statement?.reduce((s, i) => s + i.credit, 0) || 0;

  return (
    <div className="space-y-6 animate-in">
      <SectionHeader title="Mijoz analitik kartasi" subtitle="Xronologik tartibda savdolar, to'lovlar va joriy balans" />

      {/* Controls */}
      <div className="card border border-[var(--border)] p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <select
            value={selId}
            onChange={e => setSelId(e.target.value)}
            className="px-3 py-1.5 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--accent)] max-w-xs"
          >
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          {/* Summary badges */}
          {!byContract && stmt && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-0.5 font-mono">
                Savdo: {fmt(totalDebit)} UZS
              </span>
              <span className="text-[10px] bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-0.5 font-mono text-emerald-600">
                To'lov: {fmt(totalCredit)} UZS
              </span>
              <span className={`text-[10px] rounded px-2 py-0.5 font-mono font-bold border ${
                stmt.finalBalance > 0
                  ? 'bg-red-50 border-red-200 text-red-600 dark:bg-red-950/30 dark:border-red-800'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-950/30 dark:border-emerald-800'
              }`}>
                Qarz: {fmt(stmt.finalBalance)} UZS
              </span>
            </div>
          )}
          {byContract && contractData && (
            <span className={`text-[10px] rounded px-2 py-0.5 font-mono font-bold border ${
              contractData.totalBalance > 0
                ? 'bg-red-50 border-red-200 text-red-600 dark:bg-red-950/30 dark:border-red-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-950/30 dark:border-emerald-800'
            }`}>
              Jami qarz: {fmt(contractData.totalBalance)} UZS
            </span>
          )}
        </div>

        {/* Toggle: shartnomalar bo'yicha */}
        <label className="flex items-center gap-2 cursor-pointer select-none shrink-0">
          <button
            onClick={() => setByContract(v => !v)}
            className={`relative inline-flex w-9 h-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1 ${
              byContract ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
            }`}
            role="switch"
            aria-checked={byContract}
          >
            <span className={`inline-block w-4 h-4 bg-white rounded-full shadow absolute top-0.5 transition-transform ${
              byContract ? 'translate-x-4' : 'translate-x-0.5'
            }`} />
          </button>
          <span className="text-xs font-medium text-[var(--text)]">Shartnomalar bo'yicha</span>
        </label>
      </div>

      {/* Content */}
      {loading ? (
        <div className="card border border-[var(--border)] p-10 text-center text-xs text-[var(--text-3)]">
          Yuklanmoqda...
        </div>
      ) : byContract ? (
        /* ── Shartnomalar bo'yicha view ── */
        contractData?.groups?.length ? (
          <div className="space-y-4">
            {contractData.groups.map((group) => (
              <ContractLedgerTable key={group.contract?.id ?? 'no-contract'} group={group} />
            ))}

            {/* Grand total */}
            {contractData.groups.length > 1 && (
              <div className="card border-2 border-[var(--accent)] p-4 flex justify-between items-center">
                <span className="text-xs font-bold text-[var(--text)]">
                  Jami balans ({contractData.groups.length} ta shartnoma bo'yicha):
                </span>
                <span className={`text-base font-extrabold font-mono ${
                  contractData.totalBalance > 0 ? 'text-red-500' : 'text-emerald-600'
                }`}>
                  {fmt(contractData.totalBalance)} UZS
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="card border border-[var(--border)] p-10 text-center text-xs text-[var(--text-3)]">
            Ushbu mijoz bo'yicha shartnomalar topilmadi
          </div>
        )
      ) : (
        /* ── Oddiy view ── */
        <div className="card border border-[var(--border)] p-0">
          <div className="overflow-x-auto min-h-[250px]">
            {!stmt?.statement?.length ? (
              <div className="p-10 text-center text-xs text-[var(--text-3)]">
                Ushbu mijoz bo'yicha aylanmalar topilmadi
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface)] text-[10px] font-semibold text-[var(--text-2)] uppercase tracking-wider">
                    <th className="px-5 py-2">Sana</th>
                    <th className="px-5 py-2">Tavsif (Hujjat)</th>
                    <th className="px-5 py-2 text-right">Savdo (Debet)</th>
                    <th className="px-5 py-2 text-right">To'lov (Kredit)</th>
                    <th className="px-5 py-2 text-right">Balans (Qarz)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {stmt.statement.map((item, idx) => (
                    <tr key={idx} className="hover:bg-[var(--surface-2)]">
                      <td className="px-5 py-2.5 text-[11px] font-mono text-[var(--text-2)]">{fmtDate(item.date)}</td>
                      <td className="px-5 py-2.5 text-xs text-[var(--text)]">{item.desc}</td>
                      <td className="px-5 py-2.5 text-[11px] text-right font-mono text-slate-700 dark:text-slate-300">
                        {item.debit > 0 ? `${fmt(item.debit)} UZS` : '—'}
                      </td>
                      <td className="px-5 py-2.5 text-[11px] text-right font-mono text-emerald-600">
                        {item.credit > 0 ? `${fmt(item.credit)} UZS` : '—'}
                      </td>
                      <td className={`px-5 py-2.5 text-[11px] text-right font-mono font-extrabold ${item.balance > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                        {fmt(item.balance)} UZS
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[var(--surface-2)] font-bold text-xs border-t-2 border-[var(--border)]">
                    <td colSpan="2" className="px-5 py-2.5 text-[var(--text)]">Jami aylanma yakuni:</td>
                    <td className="px-5 py-2.5 text-right font-mono text-slate-700 dark:text-slate-300">{fmt(totalDebit)} UZS</td>
                    <td className="px-5 py-2.5 text-right font-mono text-emerald-600">{fmt(totalCredit)} UZS</td>
                    <td className={`px-5 py-2.5 text-right font-mono font-extrabold ${stmt.finalBalance > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                      {fmt(stmt.finalBalance)} UZS
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── TO'LOVLAR HISOBOTI ────────────────────────────────────────────────────────
function PaymentsSummarySection({ fromDate, toDate }) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await api.get('/api/reports/payments-by-period', { params: { from: fromDate, to: toDate } });
        setData(r.data);
      } catch {} finally { setLoading(false); }
    })();
  }, [fromDate, toDate]);

  return (
    <div className="space-y-6 animate-in">
      <SectionHeader title="To'lovlar hisoboti" subtitle="Tanlangan davrda qabul qilingan to'lovlar dinamikasi" />

      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4 border border-[var(--border)]">
          <p className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">Jami to'lovlar</p>
          <p className="text-xl font-extrabold font-mono text-emerald-600">
            {loading ? '...' : fmt(data?.totalAmount || 0)} <span className="text-xs font-semibold text-[var(--text-3)]">UZS</span>
          </p>
        </div>
        <div className="card p-4 border border-[var(--border)]">
          <p className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">To'lovlar soni</p>
          <p className="text-xl font-extrabold font-mono text-[var(--text)]">
            {loading ? '...' : data?.paymentsCount || 0} <span className="text-xs font-semibold text-[var(--text-3)]">ta</span>
          </p>
        </div>
      </div>

      <div className="card border border-[var(--border)]">
        <h3 className="text-xs font-semibold text-[var(--text)] mb-3">Kunlik to'lovlar trendc</h3>
        <div className="bg-[var(--surface-2)] rounded-xl p-3 border border-[var(--border)] min-h-[180px] flex items-center justify-center">
          {loading ? (
            <div className="text-xs text-[var(--text-3)]">Yuklanmoqda...</div>
          ) : !data?.paymentsByDay?.length ? (
            <div className="text-xs text-[var(--text-3)]">Tanlangan davrda to'lovlar mavjud emas</div>
          ) : (
            <TrendChart
              data={data.paymentsByDay.map(d => ({ amount: d.amount, title: `${fmtDate(d.day)}: ${fmt(d.amount)} UZS` }))}
              ticks={4} yUnit="UZS" showXLabels={false} nodeMax={35} gradientId="paymentsGrad"
            />
          )}
        </div>
      </div>

      {!loading && !!data?.paymentsByDay?.length && (
        <div className="card border border-[var(--border)] p-0">
          <div className="px-5 py-3 border-b border-[var(--border)] bg-[var(--surface-2)] rounded-t-xl">
            <h3 className="text-xs font-semibold text-[var(--text)]">Kunlik jadval</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--border)] text-[10px] font-semibold text-[var(--text-2)] uppercase tracking-wider">
                  <th className="px-5 py-2">Sana</th>
                  <th className="px-5 py-2 text-right">To'lovlar</th>
                  <th className="px-5 py-2 text-right">Jami summa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.paymentsByDay.map((row, i) => (
                  <tr key={i} className="hover:bg-[var(--surface-2)]">
                    <td className="px-5 py-2.5 text-xs font-mono text-[var(--text-2)]">{fmtDate(row.day)}</td>
                    <td className="px-5 py-2.5 text-xs text-right font-mono text-[var(--text)]">{row.count} ta</td>
                    <td className="px-5 py-2.5 text-xs text-right font-mono font-bold text-emerald-600">{fmt(row.amount)} UZS</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SOTUVCHILAR BO'YICHA ──────────────────────────────────────────────────────
function SalesBySellerSection({ fromDate, toDate }) {
  const [data, setData]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await api.get('/api/reports/sales-by-seller', { params: { from: fromDate, to: toDate } });
        setData(r.data);
      } catch { /* xato api interceptor da ko'rsatiladi */ } finally { setLoading(false); }
    })();
  }, [fromDate, toDate]);

  const maxAmount = data[0]?.totalAmount || 1;
  const total = data.reduce((s, d) => s + d.totalAmount, 0);

  return (
    <div className="space-y-6 animate-in">
      <SectionHeader title="Sotuvchilar bo'yicha oborot" subtitle="Tanlangan davrda har bir sotuvchining savdo soni va aylanmasi" />

      <div className="card border border-[var(--border)] p-0">
        <div className="px-5 py-3 border-b border-[var(--border)] bg-[var(--surface-2)] rounded-t-xl flex justify-between items-center">
          <h3 className="text-xs font-semibold text-[var(--text)]">Sotuvchilar reytingi</h3>
          <div className="flex items-center gap-4">
            {!loading && total > 0 && (
              <span className="text-[11px] font-bold font-mono text-[var(--text-2)]">Jami: {fmt(total)} UZS</span>
            )}
            <span className="text-[11px] text-[var(--text-3)]">{data.length} ta sotuvchi</span>
          </div>
        </div>
        {loading ? (
          <div className="p-8 text-center text-xs text-[var(--text-3)]">Yuklanmoqda...</div>
        ) : data.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--text-3)]">Tanlangan davrda savdolar topilmadi</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--border)] text-[10px] font-semibold text-[var(--text-2)] uppercase tracking-wider">
                  <th className="px-5 py-2 w-8">#</th>
                  <th className="px-5 py-2">Sotuvchi</th>
                  <th className="px-5 py-2 text-right">Savdolar</th>
                  <th className="px-5 py-2 text-right">Jami oborot</th>
                  <th className="px-5 py-2 w-32">Ulush</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.map((row, i) => (
                  <tr key={row.sellerName || i} className="hover:bg-[var(--surface-2)]">
                    <td className="px-5 py-2.5 text-[11px] font-mono text-[var(--text-3)]">{i + 1}</td>
                    <td className="px-5 py-2.5 text-xs font-medium text-[var(--text)]">{row.sellerName || '—'}</td>
                    <td className="px-5 py-2.5 text-xs text-right font-mono text-[var(--text-2)]">{row.salesCount} ta</td>
                    <td className="px-5 py-2.5 text-xs text-right font-mono font-bold text-[var(--text)]">{fmt(row.totalAmount)} UZS</td>
                    <td className="px-5 py-2.5">
                      <div className="h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden border border-[var(--border)]">
                        <div className="h-full bg-indigo-500 opacity-80" style={{ width: `${(row.totalAmount / maxAmount) * 100}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {total > 0 && (
                <tfoot>
                  <tr className="bg-[var(--surface-2)] font-bold text-xs border-t-2 border-[var(--border)]">
                    <td colSpan="3" className="px-5 py-2.5 text-[var(--text)]">Jami:</td>
                    <td className="px-5 py-2.5 text-right font-mono font-extrabold text-[var(--text)]">{fmt(total)} UZS</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── QQS HISOBOTI ──────────────────────────────────────────────────────────────
function VatReportSection({ fromDate, toDate }) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await api.get('/api/reports/vat-report', { params: { from: fromDate, to: toDate } });
        setData(r.data);
      } catch { /* xato api interceptor da ko'rsatiladi */ } finally { setLoading(false); }
    })();
  }, [fromDate, toDate]);

  const ratePct = data ? Math.round(data.vatRate * 100) : 12;

  return (
    <div className="space-y-6 animate-in">
      <SectionHeader title="QQS hisoboti" subtitle={`Soliq deklaratsiyasi uchun — joriy stavka ${ratePct}% (Sozlamalardan)`} />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card p-4 border border-[var(--border)]">
          <p className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">Jami (QQS bilan)</p>
          <p className="text-lg font-extrabold font-mono text-[var(--text)]">
            {loading ? '...' : fmt(data?.totalAmount || 0)} <span className="text-[10px] font-semibold text-[var(--text-3)]">UZS</span>
          </p>
        </div>
        <div className="card p-4 border border-[var(--border)]">
          <p className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">QQS siz summa</p>
          <p className="text-lg font-extrabold font-mono text-[var(--text-2)]">
            {loading ? '...' : fmt(data?.netAmount || 0)} <span className="text-[10px] font-semibold text-[var(--text-3)]">UZS</span>
          </p>
        </div>
        <div className="card p-4 border border-[var(--border)]">
          <p className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">QQS summasi ({ratePct}%)</p>
          <p className="text-lg font-extrabold font-mono text-indigo-600">
            {loading ? '...' : fmt(data?.vatAmount || 0)} <span className="text-[10px] font-semibold text-[var(--text-3)]">UZS</span>
          </p>
        </div>
        <div className="card p-4 border border-[var(--border)]">
          <p className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">Hujjatlar soni</p>
          <p className="text-lg font-extrabold font-mono text-[var(--text)]">
            {loading ? '...' : data?.salesCount || 0} <span className="text-[10px] font-semibold text-[var(--text-3)]">ta</span>
          </p>
        </div>
      </div>

      <div className="card border border-[var(--border)] p-0">
        <div className="px-5 py-3 border-b border-[var(--border)] bg-[var(--surface-2)] rounded-t-xl">
          <h3 className="text-xs font-semibold text-[var(--text)]">Oylik QQS taqsimoti</h3>
        </div>
        {loading ? (
          <div className="p-8 text-center text-xs text-[var(--text-3)]">Yuklanmoqda...</div>
        ) : !data?.byMonth?.length ? (
          <div className="p-8 text-center text-xs text-[var(--text-3)]">Tanlangan davrda savdolar topilmadi</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--border)] text-[10px] font-semibold text-[var(--text-2)] uppercase tracking-wider">
                  <th className="px-5 py-2">Oy</th>
                  <th className="px-5 py-2 text-right">Hujjatlar</th>
                  <th className="px-5 py-2 text-right">Jami (QQS bilan)</th>
                  <th className="px-5 py-2 text-right">QQS siz</th>
                  <th className="px-5 py-2 text-right">QQS summasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.byMonth.map((row) => (
                  <tr key={row.month} className="hover:bg-[var(--surface-2)]">
                    <td className="px-5 py-2.5 text-xs font-mono text-[var(--text-2)]">{row.month}</td>
                    <td className="px-5 py-2.5 text-xs text-right font-mono text-[var(--text-2)]">{row.count} ta</td>
                    <td className="px-5 py-2.5 text-xs text-right font-mono font-bold text-[var(--text)]">{fmt(row.totalAmount)} UZS</td>
                    <td className="px-5 py-2.5 text-xs text-right font-mono text-[var(--text-2)]">{fmt(row.netAmount)} UZS</td>
                    <td className="px-5 py-2.5 text-xs text-right font-mono font-bold text-indigo-600">{fmt(row.vatAmount)} UZS</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[var(--surface-2)] font-bold text-xs border-t-2 border-[var(--border)]">
                  <td colSpan="2" className="px-5 py-2.5 text-[var(--text)]">Jami:</td>
                  <td className="px-5 py-2.5 text-right font-mono font-extrabold text-[var(--text)]">{fmt(data.totalAmount)} UZS</td>
                  <td className="px-5 py-2.5 text-right font-mono text-[var(--text-2)]">{fmt(data.netAmount)} UZS</td>
                  <td className="px-5 py-2.5 text-right font-mono font-extrabold text-indigo-600">{fmt(data.vatAmount)} UZS</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── SOZLAMALAR ────────────────────────────────────────────────────────────────
function WidgetSettingsSection({ widgets, onToggle }) {
  return (
    <div className="space-y-6 animate-in">
      <SectionHeader title="Bosh sahifa sozlamalari" subtitle="Bosh sahifada ko'rsatiladigan widgetlarni yoqing yoki o'chiring" />

      <div className="card border border-[var(--border)] max-w-lg">
        <h3 className="text-xs font-semibold text-[var(--text)] mb-5">Widgetlar</h3>
        <div className="space-y-4">
          {WIDGET_META.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <span className="text-sm text-[var(--text)]">{label}</span>
              <button
                onClick={() => onToggle(key)}
                className={`relative inline-flex w-10 h-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1 ${
                  widgets[key] ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
                }`}
                aria-checked={widgets[key]}
                role="switch"
              >
                <span
                  className={`inline-block w-4 h-4 bg-white rounded-full shadow absolute top-0.5 transition-transform ${
                    widgets[key] ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-[var(--text-3)] mt-5">
          Sozlamalar brauzer xotirasida (localStorage) saqlanadi
        </p>
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function Reports() {
  const { from: fromDate, to: toDate } = useDateFilter();
  const [active, setActive] = useState('home');
  const [openGroups, setOpenGroups] = useState({
    'Savdo hisobotlari': true,
    'Moliyaviy hisobotlar': false,
  });
  const [widgets, setWidgets] = useState(loadWidgets);

  const toggleGroup = (group) => setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }));

  const toggleWidget = (key) => {
    setWidgets(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('reports_widgets', JSON.stringify(next));
      return next;
    });
  };

  return (
    <div className="flex min-h-full">
      {/* ── Sidebar ── */}
      <aside className="w-52 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] sticky top-0 self-start max-h-screen overflow-y-auto">
        <div className="px-3 pt-4 pb-2 text-[9px] font-bold text-[var(--text-3)] uppercase tracking-widest">
          Hisobotlar bo'limlari
        </div>
        <nav className="px-2 pb-4 space-y-0.5">
          {MENU.map((item) => {
            if (item.id) {
              return (
                <button
                  key={item.id}
                  onClick={() => setActive(item.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors ${
                    active === item.id
                      ? 'bg-[var(--accent)] text-white font-semibold'
                      : 'text-[var(--text)] hover:bg-[var(--surface-2)]'
                  }`}
                >
                  <item.Icon size={14} className="shrink-0" />
                  <span className="truncate text-xs">{item.label}</span>
                </button>
              );
            }
            // group with children
            return (
              <div key={item.group} className="pt-1">
                <button
                  onClick={() => toggleGroup(item.group)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs font-semibold text-[var(--text-2)] hover:bg-[var(--surface-2)] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <item.Icon size={13} className="shrink-0" />
                    <span className="truncate">{item.group}</span>
                  </div>
                  {openGroups[item.group]
                    ? <ChevronDown size={11} />
                    : <ChevronRight size={11} />
                  }
                </button>
                {openGroups[item.group] && (
                  <div className="ml-5 mt-0.5 space-y-0.5 border-l border-[var(--border)] pl-2">
                    {item.children.map(child => (
                      <button
                        key={child.id}
                        onClick={() => setActive(child.id)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors ${
                          active === child.id
                            ? 'bg-[var(--accent)] text-white font-semibold'
                            : 'text-[var(--text-2)] hover:bg-[var(--surface-2)]'
                        }`}
                      >
                        <child.Icon size={12} className="shrink-0" />
                        <span className="truncate text-xs">{child.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* ── Content ── */}
      <main className="flex-1 p-6 min-w-0">
        {active === 'home'             && <HomeSection fromDate={fromDate} toDate={toDate} widgets={widgets} />}
        {active === 'sales_period'     && <SalesPeriodSection fromDate={fromDate} toDate={toDate} />}
        {active === 'sales_by_client'  && <SalesByClientSection fromDate={fromDate} toDate={toDate} />}
        {active === 'sales_by_product' && <SalesByProductSection fromDate={fromDate} toDate={toDate} />}
        {active === 'sales_by_seller'  && <SalesBySellerSection fromDate={fromDate} toDate={toDate} />}
        {active === 'debtors'          && <DebtorsSection />}
        {active === 'client_statement' && <ClientStatementSection />}
        {active === 'payments'         && <PaymentsSummarySection fromDate={fromDate} toDate={toDate} />}
        {active === 'vat_report'       && <VatReportSection fromDate={fromDate} toDate={toDate} />}
        {active === 'widget_settings'  && <WidgetSettingsSection widgets={widgets} onToggle={toggleWidget} />}
      </main>
    </div>
  );
}
