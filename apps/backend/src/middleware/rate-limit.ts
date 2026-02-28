import { rateLimiter, UnstorageStore } from "hono-rate-limiter";
import { createStorage } from "unstorage";
import memoryDriver from "unstorage/drivers/memory";
import redisDriver from "unstorage/drivers/redis";

// Decide storage based on environment
let storageDriver;
if (process.env.REDIS_URL) {
  storageDriver = redisDriver({
    url: process.env.REDIS_URL,
  });
} else if (process.env.REDIS_HOST) {
  const host = process.env.REDIS_HOST;
  const port = process.env.REDIS_PORT || "6379";
  const password = process.env.REDIS_PASSWORD || "";
  
  // Construct redis URL manually if REDIS_URL is not set but host is
  // Ensure we don't leak password in logs, but here we just pass it to driver
  const redisUrl = `redis://${password ? `:${password}@` : ""}${host}:${port}`;
  
  storageDriver = redisDriver({
    url: redisUrl,
  });
} else {
  // Local/Fallback
  storageDriver = memoryDriver();
}

const unstorageInstance = createStorage({
  driver: storageDriver,
});

const store = new UnstorageStore({
  storage: unstorageInstance,
  prefix: "rl:",
});

export const rateLimitMiddleware = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: 100, // Limit each IP to X requests per `window`
  standardHeaders: "draft-6",
  keyGenerator: (c) => c.req.header("x-forwarded-for") ?? "anonymous",
  store: store,
  message: "Too many requests. Please try again later.",
});
