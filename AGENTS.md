# AGENTS.md

Kanonische Projektanweisungen für diesen Starter. `CLAUDE.md` importiert diese Datei;
`.agent/rules`, `.claude/rules` und `.cursor/rules` enthalten nur Verweise. Regeln
hier pflegen, nicht in den Werkzeugkopien. Einrichtung und Versionsdetails stehen
in [README.md](README.md), Deployment in [scripts/README.md](scripts/README.md).

## Stack und Grenzen

- Bun **1.4.2** ist Runtime, Paketmanager und Test-/Werkzeugrunner. Maßgeblich sind
  `.bun-version`, `packageManager` und `bun.lock`. Nur `bun`/`bunx` verwenden;
  CLI-Skripte führen Werkzeuge mit `bun --bun` aus. Keine npm-/pnpm-/yarn-Aufrufe.
  Ausnahme: Playwright 1.63 benötigt seinen offiziellen Node-CLI (Node 22),
  aufgerufen mit `bunx playwright` ohne erzwungenes `--bun`. Appserver und Unit-Tests
  bleiben auf Bun; für Playwright keinen eigenen TypeScript-Loader bauen.
- Astro **7**, Tailwind **4**, Starwind UI **3**. Astro nutzt Vite und baut statisches
  HTML (`output: "static"`). Kein SSR-Adapter und keine Astro Actions einführen,
  ohne eine ausdrücklich vereinbarte Architekturänderung.
- Hono läuft separat auf Bun, standardmäßig auf `127.0.0.1:3005`. Astro-Dev verwendet
  Port 4321; lokale PostgreSQL Port 5435. Belegte Ports nicht ungefragt übernehmen.
- Interne Pakete heißen `@ho-setup/db` und `@ho-setup/logger`. Über Paketnamen
  importieren, nicht über relative Pfade in andere Workspaces.
- TypeScript bleibt vorerst auf **6.x**: Astro Check und typescript-eslint tragen
  TS 7 noch nicht. Kompatibilität vor Versionsänderungen prüfen, nicht blind
  sämtliche Hauptversionen anheben.
- Die Demo `POST /api/users` validiert Eingaben. Sie legt keine Konten an, speichert
  nichts und versendet weder Mail noch Tracking-Events. Es gibt keine fertige
  Authentifizierung, Sessionverwaltung oder Zahlungs-/Webhook-Integration.

## Workflow und Qualitätsgate

- Bestehende Nutzerentscheidungen und Aufgabenabgrenzungen beachten. Routinefragen
  selbst lösen; fehlende fachliche Entscheidungen gezielt klären. Keine Fähigkeiten,
  Leistungen, Lizenzrechte oder Produktionszustände erfinden.
- Kleine nachvollziehbare Änderungen umsetzen. Fremde Änderungen nicht zurücksetzen.
  Neue Fehler mit passenden Regressionstests absichern; keine Tests schreiben, die
  ausschließlich die eigene Implementierung wiederholen.
- Nach Änderungen die betroffenen Prüfungen ausführen. Vor Abschluss müssen die
  Root-Befehle `bun run lint`, `bun run typecheck`, `bun test`, `bun run build`,
  `bun run audit:seo`, `bun run format:check` und `bun run test:e2e` bestehen. Bei
  neuen Abhängigkeiten zusätzlich `bun install --frozen-lockfile` prüfen.
- Browsertests verwenden simulierte Anbieterantworten und erfundene Testdaten.
  Keine echten Turnstile-, Mail- oder Tracking-Aufrufe im Testlauf. Die gleichen
  Gates gelten in CI, ohne Datenbank und ohne echte Anbieterzugangsdaten.
- ESLint prüft Fehler; Prettier formatiert und sortiert Tailwind-Klassen. Die
  `.prettierignore` beachten. Generierte Dateien nicht für Formatkorrekturen ändern.
- Strikte Typen, kein `any`; sichere Typinferenz ist erwünscht. Externe Daten mit
  Zod validieren, Typen daraus ableiten. Schemas gehören nach `schemas/`; keine
  ungeprüften `as`-Casts. `safeParse` für erwartbare Fehler verwenden; eigene
  Refinements dürfen keine ungefangenen Exceptions auslösen.

## Frontend und Sprachen

- `.astro` für statische Oberflächen; einfache Interaktivität über `<script>` und
  native Browser-APIs. `client:*` ist für Framework-Islands, nicht für Vanilla-JS.
  Keine zusätzliche UI-Framework-Abhängigkeit ohne konkreten Bedarf.
- Astro-i18n bleibt nativ: Deutsch unter `/`, Englisch unter `/en/`,
  `prefixDefaultLocale: false`. `Astro.currentLocale` und `getRelativeLocaleUrl`
  verwenden. Kein automatischer Redirect anhand der Browsersprache.
