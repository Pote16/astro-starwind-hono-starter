import { testUrls } from "./environment";
import { type AuditWindow, expect, test } from "./fixtures";

test.use({ baseURL: testUrls.configured });

test("Turnstile sperrt ungelöste Formulare, erneuert Tokens und passt sich 320px an", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Nur notwendige", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as AuditWindow).__turnstile?.sizes))
    .toEqual(["flexible"]);
  await page.locator("#demo-name").fill("Demo Person");
  await page.locator("#demo-email").fill("demo@example.test");
  let submissions = 0;
  await page.route("**/api/users", async (route) => {
    submissions++;
    expect(route.request().postDataJSON()).toMatchObject({ turnstileToken: "mock-valid-token" });
    await route.fulfill({ status: 201, json: { success: true } });
  });
  const submit = page.getByRole("button", { name: "Formular prüfen", exact: true });
  await submit.click();
  await expect(page.locator("[data-form-status]")).toContainText("Bitte schließen");
  expect(submissions).toBe(0);
  await page.evaluate(() =>
    (window as AuditWindow).__turnstile?.options?.callback("mock-valid-token"),
  );
  await submit.click();
  await expect(page.locator("[data-form-status]")).toContainText("Formular erfolgreich geprüft");
  expect(submissions).toBe(1);
  await expect.poll(() => page.evaluate(() => (window as AuditWindow).__turnstile?.resets)).toBe(1);

  // Der erfolgreiche Versuch verbraucht den Token, obwohl die Demo wieder offen ist.
  await page.locator("#demo-name").fill("Demo Person");
  await page.locator("#demo-email").fill("demo@example.test");
  await submit.click();
  await expect(page.locator("[data-form-status]")).toContainText("Bitte schließen");
  expect(submissions).toBe(1);
  await page.evaluate(() => (window as AuditWindow).__turnstile?.options?.["error-callback"]());
  await page.getByRole("button", { name: "Erneut prüfen", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as AuditWindow).__turnstile?.resets)).toBe(2);

  await page.setViewportSize({ width: 320, height: 900 });
  await expect
    .poll(() => page.evaluate(() => (window as AuditWindow).__turnstile?.sizes))
    .toEqual(["flexible", "compact"]);
  expect(await page.evaluate(() => (window as AuditWindow).__turnstile?.removes)).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
