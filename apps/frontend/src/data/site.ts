import type { ImageMetadata } from "astro";

import ogDefault from "@/assets/og-default.png";
import type { Lang } from "@/i18n/ui";
import { siteUrl } from "@/lib/site-url";

/**
 * Einzige Quelle für Fakten über die Website und ihren Betreiber. Layout
 * (Titel-Suffix, Open Graph, Manifest), JSON-LD (src/lib/schema.ts),
 * robots.txt und llms.txt lesen ausschließlich hier. Nichts erfinden: leere
 * Felder bleiben leer und werden in den strukturierten Daten weggelassen.
 * Seitentexte (Titel, Beschreibung je Seite) stehen in src/i18n/ui.ts.
 */
export interface SiteDaten {
  /** Markenname: og:site_name, Name in Organization/WebSite, Manifest, llms.txt. */
  name: string;
  /** Kurzname für den Startbildschirm (Android kürzt nach etwa zwölf Zeichen). */
  shortName: string;
  /** Eingetragener Rechtsträger, falls vom Markennamen abweichend; leer = weglassen. */
  legalName: string;
  /** Öffentliche Origin ohne Endslash, aus PUBLIC_SITE_URL (identisch mit `site`). */
  origin: string;
  /** Kurzbeschreibung der Website je Sprache (JSON-LD, Manifest, llms.txt). */
  description: Record<Lang, string>;
  /** og:locale je Sprache (Sprache_REGION). */
  ogLocale: Record<Lang, string>;
  /** Adressleistenfarbe mobiler Browser und Manifest-Themenfarbe. */
  themeColor: string;
  /** Hintergrund des Startbildschirms beim Laden der installierten Web-App. */
  backgroundColor: string;
  /** Standard-Vorschaubild 1200×630 aus src/assets (tools/erzeuge-icons.ts). */
  defaultOgImage: ImageMetadata;
  ogImageAlt: Record<Lang, string>;
  /** Logo für Organization.logo (mindestens 112×112 px), Pfad unter public/. */
  logo: string;
  /** Kontaktdaten des Betreibers; nur gesetzte Werte erscheinen im JSON-LD. */
  contact: {
    email: string;
    phone: string;
    address: { street: string; postalCode: string; locality: string; country: string };
  };
  /** Offizielle Profile (z. B. LinkedIn, GitHub) für Organization.sameAs. */
  sameAs: string[];
}

export const SITE: SiteDaten = {
  name: "Astro + Starwind Starter",
  shortName: "Starter",
  legalName: "",
  origin: siteUrl(import.meta.env.PUBLIC_SITE_URL),
  description: {
    de: "Vorlage für Websites mit statischem Astro-Frontend, Starwind UI, Hono-API und PostgreSQL im Bun-Monorepo.",
    en: "Template for websites with a static Astro frontend, Starwind UI, Hono API and PostgreSQL in a Bun monorepo.",
  },
  ogLocale: { de: "de_AT", en: "en_GB" },
  themeColor: "#2563eb",
  backgroundColor: "#ffffff",
  defaultOgImage: ogDefault,
  ogImageAlt: {
    de: "Symbol und Schriftzug „Astro + Starwind Starter“ auf blauem Grund",
    en: "Icon and wordmark “Astro + Starwind Starter” on a blue background",
  },
  logo: "/icon-512.png",
  contact: {
    email: "",
    phone: "",
    address: { street: "", postalCode: "", locality: "", country: "" },
  },
  sameAs: [],
};
