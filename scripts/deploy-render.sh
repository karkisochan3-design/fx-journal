#!/usr/bin/env bash
#
# Deploy FX Journal to Render from the command line.
#
#   ./scripts/deploy-render.sh              # validate → git push → trigger deploy
#   ./scripts/deploy-render.sh --free       # use render.free.yaml (no disk, demo only)
#   ./scripts/deploy-render.sh --validate   # only lint the blueprint
#
# Requires the official Render CLI:
#   brew install render
#   # or
#   curl -fsSL https://raw.githubusercontent.com/render-oss/cli/refs/heads/main/bin/install.sh | sh
#
# Environment:
#   RENDER_SERVICE_ID=srv-xxxx   service to deploy (set once, after first create)
#   SKIP_PUSH=1                  validate + deploy without git push
#
set -euo pipefail
cd "$(dirname "$0")/.."

BLUEPRINT="render.yaml"
VALIDATE_ONLY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --free)     BLUEPRINT="render.free.yaml"; shift ;;
    --validate) VALIDATE_ONLY=1; shift ;;
    -h|--help)  sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1 (try --help)"; exit 1 ;;
  esac
done

say()  { printf '\033[1;36m▸ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m⚠ %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# ── 1. CLI present? ────────────────────────────────────────────
if ! command -v render >/dev/null 2>&1; then
  die "Render CLI not found. Install it with:
      brew install render
   or: curl -fsSL https://raw.githubusercontent.com/render-oss/cli/refs/heads/main/bin/install.sh | sh"
fi
say "Render CLI: $(render --version 2>/dev/null | head -1)"

# ── 2. Validate the blueprint ──────────────────────────────────
say "Validating $BLUEPRINT"
if render blueprints validate "$BLUEPRINT" -o text; then
  say "Blueprint OK"
else
  warn "Validation failed, or you are not logged in yet (run: render login). Continuing."
fi

if [[ $VALIDATE_ONLY -eq 1 ]]; then exit 0; fi

# ── 3. Push the source Render builds from ──────────────────────
if [[ -z "${SKIP_PUSH:-}" ]] && git rev-parse --git-dir >/dev/null 2>&1; then
  if git remote get-url origin >/dev/null 2>&1; then
    BRANCH="$(git rev-parse --abbrev-ref HEAD)"
    say "Pushing $BRANCH to origin"
    git push origin "$BRANCH"
  else
    warn "No git remote — Render builds from your repo, so add one:"
    echo "      git remote add origin git@github.com:you/fx-journal.git && git push -u origin main"
  fi
fi

# ── 4. Trigger the deploy ──────────────────────────────────────
if [[ -n "${RENDER_SERVICE_ID:-}" ]]; then
  say "Deploying $RENDER_SERVICE_ID (streaming logs, waiting for completion)"
  render deploys create "$RENDER_SERVICE_ID" --confirm --wait -o text \
    && say "Deploy complete" \
    || die "Deploy failed — check logs with: render logs $RENDER_SERVICE_ID"
else
  cat <<EOF

$(printf '\033[1mNext step: create the service once, then every deploy is one command.\033[0m')

  A) Blueprint (recommended — this is the only way to get the persistent disk):

       render login
       open https://dashboard.render.com/blueprints
       #  New Blueprint → connect this repo → Render reads $BLUEPRINT

  B) CLI only (no disk — free/demo tier):

       render services create \\
         --name fx-journal \\
         --type web_service \\
         --repo https://github.com/YOU/fx-journal \\
         --runtime node \\
         --branch main \\
         --build-command "npm ci && npm run build" \\
         --start-command "npm start" \\
         --health-check-path /api/health \\
         --plan free \\
         --region oregon \\
         --env-var NODE_ENV=production \\
         --env-var VITE_SEED_DEMO=true \\
         --output json --confirm

  Then, from here on:

       export RENDER_SERVICE_ID=srv-xxxxxxxxxxxx
       ./scripts/deploy-render.sh

EOF
fi