- Gemeinsames Seiten-Markup liegt in `components/Starter.astro`; die englische Route
  verwendet `[lang]/index.astro` mit `getStaticPaths()`. UI-/Formular-/Consent-Texte
  stehen in `src/i18n/`. Neue Texte in beiden Sprachen pflegen, keine doppelten Seiten
  für identisches Markup erzeugen.
- Formulare senden JSON per Client-Fetch an die Hono-API. `AppType` ist exportiert,
  ein Hono-RPC-Client ist aktuell nicht angebunden. Kein Build-Fetch auf die API.
- Formulare dürfen bei fehlendem JavaScript keine personenbezogenen Daten in
  GET-URLs schreiben. Labels, Tastaturzugang, verständliche Statusmeldungen und
  schmale Viewports berücksichtigen. API-Erfolg vor einer Erfolgsmeldung validieren.
- Starwind-Komponenten unter `components/starwind/` sind generiert. Installation
  und Aktualisierung über die CLI; Anpassungen über Props/Klassen oder eigene
  Bausteine. Semantische Tailwind-Tokens aus `styles/global.css` verwenden.

## SEO, strukturierte Daten und Bilder

- `src/data/site.ts` ist die einzige Quelle für Fakten über Website und Betreiber
  (Name, Origin aus `PUBLIC_SITE_URL`, Beschreibung je Sprache, Kontakt, Profile).
  JSON-LD, Manifest, `robots.txt` und `llms.txt` lesen nur dort. Keine erfundenen
  Adressen, Bewertungen, Preise oder Verfügbarkeiten; leere Felder bleiben leer und
  werden in den strukturierten Daten weggelassen.
- Jede Seite übergibt dem Layout `title` und `description`, je Seite und Sprache
  eindeutig (`src/i18n/ui.ts`). Jede Seite existiert unter derselben Kennung in allen
  Sprachen mit Endslash; Danke- und Fehlerseiten sind `noindex` bzw. stehen in
  `NOINDEX_SEITEN` (`src/lib/seiten.ts`).
- Bilder ausschließlich über `components/Bild.astro` aus `src/assets`; genau ein Bild
  pro Seite trägt `priority`. `public/` nur für Icons und unveränderte Dateien.
  Kein `ClientRouter`; Prefetch nur mit `data-astro-prefetch` auf Navigationslinks.
- `bun run audit:seo` muss nach `bun run build` bestehen; dasselbe Gate läuft im Deploy
  gegen `dist.new` und in CI. Regeln und Kennungen: [docs/seo.md](docs/seo.md).

## Backend, Datenbank und Umgebung

- Dev, Build, Typprüfung, Tests und `/health` müssen ohne Datenbank/Redis laufen.
  Keine Abfrage beim Modulimport, Backendstart oder in `getStaticPaths()` ergänzen.
  Der Backend-Build ist `tsc --noEmit`; Bun startet `src/index.ts` direkt.
- PostgreSQL-Zugriffe über Drizzle und `@ho-setup/db`; der Runtime-Client nutzt Bun
  SQL. Schema in `packages/db/src/schema.ts`, Migrationen in `packages/db/drizzle/`.
  Keine neue ORM-Schicht. SQL nur parametrisiert; `db:push` nicht in Produktion.
- `.env.example` ist der Vertrag. Backend-Skripte laden Root-`.env` ausdrücklich,
  Astro verwendet `vite.envDir`. DB-Befehle aus dem Root ausführen. Neue Workspaces
  müssen ihren Env-Pfad bewusst konfigurieren.
- `.env` und Anbieter-/Lizenzschlüssel niemals kopieren, committen oder ausgeben.
  `PUBLIC_*` landet im Browser und darf keine Secrets enthalten.
- Reale Middleware-Reihenfolge: Request-Logger → Security-Header → CORS → globales
  Rate-Limit → CSRF-Originprüfung. Formularlimit und Zod-Validierung liegen vor
  Turnstile und fachlicher Verarbeitung.
- Produktions-Origins sind exakt, ohne Wildcard; der Backend-Port bleibt lokal.
  Client-IP nur über die validierte `TRUSTED_PROXY_HOPS`-Konfiguration ableiten.
  Nicht einem beliebigen linken `X-Forwarded-For`-Wert vertrauen.

## Datenschutz, Bot-Schutz und Mail

- Alle Anbieter sind env-gated. Ohne passende Konfiguration keine externen Requests.
  Tests setzen keine echten Schlüssel voraus und dürfen sie nicht aus dem Projekt laden.
