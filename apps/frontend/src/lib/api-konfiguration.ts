import { z } from "astro/zod";

const apiSchema = z.union([
  z.literal(""),
  z.url({ protocol: /^https?$/ }).refine((wert) => {
    try {
      return new URL(wert).origin === wert;
    } catch {
      return false;
    }
  }),
]);

/** Fehlkonfiguration darf das Formular nicht vor der lokalisierten Fehlermeldung abbrechen. */
export function leseApiOrigin(wert: string) {
  return apiSchema.safeParse(wert.replace(/\/$/, ""));
}
