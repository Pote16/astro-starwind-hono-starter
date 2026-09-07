import { createHash } from "node:crypto";

import { logger } from "@ho-setup/logger";

import { type TrackingConsent, trackingConsentSchema } from "../schemas/tracking.schema.js";

/** Aktuellen Request-/Browserzustand lesen, niemals einen gespeicherten Anmelde-Snapshot.
 * Der Callback kann einen späteren Widerruf auf einem anderen Gerät nicht selbst erkennen. */
export type CurrentTrackingConsent = () => unknown;
export type TrackingFetch = (url: string, init: RequestInit) => Promise<Response>;
export interface TrackingOptions {
  env?: Record<string, string | undefined>;
  fetch?: TrackingFetch;
}
export type TrackingResult =
  // Nur vom HTTP-Endpunkt angenommen; keine Zusage über Attribution oder GA-Verarbeitung.
  | { status: "sent" }
  | {
      status: "skipped";
      reason:
        | "consent_required"
        | "missing_config"
        | "invalid_config"
        | "invalid_event"
        | "missing_user_data";
    }
  | { status: "failed"; reason: "upstream_error" | "network_error"; statusCode?: number };

export function readCurrentConsent(
  currentConsent: CurrentTrackingConsent,
): TrackingConsent | undefined {
  try {
    const parsed = trackingConsentSchema.safeParse(currentConsent());
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export function hashContact(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Interner gemeinsamer Versandweg: auch hier unmittelbar vor fetch erneut sperren. */
export async function postTracking(
  provider: "ga4" | "meta" | "linkedin",
  category: keyof TrackingConsent,
  currentConsent: CurrentTrackingConsent,
  url: string,
  payload: (consent: TrackingConsent) => unknown,
  options: TrackingOptions,
  headers: Record<string, string> = {},
): Promise<TrackingResult> {
  const consent = readCurrentConsent(currentConsent);
  if (consent?.[category] !== true) return { status: "skipped", reason: "consent_required" };
  try {
    const response = await (options.fetch ?? fetch)(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(payload(consent)),
      signal: AbortSignal.timeout(5_000),
      redirect: "error",
    });
    // Anbieterfehler können Kontaktdaten und Tokens spiegeln. Body nie lesen oder loggen.
    void response.body?.cancel().catch(() => {});
    if (!response.ok) {
      logger.warn({ provider, status: response.status }, "Tracking-Anbieter lehnt Request ab");
      return { status: "failed", reason: "upstream_error", statusCode: response.status };
    }
    return { status: "sent" };
  } catch {
    // Auch Fetch-Fehler können die URL inklusive API-Secret enthalten.
    logger.warn({ provider }, "Tracking-Anbieter nicht erreichbar");
    return { status: "failed", reason: "network_error" };
  }
}

const eventMapping = new Map<string, string>([
  ["PageView", "page_view"],
  ["ViewContent", "view_item"],
  ["Lead", "generate_lead"],
  ["Contact", "contact"],
  ["CompleteRegistration", "sign_up"],
]);

/** Für GA bewusst Browser ODER Server wählen; event_id dedupliziert keine allgemeinen Events. */
export function toGa4EventName(name: string): string {
  return eventMapping.get(name) ?? name;
}
