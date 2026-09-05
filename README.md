# FX Journal

A clean, fast trading journal for forex traders — log every trade, manage risk before you enter, and find your edge in the analytics.

Built with **React + Vite**, an **Express + SQLite** API, and **Chart.js**.

---

## Quick start

```bash
cd forex-journal
npm install
npm run dev
```

That starts both processes together:

| Service | URL | Notes |
| --- | --- | --- |
| Web app | http://localhost:5173 | Vite dev server with HMR |
| API | http://localhost:3001 | Express + SQLite (`data/journal.db`) |

Open **http://localhost:5173**. On first run the app loads 64 demo trades so the dashboard and charts aren't empty — clear them from **Settings → Danger zone** whenever you want a clean book.

### Other scripts

```bash
npm run dev:api      # API only
npm run dev:web      # web only
npm run build        # production bundle → dist/
npm start            # run the API, which also serves dist/ if it exists
npm test             # trade maths + CSV + API round-trip tests
npm run test:render  # render every screen to catch runtime errors
```

---

## Deploy from GitHub — the normal way

**Yes.** Render builds from your GitHub repo, and auto-deploys on every push to `main` by default. The CLI is optional — most people use it only for logs and the occasional manual deploy.

```
git push  →  GitHub  →  Render pulls the branch
                     →  npm ci && npm run build
                     →  npm start
                     →  live at https://fx-journal.onrender.com
```

> **GitHub Pages cannot host this app.** Pages serves static HTML/CSS/JS only — there is no Node process and no database, so your trades would have nowhere to be saved. This app needs a host that runs a server (Render, Fly.io, Railway, a VPS).

### One-time setup

1. Create an empty repo at **https://github.com/new** (leave it completely empty).
2. Push this project to it:

   ```powershell
   npm run deploy:render -- --setup https://github.com/YOURUSER/fx-journal.git
   ```

3. Connect Render to the repo:

   ```powershell
   render login
   start https://dashboard.render.com/blueprints      # Windows
   open   https://dashboard.render.com/blueprints     # macOS
   ```

   **New Blueprint** → pick your repo → Render reads `render.yaml`.

4. From then on, shipping is just:

   ```powershell
   git add . && git commit -m "message" && git push
   ```

   …or `npm run deploy:render`, which pushes *and* streams the deploy logs.

### Find these later

| Thing | Where |
| --- | --- |
| Auto-deploy switch | Render → service → **Settings** → Auto-Deploy |
| Deploy hook URL | Render → service → **Settings** → Deploy Hooks |
| GitHub secret | Repo → **Settings** → Secrets and variables → Actions |
| Build / deploy logs | Render → service → **Events**, or `render logs <id>` |
| Your live URL | Render → service → top of the page (`*.onrender.com`) |

### Optional: only deploy when tests pass

Out of the box, Render deploys the moment you push — even if the code is broken. To put the test suite in the way:

1. Render → service → **Settings** → turn **Auto-Deploy off**
2. Settings → **Deploy Hooks** → copy the URL
3. GitHub repo → **Settings** → Secrets and variables → Actions → **New repository secret**
   → name `RENDER_DEPLOY_HOOK_URL`, value = the hook URL

`.github/workflows/render.yml` is already included. On every push and PR it builds the app, runs the 31 unit/API tests and the 13 render tests, and — only on `main`, only if all of them pass — calls the hook to deploy. If the secret is missing it simply skips and lets auto-deploy do its thing.

---

## Deploy to Render

The app is one Node process: the Express API also serves the built client from `dist/`, so there is a single service to deploy.

> ### ⚠️ Read this before deploying — your trades are a file
>
> Trades live in a SQLite file on disk. Render's **free tier has an ephemeral filesystem**: every deploy, restart and 15-minute spin-down wipes it. Persistent disks require a **Starter plan ($7/mo + $0.25/GB/mo)**.
>
> - **Keeping a real journal** → `render.yaml` (Starter + 1GB disk at `/var/data`)
> - **Kicking the tyres** → `render.free.yaml` ($0, data resets, demo trades reload)

### Windows users: open PowerShell, not cmd.exe

