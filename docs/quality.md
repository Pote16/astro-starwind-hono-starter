# Qualitätsprüfungen und Test-Harness

Die Vorlage hat gemeinsame Prüfungen für lokale Arbeit und GitHub. Der Workflow
[Quality](../.github/workflows/quality.yml) läuft bei Pull Requests, bei Pushes auf
`main` und auf manuellen Aufruf. Feature-Branches werden über ihren Pull Request
geprüft, damit dieselbe Änderung nicht zusätzlich einen identischen Push-Lauf erzeugt.
Für einen Merge sollten die beiden Checks `Quality` und `Browser E2E` erfolgreich sein.
Eine verpflichtende Branch-Regel ist eine eigene GitHub-Einstellung; die Workflowdatei
allein aktiviert sie nicht.

## Was automatisch geprüft wird

| Ebene             | Prüfung                                                                            | Aussage                                                                                                                |
| ----------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Installation      | Bun aus `.bun-version`, exakter Versionsvergleich, `bun install --frozen-lockfile` | Der eingecheckte Paketstand lässt sich mit der vorgesehenen Runtime installieren.                                      |
| Statische Analyse | ESLint, Astro Check, TypeScript und Prettier                                       | Typfehler, bekannte problematische Muster und abweichende Formatierung scheitern im Gate.                              |
| Backend           | Echte Hono-Requests und injizierte Anbieterantworten                               | Origins, JSON-Schreibzugriffe, Proxy-IP/Rate-Limits, Turnstile, Mail und Tracking-Sperren verhalten sich wie erwartet. |
| Frontend-Logik    | Bun-Tests mit kontrollierter Browserumgebung                                       | Einwilligung, Revision, optionale Anbieter, Eventparameter und Token-Lebenszyklus werden geprüft.                      |
| Betrieb           | ShellCheck, Bash-Syntax, temporäre Deploy-Fixtures und lokaler Nginx               | Schutzprüfungen vor Mutationen, Fehlerpfade, Lock und Routing bleiben überprüfbar.                                     |
| Browser           | Playwright mit Chromium und isolierten lokalen Servern                             | Die echte Oberfläche und die Formularabläufe sind als wiederholbare Browserprüfungen ausführbar.                       |
| Build             | `bun run build`                                                                    | Das statische Frontend und die Backend-Typprüfung funktionieren ohne Datenbank oder Anbieterkeys.                      |

Die beiden CI-Jobs laufen auf GitHub-gehostetem Ubuntu 24.04 mit begrenzter Laufzeit.
Neuere Änderungen derselben Referenz brechen veraltete Läufe ab. Die verwendeten
Actions sind auf vollständige Release-Commit-SHAs festgelegt; Updates müssen diese
Pins bewusst ersetzen. Der GitHub-Token hat nur `contents: read`, Checkout erhält
keine dauerhaft gespeicherten Git-Zugangsdaten. Der Workflow verwendet kein
`pull_request_target`, keine Projekt-Secrets, keine Produktionsserver und keinen Deploy.

Nginx und ShellCheck werden im kurzlebigen CI-Runner aus Ubuntu-Paketen installiert.
`STARTER_NGINX_BIN=/usr/sbin/nginx` aktiviert dort den echten Nginx-Test verpflichtend.
Er verwendet eigene temporäre Dateien und lokale Testports. Lokal bleibt diese
Prüfung ohne ausdrücklich angegebenes Nginx-Binary übersprungen. Es wird weder eine
Produktionskonfiguration verändert noch eine Datenbank gestartet oder migriert.

Der Browserjob installiert ausschließlich Chromium und zusätzlich Node.js 22 für
den Playwright-Testprozess. Playwright 1.63 lädt seine TypeScript-Konfiguration
über diesen Node-Runner; die erzwungene Ausführung mit `--bun` hat sich dafür als
inkompatibel erwiesen. Deshalb verwendet die Browserprüfung `bunx playwright`
ohne `--bun`. Paketinstallation, Anwendung, Testserver und Bun-Unit-Tests bleiben
bei Bun. Bei Fehlern speichert er
`test-results/` und `playwright-report/` für sieben Tage. Diese Berichte gehören nur
zu lokalen Tests mit erfundenen Eingaben. Keine echten Kundeninformationen, API-Keys
oder Produktions-URLs in die Tests übernehmen. Versteckte Dateien und das übrige
Projektverzeichnis werden nicht als Artefakt hochgeladen.

## Lokal reproduzieren

Aus dem Projektroot mit der Bun-Version aus `.bun-version`. Für die beiden
Playwright-Befehle muss zusätzlich Node.js 22 im `PATH` verfügbar sein:

