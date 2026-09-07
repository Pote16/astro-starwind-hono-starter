import { createHash } from "node:crypto";

import { logger } from "@ho-setup/logger";
import { expect, spyOn, test } from "bun:test";
import { z } from "zod";

import { createGa4Sender } from "./ga4-mp.js";
import { createLinkedInSender } from "./linkedin.js";
import { createMetaSender } from "./meta-capi.js";
import { toGa4EventName, type TrackingFetch } from "./tracking.js";

const env = {
  GA4_MEASUREMENT_ID: "G-TEST123",
  GA4_MP_API_SECRET: "fixture-ga-secret",
  META_PIXEL_ID: "123456789",
  META_ACCESS_TOKEN: "fixture-meta-secret",
  LINKEDIN_API_TOKEN: "fixture-linkedin-secret",
  LINKEDIN_CONVERSION_ID: "456",
};
const consent = () => ({ analytics: true, marketing: true });
const events = [
  { eventName: "generate_lead", clientId: "123.456", eventId: "event-123" },
  {
    eventName: "Lead",
    eventSourceUrl: "https://example.com/contact",
    eventId: "event-123",
    email: "guest@example.com",
  },
  { eventId: "event-123", email: "guest@example.com" },
];
const factories = [createGa4Sender, createMetaSender, createLinkedInSender];

function capture() {
  const requests: { url: string; init: RequestInit; body: unknown }[] = [];
  const fetch: TrackingFetch = async (url, init) => {
    const body: unknown = JSON.parse(z.string().parse(init.body));
    requests.push({ url, init, body });
    return new Response(null, { status: 204 });
  };
  return { requests, fetch };
}

test("alle Provider verlangen pro Aufruf aktuelle, vollständige Einwilligung", async () => {
  for (const [index, factory] of factories.entries()) {
    const mock = capture();
    const sender = factory({ env, fetch: mock.fetch });
    for (const state of [
      undefined,
      null,
      {},
      true,
      { analytics: "true", marketing: "true" },
      { analytics: false, marketing: false },
    ]) {
      expect(await sender(events[index], () => state)).toEqual({
        status: "skipped",
        reason: "consent_required",
      });
    }
    expect(
      await sender(events[index], () => {
        throw new Error("secret");
      }),
    ).toEqual({ status: "skipped", reason: "consent_required" });
    let checks = 0;
    expect(
      await sender(events[index], () =>
        ++checks === 1 ? consent() : { analytics: false, marketing: false },
      ),
    ).toEqual({ status: "skipped", reason: "consent_required" });
    expect(checks).toBe(2);
    expect(mock.requests).toHaveLength(0);
  }
});

test("fehlende Konfiguration, ungültige IDs und manipulierte Events lösen keinen Request aus", async () => {
  for (const [index, factory] of factories.entries()) {
    const mock = capture();
    expect(await factory({ env: {}, fetch: mock.fetch })(events[index], consent)).toEqual({
      status: "skipped",
      reason: "missing_config",
    });
    const invalidEnv = {
      ...env,
      GA4_MEASUREMENT_ID: "../secret",
      META_PIXEL_ID: "../secret",
      LINKEDIN_CONVERSION_ID: "../secret",
    };
    expect(await factory({ env: invalidEnv, fetch: mock.fetch })(events[index], consent)).toEqual({
      status: "skipped",
      reason: "invalid_config",
    });
    expect(
      await factory({ env, fetch: mock.fetch })(
        { ...events[index], unexpected: "guest@example.com" },
        consent,
      ),
    ).toEqual({ status: "skipped", reason: "invalid_event" });
    expect(mock.requests).toHaveLength(0);
  }
});

test("GA übermittelt nur Analyse mit aktuellen Ads-Signalen und erfindet keine Session oder Deduplizierung", async () => {
  const mock = capture();
  const sender = createGa4Sender({ env, fetch: mock.fetch });
  expect(
    await sender({ ...events[0], parameters: { form_id: "contact" } }, () => ({
      analytics: true,
      marketing: false,
    })),
  ).toEqual({ status: "sent" });
  expect(mock.requests[0].body).toEqual({
    client_id: "123.456",
    consent: { ad_user_data: "DENIED", ad_personalization: "DENIED" },
    events: [{ name: "generate_lead", params: { event_id: "event-123", form_id: "contact" } }],
  });
  expect(mock.requests[0].url).toContain("https://region1.google-analytics.com/mp/collect?");
  expect(mock.requests[0].init.redirect).toBe("error");
  expect(mock.requests[0].init.signal).toBeInstanceOf(AbortSignal);
  expect(await sender(events[0], () => ({ analytics: false, marketing: true }))).toEqual({
    status: "skipped",
    reason: "consent_required",
  });
  for (const bad of [
    { clientId: "" },
    { value: 10 },
    { parameters: { email: "guest@example.com" } },
    { eventName: "a".repeat(41) },
    { eventName: "session_start" },
    { eventName: "screen_view" },
  ]) {
    expect(await sender({ ...events[0], ...bad }, consent)).toEqual({
      status: "skipped",
      reason: "invalid_event",
    });
  }
  expect(mock.requests).toHaveLength(1);
});

