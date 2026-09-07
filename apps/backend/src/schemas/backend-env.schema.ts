import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z
    .string()
    .regex(/^[1-9][0-9]*$/)
    .default("3005")
    .transform(Number)
    .pipe(z.number().int().max(65535)),
  FRONTEND_ORIGINS: z.string().optional(),
  PUBLIC_TURNSTILE_SITE_KEY: z.string().trim().optional(),
  TURNSTILE_SECRET_KEY: z.string().trim().optional(),
  TRUSTED_PROXY_HOPS: z
    .string()
    .regex(/^[1-5]$/)
    .default("1")
    .transform(Number),
});

const originSchema = z.url({ protocol: /^https?$/ }).refine((origin) => {
  try {
    const url = new URL(origin);
    return url.origin === origin && !url.hostname.includes("*");
  } catch {
    return false;
  }
});
const originsSchema = z.array(originSchema).min(1);
const localOrigins = ["http://localhost:4321", "http://127.0.0.1:4321"];

export interface BackendEnvironment {
  port: number;
  trustedProxyHops: number;
  frontendOrigins: string[];
}

function invalidEnvironment(): never {
  // Fehler dürfen keine versehentlich in Origins eingefügten Zugangsdaten enthalten.
  throw new Error(
    "Backend-Konfiguration ungültig: NODE_ENV, PORT, FRONTEND_ORIGINS, TRUSTED_PROXY_HOPS und das Turnstile-Schlüsselpaar prüfen.",
  );
}

export function loadBackendEnvironment(input: unknown = process.env): BackendEnvironment {
  const parsed = environmentSchema.safeParse(input);
  if (!parsed.success) return invalidEnvironment();
  // Ein halbes Schlüsselpaar würde entweder alle Formulare sperren oder nur
  // im Browser Schutz vortäuschen. Ohne beide Schlüssel bleibt die Demo nutzbar.
  if (
    parsed.data.NODE_ENV === "production" &&
    Boolean(parsed.data.PUBLIC_TURNSTILE_SITE_KEY) !== Boolean(parsed.data.TURNSTILE_SECRET_KEY)
  ) {
    return invalidEnvironment();
  }
  const configuredOrigins = parsed.data.FRONTEND_ORIGINS?.trim();
  if (!configuredOrigins && parsed.data.NODE_ENV === "production") return invalidEnvironment();
  const origins = originsSchema.safeParse(
    configuredOrigins ? configuredOrigins.split(",").map((origin) => origin.trim()) : localOrigins,
  );
  if (!origins.success) return invalidEnvironment();
  return {
    port: parsed.data.PORT,
    frontendOrigins: [...new Set(origins.data)],
    trustedProxyHops: parsed.data.TRUSTED_PROXY_HOPS,
  };
}
