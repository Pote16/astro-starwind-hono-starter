import { z } from "astro/zod";

import { formularUebersetzung } from "../i18n/formular";
import { getLangFromLocale } from "../i18n/utils";
import { leseApiOrigin } from "../lib/api-konfiguration";
import { leseBotSchutz } from "./turnstile";

const formularSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().max(254).pipe(z.email()),
  website: z.string().max(500),
  language: z.enum(["de", "en"]),
  turnstileToken: z.string().max(2048).optional(),
});
const antwortSchema = z.object({ success: z.literal(true) });
const api = leseApiOrigin(import.meta.env.PUBLIC_API_URL ?? "");
const gebunden = new WeakSet<HTMLFormElement>();

function initFormulare(): void {
  document.querySelectorAll<HTMLFormElement>("[data-demo-form]").forEach((form) => {
    if (gebunden.has(form)) return;
    gebunden.add(form);
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    const status = form.querySelector<HTMLElement>("[data-form-status]");
    if (!button || !status) return;
    const sperren = (wert: boolean): void => {
      button.disabled = wert;
      // Starwind rendert beide Zustände; beim Aktivieren auch sein Styling-Attribut entfernen.
      button.toggleAttribute("data-disabled", wert);
    };
    const sprache = getLangFromLocale(form.dataset.language);
    const t = formularUebersetzung(sprache);
    const melden = (text: string): void => {
      status.hidden = false;
      status.textContent = text;
    };
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (button.disabled || !form.reportValidity()) return;
      if (!api.success) {
        melden(t("fehlgeschlagen"));
        return;
      }
      const bot = leseBotSchutz(form);
      if (bot && !bot.token) {
        melden(t("pruefungFehlt"));
        return;
      }
      const data = new FormData(form);
      const geprueft = formularSchema.safeParse({
        name: data.get("name"),
        email: data.get("email"),
        website: data.get("website") ?? "",
        language: sprache,
        turnstileToken: bot?.token,
      });
      if (!geprueft.success) {
        melden(t("eingabenPruefen"));
        return;
      }
      sperren(true);
      button.textContent = t("sendet");
      status.hidden = true;
      try {
        const antwort = await fetch(`${api.data}/api/users`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(geprueft.data),
          signal: AbortSignal.timeout(10000),
        });
        if (!antwort.ok) {
          melden(
            t(
              antwort.status === 429
                ? "rateLimit"
                : antwort.status === 403
                  ? "pruefungLadefehler"
                  : antwort.status === 400
                    ? "eingabenPruefen"
                    : "fehlgeschlagen",
            ),
          );
          return;
        }
        const ergebnis = antwortSchema.safeParse(await antwort.json());
        if (!ergebnis.success) {
          melden(t("fehlgeschlagen"));
          return;
        }
        melden(t("erfolgreich"));
        // Die Demo bleibt wiederholbar. Sie ist keine Anmeldung oder Werbe-Conversion.
        form.reset();
      } catch {
        melden(t("fehlgeschlagen"));
      } finally {
        // Auch ein nachgelagerter Fehler kann den Einmaltoken bereits verbraucht haben.
        bot?.nachVersuch(false);
        sperren(false);
        button.textContent = t("senden");
      }
    });
    // Ohne gebundenen Handler darf kein Browser-GET Formulardaten in die URL schreiben.
    sperren(false);
  });
}
initFormulare();
document.addEventListener("astro:after-swap", initFormulare);
