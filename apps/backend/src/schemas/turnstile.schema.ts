import { z } from "zod";

export const formLanguageSchema = z.enum(["de", "en"]).default("de");
/** Fremdtypen werden als befüllte Falle behandelt, ohne einen Feldfehler zu verraten. */
export const honeypotSchema = z
  .unknown()
  .optional()
  .transform((value) => {
    if (value === undefined || value === null) return undefined;
    return typeof value === "string" ? value.slice(0, 200) : "[filled]";
  });
/** Tokenfehler werden erst nach dem Honeypot geprüft. */
export const turnstileTokenSchema = z.string().max(2048).trim().min(1).optional().catch(undefined);
export const turnstileSecretSchema = z.string().trim().default("");
export const turnstileActionSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,32}$/);
export const formProtectionSchema = z.object({
  language: formLanguageSchema,
  website: honeypotSchema,
  turnstileToken: turnstileTokenSchema,
});
export const turnstileOriginsSchema = z
  .array(
    z.url({ protocol: /^https?$/ }).refine((value) => {
      try {
        const url = new URL(value);
        return url.origin === value && !url.hostname.includes("*");
      } catch {
        return false;
      }
    }),
  )
  .min(1);
export const turnstileResponseSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    hostname: z.string().min(1).max(253),
    action: turnstileActionSchema,
  }),
  z.object({ success: z.literal(false), "error-codes": z.array(z.string().max(100)).optional() }),
]);
export type FormLanguage = z.infer<typeof formLanguageSchema>;
