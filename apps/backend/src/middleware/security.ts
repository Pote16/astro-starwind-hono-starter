import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { createMiddleware } from "hono/factory";
import { secureHeaders } from "hono/secure-headers";
import { z } from "zod";

import type { BackendEnvironment } from "../schemas/backend-env.schema.js";

// Vier Header setzt der Nginx-Vhost dieser Site selbst (scripts/nginx.conf):
// X-Frame-Options, X-Content-Type-Options, Referrer-Policy und HSTS. Hono würde
// eigene Kopien mitschicken, und Nginx ersetzt sie nicht, sondern hängt seine an.
// Auf jeder API-Antwort stünden sie damit doppelt, und Browser werten bei HSTS
// nach RFC 6797 nur den ERSTEN aus — das wäre Honos Vorgabe mit 180 Tagen statt
// der 365 vom Rand. Deshalb gehören sie hier ausgeschaltet: der Rand besitzt sie.
//
// Alles andere aus secureHeaders bleibt an und ergänzt den Vhost, unter anderem
// Cross-Origin-Opener-Policy, Cross-Origin-Resource-Policy, Origin-Agent-Cluster
// und X-XSS-Protection: 0 (die moderne Empfehlung, den alten Auditor abzuschalten).
export const secureHeadersMiddleware = secureHeaders({
  xFrameOptions: false,
  xContentTypeOptions: false,
  referrerPolicy: false,
  strictTransportSecurity: false,
});

export function createSecurityMiddleware(environment: BackendEnvironment) {
  const origins = [...environment.frontendOrigins];
  const originSchema = z.string().refine((origin) => origins.includes(origin));
  const formCsrf = csrf({ origin: origins, secFetchSite: () => false });

  return {
    corsMiddleware: cors({
      origin: origins,
      allowHeaders: ["Content-Type", "Authorization"],
      allowMethods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      maxAge: 600,
      // Der Starter verwendet weder Cookie-Authentifizierung noch Sessions.
      credentials: false,
    }),
    csrfMiddleware: createMiddleware(async (c, next) => {
      // Hono prüft regulär nur HTML-Formular-Content-Types. Auch JSON-Schreibzugriffe
      // müssen zur Allowlist passen; Fetch-Metadata ersetzt keinen erlaubten Origin.
      if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
        const origin = originSchema.safeParse(c.req.header("Origin"));
        if (!origin.success) return c.json({ error: "Anfrage nicht erlaubt." }, 403);
      }
      return formCsrf(c, next);
    }),
  };
}
