import { z } from "astro/zod";

export const turnstileSitekeySchema = z
  .string()
  .trim()
  .max(100)
  .regex(/^[A-Za-z0-9_-]*$/)
  .default("");

export const turnstileKonfigurationSchema = z.object({
  sitekey: turnstileSitekeySchema.pipe(z.string().min(1)),
  aktion: z.string().regex(/^[A-Za-z0-9_-]{1,32}$/),
  sprache: z.enum(["de", "en"]),
});

export const turnstileTokenSchema = z.string().trim().min(1).max(2048);

export const turnstileFehlerSchema = z.object({
  error: z.object({ code: z.enum(["TURNSTILE_INVALID", "TURNSTILE_UNAVAILABLE"]) }),
});
