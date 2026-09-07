export const testUrls = {
  backend: "http://127.0.0.1:44151",
  blank: "http://127.0.0.1:44152",
  configured: "http://127.0.0.1:44153",
} as const;

// Erfunden und ausschließlich im abgefangenen Browserkontext verwendet.
export const browserTestIds = {
  PUBLIC_GA_MEASUREMENT_ID: "G-TEST123",
  PUBLIC_GOOGLE_ADS_ID: "AW-123456",
  PUBLIC_META_PIXEL_ID: "1234567",
  PUBLIC_LINKEDIN_PARTNER_ID: "7654321",
  PUBLIC_LI_CONVERSION_LEAD: "321",
  PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
} as const;
