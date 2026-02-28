import type { CookieConsentConfig } from "vanilla-cookieconsent";

/**
 * Exposes core Cookie Consent types to be consumed across components
 * keeping logic and data declarations separated.
 */
export type CookieTranslations = NonNullable<CookieConsentConfig["language"]>["translations"];

export interface CookieConsentAppConfig {
  defaultLanguage: string;
  cookieName: string;
  revision: number;
  expiresAfterDays: number;
}

export const appCookieConfig: CookieConsentAppConfig = {
  defaultLanguage: "de",
  cookieName: "cc_cookie",
  revision: 1,
  expiresAfterDays: 365,
};
