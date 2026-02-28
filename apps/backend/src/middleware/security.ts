import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { createMiddleware } from "hono/factory";
import { secureHeaders } from "hono/secure-headers";

// Globale Security Headers (XSS Protection, HSTS, etc.)
export const secureHeadersMiddleware = secureHeaders();

// CSRF Protection
// Verhindert Cross-Site Request Forgery. Standardmäßig auf selbe Origin beschränkt.
export const csrfMiddleware = csrf();

// CORS Konfiguration
// Für Production ggf. auf konkrete Frontend-Domains einschränken (falls extern gehostet).
export const corsMiddleware = createMiddleware(async (c, next) => {
  const corsHandler = cors({
    // In Production idealerweise auf `c.env.CORS_ORIGIN` oder exakte Domain setzen, statt `*` (falls API & App getrennt sind).
    origin: "*", 
    allowHeaders: ["Content-Type", "Authorization", "x-user-id"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  });
  return corsHandler(c, next);
});
