---
trigger: always_on
description: Vorgaben zur Nutzung externer MCP-Server (Context7, Starwind UI)
globs: "*"
---

# MCP Server Nutzung

1. **Dokumentation über MCP Server beziehen:**

- Bevor du Code für Astro, Starwind UI, Hono, Zod, Prisma oder andere Bibliotheken generierst, MUSST du die aktuellste Dokumentation über die verfügbaren MCP Server abrufen.
- Verlasse dich NICHT auf dein Trainings-Wissen für API-Syntax oder Konfigurationen – die MCP Server liefern immer die aktuellste Version.
- **Fallback:** Sollte ein MCP-Server (z.B. Context7) ausfallen oder Timeout-Fehler werfen, nutze als Fallback explizit Web-Search-Tools (falls verfügbar) für die offizielle Doku der Technologie (Stand 2026).

2. **Context7 MCP Server (`plugin-context7-plugin-context7`):**

- Nutze `resolve-library-id` um die korrekte Library-ID zu ermitteln, gefolgt von `query-docs` mit einer präzisen Frage.
- Verwende Context7 für: Astro, Zod, Hono, Prisma, Tailwind CSS, Nanostores, Stripe und alle weiteren npm-Pakete.
- Beispiel-Workflow:
  1. `resolve-library-id` → `{ "libraryName": "astro", "query": "server actions" }`
  2. `query-docs` → `{ "libraryId": "/withastro/docs", "query": "How to define server actions with Zod validation" }`

3. **Starwind UI MCP Server (`starwind-ui`):**

- **Komponenten-Dokumentation:** Nutze `starwind_docs` mit dem `topic`-Parameter (z. B. `"button"`, `"dialog"`, `"accordion"`), um aktuelle API-Docs und Beispiele zu erhalten.
- **Komponenten installieren:** Nutze `starwind_add` um den korrekten CLI-Befehl für die Installation zu generieren. Setze `pro: true` für Starwind Pro.
- **Pro Blöcke suchen:** Nutze `search_starwind_pro_blocks` um vorgefertigte UI-Blöcke zu finden (Heroes, Footer, Pricing, Navigation etc.). Wir haben eine **Starwind Pro** Lizenz – Pro-Blöcke dürfen verwendet werden.
- Installiere Komponenten immer via CLI (`pnpm dlx starwind@latest add <component>`), NIEMALS manuell kopieren.

4. **Astro MCP Server (`astro-mcp`):**

- Wird automatisch vom Astro Dev-Server bereitgestellt (`http://localhost:4321/__mcp/sse`).
- Nutze diesen Server, um zur Laufzeit Informationen über Routen, Seiten und Konfiguration des Astro-Projekts abzurufen.
- Konfiguriert in `.cursor/mcp.json`.

5. **Wann welchen MCP Server nutzen:**

| Frage / Aufgabe                            | MCP Server                                 |
| ------------------------------------------ | ------------------------------------------ |
| Astro-Syntax, Actions, Routing, SSR        | Context7 (`/withastro/docs`)               |
| Zod-Schema-Validierung                     | Context7 (`/colinhacks/zod`)               |
| Hono-Routen, Middleware, RPC               | Context7 (`/honojs/website`)               |
| Prisma-Queries, Schema-Design              | Context7                                   |
| Starwind UI Komponenten-API                | Starwind UI (`starwind_docs`)              |
| Starwind UI Installation                   | Starwind UI (`starwind_add`)               |
| Fertige UI-Blöcke (Hero, Pricing etc.)     | Starwind UI (`search_starwind_pro_blocks`) |
| Astro-Projekt Routen/Seiten (zur Laufzeit) | Astro MCP                                  |
| Alle anderen npm-Pakete                    | Context7                                   |
