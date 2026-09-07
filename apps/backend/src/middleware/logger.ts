import { logger } from "@ho-setup/logger";
import { createMiddleware } from "hono/factory";

export const loggerMiddleware = createMiddleware(async (c, next) => {
  // Query-Parameter können Tokens und personenbezogene Daten enthalten.
  const { method, path } = c.req;
  const start = performance.now();

  await next();

  const ms = performance.now() - start;
  logger.info(
    {
      method,
      path,
      status: c.res.status,
      durationMs: Math.round(ms),
    },
    "Incoming request",
  );
});
