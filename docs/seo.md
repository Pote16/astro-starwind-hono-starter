# SEO, AI-Sichtbarkeit (GEO) und PageSpeed

Der Starter liefert die technische SEO-Grundlage, die eine Marketing-Site vor dem
ersten Deploy braucht, und ein Build-Gate, das sie bei jedem Deploy und in CI
erzwingt. Nichts davon erfindet Inhalte: Fakten über Betreiber und Website stehen
in `apps/frontend/src/data/site.ts`, Seitentexte in `src/i18n/ui.ts`.

## Was umgesetzt ist

### Konfiguration (`apps/frontend/astro.config.mjs`)

| Einstellung                 | Wert                                                               | Grund                                                                                                  |
| --------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `site`                      | `PUBLIC_SITE_URL` aus der Root-`.env` (`src/lib/site-url.ts`)      | Voraussetzung für Canonical, absolute hreflang, Sitemap und OG-URLs; ungültige Werte brechen den Build |
| `trailingSlash`             | `"always"`                                                         | Nginx (`try_files $uri $uri/`) leitet `/en` ohnehin auf `/en/` um; alle URLs tragen dieselbe Form      |
| `integrations: [sitemap()]` | `i18n` de/en, `filter` für noindex-Seiten, `serialize` → x-default | `sitemap-index.xml` mit `xhtml:link`-Sprachgruppen; 404/500 filtert die Integration selbst             |
| `image`                     | `layout: "constrained"`, `responsiveStyles: true`                  | `srcset`/`sizes` und feste Maße für jedes Bild aus `src/assets` (CLS)                                  |
| `fonts`                     | Inter, `fontProviders.fontsource()`, `100 900`, latin, woff2       | Eine Datei, Preload im Layout, metrisch angepasster Fallback gegen Layoutsprünge                       |
| `prefetch`                  | `prefetchAll: false`, `defaultStrategy: "hover"`                   | Nur Links mit `data-astro-prefetch`; kein `ClientRouter`                                               |

Ohne `.env` (CI, E2E, frischer Checkout) gilt `http://localhost:4321`. In Produktion
muss `PUBLIC_SITE_URL` die HTTPS-Origin ohne Pfad sein (`https://example.at`).

Nur im Dev-Server: Astros `trailingSlash: "always"`-Prüfung läuft vor dem Vite-Proxy und
würde `/api/users` (kein Endslash, keine Dateiendung) mit 404 ablehnen. Ein kleines
Vite-Plugin in `astro.config.mjs` hängt `/api`-Aufrufen intern Endslash und Markierung
an; `rewrite` im Proxy stellt den echten Pfad vor dem Backend wieder her. In Produktion
proxyt Nginx `/api`, bevor Astro beteiligt ist.

### Layout-Head (`src/layouts/Layout.astro`)

Jede Seite übergibt `title` und `description` (Pflicht), optional `noindex`, `image`
(1200×630 aus `src/assets`) und `breadcrumbs`. Der Head enthält:

- `<meta charset>`, Viewport mit `initial-scale=1`, Titel, Description,
  `robots` (`index, follow, max-image-preview:large` bzw. `noindex, follow`);
- Canonical (absolut, selbstreferenzierend, Endslash) und hreflang `de`/`en`/`x-default`
  über `getAbsoluteLocaleUrl` – beides entfällt auf noindex-Seiten;
- `<link rel="sitemap">`, Open Graph (`og:site_name`, `og:title`, `og:description`,
  `og:type`, `og:url` = Canonical, `og:locale` + `og:locale:alternate`, `og:image`
  absolut mit Breite/Höhe/Alt) und `twitter:card summary_large_image`;
- Favicon-Satz (`favicon.ico`, `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`),
  `site.webmanifest`, `theme-color`;
- `<Font cssVariable="--font-inter" preload />` (genau ein Font-Preload);
- JSON-LD `Organization` und `WebSite` (`src/lib/schema.ts`, via `JsonLd.astro`),
  `BreadcrumbList` bei übergebenen Brotkrümeln;
