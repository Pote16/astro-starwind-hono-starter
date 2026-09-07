import { z } from "astro/zod";

/**
 * Öffentliche Origin der Website aus PUBLIC_SITE_URL. Einzige Quelle für
 * `site` in astro.config.mjs und `SITE.origin` in src/data/site.ts; daraus
 * entstehen Canonical, hreflang, Sitemap, Open-Graph-URLs und robots.txt.
 *
 * Ohne Wert (CI, E2E, frischer Checkout ohne .env) gilt der lokale Dev-Server.
 * Ein gesetzter, aber ungültiger Wert bricht den Build ab: Pfad, Query, Hash
 * oder Zugangsdaten in der Origin würden jede abgeleitete URL verfälschen.
 */
export const STANDARD_SITE_URL = "http://localhost:4321";

function istOrigin(wert: string): boolean {
  try {
    const url = new URL(wert);
    return (url.protocol === "http:" || url.protocol === "https:") && url.href === `${url.origin}/`;
  } catch {
    return false;
  }
}

const schema = z
  .string()
  .trim()
  .refine(istOrigin, {
    message:
      "PUBLIC_SITE_URL muss eine http(s)-Origin ohne Pfad, Query oder Zugangsdaten sein, z. B. https://example.at",
  })
  .transform((wert) => new URL(wert).origin);

/** Liefert die Origin ohne Endslash; leer oder undefiniert ergibt den Standard. */
export function siteUrl(wert: string | undefined): string {
  return schema.parse(wert?.trim() ? wert : STANDARD_SITE_URL);
}
