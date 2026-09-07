import { acceptedCategory, validConsent } from "vanilla-cookieconsent";

/** Abgelaufene Cookies und frühere Consent-Revisionen erlauben keine Ereignisse. */
export function hatEinwilligung(kategorie: "analytics" | "marketing"): boolean {
  return validConsent() && acceptedCategory(kategorie);
}
