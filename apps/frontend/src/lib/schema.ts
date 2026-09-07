import { SITE } from "@/data/site";
import { defaultLang, type Lang, languages } from "@/i18n/ui";
import { pfadFuerSprache } from "@/lib/seiten";

/**
 * schema.org-Bausteine für JSON-LD. Alle Werte stammen aus src/data/site.ts;
 * hier wird nichts erfunden und nichts abgeschrieben. Leere Felder (Kontakt,
 * sameAs, legalName) fallen weg statt als leere Strings im Graph zu stehen.
 * Organization und WebSite hängen über feste @id-Werte zusammen, damit
 * Suchmaschinen eine Entität erkennen. Keine Bewertungen, Preise oder
 * Verfügbarkeiten ohne belegte Daten auf der Seite.
 */
export interface BreadcrumbEintrag {
  name: string;
  /** Absolut oder relativ zur Origin, z. B. "/en/kontakt/". */
  url: string;
}

const ORGANISATION_ID = `${SITE.origin}/#organization`;
const WEBSITE_ID = `${SITE.origin}/#website`;

function absolut(url: string): string {
  return new URL(url, `${SITE.origin}/`).href;
}

function gesetzt(wert: unknown): boolean {
  if (typeof wert === "string") return wert.trim() !== "";
  if (Array.isArray(wert)) return wert.length > 0;
  return wert !== undefined && wert !== null;
}

function ohneLeere(objekt: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(objekt).filter(([, wert]) => gesetzt(wert)));
}

/** Postanschrift nur, wenn Straße, Ort und Land (ISO 3166-1 alpha-2) belegt sind. */
function postanschrift(): Record<string, unknown> | undefined {
  const { street, postalCode, locality, country } = SITE.contact.address;
  if (!gesetzt(street) || !gesetzt(locality) || !gesetzt(country)) return undefined;
  return ohneLeere({
    "@type": "PostalAddress",
    streetAddress: street,
    postalCode,
    addressLocality: locality,
    addressCountry: country,
  });
}

/** Der Betreiber der Website; die Startseite der Standardsprache ist seine URL. */
export function organizationSchema(lang: Lang): Record<string, unknown> {
  return ohneLeere({
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORGANISATION_ID,
    name: SITE.name,
    legalName: SITE.legalName,
    url: absolut(pfadFuerSprache(defaultLang, "/")),
    logo: absolut(SITE.logo),
    description: SITE.description[lang],
    email: SITE.contact.email,
    telephone: SITE.contact.phone,
    address: postanschrift(),
    sameAs: [...SITE.sameAs],
  });
}

/** Die Website als eigenes Objekt; publisher zeigt per @id auf die Organisation. */
export function websiteSchema(lang: Lang): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: SITE.name,
    url: absolut(pfadFuerSprache(lang, "/")),
    description: SITE.description[lang],
    inLanguage: Object.keys(languages),
    publisher: { "@id": ORGANISATION_ID },
  };
}

/** Brotkrümelpfad einer Unterseite; jede URL muss im Build existieren. */
export function breadcrumbSchema(eintraege: BreadcrumbEintrag[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: eintraege.map((eintrag, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: eintrag.name,
      item: absolut(eintrag.url),
    })),
  };
}
