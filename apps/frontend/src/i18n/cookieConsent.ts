import type { CookieConsentConfig } from "vanilla-cookieconsent";

import {
  cookieKonfiguration,
  marketingEingerichtet,
  statistikEingerichtet,
  trackingKonfiguration,
} from "../lib/tracking-konfiguration";

function maskiereHtml(wert: string): string {
  return wert
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Ein konfigurierter Link darf weder HTML einschleusen noch JavaScript öffnen. */
export function datenschutzLink(wert: unknown): string | undefined {
  if (typeof wert !== "string" || !wert.trim()) return undefined;
  const raw = wert.trim();
  try {
    const basis = "https://starter.invalid";
    const url = new URL(raw, basis);
    if (url.protocol !== "https:" || url.username || url.password) return undefined;
    if (raw.startsWith("/") && !raw.startsWith("//") && url.origin === basis)
      return maskiereHtml(url.pathname + url.search + url.hash);
    if (!raw.startsWith("https://")) return undefined;
    return maskiereHtml(url.href);
  } catch {
    return undefined;
  }
}

const privacyDe = datenschutzLink(import.meta.env.PUBLIC_PRIVACY_URL_DE);
const privacyEn = datenschutzLink(import.meta.env.PUBLIC_PRIVACY_URL_EN);
const marketingAnbieter = [
  trackingKonfiguration.googleAds ? "Google Ads" : undefined,
  trackingKonfiguration.meta || trackingKonfiguration.server.meta ? "Meta" : undefined,
  trackingKonfiguration.linkedin || trackingKonfiguration.server.linkedin ? "LinkedIn" : undefined,
]
  .filter(Boolean)
  .join(", ");
const optional = statistikEingerichtet || marketingEingerichtet;

const statistikBeschreibung = {
  de: [
    trackingKonfiguration.googleAnalytics
      ? "Nach Zustimmung erfasst der Google-Analytics-Tag Seitenaufrufe und ausdrücklich eingebundene Ereignisse. Dabei können Browser-, Geräte- und Cookiekennungen verarbeitet werden. Ohne Zustimmung wird das Google-Analyseziel nicht geladen."
      : undefined,
    trackingKonfiguration.server.googleAnalytics
      ? "Für serverseitig eingebundene Auswertungen kann unser Backend nach Zustimmung Ereignisse und eine Client-Kennung an Google Analytics übermitteln. Diese Einstellung allein lädt keinen Google-Tag im Browser."
      : undefined,
    "Diese Angaben sind nicht generell anonym. Google kann Daten auch außerhalb des Europäischen Wirtschaftsraums verarbeiten.",
  ]
    .filter(Boolean)
    .join(" "),
  en: [
    trackingKonfiguration.googleAnalytics
      ? "After consent, the Google Analytics tag records page views and explicitly integrated events. Browser, device and cookie identifiers may be processed. The Google Analytics destination is not loaded without consent."
      : undefined,
    trackingKonfiguration.server.googleAnalytics
      ? "For analytics integrated on the server, our backend may send events and a client identifier to Google Analytics after consent. This setting alone does not load a Google tag in your browser."
      : undefined,
    "This information is not generally anonymous. Google may also process data outside the European Economic Area.",
  ]
    .filter(Boolean)
    .join(" "),
};

const marketingBeschreibung = {
  de: [
    "Nach Zustimmung werden die eingerichteten Dienste zur Werbezuordnung verwendet. Sie können Interaktionen, Onlinekennungen und technische Verbindungsdaten verarbeiten sowie Ereignisse mit vorhandenen Profilen verknüpfen.",
    trackingKonfiguration.googleAds || trackingKonfiguration.meta || trackingKonfiguration.linkedin
      ? "Eingerichtete Browser-Tags werden erst nach Zustimmung geladen und können Seitenaufrufe erfassen."
      : undefined,
    trackingKonfiguration.server.meta || trackingKonfiguration.server.linkedin
      ? "Serverseitig eingebundene Ereignisse werden ebenfalls nur nach Zustimmung übermittelt. Diese Einstellung allein lädt keine Browser-Tags."
      : undefined,
    trackingKonfiguration.server.meta
      ? "Bei Meta können zur Zuordnung gehashte Kontaktangaben und technische Kennungen hinzukommen."
      : undefined,
    trackingKonfiguration.server.linkedin
      ? "Bei LinkedIn können E-Mail-Adressen in gehashter Form sowie Vor- und Nachnamen und Firmenangaben im Klartext hinzukommen."
      : undefined,
    "Die Anbieter können Daten auch außerhalb des Europäischen Wirtschaftsraums verarbeiten.",
  ]
    .filter(Boolean)
    .join(" "),
  en: [
    "After consent, configured services are used for advertising attribution. They may process interactions, online identifiers and technical connection data, and associate events with existing profiles.",
    trackingKonfiguration.googleAds || trackingKonfiguration.meta || trackingKonfiguration.linkedin
      ? "Configured browser tags load only after consent and may record page views."
      : undefined,
    trackingKonfiguration.server.meta || trackingKonfiguration.server.linkedin
      ? "Events integrated on the server are also sent only after consent. This setting alone does not load browser tags."
      : undefined,
    trackingKonfiguration.server.meta
      ? "Meta matching may also use hashed contact details and technical identifiers."
      : undefined,
    trackingKonfiguration.server.linkedin
      ? "LinkedIn matching may also use hashed email addresses, as well as first names, last names and company details in plain text."
      : undefined,
    "Providers may also process data outside the European Economic Area.",
  ]
    .filter(Boolean)
    .join(" "),
};

export const cookieConsentTranslations: NonNullable<
  CookieConsentConfig["language"]
>["translations"] = {
  de: {
    consentModal: {
      title: "Ihre Datenschutzeinstellungen",
      description: optional
        ? "Wir speichern Ihre Cookie-Auswahl. Optionale Statistik- und Marketingdienste werden erst mit Ihrer Zustimmung verwendet. Sie können Ihre Auswahl jederzeit ändern."
        : "Wir speichern Ihre Cookie-Auswahl. In dieser Websitekonfiguration sind keine Statistik- oder Marketingdienste aktiviert.",
      acceptAllBtn: "Alle akzeptieren",
      acceptNecessaryBtn: "Nur notwendige",
      showPreferencesBtn: "Einstellungen",
      ...(privacyDe ? { footer: `<a href="${privacyDe}">Datenschutz</a>` } : {}),
    },
    preferencesModal: {
      title: "Cookie-Einstellungen",
      acceptAllBtn: "Alle akzeptieren",
      acceptNecessaryBtn: "Nur notwendige",
      savePreferencesBtn: "Auswahl speichern",
      closeIconLabel: "Schließen",
      sections: [
        {
          title: "Notwendige Speicherung",
          linkedCategory: "necessary",
          description: `Das Cookie „${cookieKonfiguration.name}“ speichert Ihre Auswahl und den Einwilligungsnachweis für ${cookieKonfiguration.laufzeitTage} Tage. Diese Einstellung ist für die Berücksichtigung Ihrer Entscheidung erforderlich.`,
        },
        ...(statistikEingerichtet
          ? [
              {
                title: "Statistik mit Google Analytics",
                linkedCategory: "analytics",
                description: statistikBeschreibung.de,
              },
            ]
          : []),
        ...(marketingEingerichtet
          ? [
              {
                title: `Marketing mit ${marketingAnbieter}`,
                linkedCategory: "marketing",
                description: marketingBeschreibung.de,
              },
            ]
          : []),
        {
          title: "Auswahl ändern und widerrufen",
          description:
            "Sie können Ihre Einwilligung jederzeit für die Zukunft ändern. Eigene einwilligungsabhängige Ereignisse werden beim Widerruf gestoppt und erreichbare Cookies gelöscht. Bereits übermittelte Daten werden nicht zurückgeholt. Geladene Drittanbieterskripte können in der geöffneten Seite weiterlaufen; Cookies fremder Domains kann diese Website nicht vollständig entfernen. Ein erneuter Seitenaufruf berücksichtigt die neue Auswahl.",
        },
        ...(privacyDe
          ? [
              {
                title: "Weitere Informationen",
                description: `<a href="${privacyDe}">Datenschutzhinweise dieser Website</a>`,
              },
            ]
          : []),
      ],
    },
  },
  en: {
    consentModal: {
      title: "Your privacy choices",
      description: optional
        ? "We store your cookie choices. Optional analytics and marketing services are used only with your consent. You can change your choices at any time."
        : "We store your cookie choices. No analytics or marketing services are enabled in this website configuration.",
      acceptAllBtn: "Accept all",
      acceptNecessaryBtn: "Necessary only",
      showPreferencesBtn: "Settings",
      ...(privacyEn ? { footer: `<a href="${privacyEn}">Privacy</a>` } : {}),
    },
    preferencesModal: {
      title: "Cookie settings",
      acceptAllBtn: "Accept all",
      acceptNecessaryBtn: "Necessary only",
      savePreferencesBtn: "Save selection",
      closeIconLabel: "Close",
      sections: [
        {
          title: "Necessary storage",
          linkedCategory: "necessary",
          description: `The “${cookieKonfiguration.name}” cookie stores your choices and consent record for ${cookieKonfiguration.laufzeitTage} days. This setting is necessary to respect your decision.`,
        },
        ...(statistikEingerichtet
          ? [
              {
                title: "Analytics with Google Analytics",
                linkedCategory: "analytics",
                description: statistikBeschreibung.en,
              },
            ]
          : []),
        ...(marketingEingerichtet
          ? [
              {
                title: `Marketing with ${marketingAnbieter}`,
                linkedCategory: "marketing",
                description: marketingBeschreibung.en,
              },
            ]
          : []),
        {
          title: "Changing and withdrawing consent",
          description:
            "You can change your consent for the future at any time. Withdrawal stops our own consent-dependent events and deletes accessible cookies. It does not retrieve data already sent. Third-party scripts already loaded may continue within the open page; this website cannot fully remove cookies from other domains. Reopening the page applies your new choices.",
        },
        ...(privacyEn
          ? [
              {
                title: "More information",
                description: `<a href="${privacyEn}">This website’s privacy notice</a>`,
              },
            ]
          : []),
      ],
    },
  },
};
