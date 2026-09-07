import { expect, test } from "bun:test";

// Der reale Consent-Einstieg läuft in einem separaten Prozess mit erfundenen
// IDs und einem lokalen DOM. Kein Projekt-Env und kein Anbieterrequest.
function pruefeBrowser(env: Record<string, string>, aktionen: string): unknown {
  const pruefung = Bun.spawnSync({
    cmd: [
      process.execPath,
      "--no-env-file",
      "--eval",
      `
      import { spyOn } from "bun:test";
      import * as CookieConsent from "vanilla-cookieconsent";
      let gueltig = true;
      let analytics = false;
      let marketing = false;
      let config;
      spyOn(CookieConsent, "validConsent").mockImplementation(() => gueltig);
      spyOn(CookieConsent, "acceptedCategory").mockImplementation(
        (name) => name === "analytics" ? analytics : marketing,
      );
      spyOn(CookieConsent, "run").mockImplementation((wert) => { config = wert; return Promise.resolve(); });
      const google = [];
      const meta = [];
      const linkedin = [];
      const skripte = new Map();
      globalThis.fetch = () => { throw new Error("Externer Request im Test verboten"); };
      globalThis.window = {
        gtag: (...werte) => google.push(werte),
        fbq: (...werte) => meta.push(werte),
        lintrk: (...werte) => linkedin.push(werte),
        location: { origin: "https://example.test", pathname: "/en/", href: "https://example.test/en/?email=private%40example.test#token" },
      };
      globalThis.document = {
        documentElement: { getAttribute: () => "en" },
        getElementById: (id) => skripte.get(id) ?? null,
        createElement: () => ({}),
        head: { appendChild: (script) => skripte.set(script.id, script) },
        addEventListener: () => {},
        querySelectorAll: () => [],
      };
      await import("./cookie-consent.ts");
      const anwenden = () => config.onChange?.({ cookie: { categories: ["necessary", ...(analytics ? ["analytics"] : []), ...(marketing ? ["marketing"] : [])] } });
      const status = () => ({
        skripte: [...skripte.values()].map((s) => s.src),
        googleConfigs: google.filter((v) => v[0] === "config").map((v) => v[1]),
        googleEvents: google.filter((v) => v[0] === "event"),
        metaInit: meta.filter((v) => v[0] === "init").length,
        metaEvents: meta.filter((v) => v[0] === "track"),
        linkedin: linkedin.length,
      });
      ${aktionen}
    `,
    ],
    cwd: import.meta.dir,
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(new TextDecoder().decode(pruefung.stderr)).toBe("");
  expect(pruefung.exitCode).toBe(0);
  return JSON.parse(new TextDecoder().decode(pruefung.stdout));
}

const ids = {
  PUBLIC_GA_MEASUREMENT_ID: "G-TEST123",
  PUBLIC_GOOGLE_ADS_ID: "AW-123456",
  PUBLIC_META_PIXEL_ID: "1234567",
  PUBLIC_LINKEDIN_PARTNER_ID: "7654321",
  PUBLIC_LI_CONVERSION_LEAD: "321",
};

test("Consent lädt erst die jeweils erlaubten Anbieter und initialisiert Meta nur einmal", () => {
  const ergebnis = pruefeBrowser(
    ids,
    `
    const ergebnisse = [];
    anwenden();
    ergebnisse.push(status());
    analytics = true;
    anwenden();
    ergebnisse.push(status());
    marketing = true;
    anwenden();
    anwenden();
    ergebnisse.push(status());
    process.stdout.write(JSON.stringify(ergebnisse));
  `,
  );
  expect(ergebnis).toEqual([
    { skripte: [], googleConfigs: [], googleEvents: [], metaInit: 0, metaEvents: [], linkedin: 0 },
    {
      skripte: ["https://www.googletagmanager.com/gtag/js?id=G-TEST123"],
      googleConfigs: ["G-TEST123"],
      googleEvents: [
        [
          "event",
          "page_view",
          { send_to: ["G-TEST123"], page_location: "https://example.test/en/", page_referrer: "" },
        ],
      ],
      metaInit: 0,
      metaEvents: [],
      linkedin: 0,
    },
    {
      skripte: [
        "https://www.googletagmanager.com/gtag/js?id=G-TEST123",
        "https://connect.facebook.net/en_US/fbevents.js",
        "https://snap.licdn.com/li.lms-analytics/insight.min.js",
      ],
      googleConfigs: ["G-TEST123", "AW-123456"],
      googleEvents: [
        [
          "event",
          "page_view",
          { send_to: ["G-TEST123"], page_location: "https://example.test/en/", page_referrer: "" },
        ],
        [
          "event",
          "page_view",
          { send_to: ["AW-123456"], page_location: "https://example.test/en/", page_referrer: "" },
        ],
      ],
      metaInit: 1,
      metaEvents: [["track", "PageView", {}]],
      linkedin: 0,
    },
  ]);
});

test("fehlende oder ungültige IDs laden selbst bei Zustimmung keine Anbieter", () => {
  for (const env of [
    {},
    {
      ...ids,
      PUBLIC_GA_MEASUREMENT_ID: "bad",
      PUBLIC_GOOGLE_ADS_ID: "bad",
      PUBLIC_META_PIXEL_ID: "bad",
      PUBLIC_LINKEDIN_PARTNER_ID: "bad",
    },
  ]) {
    expect(
      pruefeBrowser(
        env,
        `analytics = marketing = true; anwenden(); process.stdout.write(JSON.stringify(status()));`,
      ),
    ).toEqual({
      skripte: [],
      googleConfigs: [],
      googleEvents: [],
      metaInit: 0,
      metaEvents: [],
      linkedin: 0,
    });
  }
});

test("Banner enthält keine erfundenen Datenschutzlinks, Session-Cookies oder Anonymitätszusage", () => {
  expect(
    pruefeBrowser(
      {},
      `
    const text = JSON.stringify(config.language.translations);
    process.stdout.write(JSON.stringify({
      platzhalter: /hello@example|\\/de\\/cookie|\\/en\\/cookie|\\/de\\/datenschutz|\\/en\\/datenschutz/.test(text),
      anonym: /anonymisiert|anonymized|session.cookies/i.test(text),
      callbacks: typeof config.onConsent === "function" && typeof config.onChange === "function",
    }));
  `,
    ),
  ).toEqual({ platzhalter: false, anonym: false, callbacks: true });
});

test("Widerruf und ungültige Revision sperren eigene Ereignisse und trennen Google-Ziele", () => {
  expect(
    pruefeBrowser(
      ids,
      `
    const { track, setMarketingConsent, setAnalyticsConsent } = await import("./tracking.ts");
    const ergebnisse = [];
    const zaehler = () => ({
      meta: meta.filter((v) => v[0] === "track" && v[1] === "Lead").length,
      google: google.filter((v) => v[0] === "event" && v[1] === "generate_lead").map((v) => v[2].send_to),
      linkedin: linkedin.length,
    });
    track("Lead");
    ergebnisse.push(zaehler());
    marketing = true;
    anwenden(); track("Lead");
    ergebnisse.push(zaehler());
    analytics = true;
    anwenden(); track("Lead");
    ergebnisse.push(zaehler());
    marketing = false;
    anwenden(); track("Lead");
    ergebnisse.push(zaehler());
    gueltig = false;
    marketing = true;
    anwenden(); track("Lead");
    ergebnisse.push(zaehler());
    gueltig = true;
    // Alte Cookie-Kategorien allein dürfen nach gesetzten Sperren nichts senden.
    setMarketingConsent(false); setAnalyticsConsent(false); track("Lead");
    ergebnisse.push(zaehler());
    process.stdout.write(JSON.stringify(ergebnisse));
  `,
    ),
  ).toEqual([
    { meta: 0, google: [], linkedin: 0 },
    { meta: 1, google: [["AW-123456"]], linkedin: 1 },
    { meta: 2, google: [["AW-123456"], ["G-TEST123", "AW-123456"]], linkedin: 2 },
    { meta: 2, google: [["AW-123456"], ["G-TEST123", "AW-123456"], ["G-TEST123"]], linkedin: 2 },
    { meta: 2, google: [["AW-123456"], ["G-TEST123", "AW-123456"], ["G-TEST123"]], linkedin: 2 },
    { meta: 2, google: [["AW-123456"], ["G-TEST123", "AW-123456"], ["G-TEST123"]], linkedin: 2 },
  ]);
});

test("Event-Allowlist verwirft ungültige Namen und Werte und überträgt keine freien Formularfelder", () => {
  expect(
    pruefeBrowser(
      ids,
      `
    const { track } = await import("./tracking.ts");
    analytics = marketing = true; anwenden();
    google.length = meta.length = linkedin.length = 0;
    track("Lead", { eventId: "123e4567-e89b-42d3-a456-426614174000", value: 12, currency: "EUR", email: "private@example.test", custom: { name: "Private Person" }, url: window.location.href });
    const erlaubteEvents = { google: [...google], meta: [...meta], linkedin: [...linkedin] };
    google.length = meta.length = linkedin.length = 0;
    track("private@example.test");
    track("Lead", { eventId: "private@example.test" });
    track("Lead", { value: 12 });
    track("Lead", { value: Infinity });
    track("Lead", { value: -1 });
    track("Lead", { currency: "private@example.test" });
    process.stdout.write(JSON.stringify({ gueltig: erlaubteEvents, ungueltig: { google, meta, linkedin } }));
  `,
    ),
  ).toEqual({
    gueltig: {
      google: [
        [
          "event",
          "generate_lead",
          {
            value: 12,
            currency: "EUR",
            event_id: "123e4567-e89b-42d3-a456-426614174000",
            page_location: "https://example.test/en/",
            page_referrer: "",
            send_to: ["G-TEST123", "AW-123456"],
          },
        ],
      ],
      meta: [
        [
          "track",
          "Lead",
          { value: 12, currency: "EUR" },
          { eventID: "123e4567-e89b-42d3-a456-426614174000" },
        ],
      ],
      linkedin: [
        ["track", { conversion_id: 321, event_id: "123e4567-e89b-42d3-a456-426614174000" }],
      ],
    },
    ungueltig: { google: [], meta: [], linkedin: [] },
  });
});

test("Datenschutzlinks werden nur sicher konfiguriert und für HTML maskiert ausgegeben", () => {
  expect(
    pruefeBrowser(
      {
        PUBLIC_PRIVACY_URL_DE: "/privacy?lang=de&view=full",
        PUBLIC_PRIVACY_URL_EN: "https://example.test/privacy",
      },
      `
    const { datenschutzLink } = await import("../i18n/cookieConsent.ts");
    process.stdout.write(JSON.stringify({
      de: config.language.translations.de.consentModal.footer,
      en: config.language.translations.en.consentModal.footer,
      unsicher: ["javascript:alert(1)", "//evil.test/privacy", "/\\\\evil.test/privacy", "http://example.test/privacy", "https://user:password@example.test/privacy"].map((url) => datenschutzLink(url) ?? null),
      html: datenschutzLink('https://example.test/privacy?x="<img>'),
    }));
  `,
    ),
  ).toEqual({
    de: '<a href="/privacy?lang=de&amp;view=full">Datenschutz</a>',
    en: '<a href="https://example.test/privacy">Privacy</a>',
    unsicher: [null, null, null, null, null],
    html: "https://example.test/privacy?x=%22%3Cimg%3E",
  });
});

test("Server-only-Anbieter sind auswählbar, laden aber keine Browsertracker", () => {
  expect(
    pruefeBrowser(
      {
        PUBLIC_GA4_MP_ENABLED: "true",
        PUBLIC_META_CAPI_ENABLED: "true",
        PUBLIC_LINKEDIN_CAPI_ENABLED: "true",
      },
      `
      analytics = marketing = true;
      anwenden();
      const { track } = await import("./tracking.ts");
      track("Lead");
      const sections = config.language.translations.en.preferencesModal.sections;
      process.stdout.write(JSON.stringify({
        ...status(),
        categories: Object.keys(config.categories),
        titles: sections.filter((s) => s.linkedCategory !== "necessary" && s.linkedCategory).map((s) => s.title),
        serverExplained: sections.filter((s) => ["analytics", "marketing"].includes(s.linkedCategory)).every((s) => s.description.includes("server")),
      }));
      `,
    ),
  ).toEqual({
    skripte: [],
    googleConfigs: [],
    googleEvents: [],
    metaInit: 0,
    metaEvents: [],
    linkedin: 0,
    categories: ["necessary", "analytics", "marketing"],
    titles: ["Analytics with Google Analytics", "Marketing with Meta, LinkedIn"],
    serverExplained: true,
  });
});

test("Nur wörtlich true aktiviert serverseitige Consent-Kategorien", () => {
  expect(
    pruefeBrowser(
      {
        PUBLIC_GA4_MP_ENABLED: "TRUE",
        PUBLIC_META_CAPI_ENABLED: "1",
        PUBLIC_LINKEDIN_CAPI_ENABLED: "false",
      },
      `analytics = marketing = true; anwenden(); process.stdout.write(JSON.stringify(Object.keys(config.categories)));`,
    ),
  ).toEqual(["necessary"]);
});
