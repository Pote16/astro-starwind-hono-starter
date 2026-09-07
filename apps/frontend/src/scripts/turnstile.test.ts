import { expect, test } from "bun:test";

/** Echte Modulzustände bleiben im Kindprozess; kein Projekt-Env und kein Cloudflare-Request. */
function pruefeLifecycle(aktionen: string): unknown {
  const pruefung = Bun.spawnSync({
    cmd: [
      process.execPath,
      "--no-env-file",
      "--eval",
      `
      import { mock } from "bun:test";
      // Nur Astro stellt dieses virtuelle Routingmodul bereit. Der Lifecycle
      // nutzt daraus keinen Pfadhelfer; seine echte Sprachwahl bleibt geladen.
      mock.module("astro:i18n", () => ({
        getRelativeLocaleUrl: () => { throw new Error("Routing gehört nicht zu diesem Lifecycle-Test"); },
      }));
      const skripte = [];
      const renderings = [];
      const resets = [];
      const removals = [];
      const beobachter = [];
      const timer = new Map();
      let timerId = 0;
      let elemente = [];
      globalThis.fetch = () => { throw new Error("Externer Request im Test verboten"); };
      class Element extends EventTarget {
        dataset = {};
        hidden = true;
        textContent = "";
        isConnected = true;
        entfernt = false;
        kinder = new Map();
        breite = 320;
        querySelector(selector) { return this.kinder.get(selector) ?? null; }
        getBoundingClientRect() { return { width: this.breite }; }
        remove() { this.entfernt = true; this.isConnected = false; }
      }
      globalThis.ResizeObserver = class {
        getrennt = false;
        constructor(callback) { this.callback = callback; beobachter.push(this); }
        observe(element) { this.element = element; }
        disconnect() { this.getrennt = true; }
      };
      globalThis.window = {
        setTimeout(callback, ms) { const id = ++timerId; timer.set(id, { callback, ms }); return id; },
        clearTimeout(id) { timer.delete(id); },
      };
      globalThis.document = {
        querySelectorAll: () => elemente,
        createElement: () => new Element(),
        head: { append: (script) => skripte.push(script) },
      };
      const api = {
        render(ziel, optionen) {
          const id = "widget-" + (renderings.length + 1);
          renderings.push({ id, ziel, optionen });
          return id;
        },
        reset: (id) => resets.push(id),
        remove: (id) => removals.push(id),
      };
      function formular(sprache = "de", breite = 320) {
        const wrapper = new Element();
        const ziel = new Element();
        const status = new Element();
        const retry = new Element();
        const form = new Element();
        wrapper.dataset = { sitekey: "public-fixture", aktion: "create_user", sprache };
        wrapper.breite = ziel.breite = breite;
        wrapper.kinder.set("[data-turnstile-widget]", ziel);
        wrapper.kinder.set("[data-turnstile-status]", status);
        wrapper.kinder.set("[data-turnstile-wiederholen]", retry);
        form.kinder.set("[data-turnstile]", wrapper);
        elemente.push(wrapper);
        return { wrapper, ziel, status, retry, form };
      }
      const tick = () => new Promise((resolve) => setImmediate(resolve));
      async function laden() {
        window.turnstile = api;
        skripte.at(-1).dispatchEvent(new Event("load"));
        await tick();
      }
      const { initBotSchutz, leseBotSchutz, entferneBotSchutz } = await import("./turnstile.ts");
      const token = (f) => leseBotSchutz(f.form)?.token;
      ${aktionen}
    `,
    ],
    cwd: import.meta.dir,
    env: {},
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(new TextDecoder().decode(pruefung.stderr)).toBe("");
  expect(pruefung.exitCode).toBe(0);
  return JSON.parse(new TextDecoder().decode(pruefung.stdout));
}

test("ohne Widget entstehen weder Cloudflare-Skript noch Beobachter oder Timer", () => {
  expect(
    pruefeLifecycle(`
    initBotSchutz();
    await tick();
    process.stdout.write(JSON.stringify({
      skripte: skripte.length, beobachter: beobachter.length, timer: timer.size,
      nachweis: leseBotSchutz(new Element()) ?? null,
    }));
  `),
  ).toEqual({ skripte: 0, beobachter: 0, timer: 0, nachweis: null });
});

test("Initialisierung ist idempotent und Token-Callbacks geben nur gültige Nachweise frei", () => {
  expect(
    pruefeLifecycle(`
    const f = formular("en");
    initBotSchutz(); initBotSchutz();
    const vorLaden = { token: token(f), status: f.status.textContent, timerMs: [...timer.values()][0].ms };
    await laden();
    const options = renderings[0].optionen;
    const tokens = [];
    options.callback("valid-token"); tokens.push(token(f));
    const nachErfolg = { hidden: f.status.hidden, retry: f.retry.hidden };
    options.callback(""); tokens.push(token(f));
    options.callback("x".repeat(2049)); tokens.push(token(f));
    process.stdout.write(JSON.stringify({
      vorLaden, skripte: skripte.map((s) => s.src), renders: renderings.length,
      beobachter: beobachter.length, timer: timer.size, tokens, nachErfolg,
      fehlermeldung: f.status.textContent, retry: f.retry.hidden,
      optionen: { action: options.action, language: options.language, responseField: options["response-field"], expiry: options["refresh-expired"] },
    }));
  `),
  ).toEqual({
    vorLaden: { token: "", status: "Loading security check …", timerMs: 10000 },
    skripte: ["https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"],
    renders: 1,
    beobachter: 1,
    timer: 0,
    tokens: ["valid-token", "", ""],
    nachErfolg: { hidden: true, retry: true },
    fehlermeldung: "The security check is unavailable. Please try again.",
    retry: false,
    optionen: { action: "create_user", language: "en", responseField: false, expiry: "auto" },
  });
});

test("Ablauf und Fehler löschen Tokens; Wiederholen und nachVersuch erneuern dieselbe Prüfung", () => {
  expect(
    pruefeLifecycle(`
    const f = formular(); initBotSchutz(); await laden();
    const options = renderings[0].optionen;
    options.callback("old-token"); options["expired-callback"]();
    const abgelaufen = { token: token(f), status: f.status.textContent };
    options.callback("second-token");
    const unterdrueckt = options["error-callback"]();
    const fehler = { token: token(f), retry: f.retry.hidden };
    f.retry.dispatchEvent(new Event("click")); await tick();
    options.callback("retry-token");
    leseBotSchutz(f.form).nachVersuch(false);
    const nachVersuch = token(f);
    await tick();
    options.callback("last-token");
    options["timeout-callback"]();
    const timeout = { token: token(f), retry: f.retry.hidden };
    options.callback("other-token"); options["unsupported-callback"]();
    const unsupported = { token: token(f), retry: f.retry.hidden };
    options.callback("confirmed-token");
    leseBotSchutz(f.form).nachVersuch(true); await tick();
    process.stdout.write(JSON.stringify({
      abgelaufen, unterdrueckt, fehler, nachVersuch, timeout, unsupported,
      resets, removals, skripte: skripte.length, renders: renderings.length,
      beendet: { token: token(f), getrennt: beobachter[0].getrennt },
    }));
  `),
  ).toEqual({
    abgelaufen: { token: "", status: "Die Sicherheitsprüfung ist abgelaufen. Sie wird erneuert." },
    unterdrueckt: true,
    fehler: { token: "", retry: false },
    nachVersuch: "",
    timeout: { token: "", retry: false },
    unsupported: { token: "", retry: false },
    resets: ["widget-1", "widget-1"],
    removals: ["widget-1"],
    skripte: 1,
    renders: 1,
    beendet: { token: "", getrennt: true },
  });
});

test("Ladefehler entfernen das Skript und erlauben einen erfolgreichen erneuten Ladeversuch", () => {
  expect(
    pruefeLifecycle(`
    const f = formular("en"); initBotSchutz();
    skripte[0].dispatchEvent(new Event("error")); await tick();
    const fehlgeschlagen = {
      token: token(f), entfernt: skripte[0].entfernt, timer: timer.size,
      retry: f.retry.hidden, status: f.status.textContent,
    };
    f.retry.dispatchEvent(new Event("click"));
    await laden();
    renderings[0].optionen.callback("recovered");
    process.stdout.write(JSON.stringify({
      fehlgeschlagen, skripte: skripte.length, renders: renderings.length,
      wiederhergestellt: { token: token(f), retry: f.retry.hidden, statusHidden: f.status.hidden, timer: timer.size },
    }));
  `),
  ).toEqual({
    fehlgeschlagen: {
      token: "",
      entfernt: true,
      timer: 0,
      retry: false,
      status: "The security check is unavailable. Please try again.",
    },
    skripte: 2,
    renders: 1,
    wiederhergestellt: { token: "recovered", retry: true, statusHidden: true, timer: 0 },
  });
});

test("Lade-Timeout meldet einen wiederholbaren Fehler ohne Render oder Token", () => {
  expect(
    pruefeLifecycle(`
    const f = formular(); initBotSchutz();
    [...timer.values()][0].callback(); await tick();
    process.stdout.write(JSON.stringify({
      token: token(f), timer: timer.size, entfernt: skripte[0].entfernt,
      retry: f.retry.hidden, status: f.status.textContent, renders: renderings.length,
    }));
  `),
  ).toEqual({
    token: "",
    timer: 0,
    entfernt: true,
    retry: false,
    status: "Die Sicherheitsprüfung ist nicht verfügbar. Bitte versuchen Sie es erneut.",
    renders: 0,
  });
});

test("Cleanup entfernt alle Widgets und Beobachter; die nächste Seite verwendet das geladene Skript", () => {
  expect(
    pruefeLifecycle(`
    const a = formular("de"); const b = formular("en", 250);
    initBotSchutz(); await laden();
    renderings[0].optionen.callback("a-token"); renderings[1].optionen.callback("b-token");
    const groessen = renderings.map((r) => r.optionen.size);
    entferneBotSchutz(); entferneBotSchutz();
    leseBotSchutz(a.form).nachVersuch(false); await tick();
    const cleanup = { removals: [...removals], getrennt: beobachter.map((b) => b.getrennt), tokens: [token(a), token(b)], resets: resets.length };
    a.wrapper.isConnected = b.wrapper.isConnected = false; elemente = [];
    const c = formular("en"); initBotSchutz(); await tick();
    renderings[2].optionen.callback("new-page");
    process.stdout.write(JSON.stringify({
      groessen, cleanup, skripte: skripte.length, renders: renderings.length,
      neueSeite: token(c), neuerBeobachterAktiv: !beobachter[2].getrennt,
    }));
  `),
  ).toEqual({
    groessen: ["flexible", "compact"],
    cleanup: {
      removals: ["widget-1", "widget-2"],
      getrennt: [true, true],
      tokens: ["", ""],
      resets: 0,
    },
    skripte: 1,
    renders: 3,
    neueSeite: "new-page",
    neuerBeobachterAktiv: true,
  });
});

test("entfernte Formulare werden nach verzögertem Skriptladen nicht mehr gerendert", () => {
  expect(
    pruefeLifecycle(`
    const f = formular(); initBotSchutz();
    entferneBotSchutz(); f.wrapper.isConnected = false; elemente = [];
    await laden();
    process.stdout.write(JSON.stringify({
      renders: renderings.length, getrennt: beobachter[0].getrennt,
      token: token(f), timer: timer.size,
    }));
  `),
  ).toEqual({ renders: 0, getrennt: true, token: "", timer: 0 });
});
