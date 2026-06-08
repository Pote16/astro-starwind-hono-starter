<div align="center">
  <h1>🚀 The Astro + Hono + Starwind Pro Starter</h1>
  <p><strong>Das ultimative, hochperformante Full-Stack-Erlebnis für deine nächste Web-App.</strong></p>
  <p>Baue blitzschnelle UIs mit Astro, sichere und typensichere APIs mit Hono (nativ auf Bun) und atemberaubende Designs mit Starwind UI v2 & Starwind Pro – alles perfekt integriert in einem modernen Bun Monorepo-Setup.</p>

  <br />

[![Astro](https://img.shields.io/badge/Astro%206-FF5D01?style=for-the-badge&logo=astro&logoColor=white)](https://astro.build/)
[![Hono](https://img.shields.io/badge/Hono%204-E36002?style=for-the-badge&logo=hono&logoColor=white)](https://hono.dev/)
[![Bun](https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white)](https://bun.sh/)
[![Starwind UI](https://img.shields.io/badge/Starwind%20UI%20v2-0F172A?style=for-the-badge&logo=tailwindcss&logoColor=38bdf8)](https://starwind.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript%206-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL%2018-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-C5F74F?style=for-the-badge&logo=drizzle&logoColor=black)](https://orm.drizzle.team/)

  <br />
</div>

---

## ✨ Warum dieser Stack?

Vergiss überladene SPAs, träge Load-Times und komplexe State-Muddle. Dieser Starter ist die perfekte Balance aus **Developer Experience (DX)** und **brillanter User Experience (UX)**.

- **⚡ Zero-JS per Default**: Astro liefert pures HTML. Interaktivität nur da, wo du sie wirklich brauchst (Islands Architecture). Inklusive i18n Routing (DE/EN) out of the box.
- **🔥 Edge-Ready Backend**: Hono läuft **nativ auf dem ultra-schnellen Bun-Server**. Inklusive **Zod-Typensicherheit** (End-to-End) und `/health`-Endpoint für Deploy-Probes.
- **💎 Premium Design**: **Starwind UI v2** (Tailwind CSS v4, `variants.ts`, `data-slot`) plus **Starwind Pro** für produktionsreife Blöcke – Shadcn-Alternative für Astro.
- **🛡️ Security First**: Rate-Limiting, CSRF-Schutz, CORS und Security Headern out of the box.
- **📦 Enterprise-Ready**: Bun Workspaces für DB, Logging und UI. PostgreSQL via Docker. Produktions-Deploy-Script mit atomarem `dist`-Swap und Drizzle-Migrationen.

---

## 🛠️ Features im Überblick

- **Astro 6** (Static/SSR) für maximale SEO-Power und Performance.
- **i18n Ready**: Vorkonfiguriertes Routing für mehrsprachige Apps (DE/EN).
- **Hono API auf Bun**: Typensichere Routen, Middleware (Rate Limit, Error Handling, Logger).
- **Drizzle ORM**: PostgreSQL via Docker, typsichere Queries und Migrationen.
- **Starwind UI v2**: Vorkonfiguriertes Theme in `global.css`, Starter-Komponenten (`button`, `card`, `badge`, `separator`).
- **AI Skills & MCP**: Eingecheckte `starwind-ui` / `starwind-pro` Skills + `@starwind-ui/mcp` für Docs und Block-Suche.
- **Pino Logger**: Schnelles, strukturiertes JSON-Logging im Shared Package.

---

## 🚀 Schnellstart

### 1. Abhängigkeiten installieren (Bun vorausgesetzt)

```bash
bun install
```

### 2. Environment & Datenbank

1. `.env.example` nach `.env` kopieren und Werte eintragen.
2. Für Starwind Pro: `STARWIND_LICENSE_KEY` in `apps/frontend/.env.local` setzen (wird von `bunx starwind@latest setup` angelegt).
3. PostgreSQL starten:

```bash
docker compose up -d
```

Die Datenbank ist unter Port **5435** erreichbar.

### 3. Entwicklungsserver starten

```bash
bun run dev
```

Startet Frontend und Backend gleichzeitig via Bun Workspaces:

| Service   | URL                        |
| --------- | -------------------------- |
| Frontend  | `http://localhost:4321`    |
| Backend   | `http://localhost:3005`    |
| Health    | `http://localhost:3005/health` |

---

## 📜 Verfügbare Scripts (Root)

| Befehl              | Beschreibung                              |
| ------------------- | ----------------------------------------- |
| `bun run dev`       | Frontend + Backend parallel               |
| `bun run build`     | Monorepo-Build                            |
| `bun run typecheck` | TypeScript-Check in allen Workspaces      |
| `bun run lint`      | ESLint + Astro Check                      |
| `bun run outdated`  | Veraltete Pakete anzeigen                 |
| `bun run db:migrate`| Drizzle-Migrationen ausführen             |
| `bun run db:push`   | Schema direkt pushen (Dev)                |
| `bun run db:generate`| Neue Migration generieren                |

---

## 🏗️ Projekt-Struktur

```text
├── apps/
│   ├── frontend/              # Astro 6 App (Pages, Layouts, Starwind UI, i18n)
│   │   ├── src/components/starwind/   # Starwind v2 Komponenten (CLI-installiert)
│   │   ├── src/styles/global.css      # Tailwind v4 + Starwind Theme Tokens
│   │   └── starwind.config.json       # Starwind CLI Konfiguration
│   └── backend/               # Hono API (nativ auf Bun)
├── packages/
│   ├── db/                    # Drizzle Schema & Migrationen
│   └── logger/                # Geteilter Pino-Logger
├── .claude/skills/            # starwind-ui & starwind-pro Agent Skills
├── scripts/
│   └── deploy.sh              # Ploi Auto-Deploy (atomarer dist-Swap, Health-Check)
├── docker-compose.yml         # PostgreSQL 18
└── package.json               # Bun Workspaces Root
```

---

## 🎨 Starwind UI v2 & Pro

Das Projekt ist für **Starwind UI v2** und **Starwind Pro** vorkonfiguriert. Alle CLI-Befehle aus `apps/frontend/` ausführen:

### Pro-Setup (einmalig)

```bash
cd apps/frontend
bunx starwind@latest setup
# STARWIND_LICENSE_KEY in .env.local eintragen
```

> **Hinweis:** `starwind init` schlägt in Bun-Monorepos fehl (`workspace:*` + npm). Stattdessen `setup` + `add` verwenden – das Theme liegt bereits in `src/styles/global.css`.

### Komponenten hinzufügen

```bash
cd apps/frontend
bunx starwind@latest add dialog accordion --yes
bunx starwind@latest search hero --plan pro
bunx starwind@latest docs button --json
```

### Pro-Block installieren

```bash
cd apps/frontend
bunx starwind@latest add @starwind-pro/hero-09
```

Installierte Komponenten und Versionen stehen in `apps/frontend/starwind.config.json`.

### Agent Skills (Claude Code / Cursor)

Die Starwind-Skills sind im Repo unter `.claude/skills/` eingecheckt:

- `starwind-ui` — Komponenten-API, Komposition, CLI, Styling-Regeln
- `starwind-pro` — Pro-Setup, Block-Suche und Installation

Skills aktualisieren:

```bash
bunx skills@latest add starwind-ui/skills --copy -y -a claude-code
```

### MCP Server

In `.mcp.json` konfiguriert:

- `starwind-ui` — `starwind_docs`, `starwind_add`, `search_starwind_pro_blocks`
- `astro-docs` — Offizielle Astro-Dokumentation

---

## 🚢 Deployment (Ploi / Server)

Das Deploy-Script `scripts/deploy.sh` wird nach `git pull` vom Ploi-Hook ausgeführt:

1. `bun install` (alle Workspaces)
2. Drizzle-Migrationen (`RESET_DB=true` nur für Dev/Staging → `db:push`)
3. Astro-Build mit **atomarem dist-Swap** (kein Nginx-500-Fenster)
4. Backend-Restart via `pkill` (Shared-Server-sicher mit vollem Projektpfad)
5. Health-Check auf `/health` (30s Retry, bricht bei Fehler ab)

**Ploi Daemon:** `bun run apps/backend/src/index.ts`

---

## 🤝 Agency & Enterprise Support

Du brauchst Unterstützung bei der Skalierung, Architekturentscheidungen oder hast eine konkrete **Projektanfrage** für ein maßgeschneidertes digitales Produkt in diesem High-Performance Stack?

📩 **Projektanfragen unter:** [dominik@wogenfels.com](mailto:dominik@wogenfels.com)

---

_Built with ❤️ for performance-obsessed developers._
