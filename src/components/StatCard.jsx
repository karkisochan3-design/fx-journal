import React from 'react';
import { fmtMoney } from '../lib/calc.mjs';

export default function StatCard({
  label,
  value,
  meta,
  tone,
  hero,
  children,
}) {
  const color =
    tone === 'win' ? 'var(--win)' : tone === 'loss' ? 'var(--loss)' : tone === 'accent' ? 'var(--accent-text)' : undefined;
  return (
    <div className={`stat ${hero ? 'stat-hero' : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color }}>
        {value}
      </div>
      {meta && <div className="stat-meta">{meta}</div>}
      {children}
    </div>
  );
}

export function MiniBars({ wins, losses, breakeven, theme }) {
  const total = wins + losses + breakeven || 1;
  return (
    <div style={{ display: 'flex', height: 5, borderRadius: 20, overflow: 'hidden', background: 'var(--surface-3)', marginTop: 2 }}>
      <span style={{ width: `${(wins / total) * 100}%`, background: 'var(--win)' }} title={`${wins} wins`} />
      <span style={{ width: `${(breakeven / total) * 100}%`, background: 'var(--text-faint)' }} title={`${breakeven} breakeven`} />
      <span style={{ width: `${(losses / total) * 100}%`, background: 'var(--loss)' }} title={`${losses} losses`} />
    </div>
  );
}

export function WinRateDial({ value, theme }) {
  const v = Math.max(0, Math.min(100, value || 0));
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 2 }}>
      <svg width="62" height="62" viewBox="0 0 62 62" style={{ flex: 'none' }}>
        <circle cx="31" cy="31" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="7" />
        <circle
          cx="31"
          cy="31"
          r={r}
          fill="none"
          stroke="var(--win)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${(v / 100) * c} ${c}`}
          transform="rotate(-90 31 31)"
          style={{ transition: 'stroke-dasharray .4s ease' }}
        />
        <text
          x="31"
          y="35"
          textAnchor="middle"
          fontSize="15"
          fontWeight="700"
          fill="currentColor"
          fontFamily="var(--mono)"
        >
          {v.toFixed(0)}
        </text>
      </svg>
      <div style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.4 }}>
        percent of closed
        <br />
        trades that were winners
      </div>
    </div>
  );
}

export function TradeRow({ t }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
      <span className={`sym-dir ${t.direction}`} style={{ width: 20, height: 20, fontSize: 10 }}>
        {t.direction === 'long' ? '↑' : '↓'}
      </span>
      <span style={{ fontWeight: 650 }}>{t.instrument}</span>
      <span className="faint">{fmtMoney(t.pnl, { sign: true })}</span>
    </div>
  );
}
