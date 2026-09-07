function oeffentlicheId(wert: unknown, muster: RegExp): string | undefined {
  if (typeof wert !== "string") return undefined;
  const id = wert.trim();
  return muster.test(id) ? id : undefined;
}

// Ausschließlich öffentliche IDs. Fehlende oder falsch formatierte Werte
// erzeugen weder Snippets noch Requests an einen Anbieter.
export const trackingKonfiguration = {
  googleAnalytics: oeffentlicheId(import.meta.env.PUBLIC_GA_MEASUREMENT_ID, /^G-[A-Z0-9]+$/),
  googleAds: oeffentlicheId(import.meta.env.PUBLIC_GOOGLE_ADS_ID, /^AW-\d+$/),
  meta: oeffentlicheId(import.meta.env.PUBLIC_META_PIXEL_ID, /^\d+$/),
  linkedin: oeffentlicheId(import.meta.env.PUBLIC_LINKEDIN_PARTNER_ID, /^\d+$/),
  // Diese Build-Flags beschreiben serverseitige Integrationen im Banner.
  // Sie dürfen niemals als Freigabe für einen Browser-Loader dienen.
  server: {
    googleAnalytics: import.meta.env.PUBLIC_GA4_MP_ENABLED === "true",
    meta: import.meta.env.PUBLIC_META_CAPI_ENABLED === "true",
    linkedin: import.meta.env.PUBLIC_LINKEDIN_CAPI_ENABLED === "true",
  },
  linkedinConversions: {
    Lead: oeffentlicheId(import.meta.env.PUBLIC_LI_CONVERSION_LEAD, /^\d+$/),
    Contact: oeffentlicheId(import.meta.env.PUBLIC_LI_CONVERSION_CONTACT, /^\d+$/),
    CompleteRegistration: oeffentlicheId(
      import.meta.env.PUBLIC_LI_CONVERSION_COMPLETEREGISTRATION,
      /^\d+$/,
    ),
  },
} as const;

export const cookieKonfiguration = { name: "cc_cookie", laufzeitTage: 182, revision: 2 } as const;

export const statistikEingerichtet = Boolean(
  trackingKonfiguration.googleAnalytics || trackingKonfiguration.server.googleAnalytics,
);
export const marketingEingerichtet = Boolean(
  trackingKonfiguration.googleAds ||
  trackingKonfiguration.meta ||
  trackingKonfiguration.linkedin ||
  trackingKonfiguration.server.meta ||
  trackingKonfiguration.server.linkedin,
);
