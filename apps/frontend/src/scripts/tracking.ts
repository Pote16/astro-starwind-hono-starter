import {
  googleEreignisNamen,
  trackingEreignisSchema,
  type TrackingEventName,
  trackingParameterSchema,
  type TrackOptions,
} from "../lib/tracking-ereignisse";
import { trackingKonfiguration } from "../lib/tracking-konfiguration";
import { hatEinwilligung } from "./einwilligung";
import { erlaubteGoogleZiele, googleSeitenParameter } from "./google-consent";

export type { TrackingEventName, TrackOptions } from "../lib/tracking-ereignisse";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
    lintrk?: ((...args: unknown[]) => void) & { q?: unknown[][] };
    dataLayer?: unknown[];
    __metaPixelBereit?: boolean;
    __linkedinBereit?: boolean;
    _linkedin_partner_id?: string;
    _linkedin_data_partner_ids?: string[];
  }
}

let analyticsErlaubt = false;
let marketingErlaubt = false;

export function setAnalyticsConsent(granted: boolean): void {
  analyticsErlaubt = granted && hatEinwilligung("analytics");
  if (trackingKonfiguration.googleAnalytics || trackingKonfiguration.googleAds) {
    window.gtag?.("consent", "update", {
      analytics_storage: analyticsErlaubt ? "granted" : "denied",
    });
  }
}

export function setMarketingConsent(granted: boolean): void {
  marketingErlaubt = granted && hatEinwilligung("marketing");
  if (trackingKonfiguration.meta) window.fbq?.("consent", marketingErlaubt ? "grant" : "revoke");
  if (trackingKonfiguration.googleAnalytics || trackingKonfiguration.googleAds) {
    window.gtag?.("consent", "update", {
      ad_storage: marketingErlaubt ? "granted" : "denied",
      ad_user_data: marketingErlaubt ? "granted" : "denied",
      ad_personalization: marketingErlaubt ? "granted" : "denied",
    });
  }
}

/** Eigene Ereignisse benötigen Konfiguration, gültige aktuelle Einwilligung
 * und die zuletzt angewandten Consent-Flags. Ein geladenes Skript reicht nicht. */
export function track(name: TrackingEventName, options: TrackOptions = {}): void {
  const ereignis = trackingEreignisSchema.safeParse(name);
  const parameter = trackingParameterSchema.safeParse(options);
  if (!ereignis.success || !parameter.success || typeof window === "undefined") return;
  const { eventId, value, currency } = parameter.data;
  const payload: Record<string, number | string> = {};
  if (value !== undefined) payload.value = value;
  if (currency !== undefined) payload.currency = currency;
  const marketing = marketingErlaubt && hatEinwilligung("marketing");

  if (marketing && trackingKonfiguration.meta && window.__metaPixelBereit && window.fbq) {
    if (eventId) window.fbq("track", ereignis.data, payload, { eventID: eventId });
    else window.fbq("track", ereignis.data, payload);
  }

  const ziele = erlaubteGoogleZiele().filter((ziel) =>
    ziel === trackingKonfiguration.googleAnalytics ? analyticsErlaubt : marketingErlaubt,
  );
  if (ziele.length > 0 && window.gtag) {
    // Für Lead/Contact gibt es keine zugesicherte GA-Deduplizierung. Dasselbe
    // Ereignis bewusst im Browser ODER serverseitig melden, nicht doppelt.
    window.gtag("event", googleEreignisNamen[ereignis.data], {
      ...payload,
      ...(eventId ? { event_id: eventId } : {}),
      ...googleSeitenParameter(),
      send_to: ziele,
    });
  }

  if (marketing && trackingKonfiguration.linkedin && window.__linkedinBereit && window.lintrk) {
    const ids = trackingKonfiguration.linkedinConversions;
    const raw = ereignis.data in ids ? ids[ereignis.data as keyof typeof ids] : undefined;
    const id = raw ? Number(raw) : 0;
    if (Number.isSafeInteger(id) && id > 0) {
      window.lintrk("track", { conversion_id: id, ...(eventId ? { event_id: eventId } : {}) });
    }
  }
}

/** Nur Meta, damit der erste Google-Seitenaufruf nicht doppelt gezählt wird. */
export function trackMetaPageView(): boolean {
  if (
    !marketingErlaubt ||
    !hatEinwilligung("marketing") ||
    !trackingKonfiguration.meta ||
    !window.__metaPixelBereit ||
    !window.fbq
  )
    return false;
  window.fbq("track", "PageView", {});
  return true;
}
