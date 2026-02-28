type Language = 'de' | 'en';

export interface Feature {
  title: string;
  description: string;
}

export interface HomeContent {
  hero: {
    title: string;
    starter: string;
    subtitle: string;
  };
  features: Feature[];
}

const content: Record<Language, HomeContent> = {
  de: {
    hero: {
      title: 'Astro + Starwind + Hono',
      starter: 'Starter',
      subtitle: 'Willkommen im neuen Projekt-Setup! Die i18n-Infrastruktur steht bereit.',
    },
    features: [
      {
        title: 'Frontend',
        description: 'Astro, React, Tailwind CSS 4, Starwind UI components.',
      },
      {
        title: 'Backend',
        description: 'Hono.js API, Typensicherheit im gesamten Monorepo.',
      },
    ],
  },
  en: {
    hero: {
      title: 'Astro + Starwind + Hono',
      starter: 'Starter',
      subtitle: 'Welcome to the new project setup! The i18n infrastructure is ready.',
    },
    features: [
      {
        title: 'Frontend',
        description: 'Astro, React, Tailwind CSS 4, Starwind UI components.',
      },
      {
        title: 'Backend',
        description: 'Hono.js API, Type safety across the entire monorepo.',
      },
    ],
  },
};

export function getHomeContent(lang: string): HomeContent {
  return content[lang as Language] || content['de'];
}
