/* ------------------------------------------------------------------
   Trade maths. Pure functions so both the form (live) and the
   tables/analytics (derived) agree on every number.
------------------------------------------------------------------ */

/** Pip size + default $ value per pip per 1.00 standard lot (USD account). */
export function instrumentDefaults(symbol = '') {
  const s = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');

  if (s.includes('JPY')) return { pipSize: 0.01, pipValue: 10 };
  if (s.startsWith('XAU')) return { pipSize: 0.01, pipValue: 1 };   // gold: 1 lot = 100oz
  if (s.startsWith('XAG')) return { pipSize: 0.01, pipValue: 50 };   // silver: 1 lot = 5000oz
  if (s.includes('BTC') || s.includes('ETH') || s.includes('LTC'))
    return { pipSize: 1, pipValue: 1 };
  if (s.includes('US30') || s.includes('NAS100') || s.includes('SPX500') ||
      s.includes('GER40') || s.includes('UK100') || s.includes('AUS200'))
    return { pipSize: 1, pipValue: 1 };
  return { pipSize: 0.0001, pipValue: 10 };
}

export const TIMEFRAMES = ['1M', '5M', '15M', '30M', '1H', '2H', '4H', 'Daily', 'Weekly', 'Monthly'];
export const EXIT_TYPES = ['TP', 'SL', 'Manual', 'Trailing Stop', 'Margin/Stop Out'];

const n = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};
const r = (v, d = 2) => (v === null || v === undefined || !Number.isFinite(v) ? null : Number(v.toFixed(d)));

/**
 * @param {object} t raw trade fields
 * @returns {object} derived metrics
 */
export function computeTrade(t) {
  const entry = n(t.entry_price);
  const sl = n(t.stop_loss);
  const tp = n(t.take_profit);
  const exit = n(t.exit_price);
  const lots = n(t.lot_size) ?? 1;
  const pipSize = n(t.pip_size) || instrumentDefaults(t.instrument).pipSize;
  const pipValue = n(t.pip_value) ?? instrumentDefaults(t.instrument).pipValue;
  const dir = t.direction === 'short' ? -1 : 1;
  const fees = n(t.fees) || 0;

  const toPips = (a, b) => (a === null || b === null ? null : Math.abs(a - b) / pipSize);

  const riskPips = r(toPips(entry, sl), 1);
  const rewardPips = r(toPips(entry, tp), 1);
  const rr = riskPips && rewardPips ? r(rewardPips / riskPips, 2) : null;

  const perPip = pipValue * lots;                        // $ per 1 pip move
  const riskAmount = riskPips !== null ? r(riskPips * perPip, 2) : null;
  const rewardAmount = rewardPips !== null ? r(rewardPips * perPip, 2) : null;

  let pnl = null;
  let pnlPct = null;
  let result = null;
  let resultPips = null;

  if (exit !== null && entry !== null) {
    resultPips = r((dir * (exit - entry)) / pipSize, 1);
    pnl = r(resultPips * perPip - fees, 2);
    pnlPct = riskAmount ? r((pnl / riskAmount) * 100, 2) : null;
    if (pnl > 0.009) result = 'win';
    else if (pnl < -0.009) result = 'loss';
    else result = 'breakeven';
  }

  return {
    riskPips, rewardPips, rr, riskAmount, rewardAmount,
    resultPips, pnl, pnlPct, result, perPip, pipSize, pipValue,
  };
}

/* ------------------------- formatting ------------------------- */

export const fmtMoney = (v, { sign = false, digits = 2 } = {}) => {
  const n = Number(v);
  if (v === null || v === undefined || !Number.isFinite(n)) return '—';
  const body = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  const prefix = n < 0 ? '-' : sign ? '+' : '';
  return `${prefix}$${body}`;
};

export const fmtNum = (v, d = 2) =>
  v === null || v === undefined || !Number.isFinite(Number(v)) ? '—' : Number(v).toFixed(d);

export const fmtPct = (v, d = 1) =>
  v === null || v === undefined || !Number.isFinite(Number(v)) ? '—' : `${Number(v) > 0 ? '+' : ''}${Number(v).toFixed(d)}%`;

export function fmtDate(v, withTime = true) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: '2-digit' });
  if (!withTime) return date;
  return `${date} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

export function toInputValue(d = new Date()) {
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const monthKey = (v) => {
  const d = new Date(v);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const monthLabel = (key) => {
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
};

/** ISO weekday: 1 = Monday … 7 = Sunday */
export const weekdayOf = (v) => {
  const d = new Date(v);
  return d.getDay() === 0 ? 7 : d.getDay();
};

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
