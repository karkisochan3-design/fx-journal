/* Unit tests for the trade maths + CSV helpers, and an API round-trip test. */
import { execSync } from 'node:child_process';
import { mkdtempSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const API = process.env.API || 'http://127.0.0.1:3001';
let pass = 0;
let fail = 0;

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

function t(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    pass++;
  } catch (e) {
    console.log(`  ✗ ${name} — ${e.message}`);
    fail++;
  }
}
async function ta(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    pass++;
  } catch (e) {
    console.log(`  ✗ ${name} — ${e.message}`);
    fail++;
  }
}
const eq = (actual, expected, label = '') => {
  if (actual !== expected) throw new Error(`${label} expected ${expected}, got ${actual}`);
};
const eqNear = (actual, expected, label = '') => {
  if (!near(actual, expected, 1e-6)) throw new Error(`${label} expected ${expected}, got ${actual}`);
};

/* load the pure ESM modules */
const dir = mkdtempSync(path.join(tmpdir(), 'fxj-'));
const load = (rel) => {
  const to = path.join(dir, path.basename(rel).replace(/\.js$/, '.mjs'));
  copyFileSync(new URL(`../src/lib/${rel}`, import.meta.url), to);
  return import(to);
};
const { computeTrade, instrumentDefaults, fmtMoney } = await load('calc.mjs');
const { toCSV, parseCSV, CSV_COLUMNS } = await load('csv.js');

console.log('\nPip defaults');
t('EUR/USD → 0.0001, $10', () => {
  const d = instrumentDefaults('EUR/USD');
  eqNear(d.pipSize, 0.0001, 'pipSize');
  eqNear(d.pipValue, 10, 'pipValue');
});
t('USD/JPY → 0.01, $10', () => {
  const d = instrumentDefaults('usd/jpy');
  eqNear(d.pipSize, 0.01, 'pipSize');
});
t('XAU/USD → 0.01, $1', () => {
  const d = instrumentDefaults('XAU/USD');
  eqNear(d.pipSize, 0.01, 'pipSize');
  eqNear(d.pipValue, 1, 'pipValue');
});

console.log('\nLong EUR/USD 1.1000 · SL 1.0950 · TP 1.1100 · 1.00 lot');
const long = computeTrade({
  instrument: 'EUR/USD', direction: 'long', entry_price: 1.1, stop_loss: 1.095,
  take_profit: 1.11, lot_size: 1, pip_size: 0.0001, pip_value: 10, fees: 0,
});
t('risk = 50 pips', () => eqNear(long.riskPips, 50, 'riskPips'));
t('reward = 100 pips', () => eqNear(long.rewardPips, 100, 'rewardPips'));
t('R:R = 2.00', () => eqNear(long.rr, 2, 'rr'));
t('risk $500', () => eqNear(long.riskAmount, 500, 'risk'));
t('reward $1000', () => eqNear(long.rewardAmount, 1000, 'reward'));
t('$10 per pip', () => eqNear(long.perPip, 10, 'perPip'));

const longTP = computeTrade({
  instrument: 'EUR/USD', direction: 'long', entry_price: 1.1, stop_loss: 1.095,
  take_profit: 1.11, exit_price: 1.11, lot_size: 1, pip_size: 0.0001, pip_value: 10, fees: 0,
});
t('exit at TP → +100 pips, +$1000, 2R', () => {
  eqNear(longTP.resultPips, 100, 'pips');
  eqNear(longTP.pnl, 1000, 'pnl');
  eq(longTP.result, 'win', 'result');
  eqNear(longTP.pnlPct, 200, 'pnlPct');
});
const longSL = computeTrade({
  instrument: 'EUR/USD', direction: 'long', entry_price: 1.1, stop_loss: 1.095,
  take_profit: 1.11, exit_price: 1.095, lot_size: 1, pip_size: 0.0001, pip_value: 10, fees: 0,
});
t('exit at SL → -50 pips, -$500, loss', () => {
  eqNear(longSL.resultPips, -50, 'pips');
  eqNear(longSL.pnl, -500, 'pnl');
  eq(longSL.result, 'loss', 'result');
  eqNear(longSL.pnlPct, -100, 'pnlPct');
});

console.log('\nShort USD/JPY 157.50 · SL 158.00 · TP 156.50 · 0.50 lot');
const shortJpy = computeTrade({
  instrument: 'USD/JPY', direction: 'short', entry_price: 157.5, stop_loss: 158,
  take_profit: 156.5, exit_price: 156.5, lot_size: 0.5, pip_size: 0.01, pip_value: 10, fees: 3,
});
t('risk = 50 pips', () => eqNear(shortJpy.riskPips, 50, 'riskPips'));
t('reward = 100 pips', () => eqNear(shortJpy.rewardPips, 100, 'rewardPips'));
t('R:R = 2.00', () => eqNear(shortJpy.rr, 2, 'rr'));
t('risk $250 (0.5 lots × $5/pip)', () => eqNear(shortJpy.riskAmount, 250, 'risk'));
t('hit TP → +100 pips', () => eqNear(shortJpy.resultPips, 100, 'pips'));
t('pnl = 100 pips × $5 - $3 fees = $497', () => eqNear(shortJpy.pnl, 497, 'pnl'));
t('short losing direction gives negative pips', () => {
  const bad = computeTrade({
    instrument: 'USD/JPY', direction: 'short', entry_price: 157.5, exit_price: 158.5,
    lot_size: 0.5, pip_size: 0.01, pip_value: 10,
  });
  eqNear(bad.resultPips, -100, 'pips');
  eq(bad.result, 'loss', 'result');
});

