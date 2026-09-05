const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('node:url');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'journal.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS trades (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  instrument      TEXT    NOT NULL,
  direction       TEXT    NOT NULL DEFAULT 'long',   -- long | short
  entry_time      TEXT    NOT NULL,
  entry_price     REAL,
  entry_reason    TEXT,
  timeframe       TEXT,
  lot_size        REAL,

  exit_time       TEXT,
  exit_price      REAL,
  exit_type       TEXT,                              -- TP | SL | Manual
  exit_reason     TEXT,

  stop_loss       REAL,
  take_profit     REAL,
  pip_size        REAL    NOT NULL DEFAULT 0.0001,
  pip_value       REAL    NOT NULL DEFAULT 10,       -- $ per pip per standard lot

  status          TEXT    NOT NULL DEFAULT 'open',   -- open | closed
  result          TEXT,                              -- win | loss | breakeven
  pnl             REAL,
  pnl_pct         REAL,
  rr_ratio        REAL,
  risk_amount     REAL,
  reward_amount   REAL,
  risk_pips       REAL,
  reward_pips     REAL,
  fees            REAL    NOT NULL DEFAULT 0,
  notes           TEXT,
  tags            TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_trades_entry   ON trades(entry_time);
CREATE INDEX IF NOT EXISTS idx_trades_symbol  ON trades(instrument);
`);

/* ---------------------------------------------------------------
   Shared maths. The ESM module in src/lib is the single source of
   truth for pip sizing, R:R and P&L, so anything written through
   the API (UI form, CSV import, curl) is derived identically.
----------------------------------------------------------------*/
const CALC_URL = pathToFileURL(path.join(__dirname, '..', 'src', 'lib', 'calc.mjs')).href;
let CALC = null;

async function initCalc() {
  try {
    CALC = await import(CALC_URL);
  } catch (err) {
    console.warn('[api] shared calc module unavailable, storing values as sent:', err.message);
  }
}

/** Recompute every derived metric so stored data is always self-consistent. */
function derive(row) {
  if (!CALC?.computeTrade) return row;
  if (row.lot_size === null || row.lot_size === undefined) row.lot_size = 1;

  const d = CALC.computeTrade(row);
  const closed = row.status === 'closed' || row.exit_price !== null;

  row.pip_size = d.pipSize ?? 0.0001;
  row.pip_value = d.pipValue ?? 10;
  row.status = closed ? 'closed' : 'open';
  row.result = closed ? d.result : null;
  row.pnl = closed ? d.pnl : null;
  row.pnl_pct = closed ? d.pnlPct : null;
  row.rr_ratio = d.rr;
  row.risk_amount = d.riskAmount;
  row.reward_amount = d.rewardAmount;
  row.risk_pips = d.riskPips;
  row.reward_pips = d.rewardPips;
  return row;
}

/**
 * Recompute derived metrics for every stored row. Idempotent — safe to run on
 * every boot, and it repairs data written by older versions or raw SQL imports.
 */
function recomputeAll() {
  if (!CALC?.computeTrade) return 0;
  const rows = db.prepare('SELECT * FROM trades').all();
  const upd = db.prepare(`
    UPDATE trades SET
      status = @status, result = @result, pnl = @pnl, pnl_pct = @pnl_pct,
      rr_ratio = @rr_ratio, risk_amount = @risk_amount, reward_amount = @reward_amount,
      risk_pips = @risk_pips, reward_pips = @reward_pips,
      pip_size = @pip_size, pip_value = @pip_value, lot_size = @lot_size
    WHERE id = @id
  `);
  let changed = 0;
  const tx = db.transaction(() => {
    for (const r of rows) {
      const next = derive(normalize(r));
      const differs = [
        'status', 'result', 'pnl', 'pnl_pct', 'rr_ratio', 'risk_amount',
        'reward_amount', 'risk_pips', 'reward_pips', 'pip_size', 'pip_value', 'lot_size',
      ].some((k) => next[k] !== r[k]);
      if (differs) {
        upd.run({ ...next, id: r.id });
        changed += 1;
      }
    }
  });
  tx();
  return changed;
}

/* ---------- column helpers ---------- */
const COLUMNS = [
  'instrument', 'direction', 'entry_time', 'entry_price', 'entry_reason', 'timeframe', 'lot_size',
  'exit_time', 'exit_price', 'exit_type', 'exit_reason',
  'stop_loss', 'take_profit', 'pip_size', 'pip_value',
  'status', 'result', 'pnl', 'pnl_pct', 'rr_ratio',
  'risk_amount', 'reward_amount', 'risk_pips', 'reward_pips',
  'fees', 'notes', 'tags',
];

function num(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function str(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

/** Build a clean row object from incoming JSON. */
function normalize(body = {}) {
  const status = body.status === 'closed' ? 'closed' : 'open';
  const row = {
    instrument: (str(body.instrument) || '').toUpperCase(),
    direction: body.direction === 'short' ? 'short' : 'long',
    entry_time: str(body.entry_time),
    entry_price: num(body.entry_price),
    entry_reason: str(body.entry_reason),
    timeframe: str(body.timeframe),
    lot_size: num(body.lot_size),

    exit_time: status === 'closed' ? str(body.exit_time) : null,
    exit_price: status === 'closed' ? num(body.exit_price) : null,
    exit_type: status === 'closed' ? str(body.exit_type) : null,
    exit_reason: status === 'closed' ? str(body.exit_reason) : null,

    stop_loss: num(body.stop_loss),
    take_profit: num(body.take_profit),
    pip_size: num(body.pip_size),      // resolved per instrument in derive()
    pip_value: num(body.pip_value),

    status,
    result: status === 'closed' ? str(body.result) || null : null,
    pnl: status === 'closed' ? num(body.pnl) : null,
    pnl_pct: status === 'closed' ? num(body.pnl_pct) : null,
    rr_ratio: num(body.rr_ratio),
    risk_amount: num(body.risk_amount),
    reward_amount: num(body.reward_amount),
    risk_pips: num(body.risk_pips),
    reward_pips: num(body.reward_pips),
    fees: num(body.fees) ?? 0,
    notes: str(body.notes),
    tags: str(body.tags),
  };

  return derive(row);
}

module.exports = { db, DATA_DIR, COLUMNS, normalize, initCalc, recomputeAll, num, str };
