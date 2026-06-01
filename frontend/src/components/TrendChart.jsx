import { fmt } from '../lib/format';

/**
 * Umumiy SVG trend grafigi (Dashboard "Oylik Savdo" va Reports "Savdo aylanmasi").
 *
 * @param {Array}   data        - [{ amount, label?, title? }]
 * @param {number}  ticks       - gorizontal grid chiziqlar soni (default 5)
 * @param {string}  yUnit       - Y o'qi yorlig'i suffiksi (masalan 'UZS')
 * @param {boolean} showXLabels - pastki yorliqlarni ko'rsatish (label maydoni)
 * @param {number}  nodeMax     - data.length shu sondan kichik bo'lsa nuqtalar chiziladi
 * @param {string}  gradientId  - bir sahifada bir nechta grafik bo'lsa unikal id
 */
export default function TrendChart({
  data,
  ticks = 5,
  yUnit = '',
  showXLabels = true,
  nodeMax = Infinity,
  gradientId = 'trendGrad',
}) {
  if (!data || data.length === 0) return null;

  const max = Math.max(...data.map(d => d.amount), 1);
  const w = 600, h = 200, pad = { l: 56, r: 18, t: 16, b: showXLabels ? 32 : 30 };

  const xs = (i) => pad.l + i * (w - pad.l - pad.r) / Math.max(1, data.length - 1);
  const ys = (v) => h - pad.b - (v / max) * (h - pad.t - pad.b);

  const pathStr = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xs(i).toFixed(1)} ${ys(d.amount).toFixed(1)}`).join(' ');
  const areaStr = `${pathStr} L ${xs(data.length - 1).toFixed(1)} ${h - pad.b} L ${xs(0).toFixed(1)} ${h - pad.b} Z`;

  const tickVals = Array.from({ length: ticks }, (_, i) => (max * i) / (ticks - 1));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-48 select-none">
      {/* Gorizontal grid + Y yorliqlari */}
      {tickVals.map((t, i) => (
        <g key={i}>
          <line x1={pad.l} x2={w - pad.r} y1={ys(t)} y2={ys(t)} stroke="var(--border)" strokeDasharray="2 4" />
          <text x={pad.l - 8} y={ys(t) + 3} fontSize="9.5" textAnchor="end" fill="var(--text-3)" fontFamily="var(--mono)">
            {fmt(Math.round(t))}{yUnit ? ` ${yUnit}` : ''}
          </text>
        </g>
      ))}

      {/* Pastki (X) yorliqlar */}
      {showXLabels && data.map((d, i) => (
        <text key={i} x={xs(i)} y={h - 10} fontSize="10" textAnchor="middle" fill="var(--text-3)">
          {d.label}
        </text>
      ))}

      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      <path d={areaStr} fill={`url(#${gradientId})`} />
      <path d={pathStr} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {data.length <= nodeMax && data.map((d, i) => (
        <circle
          key={i}
          cx={xs(i)}
          cy={ys(d.amount)}
          r="3"
          fill="var(--accent)"
          stroke="var(--surface)"
          strokeWidth="1.5"
        >
          {d.title && <title>{d.title}</title>}
        </circle>
      ))}
    </svg>
  );
}
