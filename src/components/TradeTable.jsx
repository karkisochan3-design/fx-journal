import React, { useMemo, useState } from 'react';
import { fmtMoney, fmtNum, fmtDate } from '../lib/calc.mjs';
import { IconEdit, IconTrash, IconCheck } from './Icons.jsx';

const COLUMNS = [
  { key: 'instrument', label: 'Instrument', sort: 'instrument' },
  { key: 'entry_time', label: 'Entry', sort: 'entry_time', hideMobile: false },
  { key: 'exit_time', label: 'Exit', sort: 'exit_time', hideMobile: true },
  { key: 'timeframe', label: 'TF', sort: 'timeframe', hideMobile: true },
  { key: 'entry_price', label: 'Entry price', sort: 'entry_price', num: true, hideMobile: false },
  { key: 'exit_price', label: 'Exit price', sort: 'exit_price', num: true, hideMobile: true },
  { key: 'lot_size', label: 'Lots', sort: 'lot_size', num: true, hideMobile: true },
  { key: 'rr', label: 'R:R', sort: 'rr_ratio', num: true },
  { key: 'risk', label: 'Risk', sort: 'risk_amount', num: true, hideMobile: true },
  { key: 'pnl', label: 'P&L', sort: 'pnl', num: true },
  { key: 'r', label: 'R', sort: 'pnl_pct', num: true, hideMobile: true },
  { key: 'status', label: 'Status', sort: 'status' },
  { key: 'actions', label: '', sort: null },
];

export default function TradeTable({ trades, onEdit, onClose, onDelete, limit }) {
  const [sort, setSort] = useState({ key: 'entry_time', dir: 'desc' });

  const rows = useMemo(() => {
    const arr = [...trades];
    const { key, dir } = sort;
    arr.sort((a, b) => {
      let av = a[key];
      let bv = b[key];
      if (av === null || av === undefined) av = key === 'pnl' || key === 'pnl_pct' ? -Infinity : '';
      if (bv === null || bv === undefined) bv = key === 'pnl' || key === 'pnl_pct' ? -Infinity : '';
      if (typeof av === 'string') return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return dir === 'asc' ? av - bv : bv - av;
    });
    return limit ? arr.slice(0, limit) : arr;
  }, [trades, sort, limit]);

  const toggleSort = (k) => {
    if (!k) return;
    setSort((s) => ({ key: k, dir: s.key === k && s.dir === 'desc' ? 'asc' : 'desc' }));
  };

  if (!trades.length) {
    return (
      <div className="empty">
        <div className="empty-icon">◎</div>
        <h3>No trades yet</h3>
        <p>Log your first trade to start building performance data. Every edge starts with good records.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="tbl">
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                className={c.sort ? 'sortable' : ''}
                onClick={() => toggleSort(c.sort)}
                style={{ textAlign: c.num ? 'right' : c.key === 'actions' ? 'right' : 'left' }}
                title={c.sort ? 'Sort' : undefined}
              >
                {c.label}
                {sort.key === c.sort && (
                  <span style={{ opacity: 0.6, marginLeft: 4 }}>{sort.dir === 'desc' ? '↓' : '↑'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const win = t.pnl > 0;
            const loss = t.pnl < 0;
            return (
              <tr key={t.id}>
                <td data-label="Instrument">
                  <div className="sym-cell">
                    <span className={`sym-dir ${t.direction}`}>{t.direction === 'long' ? '↑' : '↓'}</span>
                    <div>
                      <div className="sym-name">{t.instrument}</div>
                      <div className="sym-sub">{t.entry_reason ? truncate(t.entry_reason, 34) : '—'}</div>
                    </div>
                  </div>
                </td>
                <td data-label="Entry" className="num dim">{fmtDate(t.entry_time)}</td>
                <td data-label="Exit" className="num dim cell-hide">{t.exit_time ? fmtDate(t.exit_time) : '—'}</td>
                <td data-label="TF" className="cell-hide">
                  <span className="badge badge-neutral">{t.timeframe || '—'}</span>
                </td>
                <td data-label="Entry price" className="num" style={{ textAlign: 'right' }}>
                  {fmtNum(t.entry_price, priceDp(t.instrument))}
                </td>
                <td data-label="Exit price" className="num cell-hide" style={{ textAlign: 'right' }}>
                  {t.exit_price != null ? fmtNum(t.exit_price, priceDp(t.instrument)) : '—'}
                </td>
                <td data-label="Lots" className="num dim cell-hide" style={{ textAlign: 'right' }}>
                  {fmtNum(t.lot_size, 2)}
                </td>
                <td data-label="R:R" className="num" style={{ textAlign: 'right' }}>
                  {t.rr_ratio != null ? `1:${fmtNum(t.rr_ratio, 1)}` : '—'}
                </td>
                <td data-label="Risk" className="num dim cell-hide" style={{ textAlign: 'right' }}>
                  {fmtMoney(t.risk_amount)}
                </td>
                <td data-label="P&L" style={{ textAlign: 'right' }}>
                  <span className={`num ${win ? 'pos-win' : loss ? 'pos-loss' : 'faint'}`} style={{ fontWeight: 700 }}>
                    {t.status === 'closed' ? fmtMoney(t.pnl, { sign: true }) : '—'}
                  </span>
                </td>
                <td data-label="R" className="num cell-hide" style={{ textAlign: 'right' }}>
                  <span className={win ? 'pos-win' : loss ? 'pos-loss' : 'faint'}>
                    {t.status === 'closed' && t.risk_amount
                      ? `${t.pnl / t.risk_amount > 0 ? '+' : ''}${fmtNum(t.pnl / t.risk_amount, 2)}R`
                      : '—'}
                  </span>
                </td>
                <td data-label="Status">
                  {t.status === 'closed' ? (
                    <span className={`badge ${win ? 'badge-win' : loss ? 'badge-loss' : 'badge-neutral'}`}>
                      <span className="dot" />
                      {win ? 'Win' : loss ? 'Loss' : 'BE'}
                    </span>
                  ) : (
                    <span className="badge badge-open">
                      <span className="dot" /> Open
                    </span>
                  )}
                </td>
                <td data-label="" className="cell-actions">
                  <div className="row-actions">
                    {t.status === 'open' && (
                      <button className="icon-btn" title="Close trade" onClick={() => onClose(t)}>
                        <IconCheck size={15} />
                      </button>
                    )}
                    <button className="icon-btn" title="Edit" onClick={() => onEdit(t)}>
                      <IconEdit size={15} />
                    </button>
                    <button className="icon-btn" title="Delete" onClick={() => onDelete(t)}>
                      <IconTrash size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function priceDp(symbol = '') {
  const s = symbol.toUpperCase();
  if (s.includes('JPY')) return 3;
  if (s.startsWith('XAU') || s.startsWith('XAG')) return 2;
  if (s.includes('US30') || s.includes('NAS') || s.includes('SPX') || s.includes('GER')) return 2;
  if (s.includes('BTC') || s.includes('ETH')) return 2;
  return 5;
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
