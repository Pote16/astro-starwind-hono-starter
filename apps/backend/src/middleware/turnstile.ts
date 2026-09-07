import type { Context } from "hono";
import { createMiddleware } from "hono/factory";

import { FORM_TEXTS } from "../lib/form-texts.js";
import { type TurnstileFetch, verifyTurnstile } from "../lib/turnstile.js";
import { formProtectionSchema, turnstileSecretSchema } from "../schemas/turnstile.schema.js";

export interface TurnstileOptions {
  secret?: string;
  origins: readonly string[];
  fetcher?: TurnstileFetch;
  honeypotResponse?: (context: Context) => Response | Promise<Response>;
}

/** Nach Body-Validierung und Formularlimit einsetzen, vor jeder fachlichen Verarbeitung. */
export function createTurnstileMiddleware(action: string, options: TurnstileOptions) {
  return createMiddleware(async (c, next) => {
    const data = formProtectionSchema.parse(await c.req.json<unknown>());
    if (data.website?.trim()) {
      // Dieselbe Antwortform wie der Endpunkt, aber ohne Handler oder Provider-Aufruf.
      return options.honeypotResponse?.(c) ?? c.json({ success: true }, 201);
    }
    const secret = turnstileSecretSchema.parse(options.secret ?? process.env.TURNSTILE_SECRET_KEY);
    if (!secret) return next();
    const result = data.turnstileToken
      ? await verifyTurnstile({
          token: data.turnstileToken,
          action,
          secret,
          origins: options.origins,
          fetcher: options.fetcher,
        })
      : "invalid";
    if (result === "valid") return next();
    const unavailable = result === "unavailable";
    return c.json(
      {
        error: {
          code: unavailable ? "TURNSTILE_UNAVAILABLE" : "TURNSTILE_INVALID",
          message: FORM_TEXTS[data.language][unavailable ? "unavailable" : "invalid"],
        },
      },
      unavailable ? 503 : 403,
    );
  });
}
