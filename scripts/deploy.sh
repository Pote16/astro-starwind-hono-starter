#!/usr/bin/env bash
# =============================================================================
# Astro+Hono Starter – Auto-Deploy
# =============================================================================
# Wird nach git pull vom Ploi-Deploy-Hook ausgeführt.
# Muss aus dem Projektroot ausgeführt werden.
#
# Ploi Daemon: bun run apps/backend/src/index.ts
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

# ── Bun PATH (wird von non-interactive shells nicht aus .bashrc geladen) ──────
export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"

# ── .env laden ───────────────────────────────────────────────────────────────
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env 2>/dev/null || true
  set +a
fi

export CI=true

PORT="${PORT:-3005}"
HEALTH_URL="http://127.0.0.1:${PORT}/health"

echo "============================================"
echo "  Astro+Hono Starter – Deploy"
echo "============================================"
echo "Bun: $(bun -v 2>/dev/null || echo 'n/a')"
echo "Backend (lokal): ${HEALTH_URL}"

# ── Dependencies (Bun Workspaces) ────────────────────────────────────────────
echo "==> bun install (alle Workspaces)"
bun install

# ── Datenbank ────────────────────────────────────────────────────────────────
if [ "${RESET_DB:-false}" = "true" ]; then
  echo "==> DB Push (RESET_DB=true – nur Dev/Staging!)"
  bun run --filter @ho-setup/db db:push
else
  echo "==> Drizzle Migrationen ausführen"
  bun run --filter @ho-setup/db db:migrate
fi

# ── Production-Umgebung für Build & laufende Schritte im Hook ────────────────
# Wichtig: *vor* Frontend-Build setzen (Astro/Vite), nicht erst beim Backend-Restart.
export NODE_ENV=production

# ── Frontend Build (Astro) — atomarer dist-Swap ──────────────────────────────
# Verhindert das 500-Fenster, in dem Nginx auf eine nicht-existente
# index.html greift, während Astro gerade neu baut.
echo "==> Frontend Build (astro) → apps/frontend/dist.new"
cd apps/frontend
rm -rf dist.new
bunx astro build --outDir dist.new

echo "==> Atomarer dist-Swap"
rm -rf dist.old 2>/dev/null || true
if [ -d dist ]; then mv dist dist.old; fi
mv dist.new dist
rm -rf dist.old 2>/dev/null || true
cd "$ROOT_DIR"

# ── Backend Daemon neu starten ───────────────────────────────────────────────
# pkill beendet den Bun-Prozess → Supervisor startet ihn automatisch neu
# (supervisorctl braucht sudo-Passwort, daher pkill als zuverlässige Alternative)
#
# SHARED SERVER: Vollständigen Projektpfad matchen, damit andere Apps mit
# apps/backend/src/index.ts (z. B. mediapool.digital) nicht mitbeendet werden.
echo "==> Backend: Bun-Prozess neu starten"
pkill -f "${ROOT_DIR}/apps/backend/src/index.ts" 2>/dev/null || true

echo "==> Health Check"
ok=false
for _ in $(seq 1 30); do
  if curl -sf "${HEALTH_URL}" >/dev/null 2>&1; then ok=true; break; fi
  sleep 1
done
if [ "$ok" = true ]; then
  echo "    Backend erfolgreich neu gestartet"
else
  echo "    Backend Health-Check FEHLGESCHLAGEN nach 30s (${HEALTH_URL})" >&2
  exit 1
fi

echo "============================================"
echo "  Deploy abgeschlossen."
echo "============================================"

# ── Status-Check ─────────────────────────────────────────────────────────────
echo ""
echo "============================================"
echo "  Status-Check"
echo "============================================"

if curl -sf "${HEALTH_URL}" >/dev/null 2>&1; then
  echo "✅ Backend:  healthy (Port ${PORT}, /health)"
else
  echo "❌ Backend:  NICHT erreichbar (${HEALTH_URL})"
fi

if pg_isready -q 2>/dev/null; then
  echo "✅ Postgres: ready"
else
  echo "⚠️  Postgres: pg_isready nicht verfügbar oder DB nicht erreichbar"
fi

echo "============================================"
echo "  Deploy $(date '+%Y-%m-%d %H:%M:%S UTC')"
echo "============================================"
