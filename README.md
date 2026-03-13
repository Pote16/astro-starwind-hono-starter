<div align="center">
  <h1>🚀 The Astro + Hono + Starwind Pro Starter</h1>
  <p><strong>Das ultimative, hochperformante Full-Stack-Erlebnis für deine nächste Web-App.</strong></p>
  <p>Baue blitzschnelle UIs mit Astro, sichere und typensichere APIs mit Hono (nativ auf Bun) und atemberaubende Designs mit Starwind Pro – alles perfekt integriert in einem modernen Bun Monorepo-Setup.</p>

  <br />

[![Astro](https://img.shields.io/badge/Astro%205-FF5D01?style=for-the-badge&logo=astro&logoColor=white)](https://astro.build/)
[![Hono](https://img.shields.io/badge/Hono%204-E36002?style=for-the-badge&logo=hono&logoColor=white)](https://hono.dev/)
[![Bun](https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white)](https://bun.sh/)
[![Starwind Pro](https://img.shields.io/badge/Starwind%20UI-0F172A?style=for-the-badge&logo=tailwindcss&logoColor=38bdf8)](https://starwind.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript%205-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL%2018-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-C5F74F?style=for-the-badge&logo=drizzle&logoColor=black)](https://orm.drizzle.team/)

  <br />
</div>

---

## ✨ Warum dieser Stack?

Vergiss überladene SPAs, träge Load-Times und komplexe State-Muddle. Dieser Starter ist die perfekte Balance aus **Developer Experience (DX)** und **brillanter User Experience (UX)**.

- **⚡ Zero-JS per Default**: Astro liefert pures HTML. Interaktivität nur da, wo du sie wirklich brauchst (Islands Architecture). Inklusive i18n Routing (DE/EN) out of the box.
- **🔥 Edge-Ready Backend**: Hono ist das schnellste Web-Framework für Edge-Runtimes und Node.js. Wir lassen es **nativ auf dem ultra-schnellen Bun-Server** laufen. Inklusive **Zod-Typensicherheit** (End-to-End).
- **💎 Premium Design**: Mit **Starwind UI & Starwind Pro** hast du Zugriff auf wunderschöne, zugängliche Radix-basierte Komponenten (Shadcn-Alternative) für ein Design, das deine User vom ersten Klick an begeistert.
- **🛡️ Security First**: Komplettes Setup mit Rate-Limiting, CSRF-Schutz, CORS und Security Headern out of the box.
- **📦 Enterprise-Ready**: Monorepo-Struktur mit nativen Bun Workspaces für DB, Logging und UI. Native **PostgreSQL** Integration inklusive Docker und Produktions-Deploy Scripts.

---

## 🛠️ Features im Überblick

- **Astro SSR (Server-Side Rendering)** für maximale SEO-Power und Performance.
- **i18n Ready**: Vorkonfiguriertes Routing für mehrsprachige Apps.
- **Hono API Server auf Bun**: Typensichere API-Routen, Middleware (Rate Limit, Error Handling, Logger).
- **Datenbank & ORM**: PostgreSQL via Docker + natives Setup für typsichere Queries mit **Drizzle ORM**.
- **Bun Monorepo Architektur**: Strikte Trennung von `apps/frontend`, `apps/backend` und geteilten `packages` (`db`, `logger`).
- **Pino Logger**: Schnelles, strukturiertes JSON-Logging.

---

## 🚀 Schnellstart

In 3 Schritten zum fliegenden Start:

### 1. Abhängigkeiten installieren (Bun vorausgesetzt)

```bash
bun install
```

### 2. Datenbank starten (Docker)

```bash
docker compose up -d
```

_(Die Datenbank ist unter Port `5435` erreichbar. Die Konfiguration findest du in der `.env` Datei – benenne `.env.example` in `.env` um)._

### 3. Entwicklungsserver starten

```bash
bun run dev
```

Der Befehl startet Frontend und Backend gleichzeitig via Bun Workspaces:

- **Frontend** (Astro): `http://localhost:4321`
- **Backend** (Hono API): `http://localhost:3005`

---

## 🏗️ Projekt-Struktur

```text
├── apps/
│   ├── frontend/         # Astro App (Pages, Layouts, UI-Integration, i18n)
│   └── backend/          # Hono API Server (Nativ auf Bun)
├── packages/
│   ├── db/               # Datenbank-Schema & Migrations (Drizzle)
│   └── logger/           # Geteilter Pino-Logger
├── scripts/
│   └── deploy.sh         # Auto-Deploy Script für Ploi / Server
├── docker-compose.yml    # PG18 Datenbank
└── package.json          # Root Monorepo Konfiguration (Bun Workspaces)
```

---

## 🎨 Starwind UI / Pro Add-On

Dieses Projekt ist bereits exklusiv für Starwind UI vorkonfiguriert. Füge deine UI-Block oder Components blitzschnell via CLI hinzu.

**Basis-Komponente hinzufügen:**

```bash
bunx starwind@latest add button card
```

**Starwind Pro Block hinzufügen (Pro-Lizenz vorausgesetzt):**

```bash
bunx starwind@latest add header --pro
```

_(Siehe `starwind.config.json` in `apps/frontend` für Details)._

---

## 🤝 Agency & Enterprise Support

Du brauchst Unterstützung bei der Skalierung, Architekturentscheidungen oder hast eine konkrete **Projektanfrage** für ein maßgeschneidertes digitales Produkt in diesem sensationellen High-Performance Stack?

Wir bauen Custom Software, die nicht nur messbar schneller ist als die Konkurrenz, sondern Usern eine Experience von höchster Güteklasse bietet.

📩 **Projektanfragen unter:** [dominik@wogenfels.com](mailto:dominik@wogenfels.com)

---

_Built with ❤️ for performance-obsessed developers._
