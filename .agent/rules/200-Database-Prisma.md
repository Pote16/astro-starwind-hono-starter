---
trigger: glob
description: Prisma ORM Regeln im Monorepo
globs: "packages/db/**/*.ts", "packages/db/prisma/schema.prisma", "apps/backend/**/*.ts"
---

# Datenbank & Prisma ORM

1. **Monorepo Integration:**

- Der Prisma Client wird ausschließlich im `packages/db` Workspace instanziiert und von dort in das Backend (`apps/backend`) importiert.
- Backend-Routen dürfen niemals eigene Prisma-Instanzen erstellen. Importiere die Singleton-Instanz aus `@hollyhub/db`.

2. **Datenbank-Technologie:**

- Wir nutzen PostgreSQL. Nutze Postgres-spezifische Features (wie Enums oder JSONB) dort, wo es für Metadaten der Coworking-Buchungen sinnvoll ist.

3. **Performance:**

- Verhindere das N+1 Query Problem. Nutze Prismas `include` oder `select` für relationale Daten (z.B. User -> Buchungen -> Meetingraum).
- Generiere keine rohen SQL-Queries via `$queryRaw`, es sei denn, die Performance-Vorgaben für eine komplexe Filterung erfordern es zwingend.
