import { logger } from "@ho-setup/logger";
import { Hono } from "hono";

import { errorHandler } from "./middleware/error-handler.js";
// Import Middlewares
import { loggerMiddleware } from "./middleware/logger.js";
import { createRateLimitMiddleware } from "./middleware/rate-limit.js";
import { createSecurityMiddleware, secureHeadersMiddleware } from "./middleware/security.js";
// Import Routes
import { createExampleRouter } from "./routes/example.js";
import { loadBackendEnvironment } from "./schemas/backend-env.schema.js";

const environment = loadBackendEnvironment();
const rateLimitMiddleware = createRateLimitMiddleware(environment);
const { corsMiddleware, csrfMiddleware } = createSecurityMiddleware(environment);
const app = new Hono();

// Health check (vor Middleware – kein Rate-Limit/CSRF für Deploy-Probe)
app.get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

// global error handler overrides default
app.onError(errorHandler);

// --- Apply Global Middlewares ---
// 1. Logger (erstes, um Errors/Dauer mitzubekommen)
app.use("*", loggerMiddleware);

// 2. Security Headers (XSS, HSTS)
app.use("*", secureHeadersMiddleware);

// 3. CORS
app.use("*", corsMiddleware);

// 4. Rate Limiting (Schützt Public/API Scopes)
// app.use("/api/*", rateLimitMiddleware); // Kann auch global '*' sein. Wir beschränken es hier mal auf die geplante API
app.use("*", rateLimitMiddleware);

// 5. CSRF
app.use("*", csrfMiddleware);

// --- Mount Routes ---
// RPC Types werden aus den routern generiert
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const routes = app.route("/api", createExampleRouter(environment));

// Export RPC AppType for Frontend consumption
export type AppType = typeof routes;

// --- Start Server ---
const port = environment.port;
logger.info(`Backend Starting on port ${port}...`);

export default {
  // Nur der lokale Reverse-Proxy darf den oeffentlichen API-Zugang vermitteln.
  hostname: "127.0.0.1",
  port,
  fetch: app.fetch,
};
