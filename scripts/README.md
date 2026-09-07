# Deployment mit Ploi

Referenz-Harness für alle aus dem Starter abgeleiteten Sites auf dem gemeinsamen
Ploi-Server (Hetzner, Benutzer `ploi`, Site-Verzeichnis `/home/ploi/<domain>`).
Die Dateien hier ändern keine Serverkonfiguration und aktivieren keinen Webhook;
was im Ploi-Panel steht, wird hier gespiegelt und von Hand synchron gehalten.

## Dateien

| Datei                | Aufgabe                                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `ploi-autodeploy.sh` | Spiegel des Ploi-Deploy-Scripts: `git fetch`, `git reset --hard origin/main`, `bash scripts/deploy.sh`                 |
| `deploy.sh`          | Vorprüfungen, Lock, Install, Gates, Build nach `dist.new`, Audits, Migration, Veröffentlichung, Daemon-Neustart        |
| `deploy-common.sh`   | Root-`.env` laden (verlangt `NODE_ENV=production`), Bun-Pin, Port, Lock, Worker-ID, `supervisorctl`                    |
| `deploy-audits.sh`   | Build-Prüfungen gegen `dist.new` (Sprachindizes, `404.html`, `robots.txt`, SEO-Gate); Ort für projektspezifische Gates |
| `start-backend.sh`   | Optionaler Daemon-Wrapper mit Bun-Pin-Prüfung; Standard bleibt `bun run apps/backend/src/index.ts`                     |
| `cronjobs/run.sh`    | Einziger Cron-Einstieg: Allowlist, Umgebung, Lock je Job, setzt während eines Deploys aus                              |
| `nginx.conf`         | Ploi-Vhost-Vorlage mit Platzhaltern `__DOMAIN__`, `__SITE_DIRECTORY__`, `__PORT__`, `__MAPPREFIX__`                    |
| `deploy.test.ts`     | Fixtures mit simuliertem bun/git/sudo/supervisorctl/curl (nur Linux, läuft in CI)                                      |
| `nginx.test.ts`      | Echte lokale Nginx-Instanz gegen die Vorlage (`STARTER_NGINX_BIN`)                                                     |
| `harness.test.ts`    | Vertragsprüfung: `.gitignore`, `.gitattributes`, keine Prozessmuster, Nginx-Regeln, `.env.example`                     |
| `ploi-daemon.md`     | Spiegel der Ploi-Masken: Daemon-Kommando, Bun-Runtime je Version, Worker-ID                                            |
| `rename.js`          | Projektnamen und Paket-Scope beim Ableiten ersetzen                                                                    |

## Betriebsmodell

- **Hook.** Das Deploy-Script im Ploi-Panel entspricht `ploi-autodeploy.sh`: jeder Push
  auf `main` setzt den Server-Checkout hart auf `origin/main` und ruft `deploy.sh`.
  Es gibt keine manuelle Freigabe; CI und die Gates in `deploy.sh` sind die Barrieren.
- **Umgebung.** Ploi schreibt `Site → Environment` nach `.env`. Diese Datei lesen
  Deploy, Cronjobs **und** der Daemon. Deshalb muss dort `NODE_ENV=production`
  stehen; `deploy.sh` bricht sonst ab. Struktur siehe `.env.example`.
- **Daemon.** `Site → Daemons`: Command `bun run apps/backend/src/index.ts`,
  Directory = Site-Verzeichnis, Processes `1`, User `ploi`, Environment file leer.
  Supervisor nennt das Programm `worker-<id>`; die `<id>` aus der Ploi-Oberfläche
  gehört als `PLOI_WORKER_ID` in die Environment. Der Deploy startet ausschließlich
  dieses Programm neu und prüft vorher, dass dessen Prozesse im eigenen Site-Verzeichnis
  laufen (eine fremde ID fällt vor jeder Änderung auf). Prozessmuster (`pkill`, `pgrep`)
  sind verboten: alle Sites starten dieselbe Kommandozeile.
- **Runtime.** `.bun-version` ist der exakte Pin; Bun erzwingt ihn nicht selbst.
  Auf dem Server liegt je Version eine eigene Installation
  (`/home/ploi/.bun-versions/<version>/bin/bun`), und jede Site zeigt über
  `BUN_INSTALL` in ihrer Ploi-Environment auf die passende. Dadurch hebt ein
  Upgrade nur diese eine Site statt alle gleichzeitig. Derselbe Pfad gehört ins
  Daemon-Kommando. Kein globales `bun upgrade`.
  Alle Masken und der Umstellungsweg: [ploi-daemon.md](ploi-daemon.md).
- **Nginx.** Vorlage `nginx.conf` mit ersetzten Platzhaltern 1:1 in
  `Site → Manage → Edit Nginx Configuration`; `Web directory` der Site muss
  `/apps/frontend/dist` sein. Kein `add_header` in Locations (sonst verlieren HTML-
  Dokumente die Security-Header); `__MAPPREFIX__` muss serverweit eindeutig sein.

## Einmalige Einrichtung einer Site

