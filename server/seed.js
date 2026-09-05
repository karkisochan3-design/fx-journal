/**
 * Deterministic demo data so charts are populated on first run.
 * Uses the same maths as src/lib/calc.js.
 */

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20240917);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const between = (a, b) => a + rnd() * (b - a);
const round = (v, d) => Number(v.toFixed(d));

const MARKETS = [
  { sym: 'EUR/USD', price: 1.085, dp: 5, pip: 0.0001, pv: 10 },
  { sym: 'GBP/USD', price: 1.272, dp: 5, pip: 0.0001, pv: 10 },
  { sym: 'USD/JPY', price: 157.4, dp: 3, pip: 0.01, pv: 10 },
  { sym: 'AUD/USD', price: 0.662, dp: 5, pip: 0.0001, pv: 10 },
  { sym: 'USD/CAD', price: 1.368, dp: 5, pip: 0.0001, pv: 10 },
  { sym: 'XAU/USD', price: 2380.0, dp: 2, pip: 0.01, pv: 1 },
  { sym: 'USD/CHF', price: 0.884, dp: 5, pip: 0.0001, pv: 10 },
];

const TIMEFRAMES = ['15M', '1H', '4H', 'Daily', 'Weekly'];
const SETUPS = [
  'Break of Asian range with HTF structure alignment',
  'Liquidity sweep of previous low, then 1H displacement',
  'FVG retest on 4H, bullish order block held',
  'Daily demand zone + bullish divergence on RSI',
  'Bearish engulfing at supply, lower-high confirmed',
  'Trend continuation pullback to 20 EMA',
  'News-driven momentum continuation (CPI)',
  'Double top at key resistance, rejection wick',
];
const EXIT_NOTES = [
  'Closed early — structure broke against thesis',
  'Took partials at 1R, remainder at TP',
  'Closed before weekend risk event',
  'Moved to breakeven after 1R, stopped out flat',
  'Scaled out manually, momentum fading',
];

function buildTrade(dayOffset) {
  const m = pick(MARKETS);
  const dir = rnd() > 0.45 ? 'long' : 'short';
  const entry = round(m.price * between(0.985, 1.015), m.dp);
  const slPips = round(between(12, 38), 0);
  const rrTarget = round(between(1.4, 3.6), 2);
  const tpPips = slPips * rrTarget;

  const sign = dir === 'long' ? 1 : -1;
  const sl = round(entry - sign * slPips * m.pip, m.dp);
  const tp = round(entry + sign * tpPips * m.pip, m.dp);

  const lots = round(pick([0.25, 0.5, 0.5, 1, 1, 1.5, 2]), 2);
  const riskPips = round(Math.abs(entry - sl) / m.pip, 1);
  const rewardPips = round(Math.abs(tp - entry) / m.pip, 1);
  const rr = round(rewardPips / riskPips, 2);
  const riskAmount = round(riskPips * m.pv * lots, 2);
  const rewardAmount = round(rewardPips * m.pv * lots, 2);

  const hour = Math.floor(between(7, 20));
  const minute = pick([0, 7, 15, 23, 30, 45, 52]);
  const now = Date.now();
  const entryDate = new Date();
  entryDate.setDate(entryDate.getDate() - dayOffset);
  entryDate.setHours(hour, minute, 0, 0);
  if (entryDate.getTime() > now) entryDate.setTime(now - between(1, 6) * 3600 * 1000);

  // leave a handful of recent trades open so the "open positions" flow is visible
  const closed = dayOffset > 2 ? rnd() > 0.04 : rnd() > 0.55;
  const win = rnd() < 0.54;
  const manual = closed && rnd() < 0.22;

  let exitPrice = null;
  let exitType = null;
  let exitReason = null;
  let pnl = null;
  let pnlPct = null;
  let result = null;

  if (closed) {
    const exitDate = new Date(Math.min(entryDate.getTime() + between(0.5, 42) * 3600 * 1000, now));
    if (manual) {
      exitType = 'Manual';
      exitReason = pick(EXIT_NOTES);
      // manual closes skew slightly positive: between -0.4R and +1.6R
      const rMultiple = between(-0.4, 1.6);
      exitPrice = round(entry + sign * rMultiple * slPips * m.pip, m.dp);
    } else if (win) {
      exitType = 'TP';
      exitPrice = tp;
    } else {
      exitType = 'SL';
      exitPrice = sl;
    }
    const pnlPips = round((sign * (exitPrice - entry)) / m.pip, 1);
    const fees = round(lots * 1.2, 2);
    pnl = round(pnlPips * m.pv * lots - fees, 2);
    pnlPct = round((pnl / riskAmount) * 100, 2);
    result = pnl > 0.5 ? 'win' : pnl < -0.5 ? 'loss' : 'breakeven';

    return {
      instrument: m.sym,
      direction: dir,
      entry_time: toLocal(entryDate),
      entry_price: entry,
      entry_reason: pick(SETUPS),
      timeframe: pick(TIMEFRAMES),
      lot_size: lots,
      exit_time: toLocal(exitDate),
      exit_price: exitPrice,
      exit_type: exitType,
      exit_reason: exitReason,
      stop_loss: sl,
      take_profit: tp,
      pip_size: m.pip,
      pip_value: m.pv,
      status: 'closed',
      result,
      pnl,
      pnl_pct: pnlPct,
      rr_ratio: rr,
      risk_amount: riskAmount,
      reward_amount: rewardAmount,
      risk_pips: riskPips,
      reward_pips: rewardPips,
      fees,
      notes: rnd() < 0.35 ? pick(['Followed plan', 'Sized correctly', 'Entered late — review', 'Good patience on entry']) : null,
      tags: pick(['trend', 'reversal', 'breakout', 'range', 'news', '']),
    };
  }

  return {
    instrument: m.sym,
    direction: dir,
    entry_time: toLocal(entryDate),
    entry_price: entry,
    entry_reason: pick(SETUPS),
    timeframe: pick(TIMEFRAMES),
    lot_size: lots,
    stop_loss: sl,
    take_profit: tp,
    pip_size: m.pip,
    pip_value: m.pv,
    status: 'open',
    rr_ratio: rr,
    risk_amount: riskAmount,
    reward_amount: rewardAmount,
    risk_pips: riskPips,
    reward_pips: rewardPips,
    notes: null,
    tags: pick(['trend', 'reversal', 'breakout', '']),
  };
}

function toLocal(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const seed = [];
for (let i = 0; i < 64; i++) {
  // spread across the last ~150 days, denser recently
  const offset = Math.floor(Math.pow(rnd(), 1.35) * 150);
  seed.push(buildTrade(offset));
}
seed.sort((a, b) => (a.entry_time < b.entry_time ? 1 : -1));

// keep the 3 most recent trades open so the open-positions + close-trade flow is visible
let opened = 0;
for (const t of seed) {
  if (opened >= 3) break;
  if (t.status !== 'closed') continue;
  t.status = 'open';
  t.exit_time = null;
  t.exit_price = null;
  t.exit_type = null;
  t.exit_reason = null;
  t.result = null;
  t.pnl = null;
  t.pnl_pct = null;
  t.fees = 0;
  opened += 1;
}

module.exports = seed;