PowerShell is already installed and handles `#` comments and scripts. In File Explorer, shift-right-click the project folder → **Open PowerShell window here**. (Every command below also runs in cmd.exe — just don't paste the `#` comment lines, and use `set NAME=value` instead of `$env:NAME="value"`.)

### 1. Create an empty GitHub repo

Go to https://github.com/new → name it `fx-journal` → leave it **completely empty** (no README, no .gitignore) → Create repository.

### 2. Install the Render CLI

```powershell
winget install render.cli
render login
```

No winget? Download `cli_*_windows_amd64.zip` from https://github.com/render-oss/cli/releases/latest, unzip, and put it somewhere on your PATH.

### 3. First commit and push

> **`error: src refspec main does not match any`** means Git has no commits yet, so there is no `main` branch to push. You must commit *before* pushing — this one command does all of it:

```powershell
npm run deploy:render -- --setup https://github.com/YOURUSER/fx-journal.git
```

It runs `git init` → `git add .` → `git commit` → `git branch -M main` → `git remote add origin` → `git push -u origin main`.

By hand, if you prefer:

```powershell
git init
git add .
git commit -m "Initial commit: FX Journal"
git branch -M main
git remote add origin https://github.com/YOURUSER/fx-journal.git
git push -u origin main
```

If Git asks who you are:

```powershell
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

If the push is rejected or asks for a password, use the **HTTPS** URL above rather than `git@github.com:...` (SSH needs a key added at https://github.com/settings/keys).

### 4. Create the Render service — once

**With the disk (recommended).** The Blueprint route is the only way to attach one, because `render services create` has no disk flag:

```powershell
render blueprints validate render.yaml
start https://dashboard.render.com/blueprints
```

Then: **New Blueprint** → connect the repo → Render reads `render.yaml`.

**Without a disk (free/demo tier).** In PowerShell, line continuations use a backtick `` ` ``; in cmd.exe use `^`:

```powershell
render services create --name fx-journal --type web_service `
  --repo https://github.com/YOURUSER/fx-journal --runtime node `
  --branch main --build-command "npm ci && npm run build" `
  --start-command "npm start" --health-check-path /api/health `
  --plan free --region oregon --env-var NODE_ENV=production `
  --env-var VITE_SEED_DEMO=true --output json --confirm
```

### 5. Deploy

Grab your service ID with `render services`, then:

```powershell
$env:RENDER_SERVICE_ID = "srv-xxxxxxxxxxxx"   # PowerShell
set RENDER_SERVICE_ID=srv-xxxxxxxxxxxx        # cmd.exe
npm run deploy:render
```

From then on, **every deploy is just `npm run deploy:render`** — it validates the blueprint, pushes your branch, and streams the deploy until it finishes (exiting non-zero if it fails).

```powershell
npm run deploy:render -- --free        # use render.free.yaml
npm run deploy:render -- --validate    # lint the blueprint only
```

### Handy commands

```powershell
render services                      # list services, find your ID
render logs $env:RENDER_SERVICE_ID   # tail logs
render restart $env:RENDER_SERVICE_ID
render ssh $env:RENDER_SERVICE_ID    # shell on the instance (paid plans)
```

### Deploy anywhere else

```powershell
docker build -t fx-journal .
docker run -p 3001:3001 -v fx-journal-data:/var/data fx-journal
```

The container runs `npm start`, keeps data in `/var/data` and exposes `/api/health` for health checks. Fly.io, Railway, a VPS with pm2 or DigitalOcean all work the same way — just point `DATA_DIR` at a volume that survives restarts.

---

## Features

### Trade entry
Instrument, direction, entry date/time, entry price, entry reason (setup), timeframe and lot size. Pip size and pip value are detected from the symbol (JPY pairs, gold, indices, crypto) and can be overridden per trade.

### Exit data
Exit date/time and price, exit type (TP / SL / manual / trailing / margin), and a reason field for manual exits. Open trades can be closed straight from the row action with a live P&L preview.

### Risk calculator (live)
Stop loss, take profit, then automatically: risk/reward ratio, risk in pips and dollars, potential reward in dollars, $ per pip, return on risk and R-multiple. A **position sizer** sets lot size to risk 0.5% / 1% / 2% of your account, and **suggest 1:2** fills a sensible SL/TP around your entry.

### Status
Open vs closed, win/loss/breakeven badges, realised P&L, and % gain against risk and account.

### Dashboard
Total P&L, win rate, profit factor, expectancy, average R:R, average win/loss, best and worst trade, max drawdown, streaks, equity curve, open positions and recent trades.

### Analytics
Win/loss doughnut, monthly P&L bars, R:R distribution, weekday trade count or P&L, plus performance broken down by instrument and timeframe and an R-multiple summary.

### Filters
Search across symbol/setup/notes/tags, date range, instrument, timeframe, status and result. Filters apply to the dashboard, history table and analytics together, and CSV export respects them.

---

## How the numbers are calculated

| Metric | Formula |
| --- | --- |
| Risk in pips | \|entry − stop loss\| ÷ pip size |
| Reward in pips | \|take profit − entry\| ÷ pip size |
| R:R | reward pips ÷ risk pips |
| $ per pip | pip value × lot size |
| Risk $ | risk pips × $ per pip |
| P&L | (exit − entry) ÷ pip size × $ per pip × direction − fees |
| Return on risk | P&L ÷ risk $ × 100 |
| R multiple | P&L ÷ risk $ |

Pip size defaults: `0.0001` for most pairs, `0.01` for JPY pairs and gold/silver, `1` for indices and crypto. Pip value defaults to **$10 per pip per 1.00 lot** (with gold at $1 and silver at $50) — override the **$ per pip / lot** field on any trade for your broker's exact contract size.

Derived fields are computed by one shared module (`src/lib/calc.mjs`) used by **both** the UI and the API, so a trade saved from the form, imported from CSV, or sent with `curl` produces identical numbers. The API recomputes every row on boot, which repairs data written by older versions.

---

## Data

Trades live in SQLite at `data/journal.db`. Schema:

`id · instrument · direction · entry_time · entry_price · entry_reason · timeframe · lot_size · exit_time · exit_price · exit_type · exit_reason · stop_loss · take_profit · pip_size · pip_value · status · result · pnl · pnl_pct · rr_ratio · risk_amount · reward_amount · risk_pips · reward_pips · fees · notes · tags · created_at · updated_at`

### REST API

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/trades` | List all trades |
| GET | `/api/trades/:id` | Fetch one |
| POST | `/api/trades` | Create |
| PUT | `/api/trades/:id` | Replace |
| PATCH | `/api/trades/:id` | Partial update |
| DELETE | `/api/trades/:id` | Delete |
| DELETE | `/api/trades` | Clear everything |
| POST | `/api/trades/bulk` | Import an array (CSV import uses this) |
| POST | `/api/seed` | Load demo data (`?force=1` to replace) |

### Backup

**Settings → Export CSV** writes the current filtered view. The same file can be re-imported; columns match the export header.

---

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `N` | New trade |
| `/` | Go to trade history |
| `⌘/Ctrl + Enter` | Save the trade form |
| `Esc` | Close a dialog |

---

## Project layout

```
forex-journal/
├── server/
│   ├── index.js        # Express routes
│   ├── db.js           # SQLite schema, row normalisation, derived metrics
│   └── seed.js         # deterministic demo data
├── src/
│   ├── App.jsx         # shell, routing, CRUD, filters
│   ├── api.js          # fetch client
│   ├── index.css       # design tokens, dark + light themes, responsive rules
│   ├── lib/
│   │   ├── calc.mjs    # shared trade maths (used by UI and API)
│   │   ├── stats.js    # dashboard + analytics aggregations
│   │   ├── csv.js      # export / parse
│   │   ├── hooks.js    # theme, settings, toasts, hash router
│   │   └── theme.js    # chart palette
│   └── components/
│       ├── Dashboard.jsx, Analytics.jsx, TradeTable.jsx, TradeForm.jsx
│       ├── FilterBar.jsx, StatCard.jsx, charts.jsx, Modals.jsx, Icons.jsx
├── scripts/            # test + render smoke tests
└── vite.config.mjs
```

## Notes on the design

- Dark mode by default, light mode toggle persisted to `localStorage`; both themes are defined as CSS custom properties and mirrored in the chart palette.
- Mobile: the table collapses into cards, the sidebar becomes a bottom tab bar, and the equity/stats grids reflow to single column.
- No external network requests — fonts, icons and styles are all local, so it works offline.
