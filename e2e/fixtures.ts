import { expect, type Page, test as base } from "@playwright/test";

import { testUrls } from "./environment";

export interface TurnstileMock {
  options?: {
    callback: (token: string) => void;
    "error-callback": () => void;
    "expired-callback": () => void;
  };
  resets: number;
  removes: number;
  sizes: string[];
}

export interface AuditWindow extends Window {
  __turnstile?: TurnstileMock;
  dataLayer?: ArrayLike<unknown>[];
  fbq?: { queue?: ArrayLike<unknown>[] };
  lintrk?: { q?: ArrayLike<unknown>[] };
}

interface BrowserAudit {
  external: string[];
}

const providerHosts = new Set([
  "challenges.cloudflare.com",
  "www.googletagmanager.com",
  "connect.facebook.net",
  "snap.licdn.com",
]);

const turnstileMock = `
  window.__turnstile = { options: null, resets: 0, removes: 0, sizes: [] };
  const widgets = new Map();
  window.turnstile = {
    render(element, options) {
      window.__turnstile.options = options;
      window.__turnstile.sizes.push(options.size);
      const widget = document.createElement('div');
      widget.textContent = 'Local security mock';
      widget.style.width = options.size === 'compact' ? '150px' : '300px';
      element.replaceChildren(widget);
      widgets.set('local-widget', element);
      return 'local-widget';
    },
    reset() { window.__turnstile.resets++; },
    remove(id) {
      window.__turnstile.removes++;
      widgets.get(id)?.replaceChildren();
      widgets.delete(id);
    },
  };
`;

export const test = base.extend<{ browserAudit: BrowserAudit }>({
  browserAudit: [
    async ({ page, context }, use) => {
      const external: string[] = [];
      const unexpected: string[] = [];
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      // CookieConsent blendet Bots standardmäßig aus. Hier wird der sichtbare
      // Besucherdialog bewusst geprüft, ohne die Produktionskonfiguration zu ändern.
      await context.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => false });
      });
      await context.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (
          Object.values(testUrls).includes(url.origin as (typeof testUrls)[keyof typeof testUrls])
        ) {
          await route.continue();
          return;
        }
        external.push(url.href);
        if (!providerHosts.has(url.hostname)) {
          unexpected.push(url.href);
          await route.abort("blockedbyclient");
          return;
        }
        await route.fulfill({
          contentType: "application/javascript",
          body:
            url.hostname === "challenges.cloudflare.com"
              ? turnstileMock
              : "/* Lokaler Test: Anbieter vollständig abgefangen. */",
        });
      });
      await use({ external });
      expect(unexpected, "Unbekannte externe Requests müssen überprüft werden").toEqual([]);
      expect(errors, "Die Seite darf keine JavaScriptfehler erzeugen").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";

export async function trackingSnapshot(page: Page) {
  return page.evaluate(() => {
    const state = window as AuditWindow;
    const google = (state.dataLayer ?? []).map((entry) => Array.from(entry));
    const meta = (state.fbq?.queue ?? []).map((entry) => Array.from(entry));
    const linkedin = (state.lintrk?.q ?? []).map((entry) => Array.from(entry));
    return {
      googleConfigs: google.filter((entry) => entry[0] === "config").map((entry) => entry[1]),
      googleEvents: google.filter((entry) => entry[0] === "event"),
      metaInit: meta.filter((entry) => entry[0] === "init").length,
      metaEvents: meta.filter((entry) => entry[0] === "track"),
      linkedin,
    };
  });
}

export async function sendTestLead(page: Page) {
  await page.evaluate(async () => {
    // Ein eigener Testaufruf; das Demoformular erzeugt keine Werbekonversion.
    const modulePath = "/src/scripts/tracking.ts";
    const { track } = (await import(modulePath)) as { track: (name: "Lead") => void };
    track("Lead");
  });
}
