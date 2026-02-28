/**
 * DSGVO-konforme Cookie-Einwilligung
 * Opt-in: Keine Cookies vor expliziter Zustimmung
 * Sprache wird aus document.documentElement.lang ermittelt (i18n)
 */
import * as CookieConsent from "vanilla-cookieconsent";
import { appCookieConfig } from "../data/cookieConsentTypes";
import { cookieConsentTranslations } from "../i18n/cookieConsent";

const pageLang = document.documentElement.getAttribute("lang") ?? appCookieConfig.defaultLanguage;
const currentLang = pageLang.startsWith("de") ? "de" : "en";

CookieConsent.run({
  mode: "opt-in",
  revision: appCookieConfig.revision,
  cookie: {
    name: appCookieConfig.cookieName,
    expiresAfterDays: appCookieConfig.expiresAfterDays,
  },
  guiOptions: {
    consentModal: {
      layout: "cloud inline",
      position: "bottom center",
      equalWeightButtons: true,
    },
    preferencesModal: {
      layout: "box",
      position: "right",
      equalWeightButtons: true,
    },
  },
  categories: {
    necessary: {
      enabled: true,
      readOnly: true,
    },
    analytics: {
      enabled: false,
      autoClear: {
        cookies: [{ name: /^_ga/ }, { name: "_gid" }],
      },
    },
    marketing: {
      enabled: false,
    },
  },
  language: {
    default: currentLang,
    translations: cookieConsentTranslations,
  },
});

declare global {
  interface Window {
    showCookiePreferences?: () => void;
  }
}

window.showCookiePreferences = () => CookieConsent.showPreferences();
