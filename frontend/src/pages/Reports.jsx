import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { fmt } from '../lib/format';
import TrendChart from '../components/TrendChart';
import { useDateFilter } from '../context/DateFilterContext';
import {
  TrendingUp, ShoppingBag,
  BarChart3, FileSpreadsheet
} from 'lucide-react';

export default function Reports() {
  const { from: fromDate, to: toDate } = useDateFilter();

  // Analytics data states
  const [salesSummary, setSalesSummary] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [debtors, setDebtors] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientStatement, setClientStatement] = useState(null);

  // Loading states
  const [loadingSales, setLoadingSales] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingDebtors, setLoadingDebtors] = useState(true);
  const [loadingStatement, setLoadingStatement] = useState(false);

  // Fetch Sales period aggregation
  const fetchSalesSummary = useCallback(async () => {
    setLoadingSales(true);
    try {
      const res = await api.get('/api/reports/sales-by-period', {
        params: { from: fromDate, to: toDate }
      });
      setSalesSummary(res.data);
    } catch {
      // handled
    } finally {
      setLoadingSales(false);
    }
  }, [fromDate, toDate]);

  // Fetch Top Products
  const fetchTopProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const res = await api.get('/api/reports/products-top', { params: { limit: 5 } });
      setTopProducts(res.data);
    } catch {
      // handled
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  // Fetch Debtors list
  const fetchDebtors = useCallback(async () => {
    setLoadingDebtors(true);
    try {
      const res = await api.get('/api/reports/debtors');
      setDebtors(res.data);
    } catch {
      // handled
    } finally {
      setLoadingDebtors(false);
    }
  }, []);

  // Fetch client list for dropdown selection
  const fetchClientsList = useCallback(async () => {
    try {
      const res = await api.get('/api/clients', { params: { limit: 1000 } });
      setClients(res.data.data || []);
      if (res.data.data?.length > 0) {
        setSelectedClientId(res.data.data[0].id);
      }
    } catch {
      // handled
    }
  }, []);

  // Fetch Chronological Client Ledger Statement
  const fetchClientStatement = useCallback(async () => {
    if (!selectedClientId) return;
    setLoadingStatement(true);
    try {
      const res = await api.get(`/api/reports/client-statement/${selectedClientId}`);
      setClientStatement(res.data);
    } catch {
      // handled
    } finally {
      setLoadingStatement(false);
    }
  }, [selectedClientId]);

  // Run initial fetches
  useEffect(() => {
    fetchSalesSummary();
    fetchTopProducts();
    fetchDebtors();
    fetchClientsList();
  }, [fetchSalesSummary, fetchTopProducts, fetchDebtors, fetchClientsList]);

  // Refetch statement when selected client changes
  useEffect(() => {
    fetchClientStatement();
  }, [fetchClientStatement]);

  // SVG Line Chart for sales trend
  const renderTrendChart = () => {
    if (!salesSummary?.salesByDay || salesSummary.salesByDay.length === 0) {
      return (
        <div className="h-48 flex items-center justify-center text-xs text-[var(--text-3)]">
          Tanlangan davrda savdolar mavjud emas
        </div>
      );
    }

    return (
      <TrendChart
        data={salesSummary.salesByDay.map(d => ({
          amount: d.amount,
          title: `${new Date(d.day).toLocaleDateString('uz-UZ')}: ${fmt(d.amount)} UZS`,
        }))}
        ticks={3}
        yUnit="UZS"
        showXLabels={false}
        nodeMax={29}
        gradientId="reportsTrendGrad"
      />
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text)]">Tizim Hisobotlari</h2>
          <p className="text-xs text-[var(--text-3)] mt-0.5">Savdo tahlili, mijozlar balansi va qarzdorlik hisobotlari</p>
        </div>

        {/* Davr yuqori paneldagi global "Davr" tugmasidan boshqariladi */}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card 1: Davriy Savdo */}
        <div className="card flex items-center justify-between p-5 border border-[var(--border)]">
          <div className="space-y-1">
            <h4 className="text-[11px] font-bold text-[var(--text-3)] uppercase tracking-wider">Tanlangan Davr Savdosi</h4>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-extrabold text-[var(--text)] font-mono">
                {loadingSales ? '...' : fmt(salesSummary?.totalAmount || 0)}
              </span>
              <span className="text-[10px] font-bold text-[var(--text-3)] uppercase">UZS</span>
            </div>
            <p className="text-[10px] text-[var(--text-3)]">Jami yuk xatlari aylanmasi</p>
          </div>
          <div className="icon-badge icon-badge-success p-3 rounded-xl">
            <TrendingUp size={20} strokeWidth={2.2} />
          </div>
        </div>

        {/* Card 2: Hujjatlar soni */}
        <div className="card flex items-center justify-between p-5 border border-[var(--border)]">
          <div className="space-y-1">
            <h4 className="text-[11px] font-bold text-[var(--text-3)] uppercase tracking-wider">Hujjatlar Soni</h4>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-extrabold text-[var(--text)] font-mono">
                {loadingSales ? '...' : salesSummary?.salesCount || 0}
              </span>
              <span className="text-[10px] font-bold text-[var(--text-3)] uppercase">ta</span>
            </div>
            <p className="text-[10px] text-[var(--text-3)]">Davrdagi jami rasmiylashtirilgan yuk xatlari</p>
          </div>
          <div className="icon-badge icon-badge-info p-3 rounded-xl">
            <ShoppingBag size={20} strokeWidth={2.2} />
          </div>
        </div>

        {/* Card 3: Top mahsulot aylanmasi */}
        <div className="card flex items-center justify-between p-5 border border-[var(--border)]">
          <div className="space-y-1">
            <h4 className="text-[11px] font-bold text-[var(--text-3)] uppercase tracking-wider">Top Mahsulot Sotilishi</h4>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-extrabold text-[var(--text)] font-mono">
                {loadingProducts ? '...' : topProducts[0] ? fmt(topProducts[0].totalPieces) : '0'}
              </span>
              <span className="text-[10px] font-bold text-[var(--text-3)] uppercase">dona</span>
            </div>
            <p className="text-[10px] text-[var(--text-3)]">Eng ko'p sotilgan mahsulot donasi ({topProducts[0]?.article || 'mavjud emas'})</p>
          </div>
          <div className="icon-badge icon-badge-warn p-3 rounded-xl">
            <BarChart3 size={20} strokeWidth={2.2} />
          </div>
        </div>
      </div>

      {/* Main dashboard reports section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales trend chart container */}
        <div className="card lg:col-span-2 flex flex-col justify-between border border-[var(--border)]">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-xs font-semibold text-[var(--text)]">Savdo aylanmasi dinamikasi</h3>
              <p className="text-[10px] text-[var(--text-3)] mt-0.5">Kunlik yoki davriy savdo aylanmasi o'zgarishi</p>
            </div>
          </div>
          <div className="flex-1 bg-[var(--surface-2)] rounded-xl p-3 border border-[var(--border)] flex items-center justify-center">
            {loadingSales ? (
              <div className="h-48 flex items-center justify-center text-xs text-[var(--text-3)]">Grafik yuklanmoqda...</div>
            ) : (
              renderTrendChart()
            )}
          </div>
        </div>

        {/* Top 5 Products bar comparison list */}
        <div className="card border border-[var(--border)] flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-xs font-semibold text-[var(--text)]">Top 5 Mahsulot (Dona bo'yicha)</h3>
            <p className="text-[10px] text-[var(--text-3)] mt-0.5">Eng ko'p sotilgan top mahsulot artikullari</p>
          </div>
          <div className="space-y-4 flex-1 overflow-y-auto pr-1">
            {loadingProducts ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="space-y-1">
                  <div className="h-3 bg-[var(--surface-2)] animate-pulse rounded w-1/3" />
                  <div className="h-2 bg-[var(--surface-2)] animate-pulse rounded w-full" />
                </div>
              ))
            ) : topProducts.length === 0 ? (
              <div className="text-center py-12 text-xs text-[var(--text-3)] font-medium">Sotilgan mahsulotlar mavjud emas</div>
            ) : (
              topProducts.map((p) => {
                const maxVal = topProducts[0]?.totalPieces || 1;
                const ratio = p.totalPieces / maxVal;
                return (
                  <div key={p.id} className="space-y-1 select-none">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs font-medium text-[var(--text)] truncate max-w-[180px]">{p.article}</span>
                      <span className="text-[10.5px] font-bold font-mono text-[var(--text-2)]">{fmt(p.totalPieces)} dona</span>
                    </div>
                    <div className="h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden border border-[var(--border)]">
                      <div 
                        className="h-full bg-indigo-500 opacity-90 transition-all duration-500" 
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top 5 Debtors list */}
        <div className="card border border-[var(--border)] flex flex-col justify-between">
          <div className="px-1 mb-4 flex justify-between items-center">
            <div>
              <h3 className="text-xs font-semibold text-[var(--text)]">Eng yirik qarzdorlar</h3>
              <p className="text-[10px] text-[var(--text-3)] mt-0.5">Top faol balansdagi debitor qarzdorliklar</p>
            </div>
            <FileSpreadsheet size={16} className="text-[var(--text-3)]" />
          </div>
          <div className="space-y-3.5 flex-1 overflow-y-auto pr-1">
            {loadingDebtors ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="h-8 bg-[var(--surface-2)] animate-pulse rounded" />
              ))
            ) : debtors.length === 0 ? (
              <div className="text-center py-12 text-xs text-[var(--text-3)] font-medium">Faol qarzdorliklar mavjud emas</div>
            ) : (
              debtors.slice(0, 5).map((d) => {
                const maxDebt = debtors[0]?.debt || 1;
                const ratio = d.debt / maxDebt;
                return (
                  <div key={d.id} className="space-y-1 select-none">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs font-medium text-[var(--text)] truncate max-w-[180px]">{d.name}</span>
                      <span className="text-xs font-bold font-mono text-red-500">{fmt(d.debt)} UZS</span>
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

        {/* Client chronological Ledger Statement (Analitik aylanma vedomosti) */}
        <div className="card lg:col-span-2 border border-[var(--border)] flex flex-col justify-between p-0">
          <div className="px-5 py-3 border-b border-[var(--border)] flex flex-col sm:flex-row justify-between items-stretch sm:items-center bg-[var(--surface-2)] rounded-t-xl gap-2">
            <div>
              <h3 className="text-xs font-semibold text-[var(--text)]">Mijozning analitik aylanma kartasi (Ledger)</h3>
              <p className="text-[10px] text-[var(--text-3)] mt-0.5">Xronologik savdolar, to'lovlar va balans o'zgarishi</p>
            </div>

            {/* Client selector dropdown */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-bold text-[var(--text-2)] uppercase">Mijoz:</span>
              <select
                value={selectedClientId}
                onChange={e => setSelectedClientId(e.target.value)}
                className="px-2.5 py-1 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--accent)] font-semibold max-w-[200px]"
              >
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto min-h-[220px]">
            {loadingStatement ? (
              <div className="p-8 text-center text-xs text-[var(--text-3)]">Aylanma karta yuklanmoqda...</div>
            ) : !clientStatement || clientStatement.statement?.length === 0 ? (
              <div className="p-12 text-center text-xs text-[var(--text-3)] font-medium">Ushbu mijoz bo'yicha tarixiy aylanmalar topilmadi</div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface)] text-[10px] font-semibold text-[var(--text-2)] uppercase tracking-wider">
                    <th className="px-4 py-2">Sana</th>
                    <th className="px-4 py-2">Tavsif (Hujjat)</th>
                    <th className="px-4 py-2 text-right">Savdo (Debet)</th>
                    <th className="px-4 py-2 text-right">To'lov (Kredit)</th>
                    <th className="px-4 py-2 text-right">Balans (Qarz)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {clientStatement.statement.map((item, idx) => (
                    <tr key={idx} className="hover:bg-[var(--surface-2)] transition-colors">
                      <td className="px-4 py-2 text-[11px] text-[var(--text-2)] font-mono">{new Date(item.date).toLocaleDateString('uz-UZ')}</td>
                      <td className="px-4 py-2 text-xs text-[var(--text)] font-semibold">{item.desc}</td>
                      <td className="px-4 py-2 text-[11px] text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                        {item.debit > 0 ? `${fmt(item.debit)} UZS` : '—'}
                      </td>
                      <td className="px-4 py-2 text-[11px] text-right font-mono font-bold text-emerald-600">
                        {item.credit > 0 ? `${fmt(item.credit)} UZS` : '—'}
                      </td>
                      <td className={`px-4 py-2 text-[11px] text-right font-mono font-extrabold ${
                        item.balance > 0 ? 'text-red-500' : 'text-emerald-600'
                      }`}>
                        {fmt(item.balance)} UZS
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[var(--surface-2)] font-bold text-xs border-t-2 border-[var(--border)]">
                    <td colSpan="2" className="px-4 py-2.5 text-[var(--text)]">Jami aylanma yakuni:</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-700 dark:text-slate-300">
                      {fmt(clientStatement.statement.reduce((s, i) => s + i.debit, 0))} UZS
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-emerald-600">
                      {fmt(clientStatement.statement.reduce((s, i) => s + i.credit, 0))} UZS
                    </td>
                    <td className={`px-4 py-2.5 text-right font-mono font-extrabold ${
                      clientStatement.finalBalance > 0 ? 'text-red-500' : 'text-emerald-600'
                    }`}>
                      {fmt(clientStatement.finalBalance)} UZS
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
