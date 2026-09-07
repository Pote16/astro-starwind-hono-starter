# Frontend

Astro 7 erzeugt statisches HTML mit Tailwind 4 und Starwind UI 3. Kein React, kein
SSR-Adapter. Kleine interaktive Funktionen liegen in `src/scripts/`; Astro verwendet
Vite für Dev und Build. Einrichtung und Qualitätsgate: [Root-README](../../README.md).
Verbindliche Projektregeln: [AGENTS.md](../../AGENTS.md).

- Deutsch: `/`; Englisch: `/en/`. Beide verwenden das gemeinsame `Starter.astro`.
  Routing und Wörterbücher beschreibt [src/i18n](src/i18n/README.md).
- `src/components/starwind/` ist CLI-generiert. Eigene Änderungen über Klassen,
  Props oder eigene Komponenten; die generierten Dateien nicht direkt bearbeiten.
- `src/scripts/demo-formular.ts` sendet JSON an `/api/users`. Die Demo speichert
  keine Daten, erstellt kein Konto und sendet keine E-Mail.
- Consent, Tracking und Turnstile sind konfigurationsabhängig. Keine Anbieter-
  Schlüssel für lokale Arbeit erforderlich; Browsertests simulieren deren Antworten.
- `astro.config.mjs` lädt Root-`.env` und proxyt `/api` im Dev-Server zur lokalen API.

Vom Projektroot: `bun run dev:frontend`. Aus diesem Verzeichnis: `bun run build`,
`bun run lint`, `bun run typecheck` und `bun run preview`. Der Build benötigt weder
Datenbank noch laufendes Backend.
