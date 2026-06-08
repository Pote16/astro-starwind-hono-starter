---
description: Pflicht zur Nutzung der MCP Server für aktuelle Dokumentation
globs: "*"
alwaysApply: true
---

# MCP Server Nutzung

1. **Dokumentation über MCP Server beziehen:**

- Bevor du Code für Astro, Starwind UI, Hono, Zod, Drizzle oder andere Bibliotheken generierst, MUSST du die aktuellste Dokumentation über die verfügbaren MCP Server abrufen.
- Verlasse dich NICHT auf dein Trainings-Wissen für API-Syntax oder Konfigurationen – die MCP Server liefern immer die aktuellste Version.
- **Fallback:** Sollte ein MCP-Server (z.B. Context7) ausfallen oder Timeout-Fehler werfen, nutze als Fallback explizit Web-Search-Tools (falls verfügbar) für die offizielle Doku der Technologie (Stand 2026).

2. **Context7 MCP Server:**

- Nutze `resolve-library-id` um die korrekte Library-ID zu ermitteln, gefolgt von `query-docs` mit einer präzisen Frage.
- Verwende Context7 für: Astro, Zod, Hono, Drizzle, Tailwind CSS, Nanostores, Stripe und alle weiteren Pakete.

3. **Starwind UI – Skill (primär) + MCP (komplementär) + CLI v2:**

- **Primärquelle in Claude Code: der projektlokale Skill** unter `.claude/skills/starwind-ui` (Komponenten, Komposition, Theming, CLI-Referenz) und `.claude/skills/starwind-pro` (Pro-Setup & Block-Suche). Er ist im Repo eingecheckt, wird automatisch aktiv und enthält die aktuellen Starwind-Regeln. Aktualisieren: `bunx skills@latest add starwind-ui/skills --copy -y -a claude-code` (NUR `-a claude-code`, NICHT `--all`).
- **MCP (komplementär):** Der `@starwind-ui/mcp`-Server bietet `starwind_docs`, `starwind_add`, `search_starwind_pro_blocks`. Wenn verbunden, bevorzuge MCP für Live-Docs/Block-Suche; in Claude Code ist er ggf. NICHT verbunden – dann gilt Skill + CLI. Wir haben eine **Starwind Pro** Lizenz – Pro-Blöcke dürfen verwendet werden.
- **CLI v2** (Befehle: `init`, `add`, `update`, `search`, `docs`, `setup`, `remove`), Runner = **bun** (aus `apps/frontend/`):
  - Suchen: `bunx starwind@latest search <query> [--plan free|pro] [--json]`
  - Docs: `bunx starwind@latest docs <component> --json`
  - Hinzufügen: `bunx starwind@latest add <component> --yes`
  - Pro einrichten: `bunx starwind@latest setup`
- ⚠️ `--package-manager`/`-m` kennt nur `npm|pnpm|yarn` (KEIN bun). Auf Auto-Detect via `bun.lock` verlassen; fehlende Pakete mit `bun add` nachziehen.
- ⚠️ `init` schlägt in Bun-Monorepos fehl (npm + `workspace:*`) – stattdessen `setup` + manuelles CSS + `add`.
- ⚠️ `update` **überschreibt lokale Komponenten-Änderungen** und hat **kein `--dry-run`/`--diff`**.
- Installiere/aktualisiere Komponenten immer via CLI, NIEMALS manuell kopieren.
- Stand: Starwind **v2** (Variants-Refactor – Styling je Komponente in `variants.ts` via `tailwind-variants`, `data-slot`-Attribute).

4. **Astro Docs MCP Server (`astro-docs`):**

- Nutze diesen Server für offizielle Astro-Dokumentation zu Routen, Konfiguration, APIs und Best Practices.

5. **Wann welchen MCP Server nutzen:**

| Frage / Aufgabe                            | MCP Server                                 |
| ------------------------------------------ | ------------------------------------------ |
| Astro-Syntax, Actions, Routing, SSR        | Context7 (`/withastro/docs`) / Astro Docs  |
| Zod-Schema-Validierung                     | Context7 (`/colinhacks/zod`)               |
| Hono-Routen, Middleware, RPC               | Context7 (`/honojs/website`)               |
| Drizzle-Queries, Schema-Design             | Context7                                   |
| Starwind UI Komponenten-API / Komposition  | Skill `starwind-ui` + `bunx starwind@latest docs` |
| Starwind UI Installation / Komponenten-Suche | CLI `bunx starwind@latest add` / `search` |
| Fertige UI-Blöcke (Hero, Pricing etc.)     | Skill `starwind-pro` + `bunx starwind@latest search --plan` |
| Alle anderen Pakete                         | Context7                                   |
