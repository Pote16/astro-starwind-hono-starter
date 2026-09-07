# Cookies, Formularschutz, Mail und Tracking

Der Starter enthält eine lauffähige Formular-Demo und wiederverwendbare
Integrationshelfer. Alle Anbieter sind standardmäßig deaktiviert. Echte Schlüssel
liegen ausschließlich in der nicht eingecheckten Root-`.env`. Variablen mit
`PUBLIC_` sind öffentlich und werden beim Astro-Build in das Frontend übernommen.
Nach einer Änderung ist daher ein neuer Frontend-Build erforderlich.

## Lokale Demo

`bun run dev` startet Astro und Hono ohne Datenbank, Redis oder Anbieterkeys.
Deutsch liegt unter `/`, Englisch unter `/en/`. Das Formular verwendet Starwind
Input, Label, Button und Card. Es sendet JSON an `POST /api/users`.

`PUBLIC_API_URL` bleibt leer. Im Dev-Modus proxyt Vite `/api` an den Backend-Port
`PORT` aus der Root-Umgebung, standardmäßig 3005. In Produktion übernimmt Nginx
denselben Pfad. Bei anderem Frontend-Port dessen exakte Origin in
`FRONTEND_ORIGINS` ergänzen. Ein separat erreichbares Backend kann alternativ
über `PUBLIC_API_URL=https://api.example.org` konfiguriert werden.

Die Demo validiert Name, E-Mail und Sprache, antwortet aber nur mit einer
Bestätigung und den validierten Demowerten. Es gibt keine Speicherung, Anmeldung,
Mail oder Conversion. Bitte erfundene Testdaten verwenden. Der sechste Versuch
innerhalb einer Minute wird mit HTTP 429 abgelehnt. Honeypot-Treffer erhalten eine
unauffällige Erfolgsantwort, ohne die Anbieterprüfung oder einen echten Handler
aufzurufen. Ohne JavaScript bleibt Absenden deaktiviert; Eingaben landen nicht
versehentlich in einer GET-URL.

## Einwilligung und Browsertracking

`vanilla-cookieconsent` läuft im Opt-in-Modus. Die Sprache folgt dem Dokument.
Das Cookie `cc_cookie` speichert die Auswahl für 182 Tage. `necessary` ist
verpflichtend; `analytics` und `marketing` erscheinen nur, wenn entsprechende
Integrationen konfiguriert sind. Der Button mit `data-cookie-einstellungen`
öffnet die Einstellungen erneut.

| Variable                                         | Zweck                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------ |
| `PUBLIC_PRIVACY_URL_DE`, `PUBLIC_PRIVACY_URL_EN` | Eigene bestehende Datenschutzseiten, relativer Pfad oder HTTPS-URL |
| `PUBLIC_GA_MEASUREMENT_ID`                       | GA4-Browserziel, Format `G-…`, Kategorie Statistik                 |
| `PUBLIC_GOOGLE_ADS_ID`                           | Google-Ads-Browserziel, Format `AW-…`, Kategorie Marketing         |
| `PUBLIC_META_PIXEL_ID`                           | Öffentliche numerische Meta-Pixel-ID, Kategorie Marketing          |
| `PUBLIC_LINKEDIN_PARTNER_ID`                     | Öffentliche numerische Insight-Tag-Partner-ID, Kategorie Marketing |
| `PUBLIC_LI_CONVERSION_LEAD`                      | Numerische LinkedIn-Conversion-ID für `Lead`                       |
| `PUBLIC_LI_CONVERSION_CONTACT`                   | Numerische LinkedIn-Conversion-ID für `Contact`                    |
| `PUBLIC_LI_CONVERSION_COMPLETEREGISTRATION`      | Numerische LinkedIn-Conversion-ID für `CompleteRegistration`       |
| `PUBLIC_GA4_MP_ENABLED=true`                     | Statistik-Auswahl auch für reine GA4-Serverintegration anbieten    |
| `PUBLIC_META_CAPI_ENABLED=true`                  | Marketing-Auswahl auch ohne Browserpixel für Meta CAPI anbieten    |
| `PUBLIC_LINKEDIN_CAPI_ENABLED=true`              | Marketing-Auswahl auch ohne Insight-Tag für LinkedIn CAPI anbieten |