console.log('\nEdge cases');
t('no SL/TP → null rr and risk', () => {
  const d = computeTrade({ instrument: 'EUR/USD', entry_price: 1.1, exit_price: 1.11, lot_size: 1 });
  eq(d.rr, null, 'rr');
  eq(d.riskAmount, null, 'riskAmount');
  eqNear(d.pnl, 1000, 'pnl');   // 100 pips x $10/pip x 1.00 lot
});
t('breakeven exit → breakeven result', () => {
  const d = computeTrade({ instrument: 'EUR/USD', entry_price: 1.1, exit_price: 1.1, lot_size: 1, stop_loss: 1.095 });
  eq(d.result, 'breakeven', 'result');
});
t('empty strings are treated as missing', () => {
  const d = computeTrade({ instrument: 'EUR/USD', entry_price: '', exit_price: '', lot_size: '' });
  eq(d.pnl, null, 'pnl');
});
t('money formatting', () => {
  eq(fmtMoney(1234.5), '$1,234.50');
  eq(fmtMoney(-500, { sign: true }), '-$500.00');
  eq(fmtMoney(250, { sign: true }), '+$250.00');
  eq(fmtMoney(null), '—');
});

console.log('\nCSV round-trip');
t('exports and re-parses trades with commas and quotes', () => {
  const rows = [
    { instrument: 'EUR/USD', entry_reason: 'Liquidity sweep, then 1H displacement', notes: 'He said "good trade"' },
    { instrument: 'USD/JPY', entry_reason: 'FVG retest\nsecond line', notes: '' },
  ];
  const csv = toCSV(rows);
  const back = parseCSV(csv);
  eq(back.length, 2, 'row count');
  eq(back[0].instrument, 'EUR/USD', 'instrument');
  eq(back[0].entry_reason, 'Liquidity sweep, then 1H displacement', 'comma field');
  eq(back[0].notes, 'He said "good trade"', 'quoted field');
  eq(back[1].entry_reason, 'FVG retest\nsecond line', 'newline field');
});
t('header matches the documented columns', () => {
  eq(toCSV([]).trim(), CSV_COLUMNS.join(','), 'header');
});

console.log('\nAPI round-trip (create → close → update → delete)');
const now = new Date().toISOString().slice(0, 16);
let id;
await ta('create a long EUR/USD trade', async () => {
  const res = await fetch(`${API}/api/trades`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instrument: 'EUR/USD', direction: 'long', entry_time: now, entry_price: 1.1,
      stop_loss: 1.095, take_profit: 1.11, lot_size: 1, timeframe: '4H',
      entry_reason: 'unit test', pip_size: 0.0001, pip_value: 10, fees: 0, status: 'open',
    }),
  });
  const t = await res.json();
  id = t.id;
  eq(t.instrument, 'EUR/USD', 'instrument');
  eq(t.status, 'open', 'status');
  eq(t.rr_ratio, 2, 'rr_ratio derived by the server');
});

await ta('server persists risk/reward fields', async () => {
  const t = await (await fetch(`${API}/api/trades/${id}`)).json();
  eqNear(t.risk_pips, 50, 'risk_pips');
  eqNear(t.reward_pips, 100, 'reward_pips');
  eqNear(t.risk_amount, 500, 'risk_amount');
  eqNear(t.reward_amount, 1000, 'reward_amount');
  eq(t.pnl, null, 'pnl null while open');
});

await ta('close the trade at TP → +$1000 / win', async () => {
  const t = await (await fetch(`${API}/api/trades/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'closed', exit_time: now, exit_price: 1.11, exit_type: 'TP', result: 'win', pnl: 1000, pnl_pct: 200 }),
  })).json();
  eq(t.status, 'closed', 'status');
  eqNear(t.pnl, 1000, 'pnl');
  eq(t.result, 'win', 'result');
  eq(t.exit_type, 'TP', 'exit_type');
});

await ta('update notes keeps derived values', async () => {
  const t = await (await fetch(`${API}/api/trades/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes: 'moved to BE at 1R' }),
  })).json();
  eq(t.notes, 'moved to BE at 1R', 'notes');
  eqNear(t.pnl, 1000, 'pnl preserved');
  eqNear(t.risk_amount, 500, 'risk preserved');
});

await ta('rejects a trade with no instrument', async () => {
  const res = await fetch(`${API}/api/trades`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entry_time: now }),
  });
  if (res.status !== 400) throw new Error(`expected 400, got ${res.status}`);
});

await ta('delete the trade', async () => {
  await fetch(`${API}/api/trades/${id}`, { method: 'DELETE' });
  const res = await fetch(`${API}/api/trades/${id}`);
  if (res.status !== 404) throw new Error(`expected 404, got ${res.status}`);
});

await ta('bulk import accepts CSV rows', async () => {
  const before = (await (await fetch(`${API}/api/trades`)).json()).length;
  const rows = parseCSV(toCSV([
    { instrument: 'GBP/USD', direction: 'short', entry_time: now, entry_price: 1.27, lot_size: 0.5, status: 'open' },
    { instrument: 'XAU/USD', direction: 'long', entry_time: now, entry_price: 2380, lot_size: 0.1, status: 'open' },
  ]));
  await fetch(`${API}/api/trades/bulk`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rows),
  });
  const after = (await (await fetch(`${API}/api/trades`)).json()).length;
  eq(after - before, 2, 'inserted count');
  const all = await (await fetch(`${API}/api/trades`)).json();
  for (const row of all.filter((x) => ['GBP/USD', 'XAU/USD'].includes(x.instrument) && x.entry_reason === null)) {
    await fetch(`${API}/api/trades/${row.id}`, { method: 'DELETE' });
  }
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
