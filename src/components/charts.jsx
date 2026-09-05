import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import { palette } from '../lib/theme.js';
import { fmtMoney, monthLabel } from '../lib/calc.mjs';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler
);

ChartJS.defaults.font.family =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
ChartJS.defaults.font.size = 11.5;
ChartJS.defaults.animation.duration = 550;

const baseTooltip = (theme) => {
  const p = palette(theme);
  return {
    backgroundColor: p.surface,
    titleColor: p.text,
    bodyColor: p.dim,
    borderColor: p.border,
    borderWidth: 1,
    padding: 10,
    cornerRadius: 9,
    boxPadding: 5,
    usePointStyle: true,
    titleFont: { weight: '600', size: 12 },
    bodyFont: { size: 12 },
  };
};

const scales = (theme, { yTicks, x = true } = {}) => {
  const p = palette(theme);
  const out = {
    x: {
      grid: { display: false, drawBorder: false },
      border: { display: false },
      ticks: { color: p.faint, maxRotation: 0, autoSkipPadding: 12 },
    },
    y: {
      grid: { color: p.grid, drawBorder: false },
      border: { display: false },
      ticks: { color: p.faint, callback: yTicks, maxTicksLimit: 6 },
    },
  };
  if (!x) delete out.x;
  return out;
};

/* ------------------------------ equity curve ------------------------------ */
export function EquityChart({ curve, theme }) {
  const p = palette(theme);
  const data = useMemo(
    () => ({
      labels: curve.map((c, i) => i + 1),
      datasets: [
        {
          label: 'Cumulative P&L',
          data: curve.map((c) => c.cumulative),
          borderColor: p.accent,
          backgroundColor: p.accentSoft,
          borderWidth: 2,
          fill: true,
          tension: 0.28,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: p.accent,
          pointHoverBorderColor: p.surface,
          pointHoverBorderWidth: 2,
        },
      ],
    }),
    [curve, p]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...baseTooltip(theme),
          callbacks: {
            title: (items) => `Trade #${items[0].label}`,
            label: (item) => `Equity: ${fmtMoney(item.parsed.y, { sign: true })}`,
            afterBody: (items) => {
              const c = curve[items[0].dataIndex];
              return c ? `Trade P&L: ${fmtMoney(c.pnl, { sign: true })}` : '';
            },
          },
        },
      },
      scales: scales(theme, { yTicks: (v) => fmtMoney(v, { digits: 0 }) }),
    }),
    [curve, theme, p]
  );

  return (
    <div className="chart-box">
      <Line data={data} options={options} />
    </div>
  );
}

/* ------------------------------ win / loss pie ------------------------------ */
export function WinLossPie({ stats, theme }) {
  const p = palette(theme);
  const data = useMemo(
    () => ({
      labels: ['Wins', 'Losses', 'Breakeven'],
      datasets: [
        {
          data: [stats.wins, stats.losses, stats.breakeven],
          backgroundColor: [p.win, p.loss, p.faint],
          borderColor: p.surface,
          borderWidth: 3,
          hoverOffset: 5,
        },
      ],
    }),
    [stats, p]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: p.dim,
            padding: 14,
            boxWidth: 9,
            boxHeight: 9,
            usePointStyle: true,
            pointStyle: 'circle',
            font: { size: 12 },
          },
        },
        tooltip: {
          ...baseTooltip(theme),
          callbacks: {
            label: (ctx) => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0) || 1;
              return ` ${ctx.label}: ${ctx.parsed} (${((ctx.parsed / total) * 100).toFixed(1)}%)`;
            },
          },
        },
      },
    }),
    [stats, theme, p]
  );

  return (
    <div className="chart-box" style={{ position: 'relative' }}>
      <Doughnut data={data} options={options} />
      <div
        style={{
          position: 'absolute',
          top: '42%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          pointerEvents: 'none',
        }}
      >
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.03em' }}>
          {stats.winRate !== null ? `${stats.winRate.toFixed(0)}%` : '—'}
        </div>
        <div style={{ fontSize: 10.5, color: p.faint, letterSpacing: '.06em', fontWeight: 700 }}>WIN RATE</div>
      </div>
    </div>
  );
}

