import { zValidator } from "@hono/zod-validator";
import { expect, test } from "bun:test";
import { Hono } from "hono";

import type { TurnstileFetch } from "../lib/turnstile.js";
import { createExampleRouter } from "../routes/example.js";
import { loadBackendEnvironment } from "../schemas/backend-env.schema.js";
import { formProtectionSchema } from "../schemas/turnstile.schema.js";
import { createTurnstileMiddleware } from "./turnstile.js";

const valid = { success: true, hostname: "frontend.example", action: "create_user" };
function fixture(
  fetcher: TurnstileFetch,
  secret = "secret",
  origins = ["https://frontend.example"],
) {
  let handled = 0;
  const app = new Hono().post(
    "/",
    zValidator("json", formProtectionSchema),
    createTurnstileMiddleware("create_user", { secret, origins, fetcher }),
    (c) => {
      handled++;
      return c.json({ success: true }, 201);
    },
  );
  return {
    handled: () => handled,
    request: (data: Record<string, unknown> = {}) =>
      app.request("/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      }),
  };
}

test("fehlende Keys und Honeypots erzeugen keinen Turnstile-Request", async () => {
  let calls = 0;
  const fetcher: TurnstileFetch = async () => {
    calls++;
    throw new Error("Nicht senden");
  };
  for (const secret of ["", "   "]) {
    const app = fixture(fetcher, secret);
    expect((await app.request()).status).toBe(201);
    expect(app.handled()).toBe(1);
  }
  const app = fixture(fetcher);
  for (const website of ["bot", { nested: "bot" }, 1]) {
    expect((await app.request({ website, turnstileToken: {} })).status).toBe(201);
  }
  expect(app.handled()).toBe(0);
  expect(calls).toBe(0);
});

test("fehlende oder manipulierte Tokens sperren Handler ohne Provider-Request", async () => {
  let calls = 0;
  const app = fixture(async () => {
    calls++;
    return Response.json(valid);
  });
  for (const token of [undefined, null, 123, {}, "", " ", "t".repeat(2049)]) {
    const result = await app.request({ turnstileToken: token });
    expect(result.status).toBe(403);
    expect(await result.json()).toMatchObject({ error: { code: "TURNSTILE_INVALID" } });
  }
  expect(app.handled()).toBe(0);
  expect(calls).toBe(0);
});

test("nur exakte Aktion und konfigurierte Hosts geben den Handler frei", async () => {
  const app = fixture(async (url, init) => {
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ secret: "secret", response: "token" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    return Response.json(valid);
  });
  expect((await app.request({ turnstileToken: "token" })).status).toBe(201);
  expect(app.handled()).toBe(1);
  for (const response of [
    { success: false, "error-codes": ["timeout-or-duplicate"] },
    { ...valid, action: "other" },
    { ...valid, hostname: "frontend.example.evil.invalid" },
    { ...valid, hostname: "sub.frontend.example" },
  ]) {
    const blocked = fixture(async () => Response.json(response));
    expect((await blocked.request({ turnstileToken: "token" })).status).toBe(403);
    expect(blocked.handled()).toBe(0);
  }
  const local = fixture(async () => Response.json({ ...valid, hostname: "localhost" }), "secret", [
    "http://localhost:4321",
  ]);
  expect((await local.request({ turnstileToken: "token" })).status).toBe(201);
});

test("Provider-Ausfälle bleiben geschlossen und zeigen nur generische DE/EN-Texte", async () => {
  const fetchers: TurnstileFetch[] = [
    async () => {
      throw new Error("secret token gast@example.org");
    },
    async () => new Response("secret", { status: 502 }),
    async () => new Response("kaputtes JSON"),
    async () => Response.json({ success: true }),
    async () => Response.json({ success: false, "error-codes": ["internal-error"] }),
  ];
  for (const fetcher of fetchers) {
    for (const language of ["de", "en"]) {
      const app = fixture(fetcher);
      const result = await app.request({ turnstileToken: "token", language });
      expect(result.status).toBe(503);
      const text = await result.text();
      expect(text).toContain(language === "de" ? "Sicherheitsprüfung" : "security check");
      expect(text).not.toContain("secret");
      expect(text).not.toContain("gast@example.org");
      expect(app.handled()).toBe(0);
    }
  }
});

test("leere oder ungültige Hostlisten senden nichts", async () => {
  let calls = 0;
  for (const origins of [[], ["kaputt"], ["https://frontend.example/path"]]) {
    const app = fixture(
      async () => {
        calls++;
        return Response.json(valid);
      },
      "secret",
      origins,
    );
    expect((await app.request({ turnstileToken: "token" })).status).toBe(503);
  }
  expect(calls).toBe(0);
});

test("Siteverify wird nach fünf Sekunden abgebrochen", async () => {
  const app = fixture(
    (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new Error("Timeout")), { once: true });
      }),
  );
  const start = Date.now();
  expect((await app.request({ turnstileToken: "token" })).status).toBe(503);
  expect(Date.now() - start).toBeGreaterThanOrEqual(4900);
  expect(Date.now() - start).toBeLessThan(7000);
  expect(app.handled()).toBe(0);
}, 10000);

test("Demo erhält 201 ohne Token-Echo, Honeypot-Provider oder Datenbank; sechster Versuch ist begrenzt", async () => {
  const environment = loadBackendEnvironment({});
  let calls = 0;
  const router = createExampleRouter(environment, {
    secret: "secret",
    fetcher: async () => {
      calls++;
      return Response.json({ ...valid, hostname: "localhost" });
    },
  });
  const request = (data: Record<string, unknown>, ip: string) =>
    router.request("/users", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ name: "Example", email: "user@example.org", language: "en", ...data }),
    });
  const accepted = await request({ turnstileToken: "token" }, "203.0.113.81");
  expect(accepted.status).toBe(201);
  const normal = await accepted.json();
  expect(normal).toMatchObject({
    success: true,
    data: { name: "Example", email: "user@example.org" },
  });
  expect(JSON.stringify(normal)).not.toContain("turnstileToken");
  const bot = await request({ website: "bot", turnstileToken: {} }, "203.0.113.82");
  expect(bot.status).toBe(201);
  expect(await bot.json()).toEqual(normal);
  expect(calls).toBe(1);
  for (let i = 0; i < 5; i++) expect((await request({}, "203.0.113.83")).status).toBe(403);
  const limited = await request({}, "203.0.113.83");
  expect(limited.status).toBe(429);
  expect(limited.headers.get("retry-after")).not.toBeNull();
  expect(calls).toBe(1);
});

test("ungültige Demo-Eingaben liefern 400 ohne Provider oder internen Fehler", async () => {
  let calls = 0;
  const router = createExampleRouter(loadBackendEnvironment({}), {
    secret: "secret",
    fetcher: async () => {
      calls++;
      return Response.json(valid);
    },
  });
  for (const [i, data] of [
    null,
    {},
    { language: "en", name: "X", email: "bad" },
    { language: "fr" },
  ].entries()) {
    const response = await router.request("/users", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `203.0.113.${100 + i}` },
      body: JSON.stringify(data),
    });
    expect(response.status).toBe(400);
    expect(await response.text()).toContain(
      i === 2 ? "Please check your input" : "Bitte die Eingaben prüfen",
    );
  }
  expect(calls).toBe(0);
});
