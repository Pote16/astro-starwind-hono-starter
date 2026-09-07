#!/usr/bin/env bash
# Vorbereiteter Starter-Deploy für Linux/Ploi. Führt selbst kein git pull aus.
# Der Ploi-Hook und manuelle Aufrufe halten denselben Lock bis zum Abschluss.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd -P)"
readonly ROOT_DIR
cd "$ROOT_DIR"
# shellcheck source=scripts/deploy-common.sh
source "$SCRIPT_DIR/deploy-common.sh"
starter_umgebung
starter_runtime
[ "${RESET_DB:-false}" = "false" ] || starter_fehler "RESET_DB ist im Produktionsdeploy verboten. Ausschließlich versionierte Migrationen verwenden."
starter_port
[ -n "${DATABASE_URL:-}" ] || starter_fehler "DATABASE_URL fehlt; keine Migration mit lokalen Datenbank-Defaults."
starter_lock

NICHT_VERSIONIERTE_DATEIEN="$(git ls-files --others --exclude-standard)" \
  || starter_fehler "Unversionierte Checkout-Dateien konnten nicht geprüft werden."
if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$NICHT_VERSIONIERTE_DATEIEN" ]; then
  starter_fehler "Lokale Änderungen im Server-Checkout müssen vor dem Deploy geprüft werden."
fi
ZIEL_SHA="$(git rev-parse 'HEAD^{commit}')"
HEALTH_URL="http://127.0.0.1:${PORT}/health"
FRONTEND="$ROOT_DIR/apps/frontend"
PHASE="pruefung"
readonly ZIEL_SHA HEALTH_URL FRONTEND

PLOI_DAEMON_NAME="${PLOI_DAEMON_NAME:-}"
readonly PLOI_DAEMON_NAME
ALTE_SUPERVISOR_PID=""
NEUE_SUPERVISOR_PID=""

supervisor_pid() {
  local pid
  pid="$(sudo -n /usr/bin/supervisorctl pid "$PLOI_DAEMON_NAME" 2>/dev/null)" || return 1
  [[ "$pid" =~ ^[1-9][0-9]*$ ]] || return 1
  [ "$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)" = "$ROOT_DIR" ] || return 1
  printf '%s\n' "$pid"
}

if [ -n "$PLOI_DAEMON_NAME" ]; then
  # Nur ein konkreter Prozess, optional mit Gruppenpräfix. Supervisor versteht
  # "all" und Gruppen-Wildcards als mehrere Ziele; solche Angaben sind verboten.
  if ! [[ "$PLOI_DAEMON_NAME" =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]*(:[A-Za-z0-9_][A-Za-z0-9_.-]*)?$ ]] \
    || ! [ "${#PLOI_DAEMON_NAME}" -le 128 ]; then
    starter_fehler "PLOI_DAEMON_NAME muss genau einen Supervisor-Prozess benennen."
  fi
  case "$PLOI_DAEMON_NAME" in
    [aA][lL][lL]|[aA][lL][lL]:*|*:[aA][lL][lL]) starter_fehler "PLOI_DAEMON_NAME darf kein Sammelziel enthalten." ;;
  esac
  # Rechte, Existenz und Projektzugehörigkeit müssen vor jeder Installation,
  # Migration oder Veröffentlichung feststehen. Ein leerer/gestoppter Daemon
  # wird zuerst in Ploi eingerichtet, nicht still auf einen anderen Weg umgestellt.
  ALTE_SUPERVISOR_PID="$(supervisor_pid)" \
    || starter_fehler "Konfigurierter Ploi-Daemon ist nicht laufend, gehört nicht zu diesem Projekt oder seine gezielte sudo-pid-Freigabe fehlt."
  # pid-Leserecht allein beweist keine Restart-Berechtigung. -l prüft die
  # Freigabe ohne Ausführung, damit sie nicht erst nach dem Publish fehlt.
  sudo -n -l /usr/bin/supervisorctl restart "$PLOI_DAEMON_NAME" >/dev/null 2>&1 \
    || starter_fehler "Gezielte sudo-restart-Freigabe für den konfigurierten Ploi-Daemon fehlt."