/* ------------------------------ monthly bars ------------------------------ */
export function MonthlyChart({ monthly, theme }) {
  const p = palette(theme);
  const data = useMemo(
    () => ({
      labels: monthly.map((m) => monthLabel(m.key)),
      datasets: [
        {
          label: 'Net P&L',
          data: monthly.map((m) => m.pnl),
          backgroundColor: monthly.map((m) => (m.pnl >= 0 ? p.win : p.loss)),
          borderRadius: 6,
          borderSkipped: false,
          maxBarThickness: 44,
        },
      ],
    }),
    [monthly, p]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...baseTooltip(theme),
          callbacks: {
            label: (ctx) => ` Net: ${fmtMoney(ctx.parsed.y, { sign: true })}`,
            afterBody: (items) => {
              const m = monthly[items[0].dataIndex];
              return m ? `${m.trades} trades · ${((m.wins / m.trades) * 100).toFixed(0)}% win` : '';
            },
          },
        },
      },
      scales: scales(theme, { yTicks: (v) => fmtMoney(v, { digits: 0 }) }),
    }),
    [monthly, theme, p]
  );

  return (
    <div className="chart-box">
      <Bar data={data} options={options} />
    </div>
  );
}

/* ------------------------------ R:R distribution ------------------------------ */
export function RRDistributionChart({ buckets, theme }) {
  const p = palette(theme);
  const data = useMemo(
    () => ({
      labels: buckets.map((b) => b.label),
      datasets: [
        {
          label: 'Trades',
          data: buckets.map((b) => b.count),
          backgroundColor: p.accentSoft,
          borderColor: p.accent,
          borderWidth: 1.5,
          borderRadius: 6,
          maxBarThickness: 40,
        },
      ],
    }),
    [buckets, p]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { ...baseTooltip(theme), callbacks: { label: (c) => ` ${c.parsed.y} trades` } },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: p.faint },
          title: { display: true, text: 'planned R:R', color: p.faint, font: { size: 10.5 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: p.grid },
          border: { display: false },
          ticks: { color: p.faint, precision: 0 },
        },
      },
    }),
    [buckets, theme, p]
  );

  return (
    <div className="chart-box sm">
      <Bar data={data} options={options} />
    </div>
  );
}

/* ------------------------------ weekday counts ------------------------------ */
export function WeekdayChart({ data: rows, mode, theme }) {
  const p = palette(theme);
  const isCount = mode === 'count';
  const data = useMemo(
    () => ({
      labels: rows.map((r) => r.label),
      datasets: [
        {
          label: isCount ? 'Trades' : 'Net P&L',
          data: rows.map((r) => (isCount ? r.count : r.pnl)),
          backgroundColor: isCount
            ? p.violet
            : rows.map((r) => (r.pnl >= 0 ? p.win : p.loss)),
          borderRadius: 6,
          maxBarThickness: 34,
        },
      ],
    }),
    [rows, isCount, p]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...baseTooltip(theme),
          callbacks: {
            label: (c) => (isCount ? ` ${c.parsed.y} trades` : ` ${fmtMoney(c.parsed.y, { sign: true })}`),
          },
        },
      },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: p.faint } },
        y: {
          beginAtZero: true,
          grid: { color: p.grid },
          border: { display: false },
          ticks: { color: p.faint, callback: isCount ? (v) => v : (v) => fmtMoney(v, { digits: 0 }) },
        },
      },
    }),
    [rows, isCount, theme, p]
  );

  return (
    <div className="chart-box sm">
      <Bar data={data} options={options} />
    </div>
  );
}

/* ------------------------------ breakdown rows ------------------------------ */
export function BreakdownList({ rows, theme, kind = 'instrument' }) {
  const p = palette(theme);
  const max = Math.max(...rows.map((r) => Math.abs(r.net ?? r.pnl ?? 0)), 1);
  return (
    <div className="blist">
      {rows.length === 0 && <p className="hint" style={{ padding: 12 }}>No closed trades yet.</p>}
      {rows.map((r) => {
        const val = r.net ?? r.pnl ?? 0;
        const key = r.instrument || r.timeframe;
        return (
          <div className="brow" key={key}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <span style={{ fontWeight: 650, letterSpacing: '-.01em' }}>{key}</span>
              <span className="faint" style={{ fontSize: 11.5 }}>
                {r.trades} · {r.winRate ? `${r.winRate.toFixed(0)}%` : '—'}
              </span>
              <div className="bar-mini" style={{ flex: 1, minWidth: 30 }}>
                <i
                  style={{
                    width: `${(Math.abs(val) / max) * 100}%`,
                    background: val >= 0 ? p.win : p.loss,
                    opacity: 0.75,
                  }}
                />
              </div>
            </div>
            {kind === 'instrument' && (
              <span className="num dim" style={{ fontSize: 12 }}>
                {r.avgRR ? `1:${r.avgRR.toFixed(1)}` : '—'}
              </span>
            )}
            <span
              className="num"
              style={{ fontWeight: 700, color: val >= 0 ? p.win : p.loss, minWidth: 78, textAlign: 'right' }}
            >
              {fmtMoney(val, { sign: true })}
            </span>
          </div>
        );
      })}
    </div>
  );
}
