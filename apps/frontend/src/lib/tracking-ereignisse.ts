import { z } from "astro/zod";

export const trackingEreignisSchema = z.enum([
  "PageView",
  "ViewContent",
  "Lead",
  "Contact",
  "CompleteRegistration",
]);

// Keine freien Texte, Formularfelder, Seiten-URLs oder beliebigen Custom-Daten.
// Event-IDs sind zufällige UUIDs, keine E-Mail-Adressen oder sprechenden Namen.
export const trackingParameterSchema = z
  .object({
    eventId: z.uuid().optional(),
    value: z.number().min(0).max(1_000_000_000).optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .optional(),
  })
  .refine((daten) => daten.value === undefined || daten.currency !== undefined, {
    path: ["currency"],
    message: "Ein Geldwert benötigt eine Währung.",
  });

export type TrackingEventName = z.infer<typeof trackingEreignisSchema>;
export type TrackOptions = z.infer<typeof trackingParameterSchema>;

export const googleEreignisNamen: Record<TrackingEventName, string> = {
  PageView: "page_view",
  ViewContent: "view_item",
  Lead: "generate_lead",
  Contact: "contact",
  CompleteRegistration: "sign_up",
};
