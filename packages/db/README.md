# Datenbankpaket `@ho-setup/db`

Drizzle ORM auf PostgreSQL; der Runtime-Client in `src/index.ts` verwendet Bun SQL.
Schema: `src/schema.ts`. Versionierte SQL-Migrationen: `drizzle/`.
Drizzle-Kit-Konfiguration: `drizzle.config.ts`.

Die Apps importieren `db` und Tabellen über `@ho-setup/db`. Der Modulimport stellt
keine Datenbankverbindung her; Abfragen dürfen weder Frontend-Build noch Backendstart
vorausgesetzt werden. Die aktuelle API-Demo speichert nichts.

Diese Befehle aus dem **Projektroot** ausführen:

- `bun run db:generate`: Migration aus Schemaänderungen erzeugen.
- `bun run db:migrate`: vorhandene Migrationen anwenden; benötigt PostgreSQL.
- `bun run db:push`: bewusstes direktes Schemaabgleichen für lokale Entwicklung;
  kann Daten verändern und gehört nicht in den Produktionsdeploy.

Einrichtung: [Root-README](../../README.md). Bestehende Docker-Volumes:
[PostgreSQL 18](../../docs/postgresql-18.md). Projektregeln: [AGENTS.md](../../AGENTS.md).
