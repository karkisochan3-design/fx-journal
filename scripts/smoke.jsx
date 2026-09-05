/* Render every screen to static markup to catch runtime errors without a browser. */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import App from '../src/App.jsx';
import Dashboard from '../src/components/Dashboard.jsx';
import Analytics from '../src/components/Analytics.jsx';
import TradeTable from '../src/components/TradeTable.jsx';
import TradeForm from '../src/components/TradeForm.jsx';
import FilterBar, { EMPTY_FILTERS } from '../src/components/FilterBar.jsx';
import { Confirm, Toasts } from '../src/components/Modals.jsx';

const noop = () => {};

export function renderApp() {
  return renderToStaticMarkup(<App />);
}

export function renderDashboard(trades) {
  return renderToStaticMarkup(
    <Dashboard
      trades={trades}
      accountSize={10000}
      theme="dark"
      onEdit={noop}
      onClose={noop}
      onDelete={noop}
      onNew={noop}
    />
  );
}

export function renderAnalytics(trades) {
  return renderToStaticMarkup(<Analytics trades={trades} theme="dark" />);
}

export function renderTable(trades) {
  return renderToStaticMarkup(<TradeTable trades={trades} onEdit={noop} onClose={noop} onDelete={noop} />);
}

export function renderNewTrade() {
  return renderToStaticMarkup(<TradeForm accountSize={10000} onSave={noop} onCancel={noop} />);
}

export function renderEditTrade(trade) {
  return renderToStaticMarkup(<TradeForm trade={trade} accountSize={10000} onSave={noop} onCancel={noop} />);
}

export function renderFilters(instruments) {
  return renderToStaticMarkup(
    <FilterBar filters={EMPTY_FILTERS} onChange={noop} instruments={instruments} resultCount={0} />
  );
}

export function renderModals() {
  return renderToStaticMarkup(
    <>
      <Confirm message="Sure?" onConfirm={noop} onCancel={noop} />
      <Toasts toasts={[{ id: 1, message: 'Saved', kind: 'ok' }]} onDismiss={noop} />
    </>
  );
}
