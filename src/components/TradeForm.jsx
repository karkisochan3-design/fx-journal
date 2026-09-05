import React, { useEffect, useMemo, useState } from 'react';
import {
  TIMEFRAMES,
  EXIT_TYPES,
  computeTrade,
  instrumentDefaults,
  fmtMoney,
  fmtNum,
  toInputValue,
} from '../lib/calc.mjs';
import { IconTarget, IconSpark } from './Icons.jsx';

const COMMON = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD',
  'EUR/GBP', 'EUR/JPY', 'GBP/JPY', 'AUD/JPY', 'XAU/USD', 'XAG/USD',
  'US30', 'NAS100', 'SPX500', 'GER40', 'BTC/USD', 'ETH/USD',
];

const empty = {
  instrument: '',
  direction: 'long',
  entry_time: toInputValue(),
  entry_price: '',
  entry_reason: '',
  timeframe: '1H',
  lot_size: '1',
  exit_time: toInputValue(),
  exit_price: '',
  exit_type: 'Manual',
  exit_reason: '',
  stop_loss: '',
  take_profit: '',
  pip_size: '',
  pip_value: '',
  fees: '0',
  notes: '',
  tags: '',
  status: 'open',
};

const fromTrade = (t) => ({
  ...empty,
  ...Object.fromEntries(
    Object.keys(empty).map((k) => [k, t?.[k] ?? empty[k]])
  ),
  ...(t?.id ? { id: t.id } : {}),
  entry_time: t?.entry_time ? String(t.entry_time).slice(0, 16) : toInputValue(),
  exit_time: t?.exit_time ? String(t.exit_time).slice(0, 16) : toInputValue(),
  pip_size: t?.pip_size ?? '',
  pip_value: t?.pip_value ?? '',
});

