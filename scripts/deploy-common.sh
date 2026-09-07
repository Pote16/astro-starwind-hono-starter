#!/usr/bin/env bash
# Gemeinsame Vorbedingungen für die vorbereiteten Linux-/Ploi-Einstiege.
# Aufrufende Skripte setzen ROOT_DIR und laufen mit set -euo pipefail.

starter_fehler() {
  printf 'Abbruch: %s\n' "$*" >&2
  exit 1
}

starter_umgebung() {
  [ -f "$ROOT_DIR/.env" ] || starter_fehler ".env im Projektroot fehlt."

  # Source-Fehler dürfen den Deploy nicht mit einer halben Umgebung fortsetzen.
  # Ein eigener Fehlerkanal verhindert zugleich, dass Bash fehlerhafte Zeilen
  # mit Zugangsdaten in den Ploi-Log schreibt. Der EXIT-Trap erfasst auch set -u.
  exec 3>&2
  trap 'printf "Abbruch: .env konnte nicht vollständig geladen werden. Syntax lokal prüfen; Werte werden nicht protokolliert.\n" >&3; exit 1' EXIT
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env" >/dev/null 2>&1
  set +a
  trap - EXIT
  exec 3>&-

  # Supervisor erbt keine Exporte eines vorherigen Ploi-Deploy-Prozesses.
  # Deshalb erzwingen sowohl Deploy als auch Daemon-Wrapper diesen Wert.
  export NODE_ENV=production
  export CI=true
  export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  export PATH="$BUN_INSTALL/bin:$PATH"
}

starter_runtime() {
  local erwartet aktuell
  [ -s "$ROOT_DIR/.bun-version" ] || starter_fehler ".bun-version fehlt oder ist leer."
  erwartet="$(cat "$ROOT_DIR/.bun-version")"
  [[ "$erwartet" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || starter_fehler "Ungültiger Bun-Pin."
  aktuell="$(bun --version 2>/dev/null)" || starter_fehler "Bun ist nicht verfügbar."
  [ "$aktuell" = "$erwartet" ] || starter_fehler "Bun $erwartet erforderlich, gefunden: $aktuell. Projektruntime vorbereiten; kein globales Update auf dem gemeinsamen Host."
}

starter_lock() {
  command -v flock >/dev/null || starter_fehler "flock fehlt. Deployment setzt Linux voraus."
  [ ! -L "$ROOT_DIR/.deploy" ] || starter_fehler ".deploy darf kein Symlink sein."
  mkdir -p "$ROOT_DIR/.deploy"
  local lock="$ROOT_DIR/.deploy/deploy.lock"
  [ ! -L "$lock" ] || starter_fehler "Deploy-Lock darf kein Symlink sein."

  if [ "${STARTER_DEPLOY_LOCK:-}" = "1" ]; then
    # Der Ploi-Hook hält denselben offenen Deskriptor schon vor git fetch.
    # Eine bloße geerbte Flag-Variable reicht als Nachweis nicht aus.
    [ "$(readlink -f "/proc/$$/fd/9" 2>/dev/null || true)" = "$lock" ] \
      || starter_fehler "Übergebener Deploy-Lock zeigt nicht auf dieses Projekt."
    flock -n 9 || starter_fehler "Übergebener Deploy-Lock ist belegt."
  else
    (umask 077; touch "$lock")
    exec 9<>"$lock"
    flock -n 9 || starter_fehler "Ein anderer Deploy läuft bereits."
    export STARTER_DEPLOY_LOCK=1
  fi
}

# Den Port pro abgeleitetem Projekt mit dem Nginx-Proxy abgleichen.
starter_port() {
  export PORT="${PORT:-3005}"
  if ! [[ "$PORT" =~ ^[1-9][0-9]{0,4}$ ]] || ! [ "$PORT" -le 65535 ]; then
    starter_fehler "PORT muss eine ganze Zahl zwischen 1 und 65535 sein."
  fi
}
