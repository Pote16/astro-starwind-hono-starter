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
  local env_datei="$ROOT_DIR/.env" fehler_datei zeilen
  [ -f "$env_datei" ] || starter_fehler ".env im Projektroot fehlt (Ploi: Site -> Environment)."
  [ ! -L "$ROOT_DIR/.deploy" ] || starter_fehler ".deploy darf kein Symlink sein."
  mkdir -p "$ROOT_DIR/.deploy"
  fehler_datei="$ROOT_DIR/.deploy/env-fehler.log"
  (umask 077; : > "$fehler_datei")

  # Wagenrückläufe zuerst. Sie sind unsichtbar und hängen sich an JEDEN Wert.
  # Ohne diese Prüfung meldet die Zeile weiter unten "NODE_ENV muss production
  # setzen (gefunden: 'production')" — eine Meldung, die sich selbst widerspricht.
  if LC_ALL=C grep -q "$(printf '\r')" "$env_datei"; then
    rm -f "$fehler_datei"
    starter_fehler ".env enthält Wagenrückläufe (Zeilenenden aus Windows). Jeder Wert bekommt dadurch ein unsichtbares Zeichen angehängt. Nächster Schritt: den Inhalt in Ploi -> Site -> Environment neu eintragen, ohne ihn aus einer Windows-Datei zu übernehmen."
  fi

  # Herkunft von BUN_INSTALL unterscheidbar machen. Ohne das kann die spätere
  # Meldung nicht sagen, ob der Wert aus der Ploi-Environment stammt oder aus der
  # Umgebung des aufrufenden Prozesses. Eine leere Zuweisung in der .env zählt
  # dabei als gesetzt: der Betreiber sieht die Zeile in der Maske.
  starter_bun_vorher="${BUN_INSTALL-}"
  starter_bun_vorher_gesetzt="nein"
  [ -z "${BUN_INSTALL+ja}" ] || starter_bun_vorher_gesetzt="ja"
  unset BUN_INSTALL

  set -a
  # shellcheck disable=SC1090,SC1091
  if ! source "$env_datei" 2>"$fehler_datei"; then
    set +a
    zeilen="$(grep -oE 'line [0-9]+' "$fehler_datei" | grep -oE '[0-9]+' | sort -n -u | tr '\n' ' ' | sed 's/ $//')"
    rm -f "$fehler_datei"
    starter_fehler ".env konnte nicht geladen werden (Zeile ${zeilen:-unbekannt}). Werte mit Leerzeichen oder Sonderzeichen in doppelte Anführungszeichen setzen; Werte werden nicht protokolliert."
  fi
  set +a

  # `source` liefert den Exitstatus der LETZTEN Zeile. Eine fehlerhafte Zeile in
  # der Mitte — etwa "BUN_INSTALL = /pfad" mit Leerzeichen um das
  # Gleichheitszeichen — setzt nichts und bliebe sonst folgenlos: die Variable
  # fehlt, der Deploy meldet später einen ganz anderen Grund. Deshalb zählt hier
  # die aufgefangene Ausgabe, nicht nur der Status. Gemeldet werden
  # ausschließlich Zeilennummern, nie Namen oder Werte.
  if [ -s "$fehler_datei" ]; then
    zeilen="$(grep -oE 'line [0-9]+' "$fehler_datei" | grep -oE '[0-9]+' | sort -n -u | tr '\n' ' ' | sed 's/ $//')"
    rm -f "$fehler_datei"
    starter_fehler ".env enthält Zeilen, die nichts setzen (Zeile ${zeilen:-unbekannt}). Häufigste Ursache sind Leerzeichen um das Gleichheitszeichen. Nächster Schritt: diese Zeilen in Ploi -> Site -> Environment als NAME=wert ohne Leerzeichen schreiben. Werte werden nicht protokolliert."
  fi
  rm -f "$fehler_datei"

  # Der Daemon liest dieselbe Datei. Ein export hier würde nur diesen Prozess
  # betreffen und den Unterschied zwischen geprüfter und laufender Umgebung
  # verschleiern. Deshalb muss production IN der .env stehen.
  [ "${NODE_ENV:-}" = "production" ] \
    || starter_fehler ".env muss NODE_ENV=production setzen (gefunden: '${NODE_ENV:-<leer>}'). Der Ploi-Daemon liest diese Datei; ein export im Deploy erreicht ihn nicht."

  export CI=true
  starter_bun_install
}