Die Server-Flags laden selbst keine Browserskripte. Sie müssen zur tatsächlichen
Serververwendung passen. Die Anbietertexte und Datenschutzerklärung für das
konkrete Projekt prüfen. Der Starter erfindet keine Datenschutzseite und enthält
keine allgemeingültige rechtliche Freigabe. Wenn Verarbeitung oder Empfänger
wesentlich geändert werden, `cookieKonfiguration.revision` in
`src/lib/tracking-konfiguration.ts` erhöhen, damit die Auswahl neu abgefragt wird.

Google startet mit Consent Mode v2 auf `denied`. Die Bibliothek lädt erst nach
Zustimmung zur jeweiligen Kategorie (Basic Consent Mode). Bei ausschließlich
Marketing wird kein GA4-Analyseziel konfiguriert. Meta erhält vor Einwilligung
weder `init` noch einen `PageView`; es gibt keinen LDU-Ersatz und kein Noscript-Pixel.
LinkedIn lädt ausschließlich nach Marketing-Einwilligung.

Eigene Ereignisse werden nach einem erfolgreichen, fachlich echten Vorgang
explizit eingebunden:

```ts
import { hatEinwilligung } from "@/scripts/einwilligung";
import { track } from "@/scripts/tracking";

// Bei Bedarf vor dem Request erzeugen und für Meta an Browser UND Server weitergeben.
const eventId = crypto.randomUUID();
const consent = {
  analytics: hatEinwilligung("analytics"),
  marketing: hatEinwilligung("marketing"),
};
// Eigenen API-Request mit Ereignis-ID und aktuell ermittelter Auswahl abschicken.
// Erst nach echter Erfolgsantwort:
track("Lead", { eventId });
```

Der Starter meldet keine Demo als Lead. Erlaubte Browserereignisse sind
`PageView`, `ViewContent`, `Lead`, `Contact` und `CompleteRegistration`.
Optionale Parameter sind UUID `eventId`, nichtnegativer `value` und
Dreibuchstaben-`currency`. Freie Formularfelder werden nicht übertragen.
Google-Ereignisse verwenden öffentliche Seitenpfade ohne Query und Fragment.
Ein Google-Ads-Ziel allein definiert noch keine konkrete Ads-Conversion-Aktion;
deren Import beziehungsweise Label muss im jeweiligen Projekt eingerichtet werden.

Beim Widerruf stoppen unsere eigenen Aufrufe, Google/Meta erhalten die passenden
Sperrsignale und erreichbare First-Party-Cookies werden gelöscht. Bereits gesendete
Daten werden dadurch nicht zurückgerufen. Geladene Drittanbieterskripte können
in der offenen Seite weiterlaufen; fremde Domain-Cookies sind nicht vollständig
löschbar. Nach einem neuen Seitenaufruf gilt die geänderte Auswahl auch für das
Laden der Bibliotheken. Der Starter verwirft dafür kein ausgefülltes Formular
mit einem erzwungenen Reload.

## Turnstile

Beide Variablen gemeinsam setzen:

```dotenv
PUBLIC_TURNSTILE_SITE_KEY=eigener-oeffentlicher-schluessel
TURNSTILE_SECRET_KEY=eigener-geheimer-schluessel
```

Die Beispielwerte sind keine funktionsfähigen Schlüssel. Sind beide Werte leer, findet kein Cloudflare-Request statt. Im Entwicklungsmodus
lädt ein gesetzter Sitekey das Widget auch ohne Secret; für eine echte
serverseitige Prüfung ist der Secret-Key ebenfalls notwendig. Eine halb konfigurierte Produktionsumgebung wird
vor dem Start abgelehnt. Den Sitekey beim Anbieter für die tatsächlichen Domains
freigeben und `FRONTEND_ORIGINS` passend setzen.

