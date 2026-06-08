---
description: Best Practices für Astro.build, UI-Komponenten, Actions und Performance
globs: "apps/frontend/**/*.{astro,ts,tsx}"
alwaysApply: false
---

# Astro Frontend Architektur

## Grundprinzipien

1. **Zero-JavaScript-Baseline:**

- Standardmäßig wird in Astro KEIN JavaScript an den Client gesendet.
- Interaktive UI-Komponenten (React/Solid/Vanilla JS) MÜSSEN explizit mit Islands-Direktiven versehen werden.
- Wähle die passende Direktive: `client:load` (sofort), `client:visible` (bei Sichtbarkeit), `client:idle` (nach Idle), `client:only="react"` (kein SSR).
- Im Zweifel `client:visible` bevorzugen – es ist die performanteste Option für Inhalte unterhalb des Viewports.

2. **Astro-Komponenten bevorzugen (.astro):**

- Verwende `.astro`-Komponenten für ALLES, was keine Client-seitige Interaktivität benötigt (Layouts, Seiten, statische UI-Sektionen, Cards, Header, Footer).
- `.astro`-Komponenten haben KEINEN Client-JS-Overhead und sind immer die beste Wahl für statische Inhalte.
- Erstelle Framework-Komponenten (React/Solid) NUR wenn echte Client-Interaktivität erforderlich ist (Formulare mit Live-Validierung, dynamische Filterlisten, Modals mit komplexem State).

3. **Wann eigene Komponenten erstellen:**

- Erstelle eine eigene Komponente, wenn ein UI-Block **3x oder öfter** im Projekt vorkommt.
- Erstelle eine eigene Komponente, wenn ein UI-Block **eigene Logik** enthält (Props-Verarbeitung, bedingte Darstellung, Datenformatierung).
- Erstelle KEINE Wrapper-Komponenten, die nur eine Starwind-Komponente 1:1 wrappen, ohne Mehrwert zu liefern.
- Komponenten-Hierarchie: Seiten (`pages/`) → Layouts (`layouts/`) → Sektionen (`components/sections/`) → UI-Bausteine (`components/ui/` / `components/starwind/`).

## Astro Actions (Server Actions)

4. **Astro Actions mit Zod-Validierung:**

- Definiere Server-Actions in `src/actions/index.ts` mit `defineAction` aus `astro:actions`.
- JEDE Action MUSS einen `input`-Zod-Validator haben – Actions ohne Input-Validierung sind verboten.
- Importiere `z` aus `astro/zod` (NICHT aus dem `zod`-Paket direkt) um Versionskonflikte zu vermeiden.
- Verwende `accept: 'form'` für HTML-Formular-Actions, `accept: 'json'` (Standard) für programmatische Aufrufe.

5. **Action Error Handling:**

- Nutze `ActionError` aus `astro:actions` für kontrollierte Fehler mit HTTP-Statuscodes.
- Auf dem Client: Verwende `actions.myAction.safe()` oder `Astro.getActionResult()` für typsicheres Error-Handling.

## Assets & Routing

6. **Bilder & statische Dateien:**

- Rohe, nicht-optimierbare Dateien (Favicons, `robots.txt`, Webfonts) gehören in den Ordner `public/`.
- Bilder (JPG, PNG) gehören ZWINGEND nach `src/assets/`. Nutze die eingebaute `<Image />` oder `getImage()` API von `astro:assets`, damit Astro automatische WebP-Konvertierung und Größenanpassung übernimmt.

7. **Dynamisches Routing:**

- Falls Astro im Static Site Generator (SSG) Modus läuft, MUSST du für dynamische Routen (z. B. `src/pages/blog/[slug].astro`) die Funktion `getStaticPaths()` exportieren, damit der Build gelingt.
- Nutzt du Astro im Server/SSR-Modus (via Hono), entfällt diese Notwendigkeit.

## Internationalization (i18n)

