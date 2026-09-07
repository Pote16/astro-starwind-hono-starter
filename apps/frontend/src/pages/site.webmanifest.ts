import type { APIRoute } from "astro";

import { SITE } from "@/data/site";
import { defaultLang } from "@/i18n/ui";

/**
 * Web-App-Manifest, zur Bauzeit aus src/data/site.ts erzeugt: Name, Farben und
 * Startseite stehen an genau einer Stelle. Die Symbole liegen fertig unter
 * public/ (tools/erzeuge-icons.ts); die maskable-Fassung hat mehr Rand, weil
 * Android Symbole auf Kreis oder Quadrat beschneidet.
 */
export const GET: APIRoute = () => {
  const manifest = {
    name: SITE.name,
    short_name: SITE.shortName,
    description: SITE.description[defaultLang],
    lang: defaultLang,
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    theme_color: SITE.themeColor,
    background_color: SITE.backgroundColor,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(`${JSON.stringify(manifest, null, 2)}\n`, {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8" },
  });
};