- Analyse/Marketing benötigen aktuell gültige Einwilligung, einschließlich passender
  Consent-Revision und Kategorie. Alte Cookies oder gespeicherte Zustimmung allein
  geben keine spätere Conversion frei. Serverhelfer prüfen die Zustimmung pro Aufruf.
- Google verwendet Basic Consent Mode: keine Loader-/Config-/Event-Aufrufe vor der
  passenden Einwilligung. Meta und LinkedIn ebenfalls vollständig einwilligungsgebunden.
  Keine Noscript-Pixel und kein LDU als Ersatz für Einwilligung.
- Empfänger oder Verarbeitungen materiell ändern: Consent-Konfiguration, Revision und
  Projekt-Datenschutztexte gemeinsam prüfen. Keine Anonymitäts-/Rechtszusagen erfinden.
  Ein Widerruf entfernt bereits geladenen Fremdcode nicht rückwirkend.
- Honeypots stoppen vor Handler und Anbieteraufruf mit derselben Erfolgsform.
  Turnstile prüft serverseitig Token, exakte Aktion und erlaubten Host; Fehler bleiben
  geschlossen. In Produktion entweder beide Turnstile-Schlüssel konfigurieren oder
  beide weglassen. Nach einem Versuch verbrauchte Tokens erneuern.
- Resend nur über den serverinternen Mail-Helfer verwenden, keine öffentliche Mailrelay-
  Route. Nutzertexte für HTML escapen, Header bereinigen, Empfänger serverseitig
  bestimmen. Fehlende Konfiguration wird typisiert übersprungen, Anbieterfehler werden
  nicht ungeprüft an Clients oder Logs weitergegeben.
- Pino über `@ho-setup/logger` verwenden, kein `console.*` in Runtime-Modulen.
  Request-Logs enthalten Methode, Pfad, Status und Dauer, keine Querys/Request-Bodies.
  Keine E-Mail-Adressen, Namen, Freitexte, Tokens oder Secrets loggen. Bei Anbieterfehlern
  ausschließlich feste sichere Codes; keine pauschalen Dumps fremder Fehlerobjekte.

## Aktuelle Dokumentation

- Vor bibliotheksspezifischer Implementierung aktuelle Doku mit Context7 holen:
  zuerst `resolve-library-id`, dann gezieltes `query-docs`. Falls nicht verfügbar,
  offizielle Primärdokumentation verwenden. Keine Tools oder API-Syntax erfinden.
- Starwind: vorhandene Skills und CLI-Doku verwenden. Befehle aus `apps/frontend`
  mit Bun ausführen; generische `npx`-Beispiele der Skills entsprechend übersetzen.
  Bei CLI 3.3.2 ist die geprüfte Paketmanager-Erkennung
  `export npm_config_user_agent="bun/$(bun --version)"` relevant. Danach etwa
  `bunx --bun starwind@latest docs button` oder `update --all --dry-run`.
- Starwind Pro ist optional und benötigt eine eigene gültige Lizenz. Vorhandene
  Registry-Konfiguration beweist keinen Lizenzzugang. Die mitgelieferten Starwind-
  Skills bleiben upstream-nahe; diese Projektregeln bestimmen den Runner.

## Git und Deployment

- Commit und Push nur nach ausdrücklicher Nutzeranweisung. Eine Freigabe zum
  Committen ist keine Deploymentfreigabe. Keine Serveränderung aus Vorlagen ableiten.
- `scripts/` ist der Referenz-Deploy-Harness für alle Ploi-Sites; Vertrag und
  Einrichtung stehen in [scripts/README.md](scripts/README.md), Entscheidungen in
  [docs/superpowers/specs/2026-09-07-ploi-deploy-harness-design.md](docs/superpowers/specs/2026-09-07-ploi-deploy-harness-design.md).
  `ploi-autodeploy.sh` und `nginx.conf` spiegeln das Ploi-Panel und ändern es nicht.
- Der Daemon wird ausschließlich über `PLOI_WORKER_ID` (Supervisor-Programm
  `worker-<id>`) neu gestartet. Kein `pkill`/`pgrep`/`kill` in Deploy-Skripten: auf dem
  gemeinsamen Server starten alle Sites dieselbe Kommandozeile. `harness.test.ts`
  prüft diesen Vertrag; `.gitignore` muss `/ploi-*.sh` behalten.
- `NODE_ENV=production` gehört in die Ploi-Environment (`.env`), nie als Export in
  ein Skript: Deploy, Cronjobs und Daemon lesen dieselbe Datei.
- Gates vor Migration, `dist.new`-Wechsel und Health-Abnahme mit neuer PID sind
  Pflicht. Der Verzeichniswechsel ist nicht vollständig atomar; kein automatischer
  DB-/Gesamtrelease-Rollback behaupten. Nginx wird vom Deploy nicht neu geladen.
