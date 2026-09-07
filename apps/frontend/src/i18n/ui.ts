export const languages = {
  de: "Deutsch",
  en: "English",
} as const;

export const defaultLang = "de";
export type Lang = keyof typeof languages;

const de = {
  "nav.home": "Startseite",
  "nav.features": "Funktionen",
  // Titel und Beschreibung müssen je Seite UND Sprache eindeutig sein
  // (tools/pruefe-seo.ts meldet Duplikate). Beschreibung höchstens ~155 Zeichen.
  "seo.title": "Astro + Starwind Starter – Startvorlage für Astro, Hono und Bun",
  "seo.description":
    "Bun-Monorepo mit statischem Astro-Frontend, Starwind UI, Hono-API und PostgreSQL – zweisprachig, mit Consent, Bot-Schutz und Deploy-Harness.",
  "seo.skip": "Zum Inhalt springen",
  "seo.heroAlt": "Vorschaubild des Starters: Symbol und Schriftzug „Astro + Starwind Starter“",
  "starter.title": "Astro + Starwind Starter",
  "starter.description": "Deine neue Leinwand. Baue etwas Großartiges.",
  "starter.stack": "Starwind UI 3 mit Tailwind CSS v4, Hono API und Drizzle ORM im Bun-Monorepo.",
  "starter.docs": "Starwind-Dokumentation",
};

export const ui = {
  de,
  en: {
    "nav.home": "Home",
    "nav.features": "Features",
    "seo.title": "Astro + Starwind Starter – Starter template for Astro, Hono and Bun",
    "seo.description":
      "Bun monorepo with a static Astro frontend, Starwind UI, Hono API and PostgreSQL – bilingual, with consent, bot protection and a deploy harness.",
    "seo.skip": "Skip to content",
    "seo.heroAlt": "Preview image of the starter: icon and wordmark “Astro + Starwind Starter”",
    "starter.title": "Astro + Starwind Starter",
    "starter.description": "Your new blank canvas. Build something amazing.",
    "starter.stack":
      "Starwind UI 3 with Tailwind CSS v4, Hono API and Drizzle ORM in a Bun monorepo.",
    "starter.docs": "Starwind Docs",
  },
} satisfies Record<Lang, Record<keyof typeof de, string>>;