export default function TradeForm({ trade, accountSize, onSave, onCancel, onSaved }) {
  const editing = Boolean(trade?.id);
  const [form, setForm] = useState(() => fromTrade(trade));
  const [pipTouched, setPipTouched] = useState(Boolean(trade?.pip_size));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const defaults = useMemo(() => instrumentDefaults(form.instrument), [form.instrument]);

  // auto-fill pip defaults as the symbol is typed (unless the user overrode them)
  useEffect(() => {
    if (pipTouched) return;
    setForm((f) => ({ ...f, pip_size: defaults.pipSize, pip_value: defaults.pipValue }));
  }, [defaults.pipSize, defaults.pipValue, pipTouched]);

  const d = useMemo(() => computeTrade(form), [form]);
  const closing = form.status === 'closed' || Boolean(form.exit_price);

  const set = (k) => (e) => {
    const v = e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
  };
  const setVal = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  /* keep exit time sensible when flipping to closed */
  useEffect(() => {
    if (form.status === 'closed' && !form.exit_time) setVal('exit_time', toInputValue());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.status]);

  /* ---- risk-based position sizing ---- */
  const riskPctOfAccount = accountSize > 0 && d.riskAmount ? (d.riskAmount / accountSize) * 100 : null;

  const sizeToRisk = (pct) => {
    if (!d.riskPips || !accountSize) return;
    const target = (accountSize * pct) / 100;
    const lots = target / (d.riskPips * (d.pipValue || defaults.pipValue));
    setVal('lot_size', String(Math.max(0.01, Math.round(lots * 100) / 100)));
  };

  const suggestSLTP = (rr) => {
    const entry = Number(form.entry_price);
    if (!entry || !d.pipSize) return;
    const slPips = Math.max(8, Math.round(d.pipSize === 0.01 ? 25 : 20));
    const sign = form.direction === 'short' ? 1 : -1;
    const dp = decimalsFor(form.instrument);
    setVal('stop_loss', (entry + sign * slPips * d.pipSize).toFixed(dp));
    setVal('take_profit', (entry - sign * slPips * rr * d.pipSize).toFixed(dp));
  };

  async function submit(e) {
    e?.preventDefault();
    setError('');
    if (!form.instrument.trim()) return setError('Instrument is required (e.g. EUR/USD).');
    if (!form.entry_time) return setError('Entry date & time is required.');
    if (closing && !form.exit_time) return setError('Exit date & time is required for a closed trade.');
    if (closing && form.exit_price === '') return setError('Exit price is required for a closed trade.');

    const payload = {
      ...form,
      instrument: form.instrument.trim().toUpperCase(),
      status: closing ? 'closed' : 'open',
      exit_time: closing ? form.exit_time : null,
      exit_price: closing ? form.exit_price : null,
      exit_type: closing ? form.exit_type : null,
      exit_reason: closing ? form.exit_reason : null,
      fees: form.fees === '' ? 0 : Number(form.fees),
    };

    setSaving(true);
    try {
      await onSave(payload);
      onSaved?.();
    } catch (err) {
      setError(err.message || 'Could not save trade.');
      setSaving(false);
    }
  }

  return (
    <form className="page" onSubmit={submit}>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.85fr) minmax(300px, 1fr)', alignItems: 'start' }}>
        {/* ---------------- form ---------------- */}
        <div className="card card-pad">
          <div className="form-grid">
            <div className="section-title">Setup</div>

            <div className="field col-4">
              <label htmlFor="instrument">Instrument</label>
              <input
                id="instrument"
                className="input"
                list="symbols"
                placeholder="EUR/USD"
                autoComplete="off"
                value={form.instrument}
                onChange={(e) => setVal('instrument', e.target.value.toUpperCase())}
                style={{ fontWeight: 600, letterSpacing: '.02em' }}
              />
              <datalist id="symbols">
                {COMMON.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              <span className="hint">
                pip size {d.pipSize} · ${d.pipValue}/pip per 1.00 lot
              </span>
            </div>

            <div className="field col-4">
              <label>Direction</label>
              <div className="seg" role="group">
                <button
                  type="button"
                  data-dir="long"
                  className={form.direction === 'long' ? 'active' : ''}
                  onClick={() => setVal('direction', 'long')}
                >
                  Long / Buy
                </button>
                <button
                  type="button"
                  data-dir="short"
                  className={form.direction === 'short' ? 'active' : ''}
                  onClick={() => setVal('direction', 'short')}
                >
                  Short / Sell
                </button>
              </div>
            </div>

            <div className="field col-4">
              <label htmlFor="timeframe">Timeframe</label>
              <select id="timeframe" className="select" value={form.timeframe} onChange={set('timeframe')}>
                {TIMEFRAMES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="field col-6">
              <label htmlFor="entry_time">Entry date &amp; time</label>
              <input id="entry_time" type="datetime-local" className="input num-input" value={form.entry_time} onChange={set('entry_time')} />
            </div>

            <div className="field col-3">
              <label htmlFor="entry_price">Entry price</label>
              <input
                id="entry_price"
                type="number"
                step="any"
                inputMode="decimal"
                className="input num-input"
                placeholder="1.08540"
                value={form.entry_price}
                onChange={set('entry_price')}
              />
            </div>

            <div className="field col-3">
              <label htmlFor="lot_size">Lot size</label>
              <input
                id="lot_size"
                type="number"
                step="0.01"
                inputMode="decimal"
                className="input num-input"
                placeholder="1.00"
                value={form.lot_size}
                onChange={set('lot_size')}
              />
              {accountSize > 0 && (
                <span className="hint" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span>risk {riskPctOfAccount !== null ? `${riskPctOfAccount.toFixed(2)}%` : '—'}</span>
                  <span className="faint">·</span>
                  {[0.5, 1, 2].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => sizeToRisk(p)}
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--accent-text)',
                        background: 'var(--accent-soft)',
                        padding: '1px 6px',
                        borderRadius: 6,
                      }}
                      title={`Size the position so risk = ${p}% of account`}
                    >
                      {p}%
                    </button>
                  ))}
                </span>
              )}
            </div>

            <div className="field col-12">
              <label htmlFor="entry_reason">Entry reason / setup</label>
              <textarea
                id="entry_reason"
                className="textarea"
                placeholder="Why did you take this trade? (structure, liquidity, confirmation…)"
                value={form.entry_reason}
                onChange={set('entry_reason')}
                style={{ minHeight: 62 }}
              />
            </div>

            {/* ---------------- risk ---------------- */}
            <div className="section-title">
              Risk management
              {form.entry_price && (
                <button
                  type="button"
                  onClick={() => suggestSLTP(2)}
                  style={{
                    textTransform: 'none',
                    letterSpacing: 0,
                    fontWeight: 600,
                    fontSize: 11,
                    color: 'var(--accent-text)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <IconSpark size={12} /> suggest 1:2
                </button>
              )}
            </div>

            <div className="field col-3">
              <label htmlFor="stop_loss">Stop loss</label>
              <input
                id="stop_loss"
                type="number"
                step="any"
                inputMode="decimal"
                className="input num-input"
                placeholder="1.08200"
                value={form.stop_loss}
                onChange={set('stop_loss')}
              />
              <span className="hint">{d.riskPips !== null ? `${fmtNum(d.riskPips, 1)} pips` : '—'}</span>
            </div>

            <div className="field col-3">
              <label htmlFor="take_profit">Take profit</label>
              <input
                id="take_profit"
                type="number"
                step="any"
                inputMode="decimal"
                className="input num-input"
                placeholder="1.09200"
                value={form.take_profit}
                onChange={set('take_profit')}
              />
              <span className="hint">{d.rewardPips !== null ? `${fmtNum(d.rewardPips, 1)} pips` : '—'}</span>
            </div>

            <div className="field col-3">
              <label htmlFor="pip_value">$ per pip / lot</label>
              <input
                id="pip_value"
                type="number"
                step="any"
                inputMode="decimal"
                className="input num-input"
                value={form.pip_value}
                onChange={(e) => {
                  setPipTouched(true);
                  set('pip_value')(e);
                }}
              />
            </div>

            <div className="field col-3">
              <label htmlFor="fees">Fees / commission</label>
              <div className="input-with-prefix">
                <span className="pfx">$</span>
                <input
                  id="fees"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  className="input num-input"
                  value={form.fees}
                  onChange={set('fees')}
                />
              </div>
            </div>

            {/* ---------------- exit ---------------- */}
            <div className="section-title">Exit</div>

            <div className="field col-12">
              <div className="seg" role="group" style={{ width: 'fit-content' }}>
                <button
                  type="button"
                  className={form.status === 'open' ? '' : 'active'}
                  data-dir="long"
                  onClick={() => setVal('status', 'closed')}
                >
                  Closed
                </button>
                <button
                  type="button"
                  data-dir="short"
                  className={form.status === 'open' ? 'active' : ''}
                  onClick={() => setVal('status', 'open')}
                >
                  Still open
                </button>
              </div>
            </div>

            {form.status === 'closed' && (
              <>
                <div className="field col-4">
                  <label htmlFor="exit_time">Exit date &amp; time</label>
                  <input id="exit_time" type="datetime-local" className="input num-input" value={form.exit_time} onChange={set('exit_time')} />
                </div>
                <div className="field col-4">
                  <label htmlFor="exit_price">Exit price</label>
                  <input
                    id="exit_price"
                    type="number"
                    step="any"
                    inputMode="decimal"
                    className="input num-input"
                    placeholder="1.09100"
                    value={form.exit_price}
                    onChange={set('exit_price')}
                  />
                  <span className="hint">
                    {d.resultPips !== null ? `${d.resultPips > 0 ? '+' : ''}${fmtNum(d.resultPips, 1)} pips` : '—'}
                  </span>
                </div>
                <div className="field col-4">
                  <label htmlFor="exit_type">Exit type</label>
                  <select id="exit_type" className="select" value={form.exit_type} onChange={set('exit_type')}>
                    {EXIT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                {form.exit_type === 'Manual' && (
                  <div className="field col-12">
                    <label htmlFor="exit_reason">Reason for manual exit</label>
                    <input
                      id="exit_reason"
                      className="input"
                      placeholder="e.g. structure broke, took partials, news risk"
                      value={form.exit_reason}
                      onChange={set('exit_reason')}
                    />
                  </div>
                )}
              </>
            )}

            {/* ---------------- notes ---------------- */}
            <div className="section-title">Notes</div>

            <div className="field col-8">
              <label htmlFor="notes">Review notes</label>
              <textarea
                id="notes"
                className="textarea"
                placeholder="What went well, what to improve, mistakes…"
                value={form.notes}
                onChange={set('notes')}
              />
            </div>
            <div className="field col-4">
              <label htmlFor="tags">Tags</label>
              <input
                id="tags"
                className="input"
                placeholder="trend, breakout"
                value={form.tags}
                onChange={set('tags')}
              />
              <span className="hint">comma separated</span>
            </div>
          </div>
        </div>

        {/* ---------------- live panel ---------------- */}
        <div className="live-panel">
          <div className="card card-pad" style={{ display: 'grid', gap: 4 }}>
            <div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconTarget size={13} /> Live risk / reward
            </div>

            <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1.2 }}>
              {d.rr !== null ? `1 : ${fmtNum(d.rr, 2)}` : '—'}
            </div>
            <div className="stat-meta">
              {d.rr !== null
                ? d.rr >= 2
                  ? 'Healthy reward-to-risk'
                  : d.rr >= 1
                  ? 'Acceptable — below 1:2 is a grind'
                  : 'Warning: risk exceeds reward'
                : 'Enter entry, stop loss and take profit'}
            </div>

            <div className="rr-meter" style={{ marginTop: 12 }}>
              <div className="rr-bar">
                <span
                  className="risk"
                  style={{ width: `${d.rr ? 100 / (1 + d.rr) : 50}%` }}
                  title="Risk"
                />
                <span
                  className="reward"
                  style={{ width: `${d.rr ? (100 * d.rr) / (1 + d.rr) : 50}%`, opacity: d.rr ? 1 : 0.25 }}
                  title="Reward"
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span className="pos-loss">risk {fmtMoney(d.riskAmount)}</span>
                <span className="pos-win">reward {fmtMoney(d.rewardAmount)}</span>
              </div>
            </div>

            <div style={{ marginTop: 6 }}>
              <Row k="Risk" v={`${fmtNum(d.riskPips, 1)} pips`} />
              <Row k="Reward" v={`${fmtNum(d.rewardPips, 1)} pips`} />
              <Row k="Risk $" v={fmtMoney(d.riskAmount)} tone="loss" />
              <Row k="Potential reward $" v={fmtMoney(d.rewardAmount)} tone="win" />
              <Row k="$ per pip" v={fmtMoney(d.perPip)} />
              {accountSize > 0 && (
                <Row k="Risk % of account" v={riskPctOfAccount !== null ? `${riskPctOfAccount.toFixed(2)}%` : '—'} />
              )}
            </div>
          </div>

          <div
            className="card card-pad"
            style={{
              display: 'grid',
              gap: 4,
              borderColor: d.pnl === null ? 'var(--border)' : d.pnl > 0 ? 'color-mix(in srgb, var(--win) 40%, var(--border))' : 'color-mix(in srgb, var(--loss) 40%, var(--border))',
            }}
          >
            <div className="stat-label">Realised P&amp;L</div>
            <div
              className="num"
              style={{
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: '-.03em',
                lineHeight: 1.2,
                color: d.pnl === null ? 'var(--text-faint)' : d.pnl > 0 ? 'var(--win)' : d.pnl < 0 ? 'var(--loss)' : 'var(--text)',
              }}
            >
              {closing ? fmtMoney(d.pnl, { sign: true }) : 'Open'}
            </div>
            <div style={{ display: 'grid', gap: 0, marginTop: 4 }}>
              <Row k="Result" v={d.resultPips !== null ? `${d.resultPips > 0 ? '+' : ''}${fmtNum(d.resultPips, 1)} pips` : '—'} />
              <Row k="Return on risk" v={d.pnlPct !== null ? `${d.pnlPct > 0 ? '+' : ''}${fmtNum(d.pnlPct, 1)}%` : '—'} />
              <Row
                k="R multiple"
                v={d.pnl !== null && d.riskAmount ? `${d.pnl / d.riskAmount > 0 ? '+' : ''}${fmtNum(d.pnl / d.riskAmount, 2)}R` : '—'}
              />
              {accountSize > 0 && (
                <Row k="% of account" v={d.pnl !== null ? `${((d.pnl / accountSize) * 100).toFixed(2)}%` : '—'} />
              )}
            </div>
          </div>

          {error && (
            <div
              className="card card-pad"
              style={{ borderColor: 'var(--loss)', color: 'var(--loss)', fontSize: 13 }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, height: 42 }} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Update trade' : 'Save trade'}
            </button>
            <button type="button" className="btn" style={{ height: 42 }} onClick={onCancel}>
              Cancel
            </button>
          </div>
          <p className="hint" style={{ textAlign: 'center' }}>
            Press <kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>Enter</kbd> to save quickly
          </p>
        </div>
      </div>
    </form>
  );
}

function Row({ k, v, tone }) {
  return (
    <div className="kv">
      <span className="kv-key">{k}</span>
      <span className={`kv-val ${tone === 'win' ? 'pos-win' : tone === 'loss' ? 'pos-loss' : ''}`}>{v}</span>
    </div>
  );
}

function decimalsFor(symbol = '') {
  const s = symbol.toUpperCase();
  if (s.includes('JPY')) return 3;
  if (s.startsWith('XAU') || s.startsWith('XAG')) return 2;
  if (s.includes('US30') || s.includes('NAS') || s.includes('SPX') || s.includes('GER')) return 2;
  if (s.includes('BTC') || s.includes('ETH')) return 2;
  return 5;
}

/* Cmd/Ctrl+Enter to submit from anywhere on the page */
export function useQuickSubmit(onSubmit) {
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        onSubmit();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onSubmit]);
}
