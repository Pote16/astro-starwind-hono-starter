export const languages = {
  de: "Deutsch",
  en: "English",
} as const;

export const defaultLang = "de";
export type Lang = keyof typeof languages;

const de = {
  "nav.home": "Startseite",
  "nav.features": "Funktionen",
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
    "starter.title": "Astro + Starwind Starter",
    "starter.description": "Your new blank canvas. Build something amazing.",
    "starter.stack":
      "Starwind UI 3 with Tailwind CSS v4, Hono API and Drizzle ORM in a Bun monorepo.",
    "starter.docs": "Starwind Docs",
  },
} satisfies Record<Lang, Record<keyof typeof de, string>>;
