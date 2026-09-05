import { JSDOM } from 'jsdom';

const API = process.env.API || 'http://127.0.0.1:3001';

/* ---- browser-ish environment ---- */
const dom = new JSDOM('<!doctype html><html data-theme="dark"><body><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/#/dashboard',
  pretendToBeVisual: true,
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.localStorage = dom.window.localStorage;
global.HTMLElement = dom.window.HTMLElement;
global.HTMLCanvasElement = dom.window.HTMLCanvasElement;
global.Element = dom.window.Element;
global.getComputedStyle = dom.window.getComputedStyle;
global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);
global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
global.matchMedia = dom.window.matchMedia = (q) => ({
  matches: false, media: q,
  addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
});
dom.window.HTMLCanvasElement.prototype.getContext = () => ({
  canvas: { width: 600, height: 300 },
  save() {}, restore() {}, beginPath() {}, closePath() {}, clearRect() {}, fillRect() {},
  strokeRect() {}, measureText: () => ({ width: 10 }), fillText() {}, strokeText() {},
  translate() {}, scale() {}, rotate() {}, setTransform() {}, setLineDash() {}, getLineDash: () => [],
  createLinearGradient: () => ({ addColorStop() {} }),
  arc() {}, fill() {}, stroke() {}, clip() {}, rect() {}, moveTo() {}, lineTo() {}, bezierCurveTo() {},
  quadraticCurveTo() {}, drawImage() {}, putImageData() {}, getImageData: () => ({ data: [] }),
});

let failures = 0;

function check(name, fn, mustContain = []) {
  try {
    const html = fn();
    const missing = mustContain.filter((s) => !html.includes(s));
    if (missing.length) {
      console.log(`✗ ${name} — rendered but missing: ${missing.join(', ')}`);
      failures++;
    } else {
      console.log(`✓ ${name} (${html.length.toLocaleString()} chars)`);
    }
    return html;
  } catch (err) {
    console.log(`✗ ${name} — ${err.message}`);
    if (process.env.VERBOSE) console.error(err.stack);
    failures++;
    return '';
  }
}

(async () => {
  let trades = await (await fetch(`${API}/api/trades`)).json();

  // CI starts from an empty database — seed it so the data-driven
  // assertions (dashboard, analytics, edit forms) have something to render.
  if (!trades.length) {
    console.log('Database is empty — loading demo trades for the render tests…');
    await fetch(`${API}/api/seed`, { method: 'POST' });
    trades = await (await fetch(`${API}/api/trades`)).json();
  }

  if (!trades.length) {
    console.log('✗ Could not get any trades to render against');
    process.exit(1);
  }
  console.log(`Loaded ${trades.length} trades from the API\n`);

  const m = await import('../.ssr/smoke.mjs');

  check('App shell', m.renderApp);
  check('Dashboard', () => m.renderDashboard(trades), ['Total P&amp;L', 'Win rate', 'Equity curve']);
  check('Analytics', () => m.renderAnalytics(trades), ['Win / loss split', 'Monthly performance', 'R-multiple']);
  check('Trade table', () => m.renderTable(trades), ['Instrument', 'P&amp;L']);
  check('New trade form', m.renderNewTrade, ['Entry price', 'Stop loss', 'Live risk']);
  const openTrade = trades.find((t) => t.status === 'open');
  const closedTrade = trades.find((t) => t.status === 'closed');
  check('Edit closed trade', () => m.renderEditTrade(closedTrade), ['Update trade', 'Exit price', 'Exit type']);
  check('Edit open trade', () => m.renderEditTrade(openTrade), ['Update trade', 'Still open']);
  check('Edit forms differ', () => {
    const a = m.renderEditTrade(openTrade);
    const b = m.renderEditTrade(closedTrade);
    if (a.length === b.length) throw new Error('open and closed forms render identically');
    return a + b;
  });
  check('Filter bar', () => m.renderFilters([...new Set(trades.map((t) => t.instrument))]), ['Instrument', 'Timeframe']);
  check('Modals', m.renderModals, ['Are you sure?']);
  check('Empty dashboard', () => m.renderDashboard([]), ['No open trades']);
  check('Empty analytics', () => m.renderAnalytics([]), ['No closed trades']);
  check('Empty table', () => m.renderTable([]), ['No trades yet']);

  console.log(failures ? `\n${failures} failure(s)` : '\nAll screens render cleanly ✓');
  process.exit(failures ? 1 : 0);
})();
