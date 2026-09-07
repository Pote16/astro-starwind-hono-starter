# Deployment mit Ploi

Diese Dateien bereiten einen Linux-/Ploi-Deploy für ein aus dem Starter abgeleitetes
Projekt vor. Sie installieren keine Site, ändern keine Serverkonfiguration und
aktivieren keinen Webhook. Die Einrichtung und Prüfung auf dem tatsächlichen Host
stehen gesondert an.

## Dateien

| Datei                | Aufgabe                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------- |
| `ploi-autodeploy.sh` | Hook-Vorlage: `main`, erwartetes Repository, Lock, Fetch, Fast-Forward und Weitergabe an `deploy.sh`           |
| `deploy.sh`          | Runtime- und Konfigurationsprüfung, Qualitätsprüfungen, Build, Migration, Veröffentlichung und Backend-Abnahme |
| `deploy-common.sh`   | Root-Umgebung, Bun-Pin, Port und gemeinsamer Lock                                                              |
| `start-backend.sh`   | Daemon-Einstieg mit Root-Umgebung und derselben Bun-Prüfung                                                    |
| `nginx.conf`         | Statisches Astro-Frontend und API-Proxy mit anpassbaren Site-Werten                                            |
| `deploy.test.ts`     | Tests mit temporären Checkouts und simulierten Deploy-Aktionen                                                 |
| `CRON.md`            | Vorgehen für künftig implementierte periodische Aufgaben                                                       |

## Einmalige Vorbereitung

1. Eigene Ploi-Site und einen sauberen Checkout des abgeleiteten Projekts auf `main`
   einrichten. Alle Platzhalter durch die tatsächlichen absoluten Pfade und
   Hostnamen ersetzen.
2. Bun **exakt gemäß `.bun-version`** bereitstellen. Auf einem gemeinsamen Server
   dafür bei Bedarf eine eigene Runtime verwenden und in der Root-`.env`
   `BUN_INSTALL=/ABSOLUTER/RUNTIME-PFAD` setzen. Dort wird `bin/bun` erwartet.
   Ohne diese Angabe gilt `$HOME/.bun`. Der Hook führt kein globales Upgrade aus.
3. Eine passende PostgreSQL-Datenbank bereitstellen. Root-`.env` anhand von
   `.env.example` anlegen und nur für den Site-Benutzer lesbar halten, beispielsweise
   mit Mode `0600`. `DATABASE_URL` ist für den Deploy und den Daemon-Wrapper Pflicht;
   `FRONTEND_ORIGINS` muss die tatsächlichen Frontend-Origins enthalten.
4. `DEPLOY_REPOSITORY` auf exakt die erwartete Ausgabe von
   `git remote get-url origin` setzen. Bei einer Starter-Kopie ist das deren eigenes
   Repository. SSH- und HTTPS-Schreibweisen werden nicht gleichgesetzt.
5. Im geprüften Checkout zunächst `bun install --frozen-lockfile` ausführen, damit
   der erste Daemonstart seine Abhängigkeiten vorfindet. Danach den Backend-Daemon
   als Site-Benutzer mit dem Projektroot als Arbeitsverzeichnis und folgendem Befehl
   konfigurieren:

   ```bash
   bash /ABSOLUTER/SITE-PFAD/scripts/start-backend.sh
   ```

   Supervisor muss den Prozess nach dessen Ende automatisch wieder starten. Der
   Wrapper lädt die Umgebung selbst und erzwingt `NODE_ENV=production`; ein späterer
   Daemon erbt keine Exporte eines früheren Deploy-Prozesses.

6. `nginx.conf` mit dem von Ploi erzeugten Vhost zusammenführen. `__DOMAIN__` und
   `__SITE_DIRECTORY__` ersetzen, vorhandene Listen-/SSL-/ACME-Includes erhalten.
   Der `map`-Block gehört in den HTTP-Kontext vor `server {}`. Die Proxy-Ziele
   verwenden Port `3005`; bei abweichendem `PORT` sämtliche Proxy-Ziele anpassen. Vor einem
   Reload die tatsächliche Konfiguration mit `nginx -t` prüfen.
7. Den Inhalt von `ploi-autodeploy.sh` in Plois Deploy-Script übernehmen. Ploi ersetzt
   `{SITE_DIRECTORY}` und `{BRANCH}`. Den Push-Webhook für `main` erst nach
   erfolgreicher Einrichtung und manueller Abnahme aktivieren.

