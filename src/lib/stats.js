import { monthKey, monthLabel, weekdayOf, WEEKDAYS } from './calc.mjs';

const sum = (arr, f) => arr.reduce((a, x) => a + (f(x) || 0), 0);
const avg = (arr, f) => (arr.length ? sum(arr, f) / arr.length : null);

/**
 * Compute every dashboard/analytics metric from a list of trades.
 * @param {Array} trades   filtered trades
 * @param {object} opts    { accountSize }
 */
export function computeStats(trades, { accountSize = 0 } = {}) {
  const closed = trades.filter((t) => t.status === 'closed' && typeof t.pnl === 'number');
  const open = trades.filter((t) => t.status !== 'closed');

  const wins = closed.filter((t) => t.pnl > 0);
  const losses = closed.filter((t) => t.pnl < 0);
  const breakeven = closed.filter((t) => t.pnl === 0);

  const grossProfit = sum(wins, (t) => t.pnl);
  const grossLoss = Math.abs(sum(losses, (t) => t.pnl));
  const net = grossProfit - grossLoss;

  const winRate = closed.length ? (wins.length / closed.length) * 100 : null;
  const avgWin = avg(wins, (t) => t.pnl);
  const avgLoss = avg(losses, (t) => Math.abs(t.pnl));
  const payoff = avgWin && avgLoss ? avgWin / avgLoss : null;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : null;

  // expectancy in $ and in R
  const rMultiples = closed
    .filter((t) => t.risk_amount > 0)
    .map((t) => t.pnl / t.risk_amount);
  const avgR = avg(rMultiples, (x) => x);
  const expectancy = closed.length ? net / closed.length : null;

  // streaks (chronological, oldest → newest)
  const chronological = [...closed].sort(
    (a, b) => new Date(a.exit_time || a.entry_time) - new Date(b.exit_time || b.entry_time)
  );
  let curStreak = 0;
  let curType = null;
  let bestWinStreak = 0;
  let worstLossStreak = 0;
  for (const t of chronological) {
    const type = t.pnl > 0 ? 'W' : t.pnl < 0 ? 'L' : 'B';
    if (type === curType && type !== 'B') curStreak += 1;
    else {
      curType = type;
      curStreak = type === 'B' ? 0 : 1;
    }
    if (type === 'W') bestWinStreak = Math.max(bestWinStreak, curStreak);
    if (type === 'L') worstLossStreak = Math.max(worstLossStreak, curStreak);
  }

  const sorted = [...closed].sort((a, b) => b.pnl - a.pnl);
  const best = sorted[0] || null;
  const worst = sorted[sorted.length - 1] || null;

  // max drawdown on the equity curve
  const curve = equityCurve(chronological);
  let peak = -Infinity;
  let maxDD = 0;
  let maxDDpct = 0;
  for (const p of curve) {
    peak = Math.max(peak, p.cumulative);
    const dd = peak - p.cumulative;
    if (dd > maxDD) {
      maxDD = dd;
      maxDDpct = peak > 0 ? (dd / peak) * 100 : 0;
    }
  }

  const totalRisk = sum(closed, (t) => t.risk_amount);
  const avgRR = avg(closed.filter((t) => t.rr_ratio), (t) => t.rr_ratio);
  const avgRiskPct = accountSize > 0 ? (avg(closed, (t) => t.risk_amount) / accountSize) * 100 : null;

  return {
    total: trades.length,
    closedCount: closed.length,
    openCount: open.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: breakeven.length,
    winRate,
    net,
    grossProfit,
    grossLoss,
    avgWin,
    avgLoss,
    payoff,
    profitFactor,
    expectancy,
    avgR,
    best,
    worst,
    bestWinStreak,
    worstLossStreak,
    maxDD,
    maxDDpct,
    totalRisk,
    avgRR,
    avgRiskPct,
    roi: accountSize > 0 ? (net / accountSize) * 100 : null,
    curve,
    rMultiples,
  };
}