# Legt BUN_INSTALL fest und stellt $BUN_INSTALL/bin dem PATH voran.
#
# BUN_INSTALL zeigt auf das Verzeichnis ÜBER bin/bun, je Site auf die zu
# .bun-version passende Runtime. Der PATH-Vorrang muss stehen, bevor irgendein
# Werkzeug läuft: package.json-Scripts rufen "bun" ohne Pfad erneut auf, und
# diese verschachtelten Aufrufe wählen ihre Version über den PATH des
# Kindprozesses, nicht über den absoluten Pfad des äußeren Aufrufs.
#
# Ein unbrauchbarer Wert bricht nur im Deploy ab (STARTER_STRENG=1); dort ist
# noch nichts verändert. Im Daemon-Einstieg und in den Cronjobs wäre ein Abbruch
# teurer als ein Rückfall: Supervisor ginge in FATAL, das Backend käme nicht mehr
# hoch und Nginx lieferte nur noch das statische Frontend. Dort bleibt es beim
# Hinweis.
starter_bun_install() {
  local quelle grund="" text
  if [ -n "${BUN_INSTALL+ja}" ]; then
    quelle=".env, also Ploi -> Site -> Environment"
  elif [ "${starter_bun_vorher_gesetzt:-nein}" = ja ]; then
    BUN_INSTALL="$starter_bun_vorher"
    quelle="Prozessumgebung des Aufrufers"
  else
    BUN_INSTALL="$HOME/.bun"
    quelle="Standard, weil BUN_INSTALL weder in der .env noch in der Umgebung steht"
  fi

  # Rand-Leerzeichen und Endslashes entstehen beim Eintippen in ein Textfeld.
  BUN_INSTALL="${BUN_INSTALL#"${BUN_INSTALL%%[![:space:]]*}"}"
  BUN_INSTALL="${BUN_INSTALL%"${BUN_INSTALL##*[![:space:]]}"}"
  while [ "$BUN_INSTALL" != "/" ] && [ "${BUN_INSTALL%/}" != "$BUN_INSTALL" ]; do
    BUN_INSTALL="${BUN_INSTALL%/}"
  done

  if [ -z "$BUN_INSTALL" ]; then
    grund="ist leer"
  elif [ "${BUN_INSTALL#/}" = "$BUN_INSTALL" ]; then
    # Ein relativer Pfad im PATH zeigt in jedem Unterverzeichnis woanders hin.
    # Der Frontend-Build läuft in apps/frontend und fiele dort still auf die
    # gemeinsame alte Installation zurück.
    grund="ist kein absoluter Pfad"
  elif [ "${BUN_INSTALL#*:}" != "$BUN_INSTALL" ]; then
    grund="enthält einen Doppelpunkt und würde den PATH zerlegen"
  elif [ ! -x "$BUN_INSTALL/bin/bun" ]; then
    grund="enthält kein ausführbares bin/bun"
  fi

  if [ -n "$grund" ]; then
    text="BUN_INSTALL=$BUN_INSTALL (Quelle: $quelle) $grund. Nächster Schritt: in Ploi -> Site -> Environment den Pfad auf das Verzeichnis setzen, UNTER dem bin/bun liegt — weder auf das bin-Verzeichnis noch auf die Binärdatei selbst (scripts/ploi-daemon.md)."
    [ "${STARTER_STRENG:-0}" != "1" ] || starter_fehler "$text"
    starter_hinweis "$text Ersatzweise gilt für diesen Lauf $HOME/.bun."
    BUN_INSTALL="$HOME/.bun"
    quelle="Rückfall auf den Standard"
  fi

  STARTER_BUN_QUELLE="$quelle"
  export BUN_INSTALL STARTER_BUN_QUELLE
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
  aktuell="$(bun --version 2>/dev/null | tr -d '[:space:]')" \
    || starter_fehler "Bun ist nicht verfügbar. BUN_INSTALL=$BUN_INSTALL (Quelle: ${STARTER_BUN_QUELLE:-unbekannt}) muss ein ausführbares bin/bun enthalten."
  pfad="$(command -v bun)"
  # Die Meldung nennt die gemessene Binärdatei und die Herkunft von BUN_INSTALL,
  # behauptet aber keine Ursache: fehlende Zeile, auskommentierte Zeile, leerer
  # Wert, Leerzeichen um das Gleichheitszeichen und eine zweite Zeile weiter
  # unten führen alle hierher. Das Daemon-Kommando kann sie nicht prüfen — es
  # wird von diesem Skript nie gelesen.
  [ "$aktuell" = "$erwartet" ] \
    || starter_fehler "Bun $erwartet erforderlich (.bun-version), gefunden $aktuell aus $pfad. BUN_INSTALL=$BUN_INSTALL, Quelle: ${STARTER_BUN_QUELLE:-unbekannt}. Nächster Schritt: in Ploi -> Site -> Environment prüfen, ob dort genau die Zeile BUN_INSTALL=/home/ploi/.bun-versions/$erwartet steht — ohne führendes #, ohne Leerzeichen um das Gleichheitszeichen, mit nicht leerem Wert und nur einmal. Kein globales Upgrade auf dem gemeinsamen Host."
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
