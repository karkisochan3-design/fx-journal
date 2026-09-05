import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.js';
import { useTheme, useSetting, useToasts, useHashRoute, useDebounced } from './lib/hooks.js';
import { computeTrade, fmtMoney, toInputValue } from './lib/calc.mjs';
import { EMPTY_FILTERS, default as FilterBar } from './components/FilterBar.jsx';
import TradeTable from './components/TradeTable.jsx';
import TradeForm from './components/TradeForm.jsx';
import Dashboard from './components/Dashboard.jsx';
import Analytics from './components/Analytics.jsx';
import { Modal, Confirm, Toasts } from './components/Modals.jsx';
import { downloadCSV, parseCSV } from './lib/csv.js';
import {
  IconDashboard, IconTrades, IconPlus, IconAnalytics, IconSun, IconMoon,
  IconDownload, IconUpload, IconTrash, IconSearch,
} from './components/Icons.jsx';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', Icon: IconDashboard },
  { id: 'trades', label: 'Trades', Icon: IconTrades },
  { id: 'new', label: 'New trade', Icon: IconPlus },
  { id: 'analytics', label: 'Analytics', Icon: IconAnalytics },
];

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const [accountSize, setAccountSize] = useSetting('accountSize', 10000);
  const { toasts, push, dismiss } = useToasts();
  const [route, navigate] = useHashRoute('dashboard');

  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 180);

  const [editing, setEditing] = useState(null);
  const [closingTrade, setClosingTrade] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const fileInput = useRef(null);

  /* ---------------- load ---------------- */
  const load = useCallback(async () => {
    try {
      const data = await api.list();
      setTrades(data);
      setOffline(false);
      // first-run convenience: no trades at all → drop in a demo set once
      // first run on an empty database → drop in a demo set (disable with VITE_SEED_DEMO=false)
      if (!data.length && import.meta.env.VITE_SEED_DEMO !== 'false' && !localStorage.getItem('fxj.seeded')) {
        localStorage.setItem('fxj.seeded', '1');
        await api.seed();
        setTrades(await api.list());
        push('Loaded 64 demo trades — clear them any time from Settings.', 'info', 5000);
      }
    } catch (err) {
      setOffline(true);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    load();
  }, [load]);

  /* ---------------- filtering ---------------- */
  const instruments = useMemo(
    () => [...new Set(trades.map((t) => t.instrument).filter(Boolean))].sort(),
    [trades]
  );

  const effectiveFilters = useMemo(() => ({ ...filters, q: debouncedSearch }), [filters, debouncedSearch]);

  const filtered = useMemo(() => {
    const q = effectiveFilters.q.trim().toLowerCase();
    return trades.filter((t) => {
      if (effectiveFilters.instrument && t.instrument !== effectiveFilters.instrument) return false;
      if (effectiveFilters.timeframe && t.timeframe !== effectiveFilters.timeframe) return false;
      if (effectiveFilters.status && t.status !== effectiveFilters.status) return false;
      if (effectiveFilters.result) {
        if (t.status !== 'closed') return false;
        if (effectiveFilters.result === 'win' && !(t.pnl > 0)) return false;
        if (effectiveFilters.result === 'loss' && !(t.pnl < 0)) return false;
        if (effectiveFilters.result === 'breakeven' && t.pnl !== 0) return false;
      }
      const day = (t.entry_time || '').slice(0, 10);
      if (effectiveFilters.from && day < effectiveFilters.from) return false;
      if (effectiveFilters.to && day > effectiveFilters.to) return false;
      if (q) {
        const hay = [t.instrument, t.entry_reason, t.notes, t.tags, t.exit_reason, t.timeframe, t.exit_type]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [trades, effectiveFilters]);

  /* ---------------- CRUD ---------------- */
  const saveTrade = async (payload) => {
    const derived = computeTrade(payload);
    const body = {
      ...payload,
      result: payload.status === 'closed' ? derived.result : null,
      pnl: payload.status === 'closed' ? derived.pnl : null,
      pnl_pct: payload.status === 'closed' ? derived.pnlPct : null,
      rr_ratio: derived.rr,
      risk_amount: derived.riskAmount,
      reward_amount: derived.rewardAmount,
      risk_pips: derived.riskPips,
      reward_pips: derived.rewardPips,
    };
    if (payload.id) {
      const updated = await api.update(payload.id, body);
      setTrades((ts) => ts.map((t) => (t.id === updated.id ? updated : t)));
      push('Trade updated', 'ok');
    } else {
      const created = await api.create(body);
      setTrades((ts) => [created, ...ts]);
      push(`Logged ${created.instrument} ${created.direction}`, 'ok');
    }
  };

  const deleteTrade = async (t) => {
    await api.remove(t.id);
    setTrades((ts) => ts.filter((x) => x.id !== t.id));
    setToDelete(null);
    push('Trade deleted', 'ok');
  };

  const submitClose = async (form) => {
    const t = closingTrade;
    const derived = computeTrade({ ...t, ...form, status: 'closed' });
    const updated = await api.update(t.id, {
      ...t,
      ...form,
      status: 'closed',
      result: derived.result,
      pnl: derived.pnl,
      pnl_pct: derived.pnlPct,
      rr_ratio: derived.rr,
      risk_amount: derived.riskAmount,
      reward_amount: derived.rewardAmount,
      risk_pips: derived.riskPips,
      reward_pips: derived.rewardPips,
    });
    setTrades((ts) => ts.map((x) => (x.id === updated.id ? updated : x)));
    setClosingTrade(null);
    push(
      `${updated.instrument} closed → ${fmtMoney(updated.pnl, { sign: true })}`,
      updated.pnl >= 0 ? 'ok' : 'err'
    );
  };

  const clearAll = async () => {
    await api.clearAll();
    setTrades([]);
    localStorage.setItem('fxj.seeded', '1');
    setShowSettings(false);
    push('All trades deleted', 'ok');
  };

  const loadDemo = async () => {
    setShowSettings(false);
    await api.clearAll();
    await api.seed(true);
    setTrades(await api.list());
    push('Demo data loaded', 'ok');
  };

  const exportCSV = () => {
    downloadCSV(filtered, `journal-${new Date().toISOString().slice(0, 10)}.csv`);
    push(`Exported ${filtered.length} trades`, 'ok');
  };

  const importCSV = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = parseCSV(await file.text());
      if (!rows.length) return push('No rows found in that file', 'err');
      await api.bulk(rows.map((r) => ({ ...r, id: undefined })));
      setTrades(await api.list());
      push(`Imported ${rows.length} trades`, 'ok');
    } catch (err) {
      push(err.message || 'Import failed', 'err');
    } finally {
      e.target.value = '';
    }
  };

  /* ---------------- shortcuts ---------------- */
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'n' || e.key === 'N') navigate('new');
      if (e.key === '/') { e.preventDefault(); navigate('trades'); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navigate]);

  /* ---------------- render ---------------- */
  const view = route.name;                                   // which page to render
  const page = view === 'edit' ? 'trades' : view;             // which nav item is active
  const editTrade = view === 'edit' ? trades.find((t) => String(t.id) === String(route.param)) : null;

  const title =
    view === 'dashboard' ? 'Dashboard'
    : view === 'trades' ? 'Trade history'
    : view === 'new' ? 'New trade'
    : view === 'edit' ? 'Edit trade'
    : view === 'analytics' ? 'Analytics'
    : 'Dashboard';

  const subtitle =
    view === 'dashboard' ? 'Performance at a glance'
    : view === 'trades' ? `${filtered.length} of ${trades.length} trades`
    : view === 'new' ? 'Log an entry with live risk metrics'
    : view === 'edit' ? editTrade ? `${editTrade.instrument} · ${editTrade.entry_time?.replace('T', ' ')}` : 'Loading…'
    : view === 'analytics' ? 'Find your edge in the data'
    : '';

  return (
    <div className="app">
      {/* sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">FX</div>
          <div>
            <div className="brand-name">FX Journal</div>
            <div className="brand-sub">forex trading log</div>
          </div>
        </div>

        <div className="nav-label">Journal</div>
        {NAV.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`nav-item ${page === id ? 'active' : ''}`}
            onClick={() => navigate(id)}
          >
            <Icon size={17} />
            {label}
            {id === 'trades' && trades.length > 0 && <span className="nav-count">{trades.length}</span>}
          </button>
        ))}

        <div className="sidebar-foot">
          {offline && (
            <div className="account-box" style={{ borderColor: 'var(--loss)', color: 'var(--loss)' }}>
              <label>API offline</label>
              <span style={{ fontSize: 12 }}>Start the server to sync</span>
            </div>
          )}
          <div className="account-box">
            <label htmlFor="accountSize">Account size ($)</label>
            <div className="input-with-prefix">
              <span className="pfx">$</span>
              <input
                id="accountSize"
                type="number"
                className="input num-input"
                value={accountSize}
                onChange={(e) => setAccountSize(Number(e.target.value) || 0)}
                style={{ height: 32 }}
              />
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowSettings(true)}>
            Settings &amp; data
          </button>
          <button className="btn btn-ghost btn-sm" onClick={toggleTheme}>
            {theme === 'dark' ? <IconSun size={14} /> : <IconMoon size={14} />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
      </aside>

      {/* main */}
      <div className="main">
        <header className="topbar">
          <div>
            <h1>{title}</h1>
            <div className="sub">{subtitle}</div>
          </div>
          <div className="topbar-actions">
            <div className="input-with-prefix no-print" style={{ width: 210, display: page === 'new' ? 'none' : 'block' }}>
              <span className="pfx"><IconSearch size={13} /></span>
              <input
                className="input"
                placeholder="Search trades…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ height: 36 }}
              />
            </div>
            <button className="btn btn-icon no-print" onClick={toggleTheme} title="Toggle theme" aria-label="Toggle theme">
              {theme === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />}
            </button>
            <button className="btn btn-primary" onClick={() => navigate('new')}>
              <IconPlus size={15} /> New trade
            </button>
          </div>
        </header>

        <main className="content">
          {loading ? (
            <div className="grid g-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 92 }} />
              ))}
            </div>
          ) : view === 'dashboard' ? (
            <Dashboard
              trades={filtered}
              accountSize={accountSize}
              theme={theme}
              onEdit={(t) => navigate(`edit/${t.id}`)}
              onClose={setClosingTrade}
              onDelete={setToDelete}
              onNew={() => navigate('new')}
            />
          ) : view === 'trades' ? (
            <div className="page">
              <FilterBar
                filters={{ ...filters, q: search }}
                onChange={(f) => { setFilters({ ...f, q: '' }); setSearch(f.q || ''); }}
                instruments={instruments}
                resultCount={filtered.length}
              />
              <div className="card">
                <div className="card-head">
                  <span className="card-title">All trades</span>
                  <span className="spacer" />
                  <button className="btn btn-ghost btn-sm" onClick={exportCSV}>
                    <IconDownload size={14} /> Export
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => fileInput.current?.click()}>
                    <IconUpload size={14} /> Import
                  </button>
                </div>
                <TradeTable
                  trades={filtered}
                  onEdit={(t) => navigate(`edit/${t.id}`)}
                  onClose={setClosingTrade}
                  onDelete={setToDelete}
                />
              </div>
            </div>
          ) : view === 'analytics' ? (
            <>
              <FilterBar
                filters={{ ...filters, q: search }}
                onChange={(f) => { setFilters({ ...f, q: '' }); setSearch(f.q || ''); }}
                instruments={instruments}
                resultCount={filtered.length}
              />
              <Analytics trades={filtered} theme={theme} />
            </>
          ) : view === 'new' ? (
            <TradeForm
              accountSize={accountSize}
              onSave={saveTrade}
              onCancel={() => navigate('trades')}
              onSaved={() => navigate('trades')}
            />
          ) : view === 'edit' && editTrade ? (
            <TradeForm
              key={editTrade.id}
              trade={editTrade}
              accountSize={accountSize}
              onSave={saveTrade}
              onCancel={() => navigate('trades')}
              onSaved={() => navigate('trades')}
            />
          ) : (
            <div className="card empty">
              <h3>Trade not found</h3>
              <p>It may have been deleted.</p>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('trades')}>
                Back to history
              </button>
            </div>
          )}
        </main>
      </div>

      {/* mobile nav */}
      <nav className="mobile-nav">
        {NAV.map(({ id, label, Icon }) => (
          <button key={id} className={page === id ? 'active' : ''} onClick={() => navigate(id)}>
            <Icon size={19} />
            {label}
          </button>
        ))}
      </nav>

      <input
        ref={fileInput}
        type="file"
        accept=".csv,text/csv"
        onChange={importCSV}
        style={{ display: 'none' }}
      />

      {/* modals */}
      {closingTrade && (
        <CloseTradeModal trade={closingTrade} onClose={() => setClosingTrade(null)} onSave={submitClose} />
      )}

      {toDelete && (
        <Confirm
          title="Delete this trade?"
          message={`${toDelete.instrument} · ${toDelete.entry_time?.replace('T', ' ')} will be removed from your journal. This cannot be undone.`}
          confirmLabel="Delete trade"
          onConfirm={() => deleteTrade(toDelete)}
          onCancel={() => setToDelete(null)}
        />
      )}

      {showSettings && (
        <SettingsModal
          accountSize={accountSize}
          setAccountSize={setAccountSize}
          onClose={() => setShowSettings(false)}
          onExport={exportCSV}
          onImport={() => fileInput.current?.click()}
          onClear={clearAll}
          onDemo={loadDemo}
          tradeCount={trades.length}
        />
      )}

      <Toasts toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

