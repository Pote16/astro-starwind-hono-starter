import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger } from "@ho-setup/logger";

// Import Middlewares
import { loggerMiddleware } from "./middleware/logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import { rateLimitMiddleware } from "./middleware/rate-limit.js";
import { secureHeadersMiddleware, csrfMiddleware, corsMiddleware } from "./middleware/security.js";

// Import Routes
import exampleRouter from "./routes/example.js";

const app = new Hono();

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
const routes = app.route("/api", exampleRouter);

// Export RPC AppType for Frontend consumption
export type AppType = typeof routes;

// --- Start Server ---
const port = parseInt(process.env.PORT || "3000", 10);
logger.info(`Backend Starting on port ${port}...`);

serve({
  fetch: app.fetch,
  port,
});
