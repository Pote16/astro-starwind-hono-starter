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

function invalidEnvironment(grund: string): never {
  // Der Grund nennt das Feld, nie den Wert: in einer URL können Zugangsdaten
  // stehen. Vorher zählte die Meldung alle Felder auf, und das tatsächlich
  // fehlende war am 8.9.2026 nicht einmal darunter.
  throw new Error(`Backend-Konfiguration ungültig: ${grund}. Werte werden nicht ausgegeben.`);
}

function felderAus(fehler: z.ZodError): string {
  // Nur die Pfade aus den Zod-Issues, nie die Werte. Doppelte Nennungen fallen
  // weg, wenn ein Feld mehrere Regeln verletzt; die Reihenfolge bleibt die des
  // Schemas, damit die Meldung zwischen zwei Laeufen vergleichbar ist.
  const felder = [...new Set(fehler.issues.map((issue) => issue.path.join(".") || "(Wurzel)"))];
  return felder.join(", ");
}

export function loadBackendEnvironment(input: unknown = process.env): BackendEnvironment {
  const parsed = environmentSchema.safeParse(input);
  if (!parsed.success)
    return invalidEnvironment(`diese Felder passen nicht zum Schema: ${felderAus(parsed.error)}`);
  // Ein halbes Schlüsselpaar würde entweder alle Formulare sperren oder nur
  // im Browser Schutz vortäuschen. Ohne beide Schlüssel bleibt die Demo nutzbar.
  if (
    parsed.data.NODE_ENV === "production" &&
    Boolean(parsed.data.PUBLIC_TURNSTILE_SITE_KEY) !== Boolean(parsed.data.TURNSTILE_SECRET_KEY)
  ) {
    return invalidEnvironment(
      "PUBLIC_TURNSTILE_SITE_KEY und TURNSTILE_SECRET_KEY nur gemeinsam setzen",
    );
  }
  const configuredOrigins = parsed.data.FRONTEND_ORIGINS?.trim();
  if (!configuredOrigins && parsed.data.NODE_ENV === "production")
    return invalidEnvironment("FRONTEND_ORIGINS fehlt und ist in Produktion Pflicht");
  const origins = originsSchema.safeParse(
    configuredOrigins ? configuredOrigins.split(",").map((origin) => origin.trim()) : localOrigins,
  );
  if (!origins.success)
    return invalidEnvironment(
      "FRONTEND_ORIGINS enthält einen Eintrag, der keine gültige Origin ist",
    );
  return {
    port: parsed.data.PORT,
    frontendOrigins: [...new Set(origins.data)],
    trustedProxyHops: parsed.data.TRUSTED_PROXY_HOPS,
  };
}
