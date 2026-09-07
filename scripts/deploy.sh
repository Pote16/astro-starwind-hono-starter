#!/usr/bin/env bash
# Produktionsdeploy für Linux/Ploi. Führt selbst kein git fetch/reset aus:
# der Ploi-Hook (scripts/ploi-autodeploy.sh) setzt den Checkout vorher auf
# origin/main und ruft dieses Skript auf. Ein manueller Aufruf aus dem
# Site-Verzeichnis veröffentlicht den bereits ausgecheckten Commit.
#
# Ablauf: Umgebung/Runtime/Worker prüfen -> Lock -> Install -> Gates ->
# Frontend nach dist.new bauen -> Build-Audits -> Migration -> dist tauschen ->
# eigenen Ploi-Daemon neu starten -> neue PID + Health -> Erfolgsmarker.
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
starter_worker
starter_lock

# Versionierte Abweichungen würden bedeuten, dass nicht der gemeldete Commit
# ausgeliefert wird. Unversionierte Dateien im Site-Root (Plois eigenes
# ploi-<hash>.sh, Logs) sind erlaubt und werden nur gelistet; unversionierte
# Quelldateien dagegen würden von Astro/Bun mitgebaut und brechen ab.
VERSIONIERT_GEAENDERT="$(git status --porcelain --untracked-files=no)" \
  || starter_fehler "Git-Status des Server-Checkouts konnte nicht geprüft werden."
if [ -n "$VERSIONIERT_GEAENDERT" ]; then
  printf '%s\n' "$VERSIONIERT_GEAENDERT" | sed 's/^/  /' >&2
  starter_fehler "Versionierte Dateien im Server-Checkout weichen ab. Sichern oder mit 'git reset --hard origin/main' verwerfen."
fi
UNVERSIONIERTE_QUELLEN="$(git ls-files --others --exclude-standard -- apps packages scripts)" \
  || starter_fehler "Unversionierte Quelldateien konnten nicht geprüft werden."
if [ -n "$UNVERSIONIERTE_QUELLEN" ]; then
  printf '%s\n' "$UNVERSIONIERTE_QUELLEN" | sed 's/^/  /' >&2
  starter_fehler "Unversionierte Quelldateien würden mitgebaut. Committen oder entfernen."
fi
UNVERSIONIERT="$(git ls-files --others --exclude-standard)" || true
[ -z "$UNVERSIONIERT" ] || starter_hinweis "Unversionierte Dateien im Checkout (werden nicht ausgeliefert): $(printf '%s' "$UNVERSIONIERT" | tr '\n' ' ')"

ZIEL_SHA="$(git rev-parse 'HEAD^{commit}')"
HEALTH_URL="http://127.0.0.1:${PORT}/health"
FRONTEND="$ROOT_DIR/apps/frontend"
PHASE="pruefung"
readonly ZIEL_SHA HEALTH_URL FRONTEND

# Der Zielcommit darf sich während des Deploys nicht ändern. Der reale Ploi-Hook
# läuft mit git reset --hard außerhalb dieses Locks; ein zweiter Hook könnte den
# Checkout umschalten. Vor jeder irreversiblen Änderung wird HEAD erneut geprüft.
git_head_pruefen() {
  [ "$(git rev-parse 'HEAD^{commit}')" = "$ZIEL_SHA" ] \
    || starter_fehler "Checkout wurde während des Deploys verändert (paralleler Hook?). Erneut deployen."
}

# Kindprozesse erhalten den Lock-Deskriptor nicht; ein hängender Build-Worker
# darf den nächsten Deploy nicht blockieren.
run() { "$@" 9>&-; }

# Der Worker muss vor jeder Installation feststehen: Supervisor kennt das
# Programm, und laufende Prozesse gehören zu genau diesem Site-Verzeichnis.
# Eine fremde Worker-ID würde hier auffallen, bevor irgendetwas neu startet.
worker_pids_pruefen() {
  local pid
  for pid in $1; do
    [ "$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)" = "$ROOT_DIR" ] \
      || starter_fehler "PID $pid von $PLOI_WORKER_PROGRAM läuft nicht in $ROOT_DIR. PLOI_WORKER_ID gehört zu einem anderen Projekt."
  done
}
printf 'Eigenen Ploi-Daemon prüfen: %s\n' "$PLOI_WORKER_PROGRAM"
starter_supervisorctl status "$PLOI_WORKER_ZIEL" >/dev/null \
  || starter_fehler "Supervisor kennt '$PLOI_WORKER_PROGRAM' nicht oder supervisorctl ist nicht freigegeben. Daemon in Ploi anlegen, PLOI_WORKER_ID eintragen und die sudoers-Regel für supervisorctl prüfen (scripts/README.md)."
ALTE_PIDS="$(starter_worker_pids || true)"
worker_pids_pruefen "$ALTE_PIDS"
[ -n "$ALTE_PIDS" ] || starter_hinweis "$PLOI_WORKER_PROGRAM läuft derzeit nicht (Erstdeploy oder gestoppt); er wird nach der Veröffentlichung gestartet."

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
    printf 'Backend-Abnahme fehlgeschlagen. Neuer Frontend-Build und dist.old bleiben erhalten; kein vollständiger Release-Rollback erfolgt. Daemon-Log in Ploi prüfen. Siehe scripts/README.md.\n' >&2
  fi
}
trap abschluss EXIT