test("Meta normalisiert und hasht Kontaktdaten, entfernt URL-Tokens und sendet kein LDU", async () => {
  const mock = capture();
  const sender = createMetaSender({ env, fetch: mock.fetch });
  const digest = (value: string) => createHash("sha256").update(value).digest("hex");
  expect(
    await sender(
      {
        ...events[1],
        eventSourceUrl: "https://example.com/contact?token=private#secret",
        email: " Guest@Example.com ",
        phone: "+436601234567",
        firstName: " Mary-Jane ",
        lastName: "O’Neil",
        clientIpAddress: "2001:db8::1",
        clientUserAgent: "Fixture",
      },
      consent,
    ),
  ).toEqual({ status: "sent" });
  expect(mock.requests[0].body).toMatchObject({
    data: [
      {
        event_name: "Lead",
        event_id: "event-123",
        event_source_url: "https://example.com/contact",
        action_source: "website",
        user_data: {
          em: [digest("guest@example.com")],
          ph: [digest("436601234567")],
          fn: [digest("maryjane")],
          ln: [digest("oneil")],
          client_ip_address: "2001:db8::1",
          client_user_agent: "Fixture",
        },
      },
    ],
  });
  const serialized = JSON.stringify(mock.requests[0].body);
  for (const secret of ["Guest@", "Mary", "O’Neil", "private", "secret", "data_processing_options"])
    expect(serialized).not.toContain(secret);
  expect(mock.requests[0].url).not.toContain(env.META_ACCESS_TOKEN);
  expect(mock.requests[0].init.headers).toMatchObject({
    Authorization: `Bearer ${env.META_ACCESS_TOKEN}`,
  });
  expect(
    await sender(
      { eventName: "Lead", eventId: "event-123", eventSourceUrl: "https://example.com" },
      consent,
    ),
  ).toEqual({ status: "skipped", reason: "missing_user_data" });
  expect(await sender({ ...events[1], phone: "06601234567" }, consent)).toEqual({
    status: "skipped",
    reason: "invalid_event",
  });
  expect(mock.requests).toHaveLength(1);
});

test("LinkedIn verlangt vollständige Klartextnamen oder E-Mail und nutzt die konfigurierte Conversion", async () => {
  const mock = capture();
  const sender = createLinkedInSender({ env, fetch: mock.fetch });
  expect(
    await sender(
      {
        ...events[2],
        conversionId: "789",
        firstName: "Ada",
        lastName: "Example",
        companyName: "Example Ltd",
        value: 15,
        currency: "EUR",
      },
      consent,
    ),
  ).toEqual({ status: "sent" });
  expect(mock.requests[0].body).toMatchObject({
    conversion: "urn:lla:llaPartnerConversion:789",
    eventId: "event-123",
    user: {
      userIds: [
        {
          idType: "SHA256_EMAIL",
          idValue: createHash("sha256").update("guest@example.com").digest("hex"),
        },
      ],
      userInfo: { firstName: "Ada", lastName: "Example", companyName: "Example Ltd" },
    },
    conversionValue: { amount: "15.00", currencyCode: "EUR" },
  });
  expect(mock.requests[0].init.headers).toMatchObject({ "Linkedin-Version": "202608" });
  expect(await sender({ ...events[2], firstName: "Ada" }, consent)).toEqual({
    status: "skipped",
    reason: "invalid_event",
  });
  expect(await sender({ eventId: "event-123" }, consent)).toEqual({
    status: "skipped",
    reason: "missing_user_data",
  });
  expect(mock.requests).toHaveLength(1);
});

test("Provider- und Netzwerkfehler bleiben ohne PII, Antworttexte oder Secret-URLs im Log", async () => {
  const warning = spyOn(logger, "warn").mockImplementation(() => {});
  try {
    for (const [index, factory] of factories.entries()) {
      for (const failure of ["http", "network"]) {
        const fetch: TrackingFetch = async () => {
          if (failure === "network")
            throw new Error("https://example.com?api_secret=private guest@example.com");
          return Response.json({ message: "private guest@example.com" }, { status: 400 });
        };
        expect(await factory({ env, fetch })(events[index], consent)).toMatchObject({
          status: "failed",
          reason: failure === "http" ? "upstream_error" : "network_error",
        });
      }
    }
    const logged = JSON.stringify(warning.mock.calls);
    expect(warning).toHaveBeenCalledTimes(6);
    expect(logged).not.toMatch(/private|guest@|api_secret|fixture-/);
  } finally {
    warning.mockRestore();
  }
});

test("generisches GA-Mapping bleibt frei von Projektbezeichnungen", () => {
  expect(
    ["PageView", "ViewContent", "Lead", "Contact", "CompleteRegistration"].map(toGa4EventName),
  ).toEqual(["page_view", "view_item", "generate_lead", "contact", "sign_up"]);
  expect(toGa4EventName("download_guide")).toBe("download_guide");
  expect(toGa4EventName("toString")).toBe("toString");
});
