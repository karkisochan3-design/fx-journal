#!/usr/bin/env node
/**
 * Cross-platform Render deployer — works in cmd.exe, PowerShell, Git Bash, macOS and Linux.
 *
 *   npm run deploy:render                      validate → push → deploy
 *   npm run deploy:render -- --setup URL       init repo, first commit, rename to main, push
 *   npm run deploy:render -- --free            use render.free.yaml (no disk, demo only)
 *   npm run deploy:render -- --validate        lint the blueprint only
 *   npm run deploy:render -- --service srv-x   deploy without setting an env var
 *
 * Requires the Render CLI: https://render.com/docs/cli
 *   winget install render.cli          (Windows)
 *   brew install render                (macOS)
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

const WIN = process.platform === 'win32';
const args = process.argv.slice(2);

const BLUEPRINT = args.includes('--free') ? 'render.free.yaml' : 'render.yaml';
const VALIDATE_ONLY = args.includes('--validate');
const HELP = args.includes('--help') || args.includes('-h');
const SERVICE_ID = (args.find((a) => a.startsWith('--service=')) || '').split('=')[1]
  || process.env.RENDER_SERVICE_ID || '';

const setupIdx = args.indexOf('--setup');
const DO_SETUP = setupIdx >= 0;
const SETUP_URL = DO_SETUP && args[setupIdx + 1] && !args[setupIdx + 1].startsWith('-')
  ? args[setupIdx + 1]
  : null;

/* Colour only where the terminal understands ANSI — cmd.exe and PowerShell 5.1
   would print raw escape codes, so they get plain text. */
const colorSupported =
  !process.env.NO_COLOR &&
  (WIN
    ? Boolean(process.env.WT_SESSION || process.env.TERM_PROGRAM === 'vscode' || process.env.ConEmuANSI === 'ON' || process.env.ANSICON)
    : Boolean(process.stdout.isTTY));

const C = colorSupported
  ? { on: '\x1b[1;36m', warn: '\x1b[1;33m', bad: '\x1b[1;31m', off: '\x1b[0m', dim: '\x1b[2m' }
  : { on: '', warn: '', bad: '', off: '', dim: '' };
const say = (m) => console.log(`${C.on}▸${C.off} ${m}`);
const warn = (m) => console.log(`${C.warn}⚠${C.off} ${m}`);
const bad = (m) => console.log(`${C.bad}✗${C.off} ${m}`);
const step = (m) => console.log(`\n${C.dim}── ${m} ──${C.off}`);

if (HELP) {
  console.log(`
  FX Journal — deploy to Render

    npm run deploy:render
        Validate the blueprint, push your branch, trigger a deploy and stream logs.

    npm run deploy:render -- --setup git@github.com:YOURUSER/fx-journal.git
        First time: git init, initial commit, rename branch to main, add remote, push.
        Create the empty repo on GitHub first: https://github.com/new

    npm run deploy:render -- --free          use render.free.yaml (no persistent disk)
    npm run deploy:render -- --validate      lint the blueprint only
    npm run deploy:render -- --service srv-xxxxxxxxxxxx

  Environment:
    RENDER_SERVICE_ID   service to deploy (from: render services)
    SKIP_PUSH=1         deploy without pushing to git
`);
  process.exit(0);
}

/* run a command, streaming output */
const run = (cmd, cmdArgs, { silent = false } = {}) =>
  new Promise((resolve) => {
    const p = spawn(cmd, cmdArgs, { stdio: silent ? 'ignore' : 'inherit', shell: WIN });
    p.on('close', (code) => resolve(code ?? 1));
    p.on('error', () => resolve(127));
  });

/* run a command and capture stdout */
const capture = (cmd, cmdArgs) => {
  const r = spawnSync(cmd, cmdArgs, { encoding: 'utf8', shell: WIN });
  return { code: r.status ?? 1, out: (r.stdout || '').trim(), err: (r.error?.message || '') };
};

const hasGit = () => capture('git', ['rev-parse', '--is-inside-work-tree']).out === 'true';
/* `where` is a real binary; `command -v` is a shell builtin, so it needs shell:true */
const hasCommand = (name) =>
  spawnSync(WIN ? `where ${name}` : `command -v ${name}`, {
    encoding: 'utf8',
    shell: true,
    stdio: 'ignore',
  }).status === 0;

/* ── 0. optional first-time git setup ─────────────────────────── */
if (DO_SETUP && !SETUP_URL) {
  bad('--setup needs the repository URL.');
  console.log('      npm run deploy:render -- --setup https://github.com/YOURUSER/fx-journal.git');
  process.exit(1);
}

