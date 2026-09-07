# Assets (`src/assets`)

Dateien hier werden von Astro importiert und über `astro:assets` optimiert. Dateien
in `public/` werden **nicht** optimiert; dorthin gehören nur Icons und Dateien, die
unverändert unter ihrer URL erreichbar sein müssen (`favicon.*`, `apple-touch-icon.png`,
`icon-*.png`). `robots.txt`, `site.webmanifest`, `llms.txt` und die Sitemap werden
aus `src/pages/*.ts` bzw. der Sitemap-Integration erzeugt, nicht abgelegt.

## Bilder einbinden: `components/Bild.astro`

```astro
---
import hero from "@/assets/hero.jpg";
import Bild from "@/components/Bild.astro";
---

<Bild src={hero} alt="Beschreibung" priority sizes="(max-width: 640px) 100vw, 512px" />
<Bild src={hero} alt="Beschreibung" class="rounded-xl" />
```

- Ausgabe: `<picture>` mit AVIF und WebP-Rückfall (Qualität 62, entspricht etwa
  WebP q80 bei 25–40 % weniger Bytes), `srcset`/`sizes` aus `image.layout: "constrained"`
  (`astro.config.mjs`), feste `width`/`height` gegen Layoutsprünge.
- `priority` genau einmal pro Seite für das größte sichtbare Bild beim Laden (LCP):
  `loading="eager"`, `fetchpriority="high"`, `decoding="sync"`. Alle anderen Bilder
  laden lazy. Das Build-Gate `bun run audit:seo` meldet mehr als ein Priority-Bild,
  fehlende `alt`-Texte oder fehlende Maße.
- `sizes` beschreibt die tatsächliche Darstellungsbreite; `widths` überschreibt die
  automatischen Breiten nur bei Bedarf.
- SVG-Grafiken, die als Bild eingebunden werden, bleiben unverändert (kein AVIF).

## Vorschaubild `og-default.png`

1200×630, erzeugt von `tools/erzeuge-icons.ts` (`bun run icons` in `apps/frontend`)
aus `public/favicon.svg`; in `src/data/site.ts` als `defaultOgImage` referenziert und
vom Layout als `og:image`/`twitter:image` ausgegeben. Eine Seite kann ein eigenes Bild
über das Layout-Prop `image={{ src, alt }}` mitgeben; es wird zur Bauzeit auf 1200×630
gebracht.

## Schriften

Inter kommt über die Astro-Fonts-API (`fonts` in `astro.config.mjs`, Provider
Fontsource, nur `latin`, woff2) mit Preload im Layout; `--font-inter` speist
`--font-sans` in `src/styles/global.css`. Eigene Schriftdateien gehören nach
`src/assets/fonts/` und werden mit `fontProviders.local()` eingebunden; höchstens eine
Schrift vorladen, sonst konkurriert der Preload mit dem LCP-Bild.
