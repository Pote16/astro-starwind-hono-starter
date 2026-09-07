import { metaConfigSchema, metaEventSchema } from "../schemas/tracking.schema.js";
import {
  type CurrentTrackingConsent,
  hashContact,
  postTracking,
  readCurrentConsent,
  type TrackingOptions,
  type TrackingResult,
} from "./tracking.js";

// Meta: https://github.com/facebook/capi-param-builder (PII-Normalisierung)
function normalizedName(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]/gu, "");
}

/** Keine Limited-Data-Use-Ausnahme. Ohne aktuelle Marketing-Einwilligung kein Request. */
export function createMetaSender(options: TrackingOptions = {}) {
  return async (
    input: unknown,
    currentConsent: CurrentTrackingConsent,
  ): Promise<TrackingResult> => {
    if (readCurrentConsent(currentConsent)?.marketing !== true)
      return { status: "skipped", reason: "consent_required" };
    const env = options.env ?? process.env;
    if (!env.META_PIXEL_ID?.trim() || !env.META_ACCESS_TOKEN?.trim())
      return { status: "skipped", reason: "missing_config" };
    const config = metaConfigSchema.safeParse(env);
    if (!config.success) return { status: "skipped", reason: "invalid_config" };
    const parsed = metaEventSchema.safeParse(input);
    if (!parsed.success) return { status: "skipped", reason: "invalid_event" };
    const data = parsed.data;
    // Ein einzelner Name oder User-Agent reicht ohne weiteres Matchmerkmal nicht.
    if (
      !data.email &&
      !data.phone &&
      !data.fbc &&
      !data.fbp &&
      !(data.clientIpAddress && data.clientUserAgent)
    )
      return { status: "skipped", reason: "missing_user_data" };
    const userData = {
      ...(data.email && { em: [hashContact(data.email)] }),
      ...(data.phone && { ph: [hashContact(data.phone.slice(1))] }),
      ...(data.firstName && { fn: [hashContact(normalizedName(data.firstName))] }),
      ...(data.lastName && { ln: [hashContact(normalizedName(data.lastName))] }),
      ...(data.clientIpAddress && { client_ip_address: data.clientIpAddress }),
      ...(data.clientUserAgent && { client_user_agent: data.clientUserAgent }),
      ...(data.fbc && { fbc: data.fbc }),
      ...(data.fbp && { fbp: data.fbp }),
    };
    const body = {
      data: [
        {
          event_name: data.eventName,
          event_id: data.eventId,
          event_time: Math.floor(Date.now() / 1000),
          event_source_url: data.eventSourceUrl,
          action_source: "website",
          user_data: userData,
          ...(data.value !== undefined && {
            custom_data: { value: data.value, currency: data.currency },
          }),
        },
      ],
      ...(config.data.META_TEST_EVENT_CODE && {
        test_event_code: config.data.META_TEST_EVENT_CODE,
      }),
    };
    return postTracking(
      "meta",
      "marketing",
      currentConsent,
      `https://graph.facebook.com/${config.data.META_API_VERSION}/${config.data.META_PIXEL_ID}/events`,
      () => body,
      options,
      { Authorization: `Bearer ${config.data.META_ACCESS_TOKEN}` },
    );
  };
}

export const sendMetaConversion = createMetaSender();
