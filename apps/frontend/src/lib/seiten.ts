import { defaultLang, type Lang, languages } from "../i18n/ui";

/**
 * Pfadregeln der Website, ohne Astro-Abhängigkeit: Layout, Sitemap-Filter und
 * das Build-Gate tools/pruefe-seo.ts rechnen mit denselben Funktionen.
 *
 * Konvention (astro.config.mjs): Standardsprache ohne Präfix unter "/", jede
 * weitere Sprache unter "/<lang>/", trailingSlash "always". Eine Seite existiert
 * in allen Sprachen unter derselben Kennung; übersetzte Slugs sind nicht
 * vorgesehen (dafür wäre ein Routenkatalog je Kennung nötig).
 */

/** Seiten, die nie in Sitemap und hreflang erscheinen (Kennung ohne Sprachpräfix, z. B. "/danke/"). */
export const NOINDEX_SEITEN: ReadonlySet<string> = new Set<string>([]);

/** Sprache aus dem ersten Pfadsegment; alles andere gehört zur Standardsprache. */
export function spracheAusPfad(pathname: string): Lang {
  const segment = pathname.split("/")[1];
  return segment !== undefined && Object.hasOwn(languages, segment) && segment !== defaultLang
    ? (segment as Lang)
    : defaultLang;
}

/** Sprachunabhängige Kennung: "/" für die Startseite, sonst "/pfad/" mit Endslash. */
export function seitenKennung(pathname: string): string {
  const sprache = spracheAusPfad(pathname);
  const ohnePraefix =
    sprache === defaultLang ? pathname : pathname.slice(`/${sprache}`.length) || "/";
  const bereinigt = ohnePraefix.replace(/\/+$/, "").replace(/^\/+/, "");
  return bereinigt ? `/${bereinigt}/` : "/";
}

/** Pfad einer Kennung in einer Sprache, mit Endslash. */
export function pfadFuerSprache(sprache: Lang, kennung: string): string {
  const normiert = seitenKennung(kennung);
  return sprache === defaultLang ? normiert : `/${sprache}${normiert}`;
}

export function istNoindexSeite(pathname: string): boolean {
  return NOINDEX_SEITEN.has(seitenKennung(pathname));
}
