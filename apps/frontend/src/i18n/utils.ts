import { getRelativeLocaleUrl } from "astro:i18n";

import { defaultLang, type Lang, languages, ui } from "./ui";

export function isLang(value: string | undefined): value is Lang {
  return value !== undefined && Object.hasOwn(languages, value);
}

export function getLangFromLocale(locale: string | undefined): Lang {
  return isLang(locale) ? locale : defaultLang;
}

export function getLangFromUrl(url: URL): Lang {
  return getLangFromLocale(url.pathname.split("/")[1]);
}

export function useTranslations(lang: Lang) {
  return function t(key: keyof (typeof ui)[typeof defaultLang]): string {
    return ui[lang][key];
  };
}

export function useTranslatedPath(lang: Lang) {
  return function translatePath(path: string, target: Lang = lang): string {
    // Astro berücksichtigt dabei auch den präfixlosen deutschen Standardpfad.
    return getRelativeLocaleUrl(target, path.replace(/^\/+/, ""));
  };
}
