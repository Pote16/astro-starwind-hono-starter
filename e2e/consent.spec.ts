import { testUrls } from "./environment";
import { type AuditWindow, expect, sendTestLead, test, trackingSnapshot } from "./fixtures";

test.use({ baseURL: testUrls.configured });

test("Statistik, Marketing und Widerruf steuern die Anbieter getrennt", async ({
  page,
  browserAudit,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Nur notwendige", exact: true }).click();
  expect(browserAudit.external).toHaveLength(1);
  expect(browserAudit.external[0]).toContain("challenges.cloudflare.com");
  await expect(page.locator('script[data-tracking="google-consent"]')).toHaveCount(1);
  expect(
    await page.evaluate(() =>
      (window as AuditWindow).dataLayer?.some(
        (entry) =>
          entry[0] === "consent" &&
          entry[1] === "default" &&
          (entry[2] as Record<string, string>).analytics_storage === "denied",
      ),
    ),
  ).toBe(true);
  expect(await trackingSnapshot(page)).toEqual({
    googleConfigs: [],
    googleEvents: [],
    metaInit: 0,
    metaEvents: [],
    linkedin: [],
  });

  const preferences = page.getByRole("button", { name: "Cookie-Einstellungen", exact: true });
  await preferences.click();
  await page.locator('#cc-main input[value="analytics"]').check();
  await page.getByRole("button", { name: "Auswahl speichern", exact: true }).click();
  await expect.poll(() => browserAudit.external.length).toBe(2);
  expect(browserAudit.external[1]).toContain("googletagmanager.com/gtag/js?id=G-TEST123");
  expect(await trackingSnapshot(page)).toMatchObject({
    googleConfigs: ["G-TEST123"],
    metaInit: 0,
    metaEvents: [],
    linkedin: [],
  });
  await sendTestLead(page);
  const analyticsOnly = await trackingSnapshot(page);
  expect(analyticsOnly.googleEvents).toContainEqual([
    "event",
    "generate_lead",
    { send_to: ["G-TEST123"], page_location: `${testUrls.configured}/`, page_referrer: "" },
  ]);

  await preferences.click();
  await page.locator('#cc-main input[value="marketing"]').check();
  await page.getByRole("button", { name: "Auswahl speichern", exact: true }).click();
  await expect.poll(() => browserAudit.external.length).toBe(4);
  expect(browserAudit.external.filter((url) => url.includes("connect.facebook.net"))).toHaveLength(
    1,
  );
  expect(browserAudit.external.filter((url) => url.includes("snap.licdn.com"))).toHaveLength(1);
  await sendTestLead(page);
  const both = await trackingSnapshot(page);
  expect(both.googleConfigs).toEqual(["G-TEST123", "AW-123456"]);
  expect(both.metaInit).toBe(1);
  expect(both.metaEvents.filter((entry) => entry[1] === "PageView")).toHaveLength(1);
  expect(both.metaEvents.filter((entry) => entry[1] === "Lead")).toHaveLength(1);
  expect(both.linkedin).toContainEqual(["track", { conversion_id: 321 }]);

  await preferences.click();
  await page.locator('#cc-main input[value="analytics"]').uncheck();
  await page.locator('#cc-main input[value="marketing"]').uncheck();
  await page.getByRole("button", { name: "Auswahl speichern", exact: true }).click();
  await sendTestLead(page);
  expect(await trackingSnapshot(page)).toEqual(both);
  // Die bereits geladenen Anbieter bleiben auf der Seite; nur eigene Events
  // sind widerrufen. Beim nächsten Aufruf werden ihre Skripte nicht mehr geladen.
  browserAudit.external.length = 0;
  await page.reload();
  await expect(page.locator("[data-demo-form] button[type=submit]")).toBeEnabled();
  await expect.poll(() => browserAudit.external.length).toBe(1);
  expect(browserAudit.external[0]).toContain("challenges.cloudflare.com");
  expect(await trackingSnapshot(page)).toEqual({
    googleConfigs: [],
    googleEvents: [],
    metaInit: 0,
    metaEvents: [],
    linkedin: [],
  });
});
