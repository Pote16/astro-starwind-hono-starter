import { expect, test } from "bun:test";
import { Hono } from "hono";
import { rateLimiter } from "hono-rate-limiter";

import { loadBackendEnvironment } from "../schemas/backend-env.schema.js";
import { clientIpKey, UNKNOWN_CLIENT_KEY } from "./client-ip.js";

test("vom Nginx ergänzte rechte IP bleibt trotz beliebiger linker IPs unverändert", () => {
  expect(clientIpKey("192.0.2.10")).toBe("192.0.2.10");
  for (const prefix of ["203.0.113.1", "203.0.113.2, 198.51.100.1", "2001:db8::8"])
    expect(clientIpKey(prefix + ", 192.0.2.10", 1)).toBe("192.0.2.10");
  expect(clientIpKey("203.0.113.9, 192.0.2.10, 10.0.0.1", 2)).toBe("192.0.2.10");
  expect(clientIpKey("192.0.2.10, 10.0.0.1, 10.0.0.2, 10.0.0.3, 10.0.0.4", 5)).toBe("192.0.2.10");
});

test("IPv4 und IPv6 werden validiert und IPv6-Schreibweisen vereinheitlicht", () => {
  expect(clientIpKey(" 2001:0DB8:0:0:0:0:0:1 ")).toBe("2001:db8::1");
  expect(clientIpKey("2001:db8::1")).toBe("2001:db8::1");
  expect(clientIpKey("::ffff:192.0.2.1")).toBe(clientIpKey("::ffff:c000:201"));
});

test("ungültige oder unvollständige Ketten haben einen gemeinsamen begrenzten Schlüssel", () => {
  for (const header of [
    undefined,
    null,
    "",
    "unknown",
    "192.0.2.01",
    "[2001:db8::1]",
    "192.0.2.1:8080",
    "for=192.0.2.1",
    "fe80::1%eth0",
    "192.0.2.1,",
    ",192.0.2.1",
    "invalid,192.0.2.1",
    "192.0.2.1,invalid",
    "192.0.2.1;203.0.113.1",
    "192.0.2.1\r\nX-Injected: true",
    "1".repeat(2049),
  ])
    expect(clientIpKey(header)).toBe(UNKNOWN_CLIENT_KEY);
  expect(clientIpKey("192.0.2.1", 2)).toBe(UNKNOWN_CLIENT_KEY);
  for (const hops of [0, 6, 1.5, "1"])
    expect(clientIpKey("192.0.2.1", hops)).toBe(UNKNOWN_CLIENT_KEY);
});

test("Proxy-Konfiguration ist explizit auf 1 bis 5 Hops begrenzt", () => {
  expect(loadBackendEnvironment({}).trustedProxyHops).toBe(1);
  expect(loadBackendEnvironment({ TRUSTED_PROXY_HOPS: "5" }).trustedProxyHops).toBe(5);
  for (const TRUSTED_PROXY_HOPS of ["0", "6", "", "1.5", "1junk"])
    expect(() => loadBackendEnvironment({ TRUSTED_PROXY_HOPS })).toThrow();
});

test("mehrere XFF-Header und wechselnde linke Angaben umgehen das echte Hono-Limit nicht", async () => {
  const app = new Hono();
  app.use(
    "*",
    rateLimiter({
      windowMs: 60_000,
      limit: 2,
      keyGenerator: (c) => clientIpKey(c.req.header("X-Forwarded-For"), 1),
    }),
  );
  app.get("/", (c) => c.text("ok"));
  for (let i = 0; i < 3; i++) {
    const headers = new Headers();
    headers.append("X-Forwarded-For", "203.0.113." + (i + 1));
    headers.append("X-Forwarded-For", "192.0.2.10");
    const response = await app.request("/", { headers });
    expect(response.status).toBe(i < 2 ? 200 : 429);
  }
  expect((await app.request("/", { headers: { "X-Forwarded-For": "192.0.2.11" } })).status).toBe(
    200,
  );
});
