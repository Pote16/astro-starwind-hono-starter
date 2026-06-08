---
trigger: always_on
description: Vorgaben zur Nutzung externer MCP-Server (Context7, Starwind UI)
globs: "*"
---

# MCP Server Nutzung

1. **Dokumentation über MCP Server beziehen:**

- Bevor du Code für Astro, Starwind UI, Hono, Zod, Drizzle oder andere Bibliotheken generierst, MUSST du die aktuellste Dokumentation über die verfügbaren MCP Server abrufen.
- Verlasse dich NICHT auf dein Trainings-Wissen für API-Syntax oder Konfigurationen – die MCP Server liefern immer die aktuellste Version.
- **Fallback:** Sollte ein MCP-Server (z.B. Context7) ausfallen oder Timeout-Fehler werfen, nutze als Fallback explizit Web-Search-Tools (falls verfügbar) für die offizielle Doku der Technologie (Stand 2026).

2. **Context7 MCP Server (`plugin-context7-plugin-context7`):**

- Nutze `resolve-library-id` um die korrekte Library-ID zu ermitteln, gefolgt von `query-docs` mit einer präzisen Frage.
- Verwende Context7 für: Astro, Zod, Hono, Drizzle, Tailwind CSS, Nanostores, Stripe und alle weiteren Pakete.

3. **Starwind UI – Skill (primär) + MCP (komplementär) + CLI v2:**

- **Primärquelle:** `.claude/skills/starwind-ui` und `.claude/skills/starwind-pro`. Aktualisieren: `bunx skills@latest add starwind-ui/skills --copy -y -a claude-code`.
- **MCP:** `@starwind-ui/mcp` – `starwind_docs`, `starwind_add`, `search_starwind_pro_blocks`. Starwind Pro Lizenz vorhanden.
- **CLI v2** aus `apps/frontend/`: `bunx starwind@latest add|search|docs|setup|update`.
- ⚠️ `init` in Bun-Monorepos fehlgeschlagen – `setup` + manuelles CSS + `add` verwenden.
- Stand: Starwind **v2** (`variants.ts`, `data-slot`).

4. **Astro MCP Server (`astro-mcp`):**

- Dev-Server: `http://localhost:4321/__mcp/sse` – Routen/Seiten zur Laufzeit.

5. **Wann welchen MCP Server nutzen:**

| Frage / Aufgabe                            | MCP Server                                 |
| ------------------------------------------ | ------------------------------------------ |
| Astro-Syntax, Actions, Routing, SSR        | Context7 (`/withastro/docs`)               |
| Zod-Schema-Validierung                     | Context7 (`/colinhacks/zod`)               |
| Hono-Routen, Middleware, RPC               | Context7 (`/honojs/website`)               |
| Drizzle-Queries, Schema-Design             | Context7                                   |
| Starwind UI Komponenten-API                | Skill `starwind-ui` + CLI `docs`           |
| Starwind UI Installation                   | CLI `add` / MCP `starwind_add`             |
| Fertige UI-Blöcke (Hero, Pricing etc.)     | Skill `starwind-pro` + CLI `search --plan` |
| Astro-Projekt Routen/Seiten (zur Laufzeit) | Astro MCP                                  |
| Alle anderen Pakete                        | Context7                                   |
