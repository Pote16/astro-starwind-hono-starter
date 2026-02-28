export const languages = {
  de: 'Deutsch',
  en: 'English',
};

export const defaultLang = 'de';

export type Lang = keyof typeof languages;

export const ui = {
  de: {
    'nav.home': 'Startseite',
    'nav.features': 'Funktionen',
  },
  en: {
    'nav.home': 'Home',
    'nav.features': 'Features',
  },
} as const;
