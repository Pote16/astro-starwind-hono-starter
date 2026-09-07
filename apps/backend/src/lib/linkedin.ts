import { linkedInConfigSchema, linkedInEventSchema } from "../schemas/tracking.schema.js";
import {
  type CurrentTrackingConsent,
  hashContact,
  postTracking,
  readCurrentConsent,
  type TrackingOptions,
  type TrackingResult,
} from "./tracking.js";

/** https://learn.microsoft.com/en-us/linkedin/marketing/integrations/ads-reporting/conversions-api-schema
 * LinkedIn verlangt E-Mail gehasht, Namen/Firma hingegen im Klartext. Vor Nutzung offenlegen. */
export function createLinkedInSender(options: TrackingOptions = {}) {
  return async (
    input: unknown,
    currentConsent: CurrentTrackingConsent,
  ): Promise<TrackingResult> => {
    if (readCurrentConsent(currentConsent)?.marketing !== true)
      return { status: "skipped", reason: "consent_required" };
    const env = options.env ?? process.env;
    if (!env.LINKEDIN_API_TOKEN?.trim()) return { status: "skipped", reason: "missing_config" };
    const parsed = linkedInEventSchema.safeParse(input);
    if (!parsed.success) return { status: "skipped", reason: "invalid_event" };
    const data = parsed.data;
    const conversionId = data.conversionId ?? env.LINKEDIN_CONVERSION_ID;
    if (!conversionId?.trim()) return { status: "skipped", reason: "missing_config" };
    const config = linkedInConfigSchema.safeParse({ ...env, LINKEDIN_CONVERSION_ID: conversionId });
    if (!config.success) return { status: "skipped", reason: "invalid_config" };
    if (!data.email && !(data.firstName && data.lastName))
      return { status: "skipped", reason: "missing_user_data" };
    const body = {
      conversion: `urn:lla:llaPartnerConversion:${config.data.LINKEDIN_CONVERSION_ID}`,
      conversionHappenedAt: Date.now(),
      eventId: data.eventId,
      user: {
        userIds: data.email ? [{ idType: "SHA256_EMAIL", idValue: hashContact(data.email) }] : [],
        ...(data.firstName &&
          data.lastName && {
            userInfo: {
              firstName: data.firstName,
              lastName: data.lastName,
              ...(data.companyName && { companyName: data.companyName }),
            },
          }),
      },
      ...(data.value !== undefined && {
        conversionValue: {
          amount: data.value.toFixed(2),
          currencyCode: data.currency,
        },
      }),
    };
    return postTracking(
      "linkedin",
      "marketing",
      currentConsent,
      "https://api.linkedin.com/rest/conversionEvents",
      () => body,
      options,
      {
        Authorization: `Bearer ${config.data.LINKEDIN_API_TOKEN}`,
        "X-Restli-Protocol-Version": "2.0.0",
        "Linkedin-Version": config.data.LINKEDIN_API_VERSION,
      },
    );
  };
}

export const sendLinkedInConversion = createLinkedInSender();
