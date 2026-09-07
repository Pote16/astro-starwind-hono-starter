import { trackingKonfiguration } from "../lib/tracking-konfiguration";
import { hatEinwilligung } from "./einwilligung";

const konfigurierteZiele = new Set<string>();
const scriptId = "google-tag-script";

export function erlaubteGoogleZiele(): string[] {
  const ziele: string[] = [];
  if (trackingKonfiguration.googleAnalytics && hatEinwilligung("analytics"))
    ziele.push(trackingKonfiguration.googleAnalytics);
  if (trackingKonfiguration.googleAds && hatEinwilligung("marketing"))
    ziele.push(trackingKonfiguration.googleAds);
  return ziele;
}

/** Keine Queryparameter, Fragmente, Referrer oder Seitentitel aus Nutzereingaben. */
export function googleSeitenParameter(): { page_location: string; page_referrer: string } {
  return { page_location: window.location.origin + window.location.pathname, page_referrer: "" };
}

/** Basic Consent Mode: kein Bibliotheksabruf vor der passenden Zustimmung. */
export function aktiviereGoogleTags(): void {
  const ziele = erlaubteGoogleZiele();
  const erstesZiel = ziele[0];
  if (!erstesZiel || typeof window.gtag !== "function") return;
  const mussLaden = !document.getElementById(scriptId);
  if (mussLaden) window.gtag("js", new Date());
  for (const ziel of ziele) {
    if (konfigurierteZiele.has(ziel)) continue;
    window.gtag("config", ziel, { send_page_view: false, ...googleSeitenParameter() });
    window.gtag("event", "page_view", { send_to: [ziel], ...googleSeitenParameter() });
    konfigurierteZiele.add(ziel);
  }
  if (mussLaden) {
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(erstesZiel)}`;
    script.async = true;
    document.head.appendChild(script);
  }
}
