import React from 'react';
import { TIMEFRAMES } from '../lib/calc.mjs';
import { IconSearch, IconX } from './Icons.jsx';

export const EMPTY_FILTERS = {
  q: '',
  from: '',
  to: '',
  instrument: '',
  timeframe: '',
  result: '',
  status: '',
};

export default function FilterBar({ filters, onChange, instruments, showStatus = true, resultCount }) {
  const set = (k) => (e) => onChange({ ...filters, [k]: e.target.value });

  const active = Object.entries(filters).filter(([, v]) => v && v !== 'all').length;

  return (
    <div className="card card-pad" style={{ display: 'grid', gap: 12 }}>
      <div className="filters">
        <div className="field search-field" style={{ gridColumn: 'span 1' }}>
          <label>Search</label>
          <div className="input-with-prefix">
            <span className="pfx" style={{ fontSize: 13 }}>
              <IconSearch size={13} />
            </span>
            <input
              className="input"
              placeholder="Symbol, setup, notes, tags…"
              value={filters.q}
              onChange={set('q')}
            />
          </div>
        </div>

        <div className="field">
          <label>From</label>
          <input type="date" className="input num-input" value={filters.from} onChange={set('from')} />
        </div>

        <div className="field">
          <label>To</label>
          <input type="date" className="input num-input" value={filters.to} onChange={set('to')} />
        </div>

        <div className="field">
          <label>Instrument</label>
          <select className="select" value={filters.instrument} onChange={set('instrument')}>
            <option value="">All</option>
            {instruments.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Timeframe</label>
          <select className="select" value={filters.timeframe} onChange={set('timeframe')}>
            <option value="">All</option>
            {TIMEFRAMES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {showStatus && (
          <div className="field">
            <label>Status</label>
            <select className="select" value={filters.status} onChange={set('status')}>
              <option value="">All</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        )}

        <div className="field">
          <label>Result</label>
          <select className="select" value={filters.result} onChange={set('result')}>
            <option value="">All</option>
            <option value="win">Wins</option>
            <option value="loss">Losses</option>
            <option value="breakeven">Breakeven</option>
          </select>
        </div>
      </div>

      {(active > 0 || resultCount !== undefined) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className="hint">
            {resultCount !== undefined ? `${resultCount} trade${resultCount === 1 ? '' : 's'} match` : ''}
          </span>
          {active > 0 && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => onChange(EMPTY_FILTERS)}
              style={{ marginLeft: 'auto' }}
            >
              <IconX size={13} /> Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
