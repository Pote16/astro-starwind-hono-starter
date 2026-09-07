# Astro + Starwind + Hono Starter

[![Quality](https://github.com/Pote16/astro-starwind-hono-starter/actions/workflows/quality.yml/badge.svg)](https://github.com/Pote16/astro-starwind-hono-starter/actions/workflows/quality.yml)

Bun-Monorepo mit einem statischen Astro-Frontend, einer Hono-API und PostgreSQL über
Drizzle. Die Beispieloberfläche ist auf Deutsch unter `/` und auf Englisch unter
`/en/` erreichbar. Gemeinsames Markup liegt in
`apps/frontend/src/components/Starter.astro`, Übersetzungen in `src/i18n/ui.ts`.

## Stack

Stand des Upgrades vom 07.09.2026:

| Baustein                         | Version          | Aufgabe                                                    |
| -------------------------------- | ---------------- | ---------------------------------------------------------- |
| Bun                              | 1.4.2            | Runtime, Paketmanager, Test- und Werkzeugausführung        |
| Astro                            | 7.3.1            | Statisches HTML und dateibasiertes Routing                 |
| Starwind CLI                     | 3.3.2            | Installation und Aktualisierung der lokalen UI-Komponenten |
| Starwind Astro-Adapter / Runtime | 1.2.1 / 1.2.1    | Verhalten und zugängliche Komponenten-Primitiven           |
| Tailwind CSS                     | 4.3.3            | Styling und Theme-Tokens                                   |
| Hono / Zod                       | 4.13.7 / 4.5.4   | HTTP-Routen und Eingabevalidierung                         |
| Drizzle ORM / Kit                | 0.45.2 / 0.31.10 | PostgreSQL-Abfragen und Migrationen                        |
| TypeScript                       | 6.0.3            | Typprüfung innerhalb der unterstützten Peer-Versionen      |

Astro nutzt weiterhin Vite für seinen Entwicklungsserver und den Build. Bun führt
Astro und die weiteren CLI-Werkzeuge aus; die Projektskripte verwenden dafür
explizit `bun --bun`. Das Frontend ist als **SSG** mit `output: "static"` konfiguriert
und benötigt in Produktion keinen Astro-Server. Die Hono-API läuft als eigener
Bun-Prozess. [Astro-Konfiguration](apps/frontend/astro.config.mjs)

`.bun-version` und `packageManager` legen die Bun-Version fest; `bun.lock` hält die
aufgelösten Abhängigkeiten. Zwei neue Hauptversionen bleiben bewusst ausgeschlossen:
**TypeScript 7** wegen Astro Check und typescript-eslint sowie **ioredis 6**, weil
Unstorage den Redis-Peer in Version 5 verlangt. Details und Prüfnachweise stehen im
[Upgradebericht](docs/upgrade-2026-09-07.md).

## Lokal starten

Bun in der Version aus `.bun-version` muss bereits verfügbar sein. Die
Projektskripte führen kein globales Runtime-Update aus.

```bash
bun --version
cp .env.example .env
bun install --frozen-lockfile
bun run dev
```

Alle Befehle werden, sofern nicht anders angegeben, im Projektroot ausgeführt.
Die vorhandene `.env` beim erneuten Einrichten erhalten; der Kopierschritt ist für
einen neuen Checkout gedacht.

| Dienst            | Adresse                        |
| ----------------- | ------------------------------ |
| Frontend Deutsch  | `http://localhost:4321/`       |
| Frontend Englisch | `http://localhost:4321/en/`    |
| Backend           | `http://127.0.0.1:3005`        |
| Health-Check      | `http://127.0.0.1:3005/health` |

Das Backend bindet an `127.0.0.1`. Der Port wird über `PORT` konfiguriert.
`bun run dev:frontend` und `bun run dev:backend` starten die Workspaces einzeln.

**Docker ist für Frontend-Arbeit nicht erforderlich.** Dev-Server, Build, Lint,
Typprüfung und die Tests funktionieren ohne laufende Datenbank. Auch der Import des
DB-Moduls und `/health` benötigen keine Verbindung. Die aktuelle Route
`POST /api/users` ist eine validierte Demoantwort und speichert noch keine Benutzer.
Erst eigene persistente Routen und das Anwenden von Migrationen benötigen PostgreSQL.

### Datenbank bei Bedarf

`docker-compose.yml` stellt eine lokale PostgreSQL-18-Datenbank auf Port **5435**
bereit. Die Beispielzugangsdaten passen zu `.env.example`. Änderungen an Benutzer,
Passwort oder Datenbank müssen in Compose und `DATABASE_URL` zusammenpassen.

```bash
docker compose up -d
bun run db:migrate
```

Für bestehende Docker-Volumes und PostgreSQL-Major-Upgrades die
[PostgreSQL-18-Hinweise](docs/postgresql-18.md) lesen, bevor die Containerkonfiguration
geändert wird. Die Produktionsdatenbank wird gesondert eingerichtet. `bun run db:push` ist für
bewusste lokale Schemaänderungen gedacht und kann Daten verändern oder entfernen.
Der Deploy verwendet ausschließlich versionierte Migrationen.

## Umgebung und API

Der dokumentierte Vertrag liegt in [`.env.example`](.env.example). Backend-Skripte
laden die Root-Datei über `--env-file=../../.env`, Astro über `vite.envDir`.
Produktionswrapper lesen dieselbe Datei als vertrauenswürdige Bash-Zuweisungen;
Werte mit Leerzeichen oder Sonderzeichen entsprechend quotieren.

- `FRONTEND_ORIGINS` enthält exakte, durch Kommas getrennte Origins ohne Pfad,
  Endslash oder Wildcard. In Produktion ist eine eigene Liste erforderlich.
- `PUBLIC_API_URL` bleibt üblicherweise leer: Astro/Vite leitet `/api` lokal an
  `127.0.0.1:$PORT` weiter, Nginx übernimmt denselben Pfad in Produktion. Bei einer
  getrennten API-Origin kann die vollständige HTTP(S)-Origin ohne Pfad eingetragen werden.
- `TRUSTED_PROXY_HOPS=1` passt zur vorbereiteten Nginx-Konfiguration. Bei einer
  anderen Proxy-Kette muss der Wert überprüft werden. Der Backend-Port bleibt lokal.
- Redis ist optional. Ohne `REDIS_URL` beziehungsweise `REDIS_HOST` verwendet das
  Rate-Limiting Arbeitsspeicher; ein Prozessneustart setzt dessen Zähler zurück.

Vorhanden sind `/health`, `GET /api` und die Demo `POST /api/users`, Zod-Validierung,
Origin-Prüfung für schreibende Requests, CORS, Rate-Limiting und strukturierte
Fehlerbehandlung. `AppType` ist für einen späteren Hono-RPC-Client exportiert.
Das zweisprachige Testformular ruft diese Demo über `fetch` auf. Es prüft Name,
E-Mail, Honeypot, ein eigenes Limit von fünf Versuchen pro Minute und optional
Turnstile. Es legt keine Konten an, speichert keine Formulardaten und versendet
keine E-Mails oder Conversions.

## Cookies, Turnstile, Mail und Tracking

Die Integrationen sind vorbereitet und über `.env` konfigurierbar:

- Cookie-Auswahl auf Deutsch und Englisch mit getrenntem Opt-in für Statistik
  und Marketing sowie einem jederzeit erreichbaren Einstellungsbutton.
- Cloudflare Turnstile mit serverseitiger Host-/Aktionsprüfung, Token-Erneuerung
  und verständlichen Fehlerzuständen. Sind beide Schlüssel leer, bleibt es inaktiv.
- Resend als serverinterner Mailhelfer mit validierten Empfängern und HTML-Escaping.
- Browsertracking für Google Analytics/Ads, Meta und LinkedIn sowie Serverhelfer
  für GA4 Measurement Protocol, Meta CAPI und LinkedIn Conversions API.

Ohne konfigurierte Keys werden keine Anbieterrequests erzeugt. Serverseitiges Tracking
verlangt bei jedem Aufruf die aktuelle Einwilligung. Es gibt keinen öffentlichen
Mail- oder Tracking-Relay-Endpunkt. Datenschutzlinks erscheinen erst nach eigener
Konfiguration; projektfremde Rechtstexte oder echte Zugangsdaten sind nicht enthalten.

Die [Integrationsanleitung](docs/integrationen.md) beschreibt sämtliche Variablen,
Aufrufbeispiele, Testmöglichkeiten und die Grenzen von Widerruf und Deduplizierung.

## Befehle und Qualitätsprüfung

| Befehl                 | Zweck                                                 |
| ---------------------- | ----------------------------------------------------- |
| `bun run dev`          | Frontend und Backend starten                          |
| `bun run build`        | Statisches Frontend bauen, Backend-Typen prüfen       |
| `bun run lint`         | Astro-Diagnostik und ESLint                           |
| `bun run typecheck`    | Typprüfung aller Workspaces                           |
| `bun test`             | Tests einschließlich lokaler Deploy-Fixtures          |
| `bun run format`       | Prettier einschließlich Astro und Tailwind            |
| `bun run format:check` | Formatierung prüfen                                   |
| `bun run outdated`     | Paketversionen in allen Workspaces vergleichen        |
| `bun run db:generate`  | Versionierte Migration erzeugen                       |
| `bun run db:migrate`   | Vorhandene Migrationen anwenden                       |
| `bun run db:push`      | Schema direkt abgleichen, nur bewusst lokal verwenden |

Vor einer Änderung zuerst den vorhandenen Zustand prüfen. Vor einem Commit müssen
Lint, Typprüfung, Tests, Formatprüfung und Build erfolgreich sein. Generierte
Starwind-Dateien und Drizzle-Migrationen sind von Prettier ausgenommen.

Das Backend läuft direkt aus den TypeScript-Quellen mit Bun. Sein Build prüft deshalb
nur die Typen mit `tsc --noEmit` und erzeugt kein eigenes `dist`-Verzeichnis.

## Test- und Agent-Harness

GitHub prüft jeden Push auf `main` und jeden Pull Request mit den Jobs `Quality` und `Browser E2E`.
Das Gate umfasst Frozen-Install, Lint, Typen, Formatierung, Build, Bun-Tests und
reale Nginx-Routingtests. Isolierte Playwright-Tests bedienen die deutsche und
englische Oberfläche auf Desktop und Mobilgeräten. Sie prüfen Formularabläufe,
Turnstile und Cookie-Zustände mit abgefangenen Anbieterrequests.

Der Browserrunner benötigt zusätzlich Node.js 22. Playwright läuft mit seinem
offiziellen Node-CLI über `bunx playwright`; Paketinstallation, Bun-Tests und
Appserver bleiben auf Bun. `bun --bun` wird für diesen Runner bewusst nicht erzwungen.
Die übrige lokale Entwicklung benötigt keinen zusätzlichen Node-Prozess.

Die Workflows verwenden schreibgeschützte Repositoryrechte, gepinnte Actions,
Zeitlimits und keine Produktionsschlüssel. Sie deployen nichts. Ein grüner Test
ersetzt noch nicht die spätere Abnahme echter Domains und Anbieterzugänge.
[Prüfanleitung und Grenzen](docs/quality.md)

[AGENTS.md](AGENTS.md) bündelt die Regeln für Coding-Agents. `CLAUDE.md` und die
werkzeugspezifischen Regeln verweisen darauf, damit sich Stack- und
Sicherheitsanweisungen nicht widersprechen. Generische Starwind-Skills bleiben
erhalten; der projektspezifische Bun-Vertrag hat Vorrang.

## Starwind UI 3

Die sechs Komponenten `button`, `card`, `badge`, `separator`, `input` und `label` liegen unter
`apps/frontend/src/components/starwind/`. Die offiziellen CLI-Kommandos werden aus
`apps/frontend/` ausgeführt:

```bash
cd apps/frontend
export npm_config_user_agent="bun/$(bun --version)"
bunx --bun starwind@latest docs button card
bunx --bun starwind@latest update --all --dry-run
```

Die Umgebungsvariable hält auch die Paketmanager-Erkennung der CLI bei Bun; sie
wurde für Starwind 3.3.2 geprüft. Nach Prüfung eines Update-Plans kann der gleiche
Aufruf ohne `--dry-run` verwendet werden. Neue Komponenten lassen sich mit
`bunx --bun starwind@latest add dialog` hinzufügen.

`starwind.config.json` dokumentiert die installierten Komponenten. Die dortige
`version: 2` bezeichnet das **Konfigurationsschema**, nicht die UI-Hauptversion.

Starwind Pro ist optional. Der Starter enthält nur die Registry-Konfiguration und
keine Lizenz. Ein eigener Schlüssel gehört ausschließlich in
`apps/frontend/.env.local`; die aktuelle Einrichtung beschreibt die
[Starwind-Dokumentation](https://starwind.dev/docs/getting-started/installation/).
Für die sechs vorhandenen freien Komponenten wird kein Pro-Key benötigt.

## Projektstruktur

```text
apps/frontend/       Astro-Seiten, gemeinsames Template, Übersetzungen, Starwind
apps/backend/        Hono-API, Middleware, Umgebungsvalidierung und Tests
packages/db/         Drizzle-Schema, Client und Migrationen
packages/logger/     Gemeinsamer Pino-Logger
scripts/             Ploi-Deploy-Harness, Nginx-Vorlage, Cron-Wrapper, Deploy-Tests
.bun-version         Verbindlicher Bun-Pin
bun.lock             Geprüfter Paketstand
.env.example         Umgebungsvertrag ohne echte Zugangsdaten
```

## Deployment und Cronjobs

`scripts/` ist der Referenz-Harness für alle Ploi-Sites: Push auf `main` → Ploi-Hook
(`git reset --hard origin/main`) → `scripts/deploy.sh`. Der Deploy lädt die von Ploi
geschriebene `.env` (Pflicht: `NODE_ENV=production`, `PLOI_WORKER_ID`), prüft Bun-Pin,
Lint, Typen und Tests, baut nach `dist.new`, migriert, tauscht das Frontend und
startet ausschließlich den eigenen Supervisor-Daemon `worker-<id>` neu, mit
Nachweis einer neuen PID und Health-Check. Die [Ploi-Anleitung](scripts/README.md)
beschreibt Einrichtung, Ablauf und Grenzen; die Entscheidungen stehen im
[Design](docs/superpowers/specs/2026-09-07-ploi-deploy-harness-design.md).

Cronjobs laufen ausschließlich über `scripts/cronjobs/run.sh`
([Muster und Zeitpläne](scripts/cronjobs/README.md)); aktuell ist keiner freigeschaltet.
