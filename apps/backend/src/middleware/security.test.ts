import { expect, test } from "bun:test";
import { Hono } from "hono";

import { loadBackendEnvironment } from "../schemas/backend-env.schema.js";
import { createSecurityMiddleware } from "./security.js";

const production = {
  NODE_ENV: "production",
  FRONTEND_ORIGINS: "https://frontend.example,https://www.frontend.example",
};

function testApp() {
  let writes = 0;
  const app = new Hono();
  const middleware = createSecurityMiddleware(loadBackendEnvironment(production));
  app.use("*", middleware.corsMiddleware);
  app.use("*", middleware.csrfMiddleware);
  app.all("/example", (c) => {
    if (c.req.method === "POST") writes++;
    return c.json({ ok: true });
  });
  return { app, writes: () => writes };
}

test("Produktionskonfiguration verlangt exakte Origins und einen gültigen Port", () => {
  for (const FRONTEND_ORIGINS of [
    undefined,
    "",
    "*",
    "https://*.example",
    "https://frontend.example/path",
    "https://frontend.example?x=1",
    "https://user:secret@example.com",
    "null",
    "ftp://frontend.example",
    "https://frontend.example,",
    "https://frontend.example/",
  ]) {
    expect(() => loadBackendEnvironment({ NODE_ENV: "production", FRONTEND_ORIGINS })).toThrow();
  }
  for (const PORT of ["", "0", "65536", "3005junk", "1.5"])
    expect(() => loadBackendEnvironment({ ...production, PORT })).toThrow();
  expect(() => loadBackendEnvironment({ NODE_ENV: "unexpected" })).toThrow();
  expect(loadBackendEnvironment(production).port).toBe(3005);
  expect(loadBackendEnvironment({ ...production, PORT: "3020" }).port).toBe(3020);
});

test("Entwicklung bleibt ohne .env nutzbar; konfigurierte Listen werden nicht mit Defaults erweitert", () => {
  expect(loadBackendEnvironment({}).frontendOrigins).toEqual([
    "http://localhost:4321",
    "http://127.0.0.1:4321",
  ]);
  expect(
    loadBackendEnvironment({
      FRONTEND_ORIGINS: " https://frontend.example,https://frontend.example ",
    }).frontendOrigins,
  ).toEqual(["https://frontend.example"]);
  expect(() => loadBackendEnvironment({ FRONTEND_ORIGINS: "*" })).toThrow();
});

test("bekannte Origins dürfen JSON und Formulardaten schreiben, ohne Cookie-Credentials", async () => {
  const { app, writes } = testApp();
  for (const origin of ["https://frontend.example", "https://www.frontend.example"]) {
    for (const type of ["application/json", "application/x-www-form-urlencoded"]) {
      const response = await app.request("/example", {
        method: "POST",
        headers: { Origin: origin, "Content-Type": type, "Sec-Fetch-Site": "cross-site" },
        body: type === "application/json" ? "{}" : "name=test",
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
      expect(response.headers.get("Access-Control-Allow-Credentials")).toBeNull();
      expect(response.headers.get("Vary")).toContain("Origin");
    }
  }
  expect(writes()).toBe(4);
});

test("fremde, fehlende und ähnlich aussehende Origins erreichen keinen Schreibhandler", async () => {
  const { app, writes } = testApp();
  for (const origin of [
    undefined,
    "null",
    "https://frontend.example.evil.invalid",
    "http://frontend.example",
    "https://evil.invalid",
    "https://frontend.example:8443",
    "https://frontend.example/path",
  ]) {
    for (const contentType of [
      "application/json",
      "text/plain",
      "application/x-www-form-urlencoded",
    ]) {
      const headers = new Headers({ "Content-Type": contentType, "Sec-Fetch-Site": "same-origin" });
      if (origin !== undefined) headers.set("Origin", origin);
      const response = await app.request("/example", { method: "POST", headers, body: "{}" });
      expect(response.status).toBe(403);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    }
  }
  expect(writes()).toBe(0);
});

test("alle unsicheren Methoden brauchen Origin; GET und korrekte Preflights bleiben möglich", async () => {
  const { app } = testApp();
  for (const method of ["PUT", "PATCH", "DELETE"])
    expect(
      (
        await app.request("/example", {
          method,
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
      ).status,
    ).toBe(403);
  expect((await app.request("/example")).status).toBe(200);
  for (const origin of ["https://frontend.example", "https://evil.invalid"]) {
    const response = await app.request("/example", {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type",
      },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      origin === "https://frontend.example" ? origin : null,
    );
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBeNull();
  }
});
