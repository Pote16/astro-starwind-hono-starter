# Cronjobs in Ploi

Aktuell sind **keine Cronjobs eingerichtet**. Astro wird beim Deploy gebaut, das
Backend läuft als Ploi-Daemon. `run.sh` lehnt jeden Job ab, der nicht in seiner
Allowlist steht.

## Verbindliches Muster

Alle Zeitpläne werden in Ploi unter **Server → Cron Jobs** als Benutzer `ploi`
angelegt und hier gespiegelt. Der einzige erlaubte Befehl ist:

```bash
bash /home/ploi/__DOMAIN__/scripts/cronjobs/run.sh <job>
```

Ein neuer Job ist erst vollständig, wenn alle Punkte umgesetzt sind:

1. `apps/backend/src/jobs/<job>.ts`: endlicher Bun-Einstieg, Fehler enden mit
   Exitcode ungleich null, wiederholte Ausführung erzeugt keine doppelten Mails
   oder Datensätze. Änderungen an gespeicherten Daten brauchen dokumentierte
   Aufbewahrungsregeln.
2. Allowlist-Eintrag in `run.sh` (`case "$JOB" in <job>) ;;`).
3. Zeile in der Tabelle unten mit Zeitplan, Zeitzone (`Europe/Vienna`: die
   Zeitumstellung kann tägliche Termine überspringen oder doppelt auslösen),
   maximaler Laufzeit und Abschaltweg.

`run.sh` lädt die Root-`.env` über `deploy-common.sh` (verlangt
`NODE_ENV=production`), prüft den Bun-Pin, hält den Deploy-Lock geteilt (setzt
aus, solange ein Deploy läuft) und einen exklusiven Lock je Job. Aussetzen ist
Exit 0, damit Ploi keinen Fehlschlag meldet. Logs enthalten Status, Dauer und
interne IDs, keine E-Mail-Adressen, Nachrichtentexte oder Schlüssel.

Ein Deploy darf Cronjobs weder anlegen noch deren Zeitpläne verändern.

## Zeitpläne

| Job       | Zeitplan | Ploi-Befehl | Zweck |
| --------- | -------- | ----------- | ----- |
| _(keine)_ |          |             |       |
