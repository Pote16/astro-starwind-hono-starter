import {
  turnstileActionSchema,
  turnstileOriginsSchema,
  turnstileResponseSchema,
  turnstileSecretSchema,
  turnstileTokenSchema,
} from "../schemas/turnstile.schema.js";

export type TurnstileFetch = (url: string, init: RequestInit) => Promise<Response>;
export type TurnstileResult = "valid" | "invalid" | "unavailable";
interface VerificationOptions {
  token: unknown;
  action: string;
  secret: string;
  origins: readonly string[];
  fetcher?: TurnstileFetch;
}

/** Nur Siteverify darf Tokens freigeben. Die optionale Client-IP wird nicht übermittelt. */
export async function verifyTurnstile(options: VerificationOptions): Promise<TurnstileResult> {
  const token = turnstileTokenSchema.parse(options.token);
  if (!token) return "invalid";
  const origins = turnstileOriginsSchema.safeParse(options.origins);
  const action = turnstileActionSchema.safeParse(options.action);
  const secret = turnstileSecretSchema.safeParse(options.secret);
  if (!origins.success || !action.success || !secret.success || !secret.data) return "unavailable";
  const hosts = new Set(origins.data.map((origin) => new URL(origin).hostname));
  try {
    const response = await (options.fetcher ?? fetch)(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: secret.data, response: token }),
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!response.ok) return "unavailable";
    const result = turnstileResponseSchema.safeParse(await response.json());
    if (!result.success) return "unavailable";
    if (!result.data.success) {
      const configurationOrProviderError = result.data["error-codes"]?.some((code) =>
        ["internal-error", "missing-input-secret", "invalid-input-secret"].includes(code),
      );
      return configurationOrProviderError ? "unavailable" : "invalid";
    }
    return result.data.action === action.data && hosts.has(result.data.hostname.toLowerCase())
      ? "valid"
      : "invalid";
  } catch {
    // Fremdfehler können Token und Secret enthalten und werden deshalb nicht geloggt.
    return "unavailable";
  }
}
