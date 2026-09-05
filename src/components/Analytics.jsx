import React, { useState } from 'react';
import {
  WinLossPie,
  MonthlyChart,
  RRDistributionChart,
  WeekdayChart,
  BreakdownList,
} from './charts.jsx';
import {
  computeStats,
  monthlyPerformance,
  rrDistribution,
  weekdayCounts,
  byInstrument,
  byTimeframe,
} from '../lib/stats.js';
import { fmtMoney, fmtNum, monthLabel } from '../lib/calc.mjs';

export default function Analytics({ trades, theme }) {
  const [weekMode, setWeekMode] = useState('count');
  const [breakdown, setBreakdown] = useState('instrument');

  const s = computeStats(trades);
  const monthly = monthlyPerformance(trades);
  const rrBuckets = rrDistribution(trades);
  const weekdays = weekdayCounts(trades);
  const instruments = byInstrument(trades);
  const timeframes = byTimeframe(trades);

  const monthlyAvg = monthly.length ? monthly.reduce((a, m) => a + m.pnl, 0) / monthly.length : null;
  const bestMonth = monthly.length ? monthly.reduce((a, b) => (b.pnl > a.pnl ? b : a)) : null;
  const worstMonth = monthly.length ? monthly.reduce((a, b) => (b.pnl < a.pnl ? b : a)) : null;

  return (
    <div className="page">
      <div className="grid g-auto-lg" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-head">
            <span className="card-title">Win / loss split</span>
            <span className="spacer" />
            <span className="hint">{s.closedCount} closed</span>
          </div>
          <div className="card-pad">
            {s.closedCount ? (
              <>
                <WinLossPie stats={s} theme={theme} />
                <div style={{ display: 'grid', gap: 0, marginTop: 8 }}>
                  <Kv k="Gross profit" v={fmtMoney(s.grossProfit)} tone="win" />
                  <Kv k="Gross loss" v={fmtMoney(s.grossLoss)} tone="loss" />
                  <Kv k="Net" v={fmtMoney(s.net, { sign: true })} tone={s.net >= 0 ? 'win' : 'loss'} />
                  <Kv k="Avg win" v={fmtMoney(s.avgWin)} />
                  <Kv k="Avg loss" v={fmtMoney(s.avgLoss)} />
                </div>
              </>
            ) : (
              <div className="empty">
                <p>No closed trades in this selection.</p>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="card-title">Monthly performance</span>
            <span className="spacer" />
            {monthlyAvg !== null && (
              <span className={`hint ${monthlyAvg >= 0 ? 'pos-win' : 'pos-loss'}`}>
                avg {fmtMoney(monthlyAvg, { sign: true })}/mo
              </span>
            )}
          </div>
          <div className="card-pad">
            {monthly.length ? (
              <>
                <MonthlyChart monthly={monthly} theme={theme} />
                <div style={{ display: 'flex', gap: 18, marginTop: 10, flexWrap: 'wrap' }}>
                  <KvInline label="Best month" value={bestMonth ? `${monthLabel(bestMonth.key)} · ${fmtMoney(bestMonth.pnl, { sign: true })}` : '—'} />
                  <KvInline label="Worst month" value={worstMonth ? `${monthLabel(worstMonth.key)} · ${fmtMoney(worstMonth.pnl, { sign: true })}` : '—'} />
                </div>
              </>
            ) : (
              <div className="empty">
                <p>No monthly data yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid g-auto-lg" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-head">
            <span className="card-title">Risk / reward distribution</span>
            <span className="spacer" />
            <span className="hint">planned R:R at entry</span>
          </div>
          <div className="card-pad">
            {rrBuckets.length ? (
              <>
                <RRDistributionChart buckets={rrBuckets} theme={theme} />
                <div style={{ marginTop: 8 }}>
                  <Kv k="Average R:R" v={s.avgRR !== null ? `1 : ${s.avgRR.toFixed(2)}` : '—'} />
                  <Kv k="Realised avg R" v={s.avgR !== null ? `${s.avgR >= 0 ? '+' : ''}${s.avgR.toFixed(2)}R` : '—'} />
                </div>
              </>
            ) : (
              <div className="empty">
                <p>Set stop loss and take profit to see the distribution.</p>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="card-title">Daily trade distribution</span>
            <span className="spacer" />
            <div className="tabs">
              <button className={weekMode === 'count' ? 'active' : ''} onClick={() => setWeekMode('count')}>
                Count
              </button>
              <button className={weekMode === 'pnl' ? 'active' : ''} onClick={() => setWeekMode('pnl')}>
                P&amp;L
              </button>
            </div>
          </div>
          <div className="card-pad">
            <WeekdayChart data={weekdays} mode={weekMode} theme={theme} />
            <div className="hint" style={{ marginTop: 8, textAlign: 'center' }}>
              trades opened per weekday
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="card-title">Performance breakdown</span>
          <span className="spacer" />
          <div className="tabs">
            <button className={breakdown === 'instrument' ? 'active' : ''} onClick={() => setBreakdown('instrument')}>
              Instrument
            </button>
            <button className={breakdown === 'timeframe' ? 'active' : ''} onClick={() => setBreakdown('timeframe')}>
              Timeframe
            </button>
          </div>
        </div>
        <div className="card-pad" style={{ paddingTop: 8 }}>
          {breakdown === 'instrument' ? (
            <BreakdownList rows={instruments} theme={theme} kind="instrument" />
          ) : (
            <BreakdownList rows={timeframes} theme={theme} kind="timeframe" />
          )}
        </div>
      </div>

      {/* R-multiple table */}
      <div className="card">
        <div className="card-head">
          <span className="card-title">R-multiple summary</span>
          <span className="spacer" />
          <span className="hint">outcome measured in units of risk</span>
        </div>
        <div className="card-pad">
          <div className="grid g-auto">
            <Tile label="Average" value={s.avgR !== null ? `${s.avgR >= 0 ? '+' : ''}${s.avgR.toFixed(2)}R` : '—'} tone={s.avgR >= 0 ? 'win' : 'loss'} />
            <Tile label="Best" value={s.rMultiples.length ? `${Math.max(...s.rMultiples).toFixed(2)}R` : '—'} tone="win" />
            <Tile label="Worst" value={s.rMultiples.length ? `${Math.min(...s.rMultiples).toFixed(2)}R` : '—'} tone="loss" />
            <Tile
              label="≥ 1R trades"
              value={
                s.rMultiples.length
                  ? `${((s.rMultiples.filter((r) => r >= 1).length / s.rMultiples.length) * 100).toFixed(0)}%`
                  : '—'
              }
            />
            <Tile label="Expectancy" value={fmtMoney(s.expectancy, { sign: true })} tone={s.expectancy >= 0 ? 'win' : 'loss'} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Kv({ k, v, tone }) {
  return (
    <div className="kv">
      <span className="kv-key">{k}</span>
      <span className={`kv-val ${tone === 'win' ? 'pos-win' : tone === 'loss' ? 'pos-loss' : ''}`}>{v}</span>
    </div>
  );
}

function KvInline({ label, value }) {
  return (
    <div style={{ fontSize: 12 }}>
      <span className="faint">{label}: </span>
      <span className="num" style={{ fontWeight: 650 }}>
        {value}
      </span>
    </div>
  );
}

function Tile({ label, value, tone }) {
  const color = tone === 'win' ? 'var(--win)' : tone === 'loss' ? 'var(--loss)' : undefined;
  return (
    <div style={{ display: 'grid', gap: 3 }}>
      <span className="stat-label">{label}</span>
      <span className="num" style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-.02em', color }}>
        {value}
      </span>
    </div>
  );
}