Eine spätere Änderung der Hook-Vorlage im Repository aktualisiert nicht automatisch
Plois gespeicherten Hook. Der Deploy installiert auch keine Nginx-Konfiguration und
führt keinen Nginx-Reload aus.

## Optionaler fester Supervisor-Prozess

`PLOI_DAEMON_NAME` kann genau einen vollständigen Supervisor-Prozessnamen festlegen.
Der Wert stammt aus der tatsächlichen Daemon-Einrichtung beziehungsweise
`supervisorctl status`. Er ist keine PID. Ein mögliches Namensschema lautet
`worker-<id>:worker-<id>_00`; die konkrete Kennung ist pro Site einzutragen.

Die Administration gibt für den Site-Benutzer nur diese beiden **exakten** Befehle
mit dem tatsächlichen Prozessnamen als festem Argument ohne Passwortabfrage frei:

```text
/usr/bin/supervisorctl pid KONKRETER_PROZESSNAME
/usr/bin/supervisorctl restart KONKRETER_PROZESSNAME
```

Diese Freigaben werden administrativ in sudoers gepflegt und geprüft. Keine
Gruppen-Wildcards, kein `all` und keine allgemeine `sudo ALL`-Berechtigung verwenden.
Die Repository-Skripte ändern sudoers nicht.

Bei gesetztem Namen prüft `deploy.sh` **vor der Installation**, ob `sudo -n` die
konkrete PID lesen darf, der Prozess läuft und dessen Arbeitsverzeichnis zum
Projekt gehört. Zusätzlich prüft `sudo -n -l` die Restart-Berechtigung, ohne bereits
neu zu starten. Nach dem einen gezielten Restart müssen eine neue stabile PID
und der Health-Check erfolgreich sein. Bei falscher Kennung, fremdem Prozess,
fehlenden Rechten oder gestopptem Daemon bricht der Deploy ab; er wechselt nicht
auf eine andere Neustartmethode.

Bleibt `PLOI_DAEMON_NAME` leer, erfasst der Deploy die laufenden eigenen Backend-PIDs
anhand ihres Befehls und Projektverzeichnisses. Er beendet ausschließlich diese
PIDs; Supervisor übernimmt den Neustart. Bereits neu gestartete Prozesse landen
nicht nachträglich in der SIGKILL-Liste.

## Hook, Sperre und überprüfter Commit

Der Hook verlangt `main` sowohl als Ploi-Branch als auch im Checkout. Er vergleicht
`origin` exakt mit `DEPLOY_REPOSITORY`, lehnt Änderungen an versionierten Dateien
und nicht ignorierte unversionierte Dateien ab und hält `.deploy/deploy.lock`
bereits vor `git fetch`. Ignorierte `.env`-, Build- und `.deploy`-Dateien bleiben
zulässig. Scheitert die Git-Prüfung, wird ebenfalls abgebrochen.

Nach `git fetch --no-tags origin main` wird ausschließlich per `git merge --ff-only`
aktualisiert. Anschließend muss `HEAD` exakt dem abgerufenen Commit entsprechen;
auch ein lokal vorauseilender `main` gilt nicht als erfolgreicher Abgleich. Es gibt
keinen stillen Hard-Reset. Der Bun-Pin wird danach aus dem Zielcommit geprüft, damit
ein vorbereitetes Runtime-Upgrade nicht am Pin des vorherigen Checkouts scheitert.

Der offene Deskriptor 9 hält denselben Lock über `exec` bis zum Ende von `deploy.sh`.
Das Script prüft den geerbten Lock erneut. Ein manueller Aufruf von `deploy.sh`
verwendet dieselbe Sperre. Die Lock-Datei während eines Deploys niemals löschen;
eine neue Datei könnte sonst einen zweiten unabhängigen Lock ermöglichen.

`deploy.sh` führt selbst keinen Git-Fetch aus. Ein manueller Aufruf veröffentlicht
den bereits ausgecheckten und geprüften Commit.

## Ablauf in deploy.sh

1. Root-`.env` vollständig als Bash-Zuweisungen laden, Production erzwingen, Bun-Pin
   und Port prüfen. `RESET_DB` darf nur fehlen oder `false` sein; `DATABASE_URL`
   muss vorhanden sein. Lock, versionierte Änderungen und nicht ignorierte unversionierte Dateien prüfen.
   Bei festem Daemonnamen zusätzlich die oben genannten Supervisor-Prüfungen ausführen.
