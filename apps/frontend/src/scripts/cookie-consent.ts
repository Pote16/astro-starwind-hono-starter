import { run, showPreferences } from "vanilla-cookieconsent";

import { cookieConsentTranslations } from "../i18n/cookieConsent";
import {
  cookieKonfiguration,
  marketingEingerichtet,
  statistikEingerichtet,
  trackingKonfiguration,
} from "../lib/tracking-konfiguration";
import { hatEinwilligung } from "./einwilligung";
import { aktiviereGoogleTags } from "./google-consent";
import { setAnalyticsConsent, setMarketingConsent, trackMetaPageView } from "./tracking";

function ladeScript(id: string, src: string): void {
  if (document.getElementById(id)) return;
  const script = document.createElement("script");
  script.id = id;
  script.src = src;
  script.async = true;
  document.head.appendChild(script);
}

function starteMarketing(): void {
  if (!hatEinwilligung("marketing")) return;
  if (trackingKonfiguration.meta && window.fbq && !window.__metaPixelBereit) {
    window.fbq("init", trackingKonfiguration.meta);
    window.__metaPixelBereit = true;
    ladeScript("meta-pixel-script", "https://connect.facebook.net/en_US/fbevents.js");
    trackMetaPageView();
  }
  if (trackingKonfiguration.linkedin && !window.__linkedinBereit) {
    window._linkedin_partner_id = trackingKonfiguration.linkedin;
    window._linkedin_data_partner_ids = [trackingKonfiguration.linkedin];
    if (!window.lintrk) {
      const warteschlange: NonNullable<Window["lintrk"]> = (...werte: unknown[]) => {
        warteschlange.q?.push(werte);
      };
      warteschlange.q = [];
      window.lintrk = warteschlange;
    }
    ladeScript("li-insight-tag", "https://snap.licdn.com/li.lms-analytics/insight.min.js");
    window.__linkedinBereit = true;
  }
}

function aktualisiereEinwilligung(): void {
  // Erst die Sperren und Anbietersignale setzen, anschließend Bibliotheken
  // initialisieren. Vor Zustimmung werden keine Ereignisse zwischengespeichert.
  setAnalyticsConsent(hatEinwilligung("analytics"));
  setMarketingConsent(hatEinwilligung("marketing"));
  aktiviereGoogleTags();
  starteMarketing();
}

const sprache = document.documentElement.getAttribute("lang")?.startsWith("en") ? "en" : "de";

void run({
  mode: "opt-in",
  revision: cookieKonfiguration.revision,
  cookie: { name: cookieKonfiguration.name, expiresAfterDays: cookieKonfiguration.laufzeitTage },
  guiOptions: {
    consentModal: { layout: "cloud inline", position: "bottom center", equalWeightButtons: true },
    preferencesModal: { layout: "box", position: "right", equalWeightButtons: true },
  },
  onConsent: aktualisiereEinwilligung,
  onChange: aktualisiereEinwilligung,
  categories: {
    necessary: { enabled: true, readOnly: true },
    ...(statistikEingerichtet
      ? {
          analytics: {
            enabled: false,
            autoClear: { cookies: [{ name: /^_ga/ }, { name: "_gid" }, { name: /^_gat/ }] },
          },
        }
      : {}),
    ...(marketingEingerichtet
      ? {
          marketing: {
            enabled: false,
            autoClear: { cookies: [{ name: /^_fb/ }, { name: /^_gcl/ }] },
          },
        }
      : {}),
  },
  language: { default: sprache, autoDetect: "document", translations: cookieConsentTranslations },
});

// Widerruf stoppt unsere eigenen Aufrufe und setzt Google/Meta auf denied/revoke.
// Bereits geladene Drittanbieterskripte und Cookies auf linkedin.com können wir
// nicht vollständig entfernen. Kein erzwungener Reload, der Formulare verwirft.
declare global {
  interface Window {
    showCookiePreferences?: () => void;
  }
}
window.showCookiePreferences = () => showPreferences();
document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  if (event.target.closest("[data-cookie-einstellungen]")) showPreferences();
});
