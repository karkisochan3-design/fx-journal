const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const { db, DATA_DIR, COLUMNS, normalize, initCalc, recomputeAll } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

/* ---------------- queries ---------------- */
const SELECT = `SELECT * FROM trades`;

const listTrades = db.prepare(`${SELECT} ORDER BY datetime(entry_time) DESC, id DESC`);
const getTrade = db.prepare(`${SELECT} WHERE id = ?`);
const deleteTrade = db.prepare(`DELETE FROM trades WHERE id = ?`);
const deleteAll = db.prepare(`DELETE FROM trades`);
const countTrades = db.prepare(`SELECT COUNT(*) AS n FROM trades`);

const insertTrade = db.prepare(`
  INSERT INTO trades (${COLUMNS.join(', ')}, created_at, updated_at)
  VALUES (${COLUMNS.map((c) => `@${c}`).join(', ')}, datetime('now'), datetime('now'))
`);

const updateTrade = db.prepare(`
  UPDATE trades SET
    ${COLUMNS.map((c) => `${c} = @${c}`).join(', ')},
    updated_at = datetime('now')
  WHERE id = @id
`);

/* ---------------- routes ---------------- */
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.get('/api/trades', (req, res) => {
  res.json(listTrades.all());
});

app.get('/api/trades/:id', (req, res) => {
  const t = getTrade.get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Trade not found' });
  res.json(t);
});

app.post('/api/trades', (req, res) => {
  const row = normalize(req.body);
  if (!row.instrument) return res.status(400).json({ error: 'Instrument is required' });
  if (!row.entry_time) return res.status(400).json({ error: 'Entry date & time is required' });
  const info = insertTrade.run(row);
  res.status(201).json(getTrade.get(info.lastInsertRowid));
});

app.put('/api/trades/:id', (req, res) => {
  const existing = getTrade.get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Trade not found' });
  const row = normalize({ ...existing, ...req.body });
  row.id = Number(req.params.id);
  updateTrade.run(row);
  res.json(getTrade.get(row.id));
});

app.patch('/api/trades/:id', (req, res) => {
  const existing = getTrade.get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Trade not found' });
  const merged = normalize({ ...existing, ...req.body });
  merged.id = Number(req.params.id);
  updateTrade.run(merged);
  res.json(getTrade.get(merged.id));
});

app.delete('/api/trades/:id', (req, res) => {
  const info = deleteTrade.run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Trade not found' });
  res.json({ ok: true });
});

app.post('/api/trades/bulk', (req, res) => {
  const rows = Array.isArray(req.body) ? req.body : req.body?.trades;
  if (!Array.isArray(rows)) return res.status(400).json({ error: 'Expected an array of trades' });
  const tx = db.transaction((list) => {
    for (const r of list) insertTrade.run(normalize(r));
  });
  tx(rows);
  res.status(201).json({ inserted: rows.length });
});

app.delete('/api/trades', (req, res) => {
  deleteAll.run();
  res.json({ ok: true });
});

/* seed demo data on first run if the DB is empty */
app.post('/api/seed', (req, res) => {
  if (countTrades.get().n > 0 && !req.query.force) {
    return res.status(409).json({ error: 'Database already has trades' });
  }
  if (req.query.force) deleteAll.run();
  const seed = require('./seed');
  const tx = db.transaction((list) => list.forEach((r) => insertTrade.run(normalize(r))));
  tx(seed);
  res.status(201).json({ inserted: seed.length });
});

/* serve the built client in production (the API doubles as the web server) */
const DIST = path.join(__dirname, '..', 'dist');
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST, { maxAge: '1h', index: 'index.html' }));
  // the client uses hash routes, so every non-API path is the same shell
  app.get(/^(?!\/api(\/|$)).*/, (req, res) => res.sendFile(path.join(DIST, 'index.html')));
}

initCalc().then(() => {
  const repaired = recomputeAll();
  if (repaired) console.log(`[api] recomputed metrics for ${repaired} trade(s)`);

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[api] listening on 0.0.0.0:${PORT} · data ${DATA_DIR} · dist ${fs.existsSync(DIST) ? 'served' : 'missing (run npm run build)'}`);
  });

  /* close cleanly so SQLite never leaves a hot WAL behind */
  const shutdown = (signal) => {
    console.log(`[api] ${signal} — shutting down`);
    server.close(() => {
      try { db.close(); } catch (err) { console.warn('[api] db close:', err.message); }
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 8000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
});