- Sprunglink auf `<main id="inhalt">`; `TrackingHead` und Consent bleiben erhalten.

### Generierte Dateien (`src/pages/*.ts`)

- `robots.txt`: `Allow: /` für alle, Such- und Antwort-Bots einzeln aufgeführt,
  Trainings-Bots als dokumentierter, auskommentierter Block, `Sitemap:`-Zeile mit Origin.
- `site.webmanifest`: Name, Farben, Startseite und Icons aus `site.ts`.
- `llms.txt`: H1, Blockquote-Kurzfassung, je Sprache Links auf existierende Seiten.
- `sitemap-index.xml`/`sitemap-0.xml`: von `@astrojs/sitemap`.

### Bausteine

- `src/data/site.ts`: einzige Quelle für Name, Origin, Beschreibung je Sprache,
  OG-Locale, Farben, Vorschaubild, Logo, Kontakt (leer = wird weggelassen), `sameAs`.
- `src/lib/seiten.ts`: Pfadregeln (`/` für Deutsch, `/en/` für Englisch, Endslash),
  `NOINDEX_SEITEN` für Seiten, die nie in Sitemap und hreflang erscheinen.
- `src/lib/schema.ts` + `src/components/JsonLd.astro`: schema.org ohne erfundene Werte.
- `src/components/Bild.astro`: AVIF mit WebP-Rückfall, `priority` für das eine LCP-Bild
  je Seite (`loading=eager`, `fetchpriority=high`, `decoding=sync`), sonst lazy.
- `tools/erzeuge-icons.ts`: Favicon-Satz, App-Icons und `src/assets/og-default.png`
  aus `public/favicon.svg` (einmalig, Ergebnis committet; `bun run icons`).

### Neue Seite anlegen

1. Datei unter `src/pages/<kennung>/index.astro` und `src/pages/[lang]/<kennung>/index.astro`
   (oder gemeinsames Markup wie `Starter.astro`) – jede Seite existiert in allen Sprachen
   unter derselben Kennung.
2. `seo.<kennung>.title` und `seo.<kennung>.description` je Sprache in `src/i18n/ui.ts`;
   beide müssen siteweit eindeutig sein.
3. Bilder über `Bild.astro`; genau ein Bild pro Seite mit `priority`.
4. Danke-/Bestätigungsseiten in `NOINDEX_SEITEN` eintragen oder `noindex` übergeben.
5. `bun run build && bun run audit:seo`.

## Prüfen

### Automatisch: `bun run audit:seo`

`apps/frontend/tools/pruefe-seo.ts` liest ausschließlich das Build-Verzeichnis (kein
Browser, kein Netz), schreibt `.deploy/seo-audit.json` und beendet sich mit Exit 1 und
einer lesbaren Liste, sobald ein Befund vorliegt. Optionen: `--dist <verzeichnis>`
(Standard `apps/frontend/dist`), `--bericht <datei>`. Ist `PUBLIC_SITE_URL` in der
Umgebung gesetzt (Deploy), muss die Build-Origin dazu passen.