`BotSchutz.astro` lädt die explizite Turnstile-API nur auf Seiten mit konfiguriertem
Widget. Das Widget verwendet die Dokumentsprache und auf schmalen Karten die
kompakte Darstellung. Abgelaufene und nach einem Versuch verbrauchte Tokens
werden erneuert; Ladefehler bieten einen erneuten Versuch an.

Der Client sendet `turnstileToken` ausschließlich im JSON-Body. Die Middleware
prüft bei Cloudflare mit fünf Sekunden Timeout: Erfolg, exakten Hostnamen aus
`FRONTEND_ORIGINS` und die Aktion. Die Demo verwendet `create_user`; neue Formulare
müssen denselben Aktionswert in Komponente und Middleware verwenden.
Fehlende/ungültige Tokens ergeben HTTP 403, ein Ausfall des Prüfdiensts HTTP 503.
Ein Schlüssel im Browser allein ist kein Formularschutz.

Cloudflare bietet [offizielle Testschlüssel](https://developers.cloudflare.com/turnstile/troubleshooting/testing/).
Sie gehören nur in eine lokale Testkonfiguration, niemals in den Produktionsbetrieb.
Unsere automatisierten Tests verwenden injizierte Antworten und senden keine
echten Siteverify-Requests. Die Domainfreigabe und ein realer Token-Durchlauf
werden nach Bereitstellung der tatsächlichen Schlüssel geprüft.

## Resend

| Variable            | Zweck                                                                        |
| ------------------- | ---------------------------------------------------------------------------- |
| `RESEND_API_KEY`    | Geheimer API-Key                                                             |
| `RESEND_FROM_EMAIL` | Beim Anbieter verifizierte Absenderadresse, optional `Name <adresse@domain>` |
| `MAIL_RECIPIENT`    | Serverseitig festgelegter Standardempfänger                                  |

```ts
import { sendMail } from "../lib/mail.js";

// In einer echten Formularroute zuerst erfolgreich persistieren.
const result = await sendMail({
  subject: "Neue Kontaktanfrage",
  text: "Eine neue Anfrage wurde gespeichert.",
  fields: [{ label: "Referenz", value: gespeicherteAnfrage.id }],
  replyTo: validierteAnfrage.email,
});
```

`sendMail` validiert Eingaben und Empfänger und maskiert HTML. Ein optionales `to`
ist ausschließlich für serverseitig kontrollierte Empfänger vorgesehen. Niemals
eine frei wählbare Formularadresse als Empfänger durchreichen und dadurch einen
Mail-Relay bauen. Der Starter stellt keinen Mail-Endpunkt bereit.

Rückgabe: `sent` mit Anbieter-ID, `skipped` bei fehlender Konfiguration oder
`failed` mit festem Fehlergrund. `skipped` ist kein Versandnachweis, `sent` bestätigt
die Annahme beim Anbieter und keine Zustellung im Postfach. Logs enthalten keine
E-Mail-Adressen, Mailtexte oder zurückgespiegelten Anbieterfehler. Für Tests lässt
sich `createMailSender({ send })` mit einem eigenen Sender aufrufen.

## Serverseitige Conversions

| Dienst                   | Servervariablen                                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| GA4 Measurement Protocol | `GA4_MEASUREMENT_ID`, `GA4_MP_API_SECRET`                                                                      |
| Meta CAPI                | `META_PIXEL_ID`, `META_ACCESS_TOKEN`; optional `META_API_VERSION` (Default `v25.0`) und `META_TEST_EVENT_CODE` |
| LinkedIn CAPI            | `LINKEDIN_API_TOKEN`, `LINKEDIN_CONVERSION_ID`; optional `LINKEDIN_API_VERSION` (Default `202608`)             |

Die Helfer `sendGa4Event`, `sendMetaConversion` und `sendLinkedInConversion`
verlangen zusätzlich zum Ereignis einen Callback für die **aktuelle** Einwilligung.
Die Einwilligung wird beim Eintritt und unmittelbar vor dem HTTP-Aufruf geprüft.

```ts
import { sendMetaConversion } from "../lib/meta-capi.js";

// In einer echten Route: Request mit Zod prüfen und fachlich erfolgreich speichern.
const currentConsent = () => ({
  analytics: validierterRequest.analyticsConsent === true,
  marketing: validierterRequest.marketingConsent === true,
});
await sendMetaConversion(
  {
    eventName: "Lead",
    eventId: validierterRequest.eventId,
    eventSourceUrl: "https://eigene-domain.example/kontakt/",
    email: validierterRequest.email,
  },
  currentConsent,
);
```

Der Demo-Request enthält bewusst keine Trackingfelder. Diese bei einem echten
Formular explizit in dessen Schema aufnehmen, niemals pauschal unbekannte Felder
weiterreichen. Einwilligungen unmittelbar vor dem Request aus dem Browser lesen.
Gespeicherte Anmelde-Snapshots, spätere Double-Opt-in-Links oder Hintergrundjobs
sind kein verlässlicher aktueller Einwilligungszustand. Ein Callback kann einen
Widerruf auf einem anderen Gerät nicht selbst erkennen.

GA4 benötigt eine echte zugehörige `clientId`, keine erfundene ID. `sessionId`
und `engagementTimeMs` nur aus tatsächlichen Messwerten übernehmen; ohne diese
ist Echtzeit-/Sessionzuordnung eingeschränkt. `toGa4EventName("Lead")` liefert
`generate_lead`. Für allgemeine GA4-Ereignisse Browser **oder** Server auswählen:
Eine gemeinsame `event_id` garantiert hier keine Deduplizierung. Kein
`transaction_id` für Leads erfinden. Bei Meta dagegen dasselbe Ereignis mit
identischem `eventName` und `eventId` in Browser und CAPI senden, wenn beide Wege
bewusst verwendet werden. LinkedIn-Conversion-ID und Ereignis-ID müssen zur
konfigurierten Aktion passen.

Meta-Kontaktfelder und LinkedIn-E-Mail-Adressen werden normalisiert und nach
Anbietervorgabe gehasht. LinkedIn erhält optionale Vor-/Nachnamen und Firmenangaben
im Klartext. Hashes bleiben personenbezogene Daten; beide Wege setzen
Marketing-Einwilligung voraus. Nicht benötigte Namen, Telefonnummern, IPs oder User-Agents weglassen.
URL-Query und Fragment werden entfernt. Es gibt keinen öffentlichen generischen
Tracking-Endpunkt. Fehler, Providerantworten und API-Secrets landen nicht im Log.

Alle Sender liefern `sent`, `skipped` oder `failed`. HTTP-Annahme allein garantiert
keine Verarbeitung oder Attribution. Die Factory-Varianten erlauben `{env, fetch}`
für isolierte Tests. GA4-, Meta- und LinkedIn-Debugging im jeweiligen Anbieterportal
folgt nach Konfiguration echter IDs; der Starter verspricht keine getesteten
Live-Conversions.

## Prüfen

```bash
bun test
bun run lint
bun run typecheck
bun run format:check
bun run build
```

Die Tests prüfen Consent-Matrix und Revision, fehlende Keys, Event-Parameter,
Turnstile-Aktion/Host/Timeout, Honeypot, Rate-Limits, Mail-Escaping und die
Server-Consent-Sperren mit lokalen Mocks. Anbieter-IDs und Zugangsdaten im
Testcode sind erfunden. Echte Mails oder Conversions werden nicht gesendet.

Offizielle Referenzen:

- [CookieConsent-Konfiguration](https://cookieconsent.orestbida.com/reference/configuration-reference.html)
- [Google Consent Mode](https://developers.google.com/tag-platform/security/concepts/consent-mode)
- [GA4 Measurement Protocol](https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference)
- [Turnstile serverseitig validieren](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Resend mit Bun](https://resend.com/docs/send-with-bun)
- [LinkedIn Conversions API](https://learn.microsoft.com/en-us/linkedin/marketing/integrations/ads-reporting/conversions-api)
