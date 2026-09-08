import { fileURLToPath } from "node:url";

import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, fontProviders } from "astro/config";
import { z } from "astro/zod";
import { loadEnv } from "vite";

import { defaultLang, languages } from "./src/i18n/ui";
import { istNoindexSeite, pfadFuerSprache } from "./src/lib/seiten";
import { siteUrl } from "./src/lib/site-url";

const envDir = fileURLToPath(new URL("../../", import.meta.url));
const umgebung = loadEnv(
  process.env.NODE_ENV === "production" ? "production" : "development",
  envDir,
  ["PORT", "PUBLIC_SITE_URL"],
);
const backendPort = z.coerce
  .number()
  .int()
  .min(1)
  .max(65535)
  .parse(umgebung.PORT ?? "3005");
// Öffentliche Origin aus PUBLIC_SITE_URL: Grundlage für Astro.site, Canonical,
// hreflang, Sitemap, Open-Graph-URLs und robots.txt. Ungültige Werte brechen ab.
const site = siteUrl(umgebung.PUBLIC_SITE_URL);

// Markierung, an der der Dev-Proxy den intern angehängten Endslash erkennt.
const ENDSLASH_MARKER = "starter-endslash";

/**
 * Nur Dev-Server. Astros trailingSlash-"always"-Prüfung steht vor dem Vite-Proxy
 * und würde /api/users (kein Endslash, keine Dateiendung) mit 404 ablehnen. Diese
 * Middleware läuft davor (Nutzer-Plugins folgen Astros Plugins, ihr Post-Hook
 * setzt sich deshalb an den Anfang) und hängt intern Endslash plus Markierung
 * an; `rewrite` im Proxy stellt den echten Pfad vor dem Backend wieder her.
 * Produktion braucht das nicht: Nginx proxyt /api, bevor Astro beteiligt ist.
 * @returns {import("vite").Plugin}
 */
function apiProxyTrotzTrailingSlash() {
  return {
    name: "starter:api-proxy-trotz-trailing-slash",
    configureServer(server) {
      return () => {
        server.middlewares.stack.unshift({
          route: "",
          handle: (req, _res, next) => {
            const url = new URL(req.url ?? "/", "http://localhost");
            const api = url.pathname === "/api" || url.pathname.startsWith("/api/");
            if (api && !url.pathname.endsWith("/")) {
              req.url = `${url.pathname}/${url.search ? `${url.search}&` : "?"}${ENDSLASH_MARKER}`;
            }
            next();
          },
        });
      };
    },
  };
}

/** Kehrt die Markierung um: "/api/users/?a=1&starter-endslash" → "/api/users?a=1". */
function apiPfadOhneMarker(pfad) {
  if (!pfad.endsWith(ENDSLASH_MARKER)) return pfad;
  return pfad
    .slice(0, -ENDSLASH_MARKER.length)
    .replace(/[?&]$/, "")
    .replace(/\/(?=\?|$)/, "");
}

export default defineConfig({
  site,
  // Nginx (try_files $uri $uri/) leitet /en auf /en/ um. Canonical, hreflang,
  // Sitemap und interne Links tragen deshalb dieselbe Form mit Endslash;
  // tools/pruefe-seo.ts erzwingt sie im Build-Gate.
  trailingSlash: "always",
  output: "static",
  i18n: {
    defaultLocale: defaultLang,
    locales: Object.keys(languages),
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    sitemap({
      // Präfixlose URLs gehören zur Standardsprache; die Integration schreibt
      // daraus xhtml:link-Alternates je Sprache. 404/500 lässt sie selbst weg.
      i18n: {
        defaultLocale: defaultLang,
        locales: Object.fromEntries(Object.keys(languages).map((lang) => [lang, lang])),
      },
      // Seiten mit noindex (src/lib/seiten.ts) gehören nicht in die Sitemap.
      filter: (seite) => !istNoindexSeite(new URL(seite).pathname),
      // x-default (Standardsprache ohne Sprachweiche) schreibt die i18n-Option
      // nicht selbst; nur Seiten mit Sprachgruppe erhalten den Eintrag.
      serialize: (eintrag) => {
        if (eintrag.links?.length) {
          const url = new URL(eintrag.url);
          eintrag.links = [
            ...eintrag.links,
            {
              lang: "x-default",
              url: new URL(pfadFuerSprache(defaultLang, url.pathname), url).href,
            },
          ];
        }
        return eintrag;
      },
    }),
  ],
  // Bilder aus src/assets erhalten automatisch srcset/sizes und feste Maße (CLS).
  image: {
    layout: "constrained",
    // responsiveStyles bleibt aus. Astro spritzt damit sonst rund 30 CSS-Regeln auf
    // [data-astro-image] in jede Seite, die height: auto und aspect-ratio erzwingen.
    // Diese Regeln schlagen die Tailwind-Klassen der Bilder: ein Bild mit
    // "size-full object-cover", das seine Karte fuellen soll, faellt auf seine
    // natuerliche Hoehe zurueck. Aufgefallen am 8.9.2026 auf der Startseite.
    // srcset und sizes erzeugt layout: "constrained" unabhaengig davon weiter;
    // die Groesse bestimmen hier die Klassen am Bild.
    responsiveStyles: false,
  },
  // Fonts-API statt CSS-Import: eine Variable-Font-Datei (latin, woff2), Preload
  // im Layout, metrisch angepasster Fallback gegen Layoutsprünge beim Swap.
  fonts: [
    {
      name: "Inter",
      cssVariable: "--font-inter",
      provider: fontProviders.fontsource(),
      weights: ["100 900"],
      styles: ["normal"],
      subsets: ["latin"],
      formats: ["woff2"],
    },
  ],
  // Nur Links mit data-astro-prefetch, erst bei Hover/Fokus. Bewusst kein
  // ClientRouter: eine kleine MPA braucht keinen Client-Router und dessen JS.
  prefetch: { prefetchAll: false, defaultStrategy: "hover" },
  vite: {
    plugins: [tailwindcss(), apiProxyTrotzTrailingSlash()],
    // Alle Workspaces lesen denselben dokumentierten Vertrag im Projektroot.
    envDir,
    // Gleiche API-Pfade wie hinter Nginx; Origin bleibt für den CSRF-Check erhalten.
    server: {
      proxy: {
        "/api": {
          target: `http://127.0.0.1:${backendPort}`,
          changeOrigin: false,
          xfwd: true,
          rewrite: apiPfadOhneMarker,
        },
      },
    },
  },
});