| Kennung                                                                                      | Regel                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `build`, `sprache`                                                                           | HTML-Seiten vorhanden; Startseite jeder Sprache existiert                                                                                                               |
| `origin`, `origin-https`, `origin-umgebung`                                                  | Origin aus dem Canonical der Startseite; außerhalb von localhost https; gleich `PUBLIC_SITE_URL`                                                                        |
| `seitenpfad`                                                                                 | Nur `*/index.html` und `404.html` (Verzeichnisform, `trailingSlash: "always"`)                                                                                          |
| `html-lang`, `h1`, `title`, `description`, `viewport`, `robots-meta`                         | Sprache passt zum Pfad; genau eine H1; Titel/Description vorhanden und siteweit eindeutig; Viewport mit `initial-scale=1`; genau ein robots-Meta                        |
| `canonical`, `canonical-noindex`, `og-url`, `og-image`                                       | Canonical absolut, selbstreferenzierend, mit Endslash; keiner auf noindex-Seiten; `og:url` = Canonical; `og:image` absolut, eigene Origin, Datei im Build               |
| `hreflang`, `hreflang-ziel`, `hreflang-indexierbar`, `hreflang-reziprok`, `hreflang-noindex` | Alle Sprachen + x-default, richtige Ziele, Ziele indexierbar, wechselseitig; keine auf noindex-Seiten                                                                   |
| `bild-alt`, `bild-src`, `bild-masse`, `bild-prioritaet`                                      | `alt`, `src`, positive `width`/`height`; höchstens ein `fetchpriority=high`, und das mit `loading=eager`                                                                |
| `font-preload`                                                                               | Höchstens ein Font-Preload, Datei im Build, `crossorigin`                                                                                                               |
| `link-url`, `link-ziel`, `link-slash`, `link-anker`, `icon`, `manifest`                      | Interne `href`/`src`/`srcset` gültig und im Build; Verzeichnisseiten mit Endslash; Anker existieren; Icon-/Manifest-Dateien vorhanden, Manifest gültiges JSON mit Icons |
| `json-ld`, `json-ld-typ`, `json-ld-breadcrumb`, `json-ld-verfuegbarkeit`                     | Jeder Block parst, hat `@context`/`@type`; Brotkrümel-URLs im Build; kein statisches `InStock`                                                                          |
| `404`                                                                                        | `404.html` vorhanden und `noindex`                                                                                                                                      |
| `sitemap*`                                                                                   | `sitemap-index.xml` vorhanden; jede URL eigene Origin, im Build, Endslash, vollständige Sprachgruppe; keine noindex-Seite; jede indexierbare Seite enthalten            |
| `robots-txt`                                                                                 | `Sitemap: <origin>/sitemap-index.xml`; kein `Disallow: /` unter `User-agent: *`                                                                                         |
| `llms`                                                                                       | `llms.txt` mit H1; nur absolute Links auf existierende, indexierbare Seiten                                                                                             |

Das Gate läuft im Deploy gegen `dist.new` (`scripts/deploy-audits.sh`, vor Migration und
Veröffentlichung) und in CI nach dem Build (`.github/workflows/quality.yml`). Es ist selbst
getestet: `apps/frontend/tools/pruefe-seo.test.ts` prüft einen fehlerfreien Fixture-Build,
gezielt kaputte Seiten je Kennung und einen frischen Astro-Build des Starters.

### Manuell nach dem ersten Deploy

- `curl -sI https://<domain>/en` → `301` auf `/en/`; `curl -s https://<domain>/robots.txt`,
  `/sitemap-index.xml`, `/llms.txt`, `/site.webmanifest`, eine unbekannte URL → `404`.
- Google Search Console: Property anlegen, Sitemap einreichen, URL-Prüfung für `/` und `/en/`.
- Bing Webmaster Tools: Site verifizieren und Sitemap eintragen (Bing speist ChatGPT-Suche).
- Rich-Results-Test bzw. Schema-Validator für Organization/WebSite; Social-Debugger für OG.

## Haltung zu GEO / AI-Sichtbarkeit

