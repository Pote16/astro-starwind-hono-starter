#!/usr/bin/env bash
# =============================================================================
# Astro+Hono Starter – Auto-Deploy
# =============================================================================
# Wird nach git pull vom Ploi-Deploy-Hook ausgeführt.
# Muss aus dem Projektroot ausgeführt werden.
#
# Ploi Daemon: bun run apps/backend/src/index.ts
# =============================================================================

set -e

# ── Bun PATH (wird von non-interactive shells nicht aus .bashrc geladen) ──────
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# ── .env laden ───────────────────────────────────────────────────────────────
if [ -f .env ]; then
  set -a
  source .env 2>/dev/null || true
  set +a
fi

export CI=true

echo "============================================"
echo "  Deploy"
echo "============================================"
echo "Bun: $(bun -v 2>/dev/null || echo 'n/a')"

# ── Dependencies (Bun Workspaces) ────────
echo "==> bun install"
bun install

# ── Datenbank ────────────────────────────────────────────────────────────────
# echo "==> Drizzle Migrationen ausführen"
# bun --filter @ho-setup/db db:migrate

# ── Frontend Build (Astro/Vite) ──────────────────────────────────────────────
echo "==> Alte Frontend-Artefakte entfernen"
rm -rf apps/frontend/dist

echo "==> Frontend Build"
cd apps/frontend
bun run build
cd ../..

# ── Backend Daemon neu starten ───────────────────────────────────────────────
# pkill beendet den Bun-Prozess → Supervisor startet ihn automatisch neu
export NODE_ENV=production
echo "==> Backend: Bun-Prozess neu starten"
pkill -f "apps/backend/src/index.ts" 2>/dev/null || true
sleep 3

# Prüfe ob Backend wieder läuft (Health Check muss ggf. noch in app/backend/src/index.ts rein)
if curl -sf http://localhost:3005/api/example > /dev/null 2>&1; then
  echo "    Backend erfolgreich neu gestartet"
else
  echo "    Backend noch nicht bereit, warte weitere 5s..."
  sleep 5
fi

echo "============================================"
echo "  Deploy abgeschlossen."
echo "============================================"