printf 'Deploy %s prüfen\n' "$ZIEL_SHA"
run bun install --frozen-lockfile
run bun apps/backend/src/validate-env.ts
run bun run lint
run bun run typecheck
# Nur Anwendungstests. Die Deploy-/Nginx-Fixtures unter scripts/ gehören in CI.
run bun test apps packages

# Der bisherige Nginx-Root bleibt während Build und Audits vollständig bestehen.
printf 'Frontend in dist.new bauen und prüfen\n'
rm -rf "$FRONTEND/dist.new"
(cd "$FRONTEND" && run bun run build --outDir dist.new)
# shellcheck source=scripts/deploy-audits.sh
source "$SCRIPT_DIR/deploy-audits.sh"
starter_build_audits "$FRONTEND/dist.new"

# Erst ein vollständig geprüfter Build darf das Produktionsschema verändern.
# Migrationen müssen zum noch laufenden Backend kompatibel sein. Es gibt kein
# automatisches db:push und keinen automatischen Datenbank-Rollback.
git_head_pruefen
printf 'Versionierte Datenbankmigrationen anwenden\n'
run bun run db:migrate

# Der aktuelle Build bleibt als dist.old bis zum nächsten Deploy erhalten.
# Zwei mv sind kein atomarer Wechsel; das kurze Fenster wird bei einem Fehler
# über den EXIT-Trap repariert.
git_head_pruefen
PHASE="veroeffentlichung"
rm -rf "$FRONTEND/dist.old"
if [ -d "$FRONTEND/dist" ]; then mv "$FRONTEND/dist" "$FRONTEND/dist.old"; fi
mv "$FRONTEND/dist.new" "$FRONTEND/dist"
PHASE="backend"

# Neustart ausschließlich über Supervisor am Programmnamen. stop + start statt
# restart: ein gestoppter oder FATAL-Daemon (Erstdeploy, Crash nach schlechtem
# Release) wird so ebenfalls gestartet, und der Port ist vor dem Start frei.
printf 'Eigenen Ploi-Daemon neu starten: %s\n' "$PLOI_WORKER_PROGRAM"
if [ -n "$ALTE_PIDS" ]; then
  starter_supervisorctl stop "$PLOI_WORKER_ZIEL" >/dev/null \
    || starter_fehler "Supervisor konnte $PLOI_WORKER_PROGRAM nicht stoppen."
fi
if ! starter_supervisorctl start "$PLOI_WORKER_ZIEL" >/dev/null; then
  WORKER_STATUS="$(starter_supervisorctl status "$PLOI_WORKER_ZIEL" 2>/dev/null || true)"
  [[ "$WORKER_STATUS" == *RUNNING* || "$WORKER_STATUS" == *STARTING* || "$WORKER_STATUS" == *BACKOFF* ]] \
    || starter_fehler "Supervisor konnte $PLOI_WORKER_PROGRAM nicht starten. Daemon-Log in Ploi prüfen."
fi

# Ein grüner Health-Check allein würde auch ein nie ersetzter Prozess liefern.
# Verlangt wird: neue PID(s) laut Supervisor, Arbeitsverzeichnis = dieses
# Projekt, und dieselbe PID beantwortet zwei aufeinanderfolgende Health-Checks.
gesund=false
NEUE_PIDS=""
stabil=0
for _ in $(seq 1 60); do
  pids="$(starter_worker_pids || true)"
  if [ -n "$pids" ] && [ "$pids" != "$ALTE_PIDS" ]; then
    worker_pids_pruefen "$pids"
    if curl --fail --silent --max-time 3 --connect-timeout 1 "$HEALTH_URL" >/dev/null 2>&1; then
      if [ "$pids" = "$NEUE_PIDS" ]; then stabil=$((stabil + 1)); else NEUE_PIDS="$pids"; stabil=1; fi
      if [ "$stabil" -ge 2 ]; then gesund=true; break; fi
    else
      stabil=0
    fi
  fi
  sleep 1
done
[ "$gesund" = "true" ] || starter_fehler "Kein stabiler neuer Prozess von $PLOI_WORKER_PROGRAM mit erfolgreichem Health-Check auf $HEALTH_URL. Daemon-Log in Ploi prüfen."

# Nur ein Hinweis: der Daemon-Befehl in Ploi wählt seine Bun-Binärdatei selbst.
for pid in $NEUE_PIDS; do
  daemon_bun="$(readlink -f "/proc/$pid/exe" 2>/dev/null || true)"
  deploy_bun="$(readlink -f "$(command -v bun)" 2>/dev/null || true)"
  if [ -n "$daemon_bun" ] && [ -n "$deploy_bun" ] && [ "$daemon_bun" != "$deploy_bun" ]; then
    starter_hinweis "Daemon (PID $pid) läuft mit $daemon_bun, der Deploy mit $deploy_bun. Daemon-Befehl in Ploi und BUN_INSTALL abgleichen."
  fi
done

# Ein Erfolg referenziert den wirklich geprüften Commit. Der temporäre Marker
# verhindert einen unvollständig überschriebenen SHA.
(umask 077; printf '%s\n' "$ZIEL_SHA" > "$ROOT_DIR/.deploy/last-built-sha.new")
mv "$ROOT_DIR/.deploy/last-built-sha.new" "$ROOT_DIR/.deploy/last-built-sha"
PHASE="fertig"
printf 'Deploy %s abgeschlossen. Daemon %s läuft mit PID %s; vorheriger Frontend-Build liegt in dist.old.\n' "$ZIEL_SHA" "$PLOI_WORKER_PROGRAM" "$NEUE_PIDS"
