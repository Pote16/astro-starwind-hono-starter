import type { APIRoute } from "astro";

import { SITE } from "@/data/site";

/**
 * robots.txt wird zur Bauzeit erzeugt, weil die Sitemap-Zeile die Origin aus
 * PUBLIC_SITE_URL braucht; eine feste Datei unter public/ könnte das nicht.
 *
 * Haltung: Diese Website will gefunden und zitiert werden. Die Such-Crawler
 * von Google, Bing, OpenAI, Anthropic und Perplexity stehen einzeln drin,
 * obwohl "User-agent: *" sie einschließt – so ist die Entscheidung sichtbar
 * und wird nicht versehentlich zurückgedreht. Quellen und Einordnung:
 * docs/seo.md.
 *
 * Nicht indexierbare Seiten (404, Danke-Seiten) werden hier NICHT gesperrt:
 * sie tragen ihr eigenes noindex und fehlen in der Sitemap. Ein Disallow
 * würde Crawler nur daran hindern, dieses noindex überhaupt zu lesen.
 */
const SUCHBOTS = [
  "Googlebot",
  "Bingbot",
  "OAI-SearchBot", // ChatGPT-Suche; gesperrte Sites erscheinen nicht in Antworten
  "ChatGPT-User", // Abrufe im Auftrag eines Nutzers
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot", // trainiert laut Perplexity keine Modelle
  "Perplexity-User",
];

/**
 * Trainings-Crawler. Sie zu sperren kostet keine Sichtbarkeit in der Suche
 * (Google: Google-Extended beeinflusst die Aufnahme in die Suche nicht),
 * ist aber eine Geschäftsentscheidung. Standard: erlaubt; zum Sperren den
 * Block unten einkommentieren (TRAINING_SPERREN = true).
 */
const TRAININGSBOTS = ["GPTBot", "ClaudeBot", "Google-Extended", "CCBot", "Applebot-Extended"];
const TRAINING_SPERREN = false;

export const GET: APIRoute = () => {
  const zeilen = [
    "# robots.txt – erzeugt aus src/pages/robots.txt.ts (Origin aus PUBLIC_SITE_URL).",
    "# Such- und Antwortmaschinen sind ausdrücklich erlaubt; Details in docs/seo.md.",
    "",
    "User-agent: *",
    "Allow: /",
    "",
    ...SUCHBOTS.flatMap((bot) => [`User-agent: ${bot}`, "Allow: /", ""]),
    "# Trainings-Crawler (kein Einfluss auf die Sichtbarkeit in der Suche).",
    ...TRAININGSBOTS.flatMap((bot) =>
      TRAINING_SPERREN
        ? [`User-agent: ${bot}`, "Disallow: /", ""]
        : [`# User-agent: ${bot}`, "# Disallow: /", ""],
    ),
    `Sitemap: ${SITE.origin}/sitemap-index.xml`,
    "",
  ];
  return new Response(zeilen.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
