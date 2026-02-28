import { logger } from "@ho-setup/logger";
import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof HTTPException) {
    if (err.status >= 500) {
      logger.error(err, "HTTPException 500+ occurred");
    } else {
      logger.warn(err, `HTTPException ${err.status} occurred`);
    }
    return err.getResponse();
  }

  // Unexpected errors
  logger.error(err, "Unhandled exception intercepted");
  
  // Defense in depth: Return generic message to client
  return c.json(
    {
      success: false,
      error: "Internal Server Error",
      referenceId: c.req.header("x-request-id") || Date.now().toString(),
    },
    500
  );
};
