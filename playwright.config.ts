import { defineConfig } from "@playwright/test";

import { testUrls } from "./e2e/environment";

const profiles: Array<keyof typeof testUrls> = ["backend", "blank", "configured"];

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  // Ein Backend und dessen echtes Formularlimit werden bewusst gemeinsam benutzt.
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: 30_000,
  expect: { timeout: 10_000 },
  outputDir: "test-results",
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    browserName: "chromium",
    baseURL: testUrls.blank,
    viewport: { width: 390, height: 900 },
    serviceWorkers: "block",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: {
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
        : {}),
    },
  },
  webServer: profiles.map((profile) => ({
    command: `bun --no-env-file e2e/start-server.ts ${profile}`,
    url: profile === "backend" ? `${testUrls.backend}/health` : testUrls[profile],
    name: `E2E ${profile}`,
    timeout: 90_000,
    reuseExistingServer: false,
    gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
    stdout: "ignore",
    stderr: "pipe",
  })),
});