/** Cumulative P&L per closed trade (chronological). */
export function equityCurve(closedChronological) {
  let cum = 0;
  return closedChronological.map((t, i) => {
    cum += t.pnl || 0;
    return {
      i: i + 1,
      date: t.exit_time || t.entry_time,
      pnl: t.pnl || 0,
      cumulative: cum,
    };
  });
}

/** Net P&L grouped by month. */
export function monthlyPerformance(trades) {
  const map = new Map();
  for (const t of trades) {
    if (t.status !== 'closed' || typeof t.pnl !== 'number') continue;
    const k = monthKey(t.exit_time || t.entry_time);
    if (!map.has(k)) map.set(k, { key: k, pnl: 0, trades: 0, wins: 0 });
    const m = map.get(k);
    m.pnl += t.pnl;
    m.trades += 1;
    if (t.pnl > 0) m.wins += 1;
  }
  return [...map.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
}

/** R:R distribution buckets. */
export function rrDistribution(trades, bucket = 0.5) {
  const buckets = new Map();
  for (const t of trades) {
    if (typeof t.rr_ratio !== 'number' || !Number.isFinite(t.rr_ratio)) continue;
    const b = Math.min(Math.floor(t.rr_ratio / bucket) * bucket, 5);
    const key = b >= 5 ? '5+' : `${b}–${(b + bucket).toFixed(1)}`;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  const order = [];
  for (let v = 0; v < 5; v += bucket) order.push(`${v}–${(v + bucket).toFixed(1)}`);
  order.push('5+');
  return order.filter((k) => buckets.has(k)).map((k) => ({ label: k, count: buckets.get(k) }));
}

/** Trade counts by weekday. */
export function weekdayCounts(trades) {
  const counts = Array(7).fill(0);
  const pnl = Array(7).fill(0);
  for (const t of trades) {
    const d = weekdayOf(t.entry_time) - 1;
    counts[d] += 1;
    if (t.status === 'closed' && typeof t.pnl === 'number') pnl[d] += t.pnl;
  }
  return WEEKDAYS.map((label, i) => ({ label, count: counts[i], pnl: pnl[i] }));
}

/** Performance breakdown by instrument. */
export function byInstrument(trades) {
  const map = new Map();
  for (const t of trades) {
    const k = t.instrument || '—';
    if (!map.has(k)) map.set(k, { instrument: k, trades: 0, closed: 0, wins: 0, pnl: 0, rr: [] });
    const m = map.get(k);
    m.trades += 1;
    if (t.status === 'closed') {
      m.closed += 1;
      m.pnl += t.pnl || 0;
      if (t.pnl > 0) m.wins += 1;
      if (typeof t.rr_ratio === 'number') m.rr.push(t.rr_ratio);
    }
  }
  return [...map.values()]
    .map((m) => ({
      ...m,
      net: m.pnl,
      winRate: m.closed ? (m.wins / m.closed) * 100 : 0,
      avgRR: m.rr.length ? m.rr.reduce((a, b) => a + b, 0) / m.rr.length : null,
    }))
    .sort((a, b) => b.pnl - a.pnl);
}

/** Performance breakdown by timeframe. */
export function byTimeframe(trades) {
  const map = new Map();
  for (const t of trades) {
    const k = t.timeframe || '—';
    if (!map.has(k)) map.set(k, { timeframe: k, trades: 0, closed: 0, wins: 0, pnl: 0 });
    const m = map.get(k);
    m.trades += 1;
    if (t.status === 'closed') {
      m.closed += 1;
      m.pnl += t.pnl || 0;
      if (t.pnl > 0) m.wins += 1;
    }
  }
  return [...map.values()]
    .map((m) => ({ ...m, net: m.pnl, winRate: m.closed ? (m.wins / m.closed) * 100 : 0 }))
    .sort((a, b) => b.pnl - a.pnl);
}