/* ------------------------------- close trade ------------------------------- */
function CloseTradeModal({ trade, onClose, onSave }) {
  const [form, setForm] = useState({
    exit_time: toInputValue(),
    exit_price: '',
    exit_type: 'Manual',
    exit_reason: '',
    fees: trade.fees ?? 0,
  });

  const preview = computeTrade({ ...trade, ...form, status: 'closed' });
  const pnlColor = preview.pnl === null ? 'var(--text-faint)' : preview.pnl > 0 ? 'var(--win)' : preview.pnl < 0 ? 'var(--loss)' : 'var(--text)';

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal
      title={`Close ${trade.instrument}`}
      subtitle={`${trade.direction === 'long' ? 'Long' : 'Short'} · ${trade.lot_size ?? 1} lots · entry ${trade.entry_price}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => onSave(form)}
            disabled={form.exit_price === ''}
          >
            Close trade
          </button>
        </>
      }
    >
      <div className="grid g-2">
        <div className="field">
          <label>Exit date &amp; time</label>
          <input type="datetime-local" className="input num-input" value={form.exit_time} onChange={set('exit_time')} />
        </div>
        <div className="field">
          <label>Exit price</label>
          <input
            type="number"
            step="any"
            inputMode="decimal"
            className="input num-input"
            placeholder={String(trade.take_profit ?? trade.entry_price ?? '')}
            value={form.exit_price}
            onChange={set('exit_price')}
            autoFocus
          />
        </div>
        <div className="field">
          <label>Exit type</label>
          <select className="select" value={form.exit_type} onChange={set('exit_type')}>
            <option value="TP">TP</option>
            <option value="SL">SL</option>
            <option value="Manual">Manual close</option>
            <option value="Trailing Stop">Trailing stop</option>
            <option value="Margin/Stop Out">Margin / stop out</option>
          </select>
        </div>
        <div className="field">
          <label>Fees</label>
          <div className="input-with-prefix">
            <span className="pfx">$</span>
            <input type="number" step="any" className="input num-input" value={form.fees} onChange={set('fees')} />
          </div>
        </div>
      </div>

      {form.exit_type === 'Manual' && (
        <div className="field">
          <label>Reason for exit</label>
          <input
            className="input"
            placeholder="e.g. structure broke, took partials, news risk"
            value={form.exit_reason}
            onChange={set('exit_reason')}
          />
        </div>
      )}

      <div
        className="card card-pad"
        style={{ background: 'var(--surface-2)', display: 'grid', gap: 6, textAlign: 'center' }}
      >
        <div className="stat-label">Result</div>
        <div className="num" style={{ fontSize: 30, fontWeight: 700, color: pnlColor, letterSpacing: '-.03em' }}>
          {preview.pnl === null ? '—' : fmtMoney(preview.pnl, { sign: true })}
        </div>
        <div className="hint">
          {preview.resultPips !== null ? `${preview.resultPips > 0 ? '+' : ''}${preview.resultPips.toFixed(1)} pips` : ''}
          {preview.pnlPct !== null && ` · ${preview.pnlPct > 0 ? '+' : ''}${preview.pnlPct.toFixed(1)}% of risk`}
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------- settings --------------------------------- */
function SettingsModal({ accountSize, setAccountSize, onClose, onExport, onImport, onClear, onDemo, tradeCount }) {
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <Modal
      title="Settings & data"
      subtitle="Account sizing, backup and data management"
      onClose={onClose}
      footer={<button className="btn btn-primary" onClick={onClose}>Done</button>}
    >
      <div className="field">
        <label>Account size ($)</label>
        <div className="input-with-prefix">
          <span className="pfx">$</span>
          <input
            type="number"
            className="input num-input"
            value={accountSize}
            onChange={(e) => setAccountSize(Number(e.target.value) || 0)}
          />
        </div>
        <span className="hint">Used for risk % of account and the position sizer.</span>
      </div>

      <div className="section-title" style={{ gridColumn: 'span 12' }}>Data</div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-sm" onClick={onExport}><IconDownload size={14} /> Export CSV</button>
        <button className="btn btn-sm" onClick={onImport}><IconUpload size={14} /> Import CSV</button>
        <button className="btn btn-sm" onClick={onDemo}>Load demo data</button>
      </div>
      <p className="hint">
        {tradeCount} trade{tradeCount === 1 ? '' : 's'} stored in <code>data/journal.db</code> (SQLite).
        Export a CSV before importing or clearing.
      </p>

      <div className="section-title" style={{ gridColumn: 'span 12' }}>Danger zone</div>
      {confirmClear ? (
        <div className="card card-pad" style={{ borderColor: 'var(--loss)' }}>
          <p style={{ fontSize: 13, marginBottom: 10 }}>
            Permanently delete all {tradeCount} trades? This cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm" onClick={() => setConfirmClear(false)}>Cancel</button>
            <button className="btn btn-danger btn-sm" onClick={onClear}>
              <IconTrash size={14} /> Yes, delete everything
            </button>
          </div>
        </div>
      ) : (
        <button className="btn btn-danger btn-sm" style={{ width: 'fit-content' }} onClick={() => setConfirmClear(true)}>
          <IconTrash size={14} /> Clear all trades
        </button>
      )}
    </Modal>
  );
}
