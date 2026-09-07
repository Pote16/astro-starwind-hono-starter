# Architektur

Der Starter ist ein Bun-Monorepo mit einem statischen Astro-Frontend, einer separaten
Hono-API und zwei gemeinsamen Paketen. Versionen, Einrichtung und Qualitätsgate
stehen in [README.md](../README.md); verbindliche Regeln in [AGENTS.md](../AGENTS.md).

| Bereich   | Tatsächlicher Aufbau                                                 |
| --------- | -------------------------------------------------------------------- |
| Frontend  | Astro 7 SSG, Vite, Tailwind 4, Starwind UI 3; kein SSR-Adapter       |
| API       | Hono auf Bun, lokal gebundener HTTP-Prozess                          |
| Datenbank | Drizzle ORM mit PostgreSQL über Bun SQL, gekapselt in `@ho-setup/db` |
| Logging   | Pino über `@ho-setup/logger`, keine personenbezogenen Requestdaten   |
| Sprachen  | Native Astro-i18n-Routen `/` und `/en/`, gemeinsames Template        |

Astro erzeugt HTML zur Build-Zeit. Client-Scripts ergänzen Formular-, Consent- und
Turnstile-Verhalten. Das Formular sendet JSON an `/api/users`; der Dev-Proxy und die
Nginx-Vorlage leiten den Pfad zur Hono-API. Es gibt keine Build-Abfrage an API oder DB.
`AppType` ist exportiert, aber derzeit kein Hono-RPC-Client angebunden.

Die Demo bestätigt ausschließlich validierte Testeingaben. Persistierung,
Benutzerkonten, Authentifizierung und Webhooks sind nicht implementiert. Mail- und
Tracking-Helfer stehen für spätere serverseitige Integration bereit und werden von
der Demo nicht aufgerufen. Anbieter benötigen passende Konfiguration; Tracking
zusätzlich aktuell gültige Einwilligung.

Bun startet Backend-TypeScript direkt, deshalb emittiert der Backend-Build keine
JavaScript-Kopien. Dev, Build, Health und Qualitätsprüfungen laufen ohne Datenbank
und echte Anbieterzugangsdaten. Browsertests simulieren externe Anbieter.

[Deploymentvorlagen](../scripts/README.md) aktivieren keinen Dienst automatisch.