if (DO_SETUP) {
  step('First-time git setup');

  if (!hasGit()) {
    say('git init');
    if (await run('git', ['init'])) { bad('git init failed — is Git installed? https://git-scm.com'); process.exit(1); }
  }

  if (!capture('git', ['config', 'user.email']).out) {
    bad('Git has no identity set. Run these once (Windows cmd):');
    console.log('      git config --global user.name "Your Name"');
    console.log('      git config --global user.email "you@example.com"');
    process.exit(1);
  }

  say('git add .');
  await run('git', ['add', '.']);

  const commits = capture('git', ['rev-list', '--count', 'HEAD']);
  if (commits.code !== 0 || commits.out === '0') {
    say('git commit  (this is what makes "main" exist)');
    if (await run('git', ['commit', '-m', 'Initial commit: FX Journal'])) {
      bad('Commit failed.'); process.exit(1);
    }
  } else {
    say(`repo already has ${commits.out} commit(s)`);
  }

  say('git branch -M main');
  await run('git', ['branch', '-M', 'main']);

  const existing = capture('git', ['remote', 'get-url', 'origin']);
  if (existing.code === 0) {
    say(`remote exists (${existing.out}) → set-url`);
    await run('git', ['remote', 'set-url', 'origin', SETUP_URL]);
  } else {
    say('git remote add origin');
    await run('git', ['remote', 'add', 'origin', SETUP_URL]);
  }

  say('git push -u origin main');
  if (await run('git', ['push', '-u', 'origin', 'main'])) {
    bad('Push failed. Common causes:');
    console.log('   • The GitHub repo does not exist yet → create it at https://github.com/new (leave it empty)');
    console.log('   • SSH key not added to GitHub → https://github.com/settings/keys');
    console.log('   • Or use HTTPS instead:  --setup https://github.com/YOURUSER/fx-journal.git');
    process.exit(1);
  }
  say('Pushed ✓');
}

/* ── 1. Render CLI present? ───────────────────────────────────── */
step('Render CLI');
if (!hasCommand('render')) {
  bad('Render CLI not found. Install it, then re-run this command:');
  console.log(WIN
    ? '      winget install render.cli\n   or: https://github.com/render-oss/cli/releases/latest → cli_*_windows_amd64.zip'
    : '      brew install render\n   or: curl -fsSL https://raw.githubusercontent.com/render-oss/cli/refs/heads/main/bin/install.sh | sh');
  process.exit(1);
}
say(`found (${capture('render', ['--version']).out.split('\n')[0]})`);

/* ── 2. validate the blueprint ────────────────────────────────── */
step('Blueprint');
if (!existsSync(path.join(ROOT, BLUEPRINT))) {
  bad(`${BLUEPRINT} not found`); process.exit(1);
}
say(`validating ${BLUEPRINT}`);
if (await run('render', ['blueprints', 'validate', BLUEPRINT, '-o', 'text'])) {
  warn('Validation failed, or you are not logged in yet.');
  console.log('      run: render login        then: render workspace set');
}

if (VALIDATE_ONLY) process.exit(0);

/* ── 3. push source ───────────────────────────────────────────── */
if (!process.env.SKIP_PUSH && hasGit()) {
  step('Git');
  const branch = capture('git', ['rev-parse', '--abbrev-ref', 'HEAD']).out || 'main';
  if (branch === 'HEAD') {
    warn('No commits yet — run this first:');
    console.log('      npm run deploy:render -- --setup https://github.com/YOURUSER/fx-journal.git');
  } else if (capture('git', ['remote', 'get-url', 'origin']).code !== 0) {
    warn('No git remote — Render builds from your repo. Add one:');
    console.log('      npm run deploy:render -- --setup https://github.com/YOURUSER/fx-journal.git');
  } else {
    say(`pushing ${branch}`);
    if (await run('git', ['push', 'origin', branch])) warn('Push failed — deploying whatever Render already has.');
  }
}

/* ── 4. deploy ────────────────────────────────────────────────── */
step('Deploy');
if (SERVICE_ID) {
  say(`${SERVICE_ID} — streaming logs, waiting for completion`);
  const code = await run('render', ['deploys', 'create', SERVICE_ID, '--confirm', '--wait', '-o', 'text']);
  if (code) {
    bad(`Deploy failed. Logs: render logs ${SERVICE_ID}`);
    process.exit(code);
  }
  say('Live ✓');
} else {
  console.log(`
  One-time: create the service, then every deploy is a single command.

  A) Blueprint — the only way to attach the persistent disk your SQLite
     database needs:

       render login
       start https://dashboard.render.com/blueprints     (Windows cmd)
       open   https://dashboard.render.com/blueprints    (macOS)

     New Blueprint → connect this repo → Render reads ${BLUEPRINT}

  B) CLI only (no disk — free/demo tier):

       render services create --name fx-journal --type web_service ^
         --repo https://github.com/YOURUSER/fx-journal --runtime node ^
         --branch main --build-command "npm ci && npm run build" ^
         --start-command "npm start" --health-check-path /api/health ^
         --plan free --region oregon --env-var NODE_ENV=production ^
         --env-var VITE_SEED_DEMO=true --output json --confirm

     (In PowerShell use a backtick \` instead of ^ to continue lines.)

  Then:
       set RENDER_SERVICE_ID=srv-xxxxxxxxxxxx          (Windows cmd)
       $env:RENDER_SERVICE_ID="srv-xxxxxxxxxxxx"       (PowerShell)
       export RENDER_SERVICE_ID=srv-xxxxxxxxxxxx       (macOS/Linux)

       npm run deploy:render
`);
}
