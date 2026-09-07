import { logger } from "@ho-setup/logger";
import { expect, spyOn, test } from "bun:test";
import { Hono } from "hono";

import { loggerMiddleware } from "./logger.js";

test("Request-Logs enthalten keine Query-Tokens oder E-Mail-Adressen", async () => {
  const protokoll = spyOn(logger, "info").mockImplementation(() => {});
  try {
    const app = new Hono().use("*", loggerMiddleware).get("/bestaetigen", (c) => c.text("OK"));
    const antwort = await app.request(
      "/bestaetigen?token=geheimer-bestätigungstoken&email=gast%40example.org",
    );
    expect(antwort.status).toBe(200);
    expect(protokoll).toHaveBeenCalledTimes(1);
    expect(protokoll.mock.calls[0]?.[0]).toMatchObject({
      method: "GET",
      path: "/bestaetigen",
      status: 200,
    });
    const ausgabe = JSON.stringify(protokoll.mock.calls);
    expect(ausgabe).not.toContain("token");
    expect(ausgabe).not.toContain("gast");
    expect(ausgabe).not.toContain("email");
    expect(ausgabe).not.toContain("?");
  } finally {
    protokoll.mockRestore();
  }
});
