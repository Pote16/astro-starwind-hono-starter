import { isIP } from "node:net";

import { z } from "zod";

export const trackingConsentSchema = z.strictObject({
  analytics: z.boolean(),
  marketing: z.boolean(),
});
export type TrackingConsent = z.infer<typeof trackingConsentSchema>;

const identifier = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9._:-]+$/);
const numericId = z.string().regex(/^[1-9][0-9]{0,29}$/);
const secret = z.string().trim().min(1).max(4096).regex(/^\S+$/);
const currency = z.string().regex(/^[A-Z]{3}$/);
const name = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine((value) => /\p{L}/u.test(value));
const email = z.string().trim().toLowerCase().max(254).pipe(z.email());
const amount = z.number().finite().min(0).max(1e12);
const ip = z
  .string()
  .max(45)
  .refine((value) => isIP(value) !== 0 && !value.includes("%"));

export const trackingEventNameSchema = z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,39}$/);
// Reservierte Namen und reine App-Events dürfen nicht in einen Web-Stream.
// https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference#reserved_names
const reservedGaNames = new Set([
  "ad_activeview",
  "ad_click",
  "ad_exposure",
  "ad_query",
  "ad_reward",
  "adunit_exposure",
  "app_clear_data",
  "app_exception",
  "app_install",
  "app_remove",
  "app_store_refund",
  "app_update",
  "app_upgrade",
  "dynamic_link_app_open",
  "dynamic_link_app_update",
  "dynamic_link_first_open",
  "error",
  "firebase_campaign",
  "firebase_in_app_message_action",
  "firebase_in_app_message_dismiss",
  "firebase_in_app_message_impression",
  "first_open",
  "first_visit",
  "notification_dismiss",
  "notification_foreground",
  "notification_open",
  "notification_receive",
  "notification_send",
  "os_update",
  "session_start",
  "user_engagement",
  "ad_impression",
  "in_app_purchase",
  "screen_view",
]);
const gaName = trackingEventNameSchema.refine(
  (value) => !/^(google_|ga_|firebase_)/i.test(value) && !reservedGaNames.has(value),
);

// Nur öffentliche Seitenpfade verwenden. Query und Fragment können Tokens oder PII enthalten.
const sourceUrl = z
  .string()
  .max(2048)
  .pipe(z.url({ protocol: /^https?$/ }))
  .refine((value) => {
    const url = new URL(value);
    return !url.username && !url.password;
  })
  .transform((value) => {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return url.href;
  });

export const ga4ConfigSchema = z.object({
  GA4_MEASUREMENT_ID: z.string().regex(/^G-[A-Z0-9]+$/),
  GA4_MP_API_SECRET: secret,
});
export const metaConfigSchema = z.object({
  META_PIXEL_ID: numericId,
  META_ACCESS_TOKEN: secret,
  // Verifizierter Business-SDK-Stand; Aktualisierungen bewusst konfigurieren.
  META_API_VERSION: z
    .string()
    .regex(/^v[1-9][0-9]*\.0$/)
    .default("v25.0"),
  META_TEST_EVENT_CODE: z
    .string()
    .trim()
    .max(100)
    .regex(/^[A-Za-z0-9_-]*$/)
    .optional(),
});
export const linkedInConfigSchema = z.object({
  LINKEDIN_API_TOKEN: secret,
  // https://learn.microsoft.com/en-us/linkedin/marketing/versioning
  LINKEDIN_API_VERSION: z
    .string()
    .regex(/^20[0-9]{2}(0[1-9]|1[0-2])$/)
    .default("202608"),
  LINKEDIN_CONVERSION_ID: numericId,
});

export const ga4EventSchema = z
  .strictObject({
    eventName: gaName,
    clientId: z.string().regex(/^[0-9]{1,20}\.[0-9]{1,20}$/),
    sessionId: numericId.optional(),
    engagementTimeMs: z.number().int().min(0).max(86_400_000).optional(),
    eventId: identifier.optional(),
    value: amount.optional(),
    currency: currency.optional(),
    // Keine freien Nachrichten, Namen oder E-Mail-Adressen als Eventparameter.
    parameters: z
      .strictObject({
        form_id: identifier.optional(),
        content_id: identifier.optional(),
        content_type: identifier.optional(),
        method: identifier.optional(),
      })
      .optional(),
  })
  .refine((data) => data.value === undefined || data.currency !== undefined);
export type Ga4Event = z.input<typeof ga4EventSchema>;

export const metaEventSchema = z
  .strictObject({
    eventName: trackingEventNameSchema,
    eventId: identifier,
    eventSourceUrl: sourceUrl,
    email: email.optional(),
    // Vorher ins internationale E.164-Format bringen; kein Land wird geraten.
    phone: z
      .string()
      .regex(/^\+[1-9][0-9]{6,14}$/)
      .optional(),
    firstName: name.optional(),
    lastName: name.optional(),
    clientIpAddress: ip.optional(),
    clientUserAgent: z
      .string()
      .min(1)
      .max(1024)
      .regex(/^[^\r\n]+$/)
      .optional(),
    fbp: z
      .string()
      .max(255)
      .regex(/^fb\.[0-9]+\.[0-9]+\.[0-9]+$/)
      .optional(),
    fbc: z
      .string()
      .max(512)
      .regex(/^fb\.[0-9]+\.[0-9]+\.[A-Za-z0-9_-]+$/)
      .optional(),
    value: amount.optional(),
    currency: currency.optional(),
  })
  .refine((data) => data.value === undefined || data.currency !== undefined);
export type MetaEvent = z.input<typeof metaEventSchema>;

export const linkedInEventSchema = z
  .strictObject({
    conversionId: numericId.optional(),
    eventId: identifier,
    email: email.optional(),
    firstName: name.optional(),
    lastName: name.optional(),
    companyName: z.string().trim().min(1).max(200).optional(),
    value: amount.optional(),
    currency: currency.optional(),
  })
  .refine((data) => data.value === undefined || data.currency !== undefined)
  .refine((data) => {
    const hasUserInfo = Boolean(data.firstName || data.lastName || data.companyName);
    return !hasUserInfo || Boolean(data.firstName && data.lastName);
  });
export type LinkedInEvent = z.input<typeof linkedInEventSchema>;