- Google verlangt für AI Overviews und AI Mode „no additional requirements“ – keine
  AI-Textdateien, kein Spezial-Markup; Steuerung nur über `nosnippet`, `max-snippet`,
  `noindex` ([Google: AI features](https://developers.google.com/search/docs/appearance/ai-features)).
  Saubere technische SEO plus klare, konsistente Fakten im sichtbaren HTML sind daher
  der Kern; JSON-LD und `llms.txt` ergänzen das.
- Such- und Antwort-Bots sind ausdrücklich erlaubt: OpenAI blendet gesperrte Sites aus
  ChatGPT-Antworten aus ([OpenAI-Bots](https://developers.openai.com/api/docs/bots)),
  Anthropic trennt `Claude-SearchBot`/`Claude-User` vom Trainings-Crawler
  ([Anthropic](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler)),
  Perplexity bittet um Freigabe und trainiert nicht ([Perplexity-Bots](https://docs.perplexity.ai/guides/bots)).
- Trainings-Crawler (`GPTBot`, `ClaudeBot`, `Google-Extended`, `CCBot`, `Applebot-Extended`)
  zu sperren kostet keine Sichtbarkeit in der Suche
  ([Google-Crawler](https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers));
  Standard im Starter: erlaubt, Sperrblock in `robots.txt.ts` dokumentiert.
- `llms.txt` ([Spezifikation](https://llmstxt.org/)) wird von AI-Crawlern selten abgerufen
  und von Google nicht unterstützt; die Datei ist billig, ersetzt aber weder Sitemap noch HTML.
- FAQPage-Rich-Results gibt es seit 2026 nicht mehr
  ([Google FAQPage](https://developers.google.com/search/docs/appearance/structured-data/faqpage));
  FAQ-Inhalte gehören sichtbar ins HTML, Schema nur als Ergänzung.
- Keine `aggregateRating`, Preise oder Verfügbarkeiten im JSON-LD ohne belegte Daten auf
  der Seite ([Organization-Doku](https://developers.google.com/search/docs/appearance/structured-data/organization)).

## PageSpeed-Entscheidungen

- **Schrift:** Fonts-API statt `@fontsource`-CSS-Import: eine latin-Datei (Variable
  100–900), ein Preload, `font-display: swap`, metrisch angepasster Fallback
  ([Astro Fonts](https://docs.astro.build/en/guides/fonts/), [web.dev](https://web.dev/articles/font-best-practices)).
  Der Build lädt die Datei einmal von Fontsource und cacht sie unter `node_modules/.astro`;
  ein Build ohne Netz braucht stattdessen `fontProviders.local()`.
- **Bilder:** nur `astro:assets` über `Bild.astro`; AVIF q62 spart 25–40 % gegenüber WebP q80
  bei gleicher Qualität; genau ein `priority`-Bild je Seite (LCP), Rest lazy; `public/`
  nur für Icons. Das Gate erzwingt Maße, `alt` und die Priority-Regel.
- **Kein `ClientRouter`/View Transitions:** bringt Client-Router-JS und `prefetchAll`, für
  eine kleine MPA ohne Nutzen; Prefetch nur bei Hover auf markierten Links.
- **CSS:** `build.inlineStylesheets` bleibt auf `auto` – große Stylesheets inline verschieben
  die Entdeckung des LCP-Bildes nach hinten.
- **Nginx (`scripts/nginx.conf`):** HTML `no-store`, `/_astro/` ein Jahr `immutable`, echte
  404-Seite mit Status 404, gzip je Site. **Brotli** (`brotli_static` mit vorkomprimierten
  Dateien) und **HTTP/3** sind Server-Optionen in Ploi (Modulnachweis per `nginx -V`,
  HTTP/3-Häkchen plus UDP 443 in der Firewall,
  [Ploi-Doku](https://ploi.io/documentation/server/setting-up-http3-with-nginx-on-ubuntu));
  sie gehören nicht in den Vhost-Vertrag des Starters.
- **JS:** Consent, Turnstile und Tracking bleiben einwilligungs- und env-gebunden;
  kein Drittanbieter-Script statisch im Head.

## Nicht umgesetzt (bewusst)

- IndexNow-Push nach dem Deploy, `llms-full.txt`, Lighthouse-CI-Job, `LocalBusiness`
  statt `Organization` (nur mit echter Adresse), FAQ-Schema: erst mit konkretem Bedarf
  des abgeleiteten Projekts.

## Quellen

- [Astro: `Astro.site`, i18n, Sitemap, Bilder, Fonts, Prefetch](https://docs.astro.build/en/)
- [Google: Lokalisierte Versionen / hreflang](https://developers.google.com/search/docs/specialty/international/localized-versions)
- [Google: robots-Meta](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)
- [Google: HTTP-Statuscodes und Soft-404](https://developers.google.com/search/docs/crawling-indexing/http-network-errors)
- [Core Web Vitals](https://web.dev/articles/vitals)
