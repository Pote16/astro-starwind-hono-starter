#!/usr/bin/env bash
# Gemeinsame Vorbedingungen für deploy.sh, start-backend.sh und cronjobs/run.sh.
# Aufrufende Skripte setzen ROOT_DIR und laufen mit set -euo pipefail.
#
# Realität auf dem Ploi-Server (gilt für alle aus dem Starter abgeleiteten Sites):
#   - Ploi schreibt "Site -> Environment" 1:1 nach <site>/.env.
#   - Der Backend-Daemon ist ein Ploi-Daemon (Supervisor-Programm worker-<id>),
#     Kommando `bun run apps/backend/src/index.ts`, Arbeitsverzeichnis = Site.
#     Er liest dieselbe .env selbst; Exporte aus diesem Skript erreichen ihn nie.
#   - Mehrere Sites teilen sich Server, Benutzer `ploi` und dieselbe Bun-Installation.

starter_fehler() {
  printf 'Abbruch: %s\n' "$*" >&2
  exit 1
}

starter_hinweis() {
  printf 'Hinweis: %s\n' "$*" >&2
}

# Lädt die Root-.env als Bash-Zuweisungen (set -a), ohne Werte zu protokollieren.
# Bash und Bun expandieren ${VAR} in Werten gleich; Werte mit Leerzeichen oder
# Sonderzeichen gehören in doppelte Anführungszeichen. Ein Syntaxfehler bricht
# ab und meldet ausschließlich die Zeilennummer.
starter_umgebung() {
  local env_datei="$ROOT_DIR/.env" fehler_datei zeile
  [ -f "$env_datei" ] || starter_fehler ".env im Projektroot fehlt (Ploi: Site -> Environment)."
  [ ! -L "$ROOT_DIR/.deploy" ] || starter_fehler ".deploy darf kein Symlink sein."
  mkdir -p "$ROOT_DIR/.deploy"
  fehler_datei="$ROOT_DIR/.deploy/env-fehler.log"
  (umask 077; : > "$fehler_datei")

  set -a
  # shellcheck disable=SC1090,SC1091
  if ! source "$env_datei" 2>"$fehler_datei"; then
    set +a
    zeile="$(grep -oE 'line [0-9]+' "$fehler_datei" | head -n 1 || true)"
    rm -f "$fehler_datei"
    starter_fehler ".env konnte nicht geladen werden (${zeile:-Position unbekannt}). Werte mit Leerzeichen/Sonderzeichen in doppelte Anführungszeichen setzen; Werte werden nicht protokolliert."
  fi
  set +a
  rm -f "$fehler_datei"

  # Der Daemon liest dieselbe Datei. Ein export hier würde nur diesen Prozess
  # betreffen und den Unterschied zwischen geprüfter und laufender Umgebung
  # verschleiern. Deshalb muss production IN der .env stehen.
  [ "${NODE_ENV:-}" = "production" ] \
    || starter_fehler ".env muss NODE_ENV=production setzen (gefunden: '${NODE_ENV:-<leer>}'). Der Ploi-Daemon liest diese Datei; ein export im Deploy erreicht ihn nicht."

  export CI=true
  export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  export PATH="$BUN_INSTALL/bin:$PATH"
}

