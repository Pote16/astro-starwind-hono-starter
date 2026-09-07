#!/usr/bin/env bash
# Vorbereiteter Ploi-Daemon: bash /ABSOLUTER/SITE-PFAD/scripts/start-backend.sh
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

# exec erhält die überwachte PID. Nach SIGTERM startet Supervisor den neuen
# Backendprozess mit derselben geprüften Umgebung, ohne zusätzliche Shell.
exec bun run apps/backend/src/index.ts
