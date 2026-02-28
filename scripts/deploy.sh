#!/usr/bin/env bash
# =============================================================================
# Astro+Hono-Setup – Auto-Deploy (Monorepo: Astro Frontend + Hono Backend)
# =============================================================================
# Wird nach git pull vom Ploi-Deploy-Hook ausgeführt.
# Muss aus dem Projektroot ausgeführt werden.
#
# PM2 wird von Ploi verwaltet (NodeJS-Settings: "Restart process after deployment").
# Start command in Ploi: npx tsx apps/backend/src/index.ts
# =============================================================================

set -e

# .env aus Root laden
if [ -f .env ]; then
  set -a
  source .env 2>/dev/null || true
  set +a
fi

export PORT=3004
export CI=true

echo "============================================"
echo "  Astro+Hono-Setup – Deploy"
echo "============================================"
echo "Node: $(node -v) | pnpm: $(pnpm -v 2>/dev/null || echo 'n/a')"

# ── pnpm via Corepack sicherstellen ──────────────────────────────────────────
corepack enable 2>/dev/null || true
corepack prepare pnpm@9.14.2 --activate 2>/dev/null || true

# ── Dependencies installieren ────────────────────────────────────────────────
echo "==> pnpm install"
pnpm install

# ── Prisma Client generieren ────────────────────────────────────────────────
echo "==> Prisma Client generieren"
pnpm db:generate

# ── Datenbank-Schema synchronisieren ─────────────────────────────────────────
# TODO: Auf `prisma migrate deploy` umstellen, sobald Migrations vorhanden sind
echo "==> Datenbank-Schema synchronisieren (prisma db push)"
pnpm db:push

# ── Build (Frontend + Backend) ──────────────────────────────────────────────
echo "==> Alte Build-Artefakte entfernen"
rm -rf apps/frontend/dist apps/backend/dist

echo "==> Build (alle Workspaces)"
pnpm build

export NODE_ENV=production

echo "============================================"
echo "  Deploy fertig. PM2-Restart via Ploi."
echo "============================================"