```bash
bun install --frozen-lockfile
bun run lint
bun run typecheck
bun test
bun run format:check
bun run build
bunx playwright install chromium
bun run test:e2e
```

Die Playwright-Konfiguration startet ihre Testserver selbst. Sie verwendet keine
bereits laufende Produktionsinstanz. Die lokalen Deploy-Fixtures simulieren Bun,
Git, Provider, Supervisor und Backend-PIDs; sie führen keinen echten Deploy aus.
Für Nginx kann optional `STARTER_NGINX_BIN=/absoluter/pfad/zu/nginx bun test scripts/nginx.test.ts`
verwendet werden. ShellCheck und `bash -n` prüfen die Skripte zusätzlich ohne Ausführung.

## Warum Playwright statt Bun.WebView?

Stand 07.09.2026: [Bun.WebView](https://bun.com/docs/runtime/webview) bietet bereits
echte Browserinteraktion, Größenwechsel und Screenshots direkt aus Bun. Die API
ist noch experimentell. Auf macOS ist System-WebKit der Standard, auf Linux
wird ein installierter Chromium-Browser benötigt. Erweiterte Steuerung ist über
CDP beim Chrome-Backend möglich, beim WebKit-Backend jedoch nicht.

Für dieses verbindliche CI-Gate bleibt Playwright gewählt: Netzwerk-Mocks vor
der ersten Seitennavigation, isolierte Browserkontexte, automatisch wartende
Assertions und aufbewahrte Fehler-Traces sind fertig verfügbar. Unsere Tests
nutzen diese Funktionen für Turnstile und Consent. Ein Wechsel würde zusätzlichen
eigenen Test-Infrastrukturcode erfordern. Die Entscheidung betrifft den Browserrunner;
Bun bleibt Runtime, Paketmanager und Runner der Logik-/API-Tests.

WebView ist für kleine lokale Browserprüfungen eine mögliche spätere Ergänzung.
Der Starter installiert dafür keine zusätzliche Abstraktionsbibliothek und pflegt
keine zweite identische E2E-Suite. Neu bewerten, wenn die benötigten Schnittstellen
stabil und auf den vorgesehenen CI-Plattformen gleichwertig nutzbar sind.
[Playwright-Assertions](https://playwright.dev/docs/test-assertions),
[Fehler-Traces](https://playwright.dev/docs/trace-viewer).

## Grenzen der Nachweise

- Die Browserprüfung deckt Chromium ab. Firefox, WebKit und echte Mobilgeräte sind
  damit nicht geprüft. Sie ersetzt keine vollständige Prüfung von Barrierefreiheit,
  Bildwirkung oder allen Kombinationen von Bildschirmgröße und Inhalt.
- Anbieter werden in Tests simuliert. Zustellung echter E-Mails, reale Turnstile-Tokens
  sowie Verarbeitung und Attribution bei Google, Meta oder LinkedIn müssen mit der
  Konfiguration des jeweiligen Projekts separat geprüft werden.
- Es gibt keine Testdatenbank. SQL-Migrationen, reale Persistierung und ein späterer
  Wiederherstellungsprozess brauchen zusätzliche Integrationstests, sobald die Vorlage
  dafür konkrete fachliche Routen erhält. Die Demo speichert bewusst nichts.
- Deploy-Fixtures und Nginx-Routing prüfen nicht die Rechte eines echten Ploi-Daemons,
  TLS-Zertifikate oder einen vollständigen Produktionsrelease. Der CI-Workflow veröffentlicht
  nichts und behauptet keinen bestandenen Live-Deploy.
- Es ist keine vollständige Codeabdeckungsquote nachgewiesen und keine willkürliche
  Prozenthürde gesetzt. `bun test --coverage` kann lokal zeigen, welche ausführbaren
  Bereiche noch ungetestet sind; Abdeckung allein belegt keine sinnvollen Assertions.

Bei einer neuen Funktion die Grenze ihres Fehlers testen: etwa ein fremder Origin,
widerrufene Einwilligung, ein fehlerhafter Anbieter oder ein abgebrochener Build.
Für neue interaktive Oberflächen den entsprechenden Browserablauf ergänzen. Bereits
bestandene Gates sind der überprüfte Stand des jeweiligen Commits, keine pauschale
Garantie für spätere Änderungen.

## Quellen für den Workflow

- [GitHub: Workflow-Syntax und Berechtigungen](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
- [GitHub: sichere Verwendung von Actions und Commit-Pins](https://docs.github.com/en/actions/reference/security/secure-use)
- [Bun anhand einer Versionsdatei installieren](https://github.com/oven-sh/setup-bun#usage)
- [Playwright in CI](https://playwright.dev/docs/ci)