# Exakter Bun-Pin aus .bun-version. Bun selbst erzwingt weder .bun-version noch
# packageManager; diese Prüfung ist auf dem Server der einzige Mechanismus.
#
# Auf dem gemeinsamen Host liegt je Version eine eigene Runtime:
#   /home/ploi/.bun-versions/<version>/bin/bun
# Jede Site zeigt über BUN_INSTALL in ihrer Ploi-Environment auf die Version,
# die zu ihrer .bun-version passt. Dadurch hebt ein Upgrade nur diese eine Site,
# nicht alle gleichzeitig. starter_umgebung stellt BUN_INSTALL/bin voran, damit
# auch verschachtelte Aufrufe (ein package.json-Script, das erneut "bun" ruft)
# dieselbe Version erben; ohne das entscheidet der PATH des Kindprozesses.
# Details und die Ploi-Masken: scripts/ploi-daemon.md.
starter_runtime() {
  local erwartet aktuell pfad
  [ -s "$ROOT_DIR/.bun-version" ] || starter_fehler ".bun-version fehlt oder ist leer."
  erwartet="$(tr -d '[:space:]' < "$ROOT_DIR/.bun-version")"
  [[ "$erwartet" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || starter_fehler "Ungültiger Bun-Pin in .bun-version."
  aktuell="$(bun --version 2>/dev/null | tr -d '[:space:]')" || starter_fehler "Bun ist nicht verfügbar (BUN_INSTALL=$BUN_INSTALL erwartet bin/bun darin)."
  pfad="$(command -v bun)"
  [ "$aktuell" = "$erwartet" ] \
    || starter_fehler "Bun $erwartet erforderlich, gefunden $aktuell aus $pfad. In der Ploi-Environment BUN_INSTALL=/home/ploi/.bun-versions/$erwartet setzen (dort muss bin/bun liegen) und denselben Pfad im Daemon-Kommando verwenden; kein globales Upgrade auf dem gemeinsamen Host."
}

# Exklusiver Deploy-Lock. Cronjobs halten denselben Lock geteilt (flock -s -n)
# und setzen aus, solange ein Deploy läuft; der Deploy wartet umgekehrt bis zu
# STARTER_LOCK_WAIT Sekunden auf laufende Jobs.
starter_lock() {
  local lock="$ROOT_DIR/.deploy/deploy.lock" wartezeit="${STARTER_LOCK_WAIT:-300}"
  command -v flock >/dev/null || starter_fehler "flock fehlt. Deployment setzt Linux voraus."
  [ ! -L "$ROOT_DIR/.deploy" ] || starter_fehler ".deploy darf kein Symlink sein."
  mkdir -p "$ROOT_DIR/.deploy"
  [ ! -L "$lock" ] || starter_fehler "Deploy-Lock darf kein Symlink sein."
  (umask 077; touch "$lock")
  exec 9<>"$lock"
  flock -w "$wartezeit" 9 \
    || starter_fehler "Ein anderer Deploy oder Cronjob hält den Lock länger als ${wartezeit}s (.deploy/deploy.lock)."
}

# PORT aus der .env; muss zum Nginx-Proxy der Site passen.
starter_port() {
  export PORT="${PORT:-3005}"
  if ! [[ "$PORT" =~ ^[1-9][0-9]{0,4}$ ]] || ! [ "$PORT" -le 65535 ]; then
    starter_fehler "PORT muss eine ganze Zahl zwischen 1 und 65535 sein."
  fi
  # Die versionierte Nginx-Referenz muss auf denselben Port zeigen. Die
  # unveränderte Starter-Vorlage trägt noch den Platzhalter __PORT__.
  if [ -f "$ROOT_DIR/scripts/nginx.conf" ] && ! grep -q '__PORT__' "$ROOT_DIR/scripts/nginx.conf"; then
    grep -q "127\.0\.0\.1:${PORT}\b" "$ROOT_DIR/scripts/nginx.conf" \
      || starter_fehler "scripts/nginx.conf proxyt nicht auf 127.0.0.1:${PORT}. PORT in Ploi und Nginx-Referenz abgleichen."
  fi
}

# Der eigene Ploi-Daemon wird ausschließlich über seinen Supervisor-Programmnamen
# angesprochen. PLOI_WORKER_ID ist die Zahl aus Ploi -> Site -> Daemons.
# Prozessmuster (pkill/pgrep) sind auf dem gemeinsamen Host verboten: alle
# Sites starten dieselbe Kommandozeile.
starter_worker() {
  [ -n "${PLOI_WORKER_ID:-}" ] || starter_fehler "PLOI_WORKER_ID fehlt in .env (Ploi -> Site -> Environment; Zahl aus Ploi -> Daemons)."
  [[ "$PLOI_WORKER_ID" =~ ^[0-9]{1,12}$ ]] || starter_fehler "PLOI_WORKER_ID muss eine Zahl sein (gefunden: '$PLOI_WORKER_ID')."
  PLOI_WORKER_PROGRAM="worker-${PLOI_WORKER_ID}"
  PLOI_WORKER_ZIEL="${PLOI_WORKER_PROGRAM}:*"
  export PLOI_WORKER_PROGRAM PLOI_WORKER_ZIEL
}

# supervisorctl mit passwortloser sudo-Freigabe, ersatzweise direkt. Fehlermeldungen
# von Supervisor kommen als Text mit Exit 0, deshalb wird die Ausgabe geprüft.
# STARTER_SUPERVISORCTL_OK nennt einen zusätzlich erlaubten Exitcode; siehe
# starter_worker_status.
starter_supervisorctl() {
  local ausgabe rc versuch
  for versuch in sudo direkt; do
    if [ "$versuch" = sudo ]; then
      ausgabe="$(sudo -n /usr/bin/supervisorctl "$@" 2>&1)" && rc=0 || rc=$?
    else
      ausgabe="$(/usr/bin/supervisorctl "$@" 2>&1)" && rc=0 || rc=$?
    fi
    if { [ "$rc" -eq 0 ] || [ "$rc" = "${STARTER_SUPERVISORCTL_OK:-}" ]; } \
      && [[ "$ausgabe" != *"ERROR"* ]] && [[ "$ausgabe" != *"error:"* ]] && [[ "$ausgabe" != *"no such"* ]]; then
      printf '%s\n' "$ausgabe"
      return 0
    fi
  done
  printf '%s\n' "$ausgabe" >&2
  return 1
}

# Status des eigenen Programms. `supervisorctl status` endet nach LSB mit Exit 3,
# sobald einer seiner Prozesse STOPPED, EXITED oder FATAL ist — beim Erstdeploy
# und nach einem abgestürzten Daemon genau der Zustand, den stop + start
# repariert. Nur ein unbekanntes Programm (Exit 4, "no such group/process") und
# eine fehlende sudo-Freigabe dürfen den Deploy stoppen.
starter_worker_status() {
  # shellcheck disable=SC2034  # wird per dynamischem Gültigkeitsbereich in starter_supervisorctl gelesen
  local STARTER_SUPERVISORCTL_OK=3
  starter_supervisorctl status "$PLOI_WORKER_ZIEL"
}

# Alle PIDs des eigenen Supervisor-Programms, sortiert, leer wenn gestoppt.
# Zeile: "worker-123:worker-123_00   RUNNING   pid 4711, uptime 0:00:21"
starter_worker_pids() {
  starter_worker_status 2>/dev/null \
    | awk '{ for (i = 1; i < NF; i++) if ($i == "pid") { gsub(/,/, "", $(i + 1)); print $(i + 1) } }' \
    | sort -n \
    | tr '\n' ' ' \
    | sed 's/ $//'
}