1. Ploi-Site anlegen, Repository verbinden, `Web directory` auf `/apps/frontend/dist`.
2. Server: Bun gemäß `.bun-version` bereitstellen; `flock`, `curl`, `git` sind vorhanden.
3. Einmalig als `root`: `/etc/sudoers.d/ploi-supervisorctl` mit
   `ploi ALL=(root) NOPASSWD: /usr/bin/supervisorctl`. Enger möglich:
   `/usr/bin/supervisorctl status worker-*, /usr/bin/supervisorctl stop worker-*, /usr/bin/supervisorctl start worker-*`.
   Prüfen als `ploi`: `sudo -n /usr/bin/supervisorctl status`.
4. PostgreSQL-Datenbank und -Benutzer anlegen (nur Loopback).
5. `Site → Daemons` anlegen (siehe oben), die angezeigte ID notieren.
6. `Site → Environment` nach `.env.example` füllen: mindestens `NODE_ENV=production`,
   `PORT`, `POSTGRES_*`/`DATABASE_URL`, `PUBLIC_SITE_URL`, `FRONTEND_ORIGINS`,
   `TRUSTED_PROXY_HOPS=1`, `PLOI_WORKER_ID=<id>`, `RESET_DB=false`. Daemon einmal
   neu starten, damit er die Datei liest.
7. Nginx-Vorlage einsetzen, `nginx -t`, Reload.
8. Deploy-Script im Panel = Inhalt von `ploi-autodeploy.sh` (Platzhalter bleiben, Ploi
   ersetzt sie). Ersten Deploy manuell auslösen und das Log lesen; danach den
   Push-Webhook aktivieren.
9. Von außen prüfen: Startseite, `/en/`, `/health`, eine API-Route, `/robots.txt`,
   `/sitemap-index.xml`, `/site.webmanifest`, `/llms.txt`, eine unbekannte URL
   (Status 404 mit eigener Seite). Danach Sitemap in Google Search Console und Bing
   Webmaster Tools eintragen ([docs/seo.md](../docs/seo.md)).

Bei jeder späteren Neuanlage des Daemons vergibt Ploi eine neue ID; `PLOI_WORKER_ID`
nachziehen.

## Ablauf in deploy.sh

1. `.env` laden und prüfen (`NODE_ENV=production`, Bun-Pin, `RESET_DB`, `PORT` passend
   zur Nginx-Referenz, `DATABASE_URL`, `PLOI_WORKER_ID`), exklusiven Lock nehmen
   (wartet bis `STARTER_LOCK_WAIT`, Standard 300 s, auf laufende Cronjobs).
2. Git: versionierte Abweichungen und unversionierte Quelldateien unter `apps/`,
   `packages/`, `scripts/` brechen ab; andere unversionierte Dateien (Plois
   `ploi-<hash>.sh`) werden nur gelistet.
3. Supervisor kennt `worker-<id>`; laufende PIDs gehören zu diesem Verzeichnis.
4. `bun install --frozen-lockfile`, `validate-env.ts`, `bun run lint`,
   `bun run typecheck`, `bun test apps packages`. Formatprüfung und die
   Deploy-Fixtures laufen nur in CI.
5. Astro nach `dist.new` bauen, `deploy-audits.sh` prüfen: Sprachindizes, `404.html`,
   `robots.txt` und das SEO-Gate `apps/frontend/tools/pruefe-seo.ts` (Canonical,
   hreflang, Sitemap, Bilder, interne Links, JSON-LD; Bericht `.deploy/seo-audit.json`,
   Regeln in [docs/seo.md](../docs/seo.md)). Die Build-Origin muss `PUBLIC_SITE_URL`
   entsprechen.
6. Zielcommit erneut prüfen, `bun run db:migrate` (nur versionierte Migrationen).
7. `dist` → `dist.old`, `dist.new` → `dist`. Bei einem Fehler stellt der Exit-Handler
   `dist.old` wieder her.
8. `supervisorctl stop`/`start worker-<id>:*`, danach neue PID, Arbeitsverzeichnis und
   zwei aufeinanderfolgende Health-Checks auf `127.0.0.1:$PORT/health`.
9. Erfolgsmarker `.deploy/last-built-sha`.

## Fehler und Wiederanlauf

Während Install, Gates und Build bleibt der bisherige Build online; ein Fehler
ändert weder Frontend noch Schema noch Daemon. Ein Migrationsfehler stoppt vor der
Veröffentlichung; die Datenbank ist gesondert zu prüfen. Scheitert die Backend-Abnahme,
ist das neue Frontend veröffentlicht, `dist.old` erhalten, der Marker unverändert
und der Daemon-Log in Ploi der erste Anlaufpunkt. Es gibt keinen automatischen
Datenbank- oder Gesamtrelease-Rollback; ein Rückwechsel ist ein normaler Deploy
eines bekannten Commits.

## Cronjobs

`cronjobs/README.md` beschreibt das Muster; aktuell ist kein Job freigeschaltet.

## Tests

```bash
bun test scripts            # harness.test.ts überall; deploy.test.ts nur Linux
STARTER_NGINX_BIN=/usr/sbin/nginx bun test scripts/nginx.test.ts
shellcheck -x scripts/*.sh scripts/cronjobs/*.sh
```

Unter Windows werden die Deploy-Fixtures übersprungen; CI (Ubuntu) führt sie
zusammen mit ShellCheck und einer echten Nginx-Instanz aus.