2. `bun install --frozen-lockfile` ausführen. Dev-Dependencies bleiben für Build und
   Qualitätsprüfungen erforderlich. Anschließend validiert
   `apps/backend/src/validate-env.ts` die Backend-Konfiguration, ohne App oder
   Datenbank zu starten.
3. Lint, Typprüfung, Tests und Formatprüfung ausführen.
4. Astro nach `apps/frontend/dist.new` bauen. Mindestens eine nicht leere
   `index.html` muss vorhanden sein. Zusätzliche fachliche oder SEO-Abnahmen eines
   abgeleiteten Projekts gehören an diese Stelle vor die Migration.
5. Versionierte Drizzle-Migrationen mit `bun run db:migrate` anwenden.
6. Den vorherigen Backup-Build entfernen, den aktuellen Build nach `dist.old`
   verschieben und `dist.new` als `dist` veröffentlichen. Der bisherige Live-Build
   bleibt damit bis zur nächsten Veröffentlichung als `dist.old` erhalten.
7. Das eigene Backend neu starten. Einen neuen eigenen Prozess und
   `http://127.0.0.1:${PORT}/health` prüfen, mit höchstens 30 Prüfversuchen.
8. Erst bei erfolgreicher Abnahme den überprüften Commit in
   `.deploy/last-built-sha` schreiben. Der Marker wird über eine temporäre Datei ersetzt.

## Fehler und Wiederanlauf

Während Build und Qualitätsprüfungen bleibt das bisherige Frontend online. Git-
Checkout und Abhängigkeiten können zu diesem Zeitpunkt bereits aktualisiert sein.
Ein fehlgeschlagenes Gate verändert weder den veröffentlichten Frontend-Build noch
das Datenbankschema.

Die beiden `mv`-Operationen sind **kein vollständig atomarer Release-Wechsel**.
Zwischen ihnen kann der `dist`-Pfad kurz fehlen. Bei einem erkannten Fehler in der
Veröffentlichungsphase stellt der Exit-Handler `dist.old` nach Möglichkeit wieder
her, sofern `dist` fehlt. Ein vorheriger Backup-Build wird nur bis zum nächsten
Veröffentlichungsversuch aufbewahrt.

Ein Migrationsfehler stoppt vor der Veröffentlichung; der Zustand der Datenbank ist
gesondert zu prüfen. Migrationen müssen mit dem noch laufenden vorherigen Backend
kompatibel bleiben. Es gibt keinen automatischen Datenbank-Rollback.

Scheitert die spätere Backend-Abnahme, bleibt das neue Frontend veröffentlicht und
`dist.old` erhalten. Der Erfolgsmarker bleibt auf dem vorherigen Stand. Es erfolgt
kein vollständiger Release-Rollback von Checkout, Paketen oder Datenbank. Zuerst
Daemon-Log und Konfiguration prüfen und einen passenden korrigierten Release
vorbereiten. Ein Zurücksetzen allein des Frontends muss zum laufenden Backend passen.

Nach der ersten tatsächlichen Veröffentlichung zusätzlich von außen beide
Sprachseiten, `/health`, eigene API-Routen, statische Assets und eine unbekannte
404-Adresse prüfen. Eine erfolgreiche lokale Fixture ersetzt die Server-Abnahme nicht.

## Tests und Cron

```bash
bash -n scripts/deploy.sh
bash -n scripts/deploy-common.sh
bash -n scripts/ploi-autodeploy.sh
bash -n scripts/start-backend.sh
bun test scripts/deploy.test.ts
```

Die Deploy-Tests verwenden temporäre Verzeichnisse und simulieren die produktiven
Git-, Installations-, Migrations-, HTTP- und Neustartaktionen. Sie führen keinen
Deploy auf einem Server aus.

Cronjobs sind nicht eingerichtet. [CRON.md](CRON.md) beschreibt ausschließlich die
Vorbereitung späterer, konkret definierter Aufgaben. Die laufende Hono-API gehört
in den Daemon und der Deploy in den Push-Workflow.

Der optionale HTTP-Test `scripts/nginx.test.ts` startet ausschließlich einen
temporären lokalen Nginx. Mit `STARTER_NGINX_BIN` lässt sich eine bereits
installierte Binärdatei angeben. Ohne diese Variable wird der Test übersprungen.
