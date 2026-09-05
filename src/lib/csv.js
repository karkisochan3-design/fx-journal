export const CSV_COLUMNS = [
  'instrument', 'direction', 'entry_time', 'entry_price', 'entry_reason', 'timeframe', 'lot_size',
  'exit_time', 'exit_price', 'exit_type', 'exit_reason',
  'stop_loss', 'take_profit', 'pip_size', 'pip_value', 'fees',
  'status', 'result', 'pnl', 'pnl_pct', 'rr_ratio',
  'risk_amount', 'reward_amount', 'risk_pips', 'reward_pips',
  'notes', 'tags',
];

const esc = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCSV(trades) {
  const header = CSV_COLUMNS.join(',');
  const rows = trades.map((t) => CSV_COLUMNS.map((c) => esc(t[c])).join(','));
  return [header, ...rows].join('\n');
}

export function downloadCSV(trades, filename = 'trading-journal.csv') {
  const blob = new Blob([toCSV(trades)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Minimal RFC-4180-ish parser that handles quoted fields with commas/newlines. */
export function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch === '\r') { /* skip */ }
    else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }

  const clean = rows.filter((r) => r.some((c) => c.trim() !== ''));
  if (!clean.length) return [];
  const [header, ...body] = clean;
  const cols = header.map((h) => h.trim().toLowerCase());
  return body
    .filter((r) => r.length >= 2)
    .map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i] ?? ''])))
    .filter((r) => r.instrument || r.entry_time);
}
