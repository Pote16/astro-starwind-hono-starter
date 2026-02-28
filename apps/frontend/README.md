# Frontend (Astro)

Dieser Ordner enthält die Frontend-Applikation basierend auf Astro.
Sie verwendet Tailwind CSS v4, React und Hono-Client-Typen. Sie ist Teil des Monorepos.

## Struktur

```text
frontend/
├── public/                 # Statische Assets (favicon, robots.txt, etc.)
├── src/
│   ├── components/         # UI Komponenten (React, Astro)
│   ├── layouts/            # Astro Seiten-Layouts (z.B. Layout.astro)
│   ├── pages/              # Astro Routen (z.B. index.astro)
│   └── styles/             # Globale Styles (global.css mit Tailwind)
├── astro.config.mjs        # Astro Konfiguration
├── package.json            # Abhängigkeiten
└── tsconfig.json           # TypeScript Setup
```

## Befehle

- `pnpm dev`: Startet den Astro Development-Server.
- `pnpm build`: Baut die statische/SSR-Seite.
- `pnpm lint`: Führt Astro-Check und ESLint für das Frontend aus.
- `pnpm typecheck`: Prüft TypeScript-Typen (Astro Check).
