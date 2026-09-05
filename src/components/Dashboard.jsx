import React from 'react';
import StatCard, { MiniBars, WinRateDial } from './StatCard.jsx';
import { EquityChart } from './charts.jsx';
import TradeTable from './TradeTable.jsx';
import { computeStats } from '../lib/stats.js';
import { fmtMoney, fmtNum } from '../lib/calc.mjs';

export default function Dashboard({ trades, accountSize, theme, onEdit, onClose, onDelete, onNew }) {
  const s = computeStats(trades, { accountSize });
  const netTone = s.net > 0 ? 'win' : s.net < 0 ? 'loss' : undefined;
  const recent = [...trades]
    .sort((a, b) => new Date(b.entry_time) - new Date(a.entry_time))
    .slice(0, 8);

  return (
    <div className="page">
      {/* hero row */}
      <div className="grid g-4">
        <StatCard
          hero
          label="Total P&L"
          value={fmtMoney(s.net, { sign: true })}
          tone={netTone}
          meta={
            <>
              {s.closedCount} closed trade{s.closedCount === 1 ? '' : 's'}
              {accountSize > 0 && s.roi !== null && (
                <> · {s.roi >= 0 ? '+' : ''}
                  {s.roi.toFixed(2)}% on {fmtMoney(accountSize, { digits: 0 })} account</>
              )}
            </>
          }
        />
        <StatCard
          label="Win rate"
          value={s.winRate !== null ? `${s.winRate.toFixed(1)}%` : '—'}
          meta={`${s.wins}W · ${s.losses}L${s.breakeven ? ` · ${s.breakeven}BE` : ''}`}
        >
          <MiniBars wins={s.wins} losses={s.losses} breakeven={s.breakeven} />
        </StatCard>
        <StatCard
          label="Profit factor"
          value={s.profitFactor === null ? '—' : s.profitFactor === Infinity ? '∞' : s.profitFactor.toFixed(2)}
          tone={s.profitFactor >= 1 ? 'win' : 'loss'}
          meta={`${fmtMoney(s.grossProfit)} made · ${fmtMoney(s.grossLoss)} lost`}
        />
      </div>

      {/* secondary stats */}
      <div className="grid g-auto">
        <StatCard
          label="Expectancy / trade"
          value={fmtMoney(s.expectancy, { sign: true })}
          tone={s.expectancy > 0 ? 'win' : s.expectancy < 0 ? 'loss' : undefined}
          meta={s.avgR !== null ? `avg ${s.avgR >= 0 ? '+' : ''}${s.avgR.toFixed(2)}R per trade` : '—'}
        />
        <StatCard
          label="Avg risk / reward"
          value={s.avgRR !== null ? `1 : ${s.avgRR.toFixed(2)}` : '—'}
          meta={`payoff ratio ${s.payoff ? s.payoff.toFixed(2) : '—'}`}
        />
        <StatCard label="Total trades" value={s.total} meta={`${s.openCount} open · ${s.closedCount} closed`} />
        <StatCard
          label="Avg win"
          value={fmtMoney(s.avgWin)}
          tone="win"
          meta={`avg loss ${fmtMoney(s.avgLoss)}`}
        />
        <StatCard
          label="Best trade"
          value={s.best ? fmtMoney(s.best.pnl, { sign: true }) : '—'}
          tone="win"
          meta={s.best ? `${s.best.instrument} · ${s.best.timeframe || ''}` : '—'}
        />
        <StatCard
          label="Worst trade"
          value={s.worst ? fmtMoney(s.worst.pnl, { sign: true }) : '—'}
          tone="loss"
          meta={s.worst ? `${s.worst.instrument} · ${s.worst.timeframe || ''}` : '—'}
        />
        <StatCard
          label="Max drawdown"
          value={fmtMoney(-s.maxDD)}
          tone="loss"
          meta={s.maxDDpct ? `${s.maxDDpct.toFixed(1)}% peak-to-trough` : '—'}
        />
        <StatCard
          label="Streaks"
          value={`${s.bestWinStreak} / ${s.worstLossStreak}`}
          meta="best win / worst loss run"
        />
      </div>

      {/* equity curve */}
      <div className="card">
        <div className="card-head">
          <span className="card-title">Equity curve</span>
          <span className="spacer" />
          <span className="hint">cumulative P&amp;L by trade</span>
        </div>
        <div style={{ padding: 16 }}>
          {s.curve.length ? (
            <EquityChart curve={s.curve} theme={theme} />
          ) : (
            <div className="empty" style={{ padding: 30 }}>
              <p>Close a few trades to see your equity curve.</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid g-auto-lg" style={{ alignItems: 'start' }}>
        {/* open positions */}
        <div className="card">
          <div className="card-head">
            <span className="card-title">Open positions</span>
            <span className="spacer" />
            <span className="badge badge-open">{s.openCount}</span>
          </div>
          {s.openCount === 0 ? (
            <div className="empty" style={{ padding: 34 }}>
              <p>No open trades right now.</p>
              <button className="btn btn-primary btn-sm" onClick={onNew}>
                Log a trade
              </button>
            </div>
          ) : (
            <TradeTable
              trades={trades.filter((t) => t.status === 'open')}
              onEdit={onEdit}
              onClose={onClose}
              onDelete={onDelete}
            />
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <span className="card-title">Win rate breakdown</span>
          </div>
          <div className="card-pad" style={{ display: 'grid', gap: 14 }}>
            <WinRateDial value={s.winRate} theme={theme} />
            <div>
              <Stat label="Return on risk" value={s.avgR !== null ? `${s.avgR >= 0 ? '+' : ''}${s.avgR.toFixed(2)}R` : '—'} />
              <Stat label="Total risk taken" value={fmtMoney(s.totalRisk)} />
              <Stat
                label="Avg risk per trade"
                value={s.closedCount ? fmtMoney(s.totalRisk / s.closedCount) : '—'}
              />
              {accountSize > 0 && s.avgRiskPct !== null && (
                <Stat label="Avg risk % of account" value={`${s.avgRiskPct.toFixed(2)}%`} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* recent trades */}
      <div className="card">
        <div className="card-head">
          <span className="card-title">Recent trades</span>
          <span className="spacer" />
          <a href="#/trades" className="btn btn-ghost btn-sm">
            View all →
          </a>
        </div>
        {recent.length ? (
          <TradeTable trades={recent} onEdit={onEdit} onClose={onClose} onDelete={onDelete} />
        ) : (
          <div className="empty">
            <div className="empty-icon">▤</div>
            <h3>Nothing logged yet</h3>
            <p>Start journaling and your stats will build automatically.</p>
            <button className="btn btn-primary btn-sm" onClick={onNew}>
              Log your first trade
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="kv">
      <span className="kv-key">{label}</span>
      <span className="kv-val">{value}</span>
    </div>
  );
}