fi

abschluss() {
  local status="$?"
  # Nur eine unterbrochene Datei-Veröffentlichung wird automatisch repariert.
  # Datenbank und laufender Backendcode haben einen anderen Lebenszyklus.
  if [ "$PHASE" = "veroeffentlichung" ] && [ ! -e "$FRONTEND/dist" ] && [ -d "$FRONTEND/dist.old" ]; then
    if mv "$FRONTEND/dist.old" "$FRONTEND/dist"; then
      printf 'Vorherigen Frontend-Build nach fehlgeschlagener Veröffentlichung wiederhergestellt.\n' >&2
    else
      printf 'Frontend-Wiederherstellung fehlgeschlagen. dist.old unverzüglich prüfen.\n' >&2
    fi
  fi
  if [ "$status" -ne 0 ] && [ "$PHASE" = "backend" ]; then
    printf 'Backend-Abnahme fehlgeschlagen. Neuer Frontend-Build und dist.old bleiben erhalten; kein vollständiger Release-Rollback erfolgt. Siehe scripts/README.md.\n' >&2
  fi
}
trap abschluss EXIT

printf 'Astro-Hono-Starter: prüfe Deploy %s\n' "$ZIEL_SHA"
bun install --frozen-lockfile
bun apps/backend/src/validate-env.ts
bun run lint
bun run typecheck
bun test
bun run format:check

# Der bisherige Nginx-Root bleibt während Build und Audits vollständig bestehen.
# Dev-Dependencies werden für Astro und das Qualitäts-Gate ausdrücklich benötigt.
printf 'Frontend in dist.new bauen und prüfen\n'
rm -rf "$FRONTEND/dist.new"
(cd "$FRONTEND" && bun run build --outDir dist.new)
[ -s "$FRONTEND/dist.new/index.html" ] || starter_fehler "Frontend-Build unvollständig: index.html fehlt."
# Projektspezifische Abnahmen gehören hierhin, vor die Datenbankmigration.

# Erst ein vollständig geprüfter Build darf das Produktionsschema verändern.
# Migrationen müssen zum noch laufenden Backend kompatibel sein. Es gibt kein
# automatisches db:push und keinen automatischen Datenbank-Rollback.
printf 'Versionierte Datenbankmigrationen anwenden\n'
bun run db:migrate

# Ein vorheriger Backup-Build wird erst entfernt, wenn sein Nachfolger bereit
# ist. Der aktuelle Build bleibt als dist.old bis zum nächsten Publish erhalten.
# Zwei Verzeichnis-mv sind kein atomarer Symlinkwechsel: das kurze Zwischenfenster
# wird hier ehrlich dokumentiert und bei einem Fehler über den EXIT-Trap repariert.
PHASE="veroeffentlichung"
rm -rf "$FRONTEND/dist.old"
if [ -d "$FRONTEND/dist" ]; then mv "$FRONTEND/dist" "$FRONTEND/dist.old"; fi
mv "$FRONTEND/dist.new" "$FRONTEND/dist"
PHASE="backend"

eigene_pids() {
  local pid
  for pid in $(pgrep -f "apps/backend/src/index.ts" 2>/dev/null || true); do
    if [ "$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)" = "$ROOT_DIR" ]; then
      printf '%s\n' "$pid"
    fi
  done
}

ALTE_PIDS=""
alte_pids_aktiv() {
  local pid
  # Niemals pgrep erneut als Kill-Liste verwenden: Supervisor kann bereits
  # einen neuen Prozess gestartet haben, während der alte noch beendet wird.
  for pid in $ALTE_PIDS; do
    if kill -0 "$pid" 2>/dev/null && [ "$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)" = "$ROOT_DIR" ]; then
      printf '%s\n' "$pid"
    fi
  done
}

