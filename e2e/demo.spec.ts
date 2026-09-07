import { expect, test } from "./fixtures";

test("Deutsche und englische Demo erreichen die echte lokale Hono-API", async ({
  page,
  browserAudit,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Nur notwendige", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(page.locator("[data-turnstile]")).toHaveCount(0);
  await expect(page.locator("script[data-tracking]")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  for (const language of ["de", "en"] as const) {
    if (language === "en") {
      await page.getByRole("link", { name: "English", exact: true }).click();
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
    }
    const submit = page.getByRole("button", {
      name: language === "de" ? "Formular prüfen" : "Validate form",
      exact: true,
    });
    // Regression: Starwind darf den aktivierten Knopf nicht visuell sperren.
    await expect(submit).toBeEnabled();
    await expect(submit).not.toHaveAttribute("data-disabled", "");
    await page.locator("#demo-name").fill("Demo Person");
    await page.locator("#demo-email").fill("demo@example.test");
    const [response] = await Promise.all([
      page.waitForResponse(
        (result) => result.url().endsWith("/api/users") && result.request().method() === "POST",
      ),
      submit.click(),
    ]);
    expect(response.status()).toBe(201);
    expect(await response.json()).toMatchObject({ success: true, data: { name: "Demo Person" } });
    await expect(page.locator("[data-form-status]")).toContainText(
      language === "de" ? "Formular erfolgreich geprüft" : "Form validated successfully",
    );
    await expect(page.locator("#demo-name")).toHaveValue("");
    await expect(page.locator("#demo-email")).toHaveValue("");
  }
  await page.getByRole("button", { name: "Cookie settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Cookie settings", exact: true })).toBeVisible();
  expect(browserAudit.external).toEqual([]);
});

test.describe("Ohne JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("Formulardaten können nicht ungeschützt abgeschickt werden", async ({
    page,
    browserAudit,
  }) => {
    await page.goto("/");
    await expect(page.locator("button[type=submit]")).toBeDisabled();
    await expect(
      page.getByText("Bitte aktivieren Sie JavaScript, um das Formular zu testen.", {
        exact: true,
      }),
    ).toBeVisible();
    expect(browserAudit.external).toEqual([]);
  });
});
