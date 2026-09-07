#!/usr/bin/env bash
# shellcheck disable=SC2317  # Solange die Allowlist leer ist, gilt alles nach dem case als unerreichbar.
# Einziger Einstieg für Ploi-Cronjobs dieser Site (Ploi -> Server -> Cron Jobs,
# Benutzer ploi):
#
#   */5 * * * *  bash /home/ploi/__DOMAIN__/scripts/cronjobs/run.sh <job>
#
# Ein Job ist erst vollständig, wenn (1) sein Name unten in der Allowlist steht,
# (2) apps/backend/src/jobs/<job>.ts existiert und endlich mit Exitcode ≠ 0 bei
# Fehlern endet, (3) Zeitplan und exakter Ploi-Befehl in README.md stehen.
#
# Warum ein Wrapper statt des Befehls direkt in der Cron-Zeile:
#   PATH   Cron kennt $HOME/.bun/bin nicht -> "bun: command not found", still.
#   cwd    Cron startet im Home; Bun sucht die .env im Arbeitsverzeichnis.
#   Locks  Ein Lauf pro Job (kein Überlappen) und Aussetzen, solange ein Deploy
#          läuft (gemeinsamer Deploy-Lock). Aussetzen ist Exit 0: kein Fehler.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd -P)"
readonly ROOT_DIR
cd "$ROOT_DIR"
# shellcheck source=scripts/deploy-common.sh
source "$SCRIPT_DIR/../deploy-common.sh"

JOB="${1:-}"
case "$JOB" in
  # Ersten echten Job hier eintragen, z. B.:  bereinigung) ;;
  *)
    printf 'Unbekannter Job: %s. Aktuell sind keine Cronjobs freigeschaltet (scripts/cronjobs/README.md).\n' "'${JOB}'" >&2
    exit 2
    ;;
esac

starter_umgebung
starter_runtime
[ -f "$ROOT_DIR/apps/backend/src/jobs/${JOB}.ts" ] || starter_fehler "apps/backend/src/jobs/${JOB}.ts fehlt."
command -v flock >/dev/null || starter_fehler "flock fehlt. Cronjobs setzen Linux voraus."
mkdir -p "$ROOT_DIR/.deploy"

# Geteilter Deploy-Lock: während eines Deploys (Migration, Neustart) läuft
# kein Job an; der Deploy wartet umgekehrt auf laufende Jobs.
exec 9<>"$ROOT_DIR/.deploy/deploy.lock"
if ! flock -s -n 9; then
  printf '[%s] %s setzt aus: ein Deploy läuft.\n' "$(date '+%F %T')" "$JOB"
  exit 0
fi
# Ein Lauf pro Job.
exec 8<>"$ROOT_DIR/.deploy/cron-${JOB}.lock"
if ! flock -n 8; then
  printf '[%s] %s läuft noch; dieser Lauf setzt aus.\n' "$(date '+%F %T')" "$JOB"
  exit 0
fi

printf '[%s] %s startet\n' "$(date '+%F %T')" "$JOB"
CODE=0
bun run "apps/backend/src/jobs/${JOB}.ts" 8>&- 9>&- || CODE=$?
printf '[%s] %s beendet (Code %s)\n' "$(date '+%F %T')" "$JOB" "$CODE"
exit "$CODE"