8. **Trennung von UI-Strings und Page Content:**

- **Globale UI-Übersetzungen:** Kurze, global wiederverwendbare Strings (Navigation, Footer, Button-Texte, Legal-Links) gehören in `src/i18n/ui.ts`. Diese werden über die `useTranslations(lang)`-Funktion direkt in den Komponenten geladen (`t('nav.pricing')`).
- **Seiten-spezifischer Content:** Lange Texte, Arrays, Features, FAQs oder ganze Landingpage-Blöcke gehören **nicht** in `ui.ts`. Lege dafür strukturierte Datenmodelle an (z. B. `src/data/homeContent.ts`) und exportiere eine Funktion (z.B. `getHomeContent(lang:)`), um die kompletten lokalisierten Datenobjekte abzurufen.

9. **Keine hardgecodeten Fallbacks im UI:**

- Verwende KEINE Ternary-Operatoren in `.astro`-Komponenten zur reinen Sprachenscheidung (`lang === 'en' ? 'Yes' : 'Ja'`). Die Logik für die Rückgabe der korrekten Sprache muss zwingend in den jeweiligen TS-Datenstrukturen/Funktionen oder im Context abstrahiert liegen.

## Styling & UI

10. **Starwind UI v2 (Pro):**

- Verwende Starwind UI als primäre Komponentenbibliothek. Wir haben eine **Pro-Lizenz** – Pro-Blöcke und Komponenten dürfen genutzt werden.
- Komponenten liegen unter `src/components/starwind/` mit `variants.ts` pro Komponente (tailwind-variants, `data-slot`).
- Import über `@/`-Alias: `import { Button } from "@/components/starwind/button"`.
- Skills: `.claude/skills/starwind-ui` und `starwind-pro`. CLI aus `apps/frontend/`: `bunx starwind@latest add <component> --yes`.
- Vor eigenem Bau: Skill + `bunx starwind@latest docs <component>` (oder MCP `starwind_docs`).
- Pro-Blöcke: Skill `starwind-pro` + `bunx starwind@latest search --plan pro`.
- Starwind-Komponenten NICHT direkt anpassen – Wrapper in `components/ui/`.

11. **Tailwind CSS v4:**

- Nutze Tailwind CSS v4 mit der neuen `@theme`-Syntax und CSS-Variablen.
- Theming über CSS-Variablen in `src/styles/global.css` (`:root` und `.dark`).
- Verwende die semantischen Farben (`bg-primary`, `text-foreground`, `border-border`) statt hardgecodeter Tailwind-Farben (`bg-blue-700`).
- Dark Mode wird über die CSS-Klasse `.dark` gesteuert – kein `prefers-color-scheme` Media-Query.

## State & Datenfluss

12. **State Management:**

- Übergeordnete Zustände zwischen isolierten Islands müssen mit `nanostores` verwaltet werden. Keine tiefen React-Context-Provider.
- Für einfache UI-States (Toggle, Tabs) nutze native HTML/CSS Lösungen oder `<script>`-Tags in Astro-Komponenten.

13. **Daten-Fetching:**

- Fetche Daten im Astro-Frontmatter (Server-Side) über den Hono RPC Client. KEIN `fetch()` im Client, wenn es nicht zwingend nötig ist.
- Nutze den typisierten Hono Client: `import { hc } from 'hono/client'` mit dem exportierten `AppType`.

## Refactoring-Regeln

14. **Dateistruktur:**

- Eine Astro-Datei sollte NICHT länger als ~200 Zeilen sein. Wenn sie größer wird, extrahiere Sektionen in eigene Komponenten.
- Frontmatter-Logik (zwischen `---`) sollte minimal sein. Komplexe Logik gehört in Utility-Funktionen (`src/lib/` oder `src/utils/`).
- Wiederverwendbare Typen gehören in `src/types/`, Zod-Schemas in `src/schemas/`.
