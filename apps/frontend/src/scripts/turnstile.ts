import { formularUebersetzung } from "../i18n/formular";
import type { Lang as Sprache } from "../i18n/ui";
import { getLangFromLocale as aktuelleSprache } from "../i18n/utils";
import { turnstileKonfigurationSchema, turnstileTokenSchema } from "../schemas/turnstile.schema";

interface TurnstileApi {
  render(
    element: HTMLElement,
    optionen: {
      sitekey: string;
      action: string;
      language: Sprache;
      theme: "light";
      size: "compact" | "flexible";
      "response-field": false;
      "refresh-expired": "auto";
      callback: (token: string) => void;
      "error-callback": () => boolean;
      "expired-callback": () => void;
      "timeout-callback": () => void;
      "unsupported-callback": () => void;
    },
  ): string | undefined;
  reset(id: string): void;
  remove(id: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

interface WidgetZustand {
  token: string;
  id?: string;
  startet: boolean;
  groesse?: "compact" | "flexible";
  beobachter?: ResizeObserver;
}

/** Nach einem Versuch wird der verbrauchte Token erneuert oder die Prüfung beendet. */
export interface BotNachweis {
  token: string;
  nachVersuch: (erfolgreich: boolean) => void;
}

const widgets = new Map<HTMLElement, WidgetZustand>();
let geladen: Promise<TurnstileApi> | undefined;

function entferneWidget(zustand: WidgetZustand): void {
  try {
    if (zustand.id) window.turnstile?.remove(zustand.id);
  } catch {
    // Ein bereits entferntes iframe darf weder den Seitenwechsel noch eine bestätigte Anfrage stören.
  }
  zustand.id = undefined;
  zustand.token = "";
}

/** Ohne gerendertes Widget wird diese Funktion nie aufgerufen: kein Schlüssel, kein Fremdrequest. */
function ladeTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (geladen) return geladen;

  geladen = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    const timer = window.setTimeout(fehler, 10_000);
    function fehler(): void {
      window.clearTimeout(timer);
      script.remove();
      geladen = undefined;
      reject(new Error("Sicherheitsprüfung nicht verfügbar"));
    }
    script.addEventListener("error", fehler, { once: true });
    script.addEventListener(
      "load",
      () => {
        window.clearTimeout(timer);
        if (window.turnstile) resolve(window.turnstile);
        else fehler();
      },
      { once: true },
    );
    document.head.append(script);
  });
  return geladen;
}

function meldung(element: HTMLElement, text: string, erneut = false): void {
  const status = element.querySelector<HTMLElement>("[data-turnstile-status]");
  const knopf = element.querySelector<HTMLButtonElement>("[data-turnstile-wiederholen]");
  if (status) {
    status.hidden = text === "";
    status.textContent = text;
  }
  if (knopf) knopf.hidden = !erneut;
}

function fehlerMelden(element: HTMLElement, zustand: WidgetZustand): void {
  zustand.token = "";
  meldung(
    element,
    formularUebersetzung(aktuelleSprache(element.dataset.sprache))("pruefungLadefehler"),
    true,
  );
}

async function startePruefung(element: HTMLElement, zustand: WidgetZustand): Promise<void> {
  if (zustand.startet) return;
  const konfiguration = turnstileKonfigurationSchema.safeParse({
    sitekey: element.dataset.sitekey,
    aktion: element.dataset.aktion,
    sprache: element.dataset.sprache,
  });
  const ziel = element.querySelector<HTMLElement>("[data-turnstile-widget]");
  if (!konfiguration.success || !ziel) {
    fehlerMelden(element, zustand);
    return;
  }
  zustand.startet = true;
  zustand.token = "";
  const t = formularUebersetzung(konfiguration.data.sprache);
  meldung(element, t("pruefungLaedt"));

  try {
    const api = await ladeTurnstile();
    if (!element.isConnected) return;
    if (zustand.id) {
      api.reset(zustand.id);
      return;
    }
    // Flexible Widgets sind mindestens 300px breit; schmale Formularkarten brauchen Compact.
    zustand.groesse = ziel.getBoundingClientRect().width < 300 ? "compact" : "flexible";
    const abgelaufen = (): void => {
      zustand.token = "";
      meldung(element, t("pruefungAbgelaufen"));
    };
    zustand.id = api.render(ziel, {
      sitekey: konfiguration.data.sitekey,
      action: konfiguration.data.aktion,
      language: konfiguration.data.sprache,
      theme: "light",
      size: zustand.groesse,
      "response-field": false,
      "refresh-expired": "auto",
      callback: (token) => {
        const geprueft = turnstileTokenSchema.safeParse(token);
        if (!geprueft.success) {
          fehlerMelden(element, zustand);
          return;
        }
        zustand.token = geprueft.data;
        meldung(element, "");
      },
      "error-callback": () => {
        fehlerMelden(element, zustand);
        return true;
      },
      "expired-callback": abgelaufen,
      "timeout-callback": () => fehlerMelden(element, zustand),
      "unsupported-callback": () => fehlerMelden(element, zustand),
    });
    if (!zustand.id) fehlerMelden(element, zustand);
  } catch {
    fehlerMelden(element, zustand);
  } finally {
    zustand.startet = false;
  }
}

export function initBotSchutz(): void {
  document.querySelectorAll<HTMLElement>("[data-turnstile]").forEach((element) => {
    if (widgets.has(element)) return;
    const zustand: WidgetZustand = { token: "", startet: false };
    widgets.set(element, zustand);
    element.querySelector("[data-turnstile-wiederholen]")?.addEventListener("click", () => {
      void startePruefung(element, zustand);
    });

    // Ein Wechsel zwischen Desktop und schmalem Mobilfenster darf das iframe nicht überlaufen lassen.
    if (typeof ResizeObserver !== "undefined") {
      zustand.beobachter = new ResizeObserver(() => {
        const breite = element.getBoundingClientRect().width;
        if (breite <= 0) return;
        const groesse = breite < 300 ? "compact" : "flexible";
        if (!zustand.id || groesse === zustand.groesse) return;
        entferneWidget(zustand);
        void startePruefung(element, zustand);
      });
      zustand.beobachter.observe(element);
    }
    void startePruefung(element, zustand);
  });
}

/** Tokens gelten nur einmal, auch wenn nach der Prüfung erst das Speichern fehlschlägt. */
export function leseBotSchutz(formular: HTMLFormElement): BotNachweis | undefined {
  const element = formular.querySelector<HTMLElement>("[data-turnstile]");
  if (!element) return undefined;
  return {
    token: widgets.get(element)?.token ?? "",
    nachVersuch: (erfolgreich) => {
      const zustand = widgets.get(element);
      if (!zustand) return;
      zustand.token = "";
      if (erfolgreich) {
        // Erfolgreiche Formulare werden ausgeblendet; dort keine neue Prüfung anfordern.
        zustand.beobachter?.disconnect();
        entferneWidget(zustand);
      } else {
        void startePruefung(element, zustand);
      }
    },
  };
}

export function entferneBotSchutz(): void {
  widgets.forEach((zustand) => {
    zustand.beobachter?.disconnect();
    entferneWidget(zustand);
  });
  widgets.clear();
}
