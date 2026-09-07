import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { createMiddleware } from "hono/factory";
import { secureHeaders } from "hono/secure-headers";
import { z } from "zod";

import type { BackendEnvironment } from "../schemas/backend-env.schema.js";

export const secureHeadersMiddleware = secureHeaders();

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
