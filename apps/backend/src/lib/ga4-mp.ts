import { ga4ConfigSchema, ga4EventSchema } from "../schemas/tracking.schema.js";
import {
  type CurrentTrackingConsent,
  postTracking,
  readCurrentConsent,
  type TrackingOptions,
  type TrackingResult,
} from "./tracking.js";

/** https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference */
export function createGa4Sender(options: TrackingOptions = {}) {
  return async (
    input: unknown,
    currentConsent: CurrentTrackingConsent,
  ): Promise<TrackingResult> => {
    if (readCurrentConsent(currentConsent)?.analytics !== true)
      return { status: "skipped", reason: "consent_required" };
    const env = options.env ?? process.env;
    if (!env.GA4_MEASUREMENT_ID?.trim() || !env.GA4_MP_API_SECRET?.trim())
      return { status: "skipped", reason: "missing_config" };
    const config = ga4ConfigSchema.safeParse(env);
    if (!config.success) return { status: "skipped", reason: "invalid_config" };
    const parsed = ga4EventSchema.safeParse(input);
    if (!parsed.success) return { status: "skipped", reason: "invalid_event" };
    const data = parsed.data;
    const params = {
      ...data.parameters,
      ...(data.sessionId && { session_id: data.sessionId }),
      ...(data.engagementTimeMs !== undefined && { engagement_time_msec: data.engagementTimeMs }),
      ...(data.eventId && { event_id: data.eventId }),
      ...(data.value !== undefined && { value: data.value }),
      ...(data.currency && { currency: data.currency }),
    };
    // Keine erfundene Client-ID/Interaktionsdauer und keine transaction_id für Leads.
    // EU-Erfassung ist keine Zusage, dass jede weitere Verarbeitung in der EU bleibt.
    const url = new URL("https://region1.google-analytics.com/mp/collect");
    url.searchParams.set("measurement_id", config.data.GA4_MEASUREMENT_ID);
    url.searchParams.set("api_secret", config.data.GA4_MP_API_SECRET);
    return postTracking(
      "ga4",
      "analytics",
      currentConsent,
      url.href,
      (consent) => ({
        client_id: data.clientId,
        consent: {
          ad_user_data: consent.marketing ? "GRANTED" : "DENIED",
          ad_personalization: consent.marketing ? "GRANTED" : "DENIED",
        },
        events: [{ name: data.eventName, params }],
      }),
      options,
    );
  };
}

export const sendGa4Event = createGa4Sender();
