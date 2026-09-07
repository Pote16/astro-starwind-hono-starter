import type { APIRoute } from "astro";

import { SITE } from "@/data/site";
import { type Lang, languages, ui } from "@/i18n/ui";
import { pfadFuerSprache } from "@/lib/seiten";

/**
 * Kompakter Quellenindex nach dem llms.txt-Vorschlag (llmstxt.org): H1,
 * Blockquote-Kurzfassung, Abschnitte mit Linklisten. Er ergänzt Sitemap und
 * crawlbares HTML, ersetzt sie nicht; AI-Crawler rufen die Datei selten ab.
 * Nur Seiten verlinken, die indexierbar sind und im Build existieren
 * (tools/pruefe-seo.ts prüft jeden Link).
 */
export const GET: APIRoute = () => {
  const abschnitte = (Object.keys(languages) as Lang[]).map(
    (lang) =>
      `## ${languages[lang]}\n- [${ui[lang]["nav.home"]}](${SITE.origin}${pfadFuerSprache(lang, "/")}): ${SITE.description[lang]}`,
  );
  const inhalt = [
    `# ${SITE.name}`,
    "",
    `> ${SITE.description.en}`,
    "",
    ...abschnitte.flatMap((abschnitt) => [abschnitt, ""]),
  ].join("\n");
  return new Response(inhalt, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
