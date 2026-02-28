# Systemarchitektur & Entscheidungen

## Übersicht

Dieses Template ist ein Monorepo: Frontend (Astro), Backend (Hono), geteilte Packages (DB, Logger).

## Technologie-Stack

| Bereich   | Technologie         | Begründung                                         |
| --------- | ------------------- | -------------------------------------------------- |
| Monorepo  | pnpm Workspaces     | Goldstandard 2026, native Prisma-Unterstützung     |
| Frontend  | Astro + Starwind UI | Zero-JS-Baseline, Tailwind v4, KI-freundlich (MCP) |
| Backend   | Hono                | Edge/Node, typisiertes RPC, schlank                |
| Datenbank | PostgreSQL + Prisma | packages/db als isoliertes Package                 |
| Logging   | Pino                | packages/logger, strukturierte JSON-Logs           |

## Verzeichnisstruktur

- `apps/frontend` – Astro (Port 4321)
- `apps/backend` – Hono API & Webhooks (z. B. Stripe)
- `packages/db` – Prisma Client, Schema
- `packages/logger` – Pino-Instanz
- `docs/` – Zentrale Doku (u. a. für Cursor-Kontext)

## Architektur-Entscheidungen

1. **Zero-JavaScript-Baseline (Astro):** Kein Client-JS außer expliziten Islands (`client:load`, `client:visible`).
2. **Typisiertes RPC (Hono):** `AppType` wird exportiert, Frontend nutzt strikt typisierte API-Clients.
3. **Singleton DB/Logger:** Keine eigenen Prisma-/Logger-Instanzen in Apps; Import aus `@ho-setup/db` bzw. `@ho-setup/logger`.
4. **Starwind UI:** Native Astro-Komponenten, kein React-Overhead für statische Teile; optional MCP-Server für Cursor.
