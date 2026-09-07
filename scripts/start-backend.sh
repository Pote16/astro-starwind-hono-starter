#!/usr/bin/env bash
# OPTIONALER Daemon-Einstieg: bash /home/ploi/__DOMAIN__/scripts/start-backend.sh
#
# Standard-Daemon in Ploi ist der direkte Aufruf `bun run apps/backend/src/index.ts`
# mit dem Site-Verzeichnis als Arbeitsverzeichnis; Bun lädt die .env selbst.
# Dieser Wrapper ist nur nötig, wenn der Daemon zusätzlich den Bun-Pin und
# DATABASE_URL vor dem Start prüfen soll. Beide Varianten setzen voraus, dass
# NODE_ENV=production in der Ploi-Environment steht.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd -P)"
readonly ROOT_DIR
cd "$ROOT_DIR"
# shellcheck source=scripts/deploy-common.sh
source "$SCRIPT_DIR/deploy-common.sh"

starter_umgebung
starter_runtime
starter_port
[ -n "${DATABASE_URL:-}" ] || starter_fehler "DATABASE_URL fehlt; kein Produktionsstart mit lokalen Datenbank-Defaults."

# exec erhält die von Supervisor überwachte PID.
exec bun run apps/backend/src/index.ts
