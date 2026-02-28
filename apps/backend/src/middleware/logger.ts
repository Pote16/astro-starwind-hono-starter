import { logger } from "@ho-setup/logger";
import { createMiddleware } from "hono/factory";

export const loggerMiddleware = createMiddleware(async (c, next) => {
  const { method, url } = c.req;
  const start = performance.now();
  
  await next();
  
  const ms = performance.now() - start;
  logger.info({
    method,
    url,
    status: c.res.status,
    durationMs: Math.round(ms),
  }, "Incoming request");
});
