# Datenmodelle (Postgres-Entitäten)

## Übersicht

Die Datenbank wird mit Prisma im Package `packages/db` verwaltet. PostgreSQL-spezifische Features (Enums, JSONB) werden genutzt, wo sie für Co-Working-Buchungen und Metadaten sinnvoll sind.

## Wichtige Entitäten (Beispiele)

- **User** – Nutzer des Co-Working-Space
- **Booking** – Buchungen (Desk, Meetingraum, etc.)
- **Room** – Räume / Ressourcen
- **Stripe** – Abonnements, Zahlungen (IDs, Metadaten)

Detaillierte Felder und Relationen stehen im Prisma-Schema: `packages/db/prisma/schema.prisma`.

## Regeln

- Keine rohen SQL-Queries außer bei zwingender Performance-Begründung.
- N+1 vermeiden: `include`/`select` für Relationen nutzen.
- Backend importiert ausschließlich den Client aus `@ho-setup/db`.