printf 'Eigenen Backend-Daemon neu starten\n'
if [ -n "$PLOI_DAEMON_NAME" ]; then
  # Die Konfiguration könnte sich während des Builds geändert haben. Vor dem
  # einzigen Restart deshalb nochmals ausschließlich dieses Ziel zuordnen.
  ALTE_SUPERVISOR_PID="$(supervisor_pid)" \
    || starter_fehler "Ploi-Daemon ist vor dem Neustart nicht mehr eindeutig diesem Projekt zugeordnet."
  sudo -n /usr/bin/supervisorctl restart "$PLOI_DAEMON_NAME" 2>/dev/null \
    || starter_fehler "Gezielter Ploi-Neustart fehlgeschlagen. Daemon und dessen sudo-restart-Freigabe prüfen; kein Fallback."
else
  ALTE_PIDS="$(eigene_pids)"
  for pid in $ALTE_PIDS; do kill "$pid" 2>/dev/null || true; done
  for _ in $(seq 1 20); do
    [ -z "$(alte_pids_aktiv)" ] && break
    sleep 0.5
  done
  for pid in $(alte_pids_aktiv); do kill -9 "$pid" 2>/dev/null || true; done
  for _ in $(seq 1 10); do
    [ -z "$(alte_pids_aktiv)" ] && break
    sleep 0.2
  done
  [ -z "$(alte_pids_aktiv)" ] || starter_fehler "Alter Backendprozess konnte nicht beendet werden."
fi

neuer_daemon_vorhanden() {
  local pid alt bekannt
  if [ -n "$PLOI_DAEMON_NAME" ]; then
    pid="$(supervisor_pid)" || return 1
    [ "$pid" != "$ALTE_SUPERVISOR_PID" ] || return 1
    # Derselbe neue Prozess muss vor und nach dem HTTP-Check bestehen bleiben.
    # Ein Crash mit erneutem Supervisor-Start zählt nicht als stabiler Release.
    if [ -z "$NEUE_SUPERVISOR_PID" ]; then NEUE_SUPERVISOR_PID="$pid"; fi
    [ "$pid" = "$NEUE_SUPERVISOR_PID" ]
    return
  fi
  for pid in $(eigene_pids); do
    bekannt=false
    for alt in $ALTE_PIDS; do [ "$pid" != "$alt" ] || bekannt=true; done
    if [ "$bekannt" = "false" ]; then return 0; fi
  done
  return 1
}

# Ein zufälliges 200 reicht nicht: ein eigener, neuer Prozess muss existieren
# und exakt die IPv4-Schnittstelle antworten, die auch Nginx verwendet.
gesund=false
for _ in $(seq 1 30); do
  if neuer_daemon_vorhanden \
    && curl --fail --silent --max-time 3 --connect-timeout 1 "$HEALTH_URL" >/dev/null 2>&1 \
    && neuer_daemon_vorhanden; then
    gesund=true
    break
  fi
  sleep 1
done
[ "$gesund" = "true" ] || starter_fehler "Kein erfolgreicher Health-Check eines neuen eigenen Backends. Ploi-Daemon und dessen Log prüfen."

# Ein Erfolg referenziert den wirklich geprüften Commit, nicht HEAD@{1}.
# Der temporäre Marker verhindert einen unvollständig überschriebenen SHA.
(umask 077; printf '%s\n' "$ZIEL_SHA" > "$ROOT_DIR/.deploy/last-built-sha.new")
mv "$ROOT_DIR/.deploy/last-built-sha.new" "$ROOT_DIR/.deploy/last-built-sha"
PHASE="fertig"
printf 'Deploy %s abgeschlossen. Vorheriger Frontend-Build bleibt in dist.old.\n' "$ZIEL_SHA"
