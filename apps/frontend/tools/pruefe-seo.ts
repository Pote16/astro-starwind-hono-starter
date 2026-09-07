/**
 * Statisches SEO-Gate für den fertigen Astro-Build: liest ausschließlich das
 * Build-Verzeichnis, kein Browser, kein Netz. Läuft im Deploy gegen dist.new
 * (scripts/deploy-audits.sh), in CI nach dem Build (bun run audit:seo) und in
 * tools/pruefe-seo.test.ts gegen Fixtures und einen frischen Build.
 *
 * Aufruf: bun tools/pruefe-seo.ts [--dist <verzeichnis>] [--bericht <datei>]
 * Bericht: <projektroot>/.deploy/seo-audit.json. Exit 1 bei Befunden.
 *
 * Geprüfte Regeln (Kennung in eckigen Klammern): siehe docs/seo.md.
 */
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { defaultLang, type Lang, languages } from "../src/i18n/ui";
import { pfadFuerSprache, seitenKennung, spracheAusPfad } from "../src/lib/seiten";
import { buildVerzeichnisAusArgumenten } from "./build-verzeichnis";

export interface Befund {
  seite: string;
  pruefung: string;
  meldung: string;
}

export interface Ergebnis {
  zeitpunkt: string;
  buildVerzeichnis: string;
  origin: string | undefined;
  erfolgreich: boolean;
  statistik: {
    seiten: number;
    indexierbar: number;
    bilder: number;
    sitemapUrls: number;
    befunde: number;
  };
  seiten: {
    pfad: string;
    titel: string | undefined;
    noindex: boolean;
    h1: number;
    bilder: number;
    jsonLd: number;
  }[];
  befunde: Befund[];
}

export interface Optionen {
  /** Build-Verzeichnis als file:-URL mit Endslash. */
  dist: URL;
  /** Pfad des JSON-Berichts. */
  bericht: string;
  /** Erwartete Origin (PUBLIC_SITE_URL der Deploy-Umgebung), falls bekannt. */
  erwarteteOrigin?: string | undefined;
}

interface Verweis {
  url: string;
  art: "href" | "img src" | "srcset" | "icon" | "manifest" | "font-preload";
}
interface Sprachverweis {
  sprache: string;
  url: string;
}
interface Bild {
  src: string | null;
  alt: string | null;
  breite: string | null;
  hoehe: string | null;
  fetchpriority: string | null;
  loading: string | null;
}
interface Seite {
  datei: string;
  pfad: string;
  sprache: string | null;
  titel: string[];
  beschreibungen: string[];
  kanonisch: string[];
  robots: string[];
  viewport: string[];
  ogUrl: string[];
  ogBild: string[];
  noindex: boolean;
  h1: number;
  ids: Set<string>;
  verweise: Verweis[];
  sprachverweise: Sprachverweis[];
  bilder: Bild[];
  jsonLd: string[];
  fontPreloads: { href: string; crossorigin: boolean }[];
}

const SPRACHEN = Object.keys(languages) as Lang[];
const LOKALE_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const bereinigt = (text: string): string => text.replace(/\s+/g, " ").trim();

function entitaeten(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseUrl(wert: string, basis?: string): URL | undefined {
  try {
    return new URL(wert, basis);
  } catch {
    return undefined;
  }
}

/** Kommas in Daten-URLs gehören zur URL, nicht zum Trenner zwischen Kandidaten. */
function srcsetAdressen(text: string): string[] {
  const adressen: string[] = [];
  let stelle = 0;
  while (stelle < text.length) {
    while (/[\s,]/.test(text[stelle] ?? "") && stelle < text.length) stelle++;
    const anfang = stelle;
    while (stelle < text.length && !/\s/.test(text[stelle] ?? "")) stelle++;
    const token = text.slice(anfang, stelle);
    if (!token) break;
    adressen.push(token.replace(/,+$/, ""));
    if (token.endsWith(",")) continue;
    let klammern = 0;
    while (stelle < text.length) {
      const zeichen = text[stelle++];
      if (zeichen === "(") klammern++;
      if (zeichen === ")") klammern--;
      if (zeichen === "," && klammern === 0) break;
    }
  }
  return adressen;
}

/** URL-Pfad einer Build-Datei: "en/index.html" → "/en/", "404.html" → "/404.html". */
function pfadAusDatei(datei: string): string {
  return datei.endsWith("index.html") ? `/${datei.slice(0, -"index.html".length)}` : `/${datei}`;
}

function parseSeite(datei: string, html: string): Seite {
  const seite: Seite = {
    datei,
    pfad: pfadAusDatei(datei),
    sprache: null,
    titel: [],
    beschreibungen: [],
    kanonisch: [],
    robots: [],
    viewport: [],
    ogUrl: [],
    ogBild: [],
    noindex: false,
    h1: 0,
    ids: new Set(),
    verweise: [],
    sprachverweise: [],
    bilder: [],
    jsonLd: [],
    fontPreloads: [],
  };
  new HTMLRewriter()
    .on("html", {
      element: (element) => {
        seite.sprache = element.getAttribute("lang");
      },
    })
    .on("h1", {
      element: () => {
        seite.h1++;
      },
    })
    .on("[id]", {
      element: (element) => {
        seite.ids.add(element.getAttribute("id") ?? "");
      },
    })
    .on("a[name]", {
      element: (element) => {
        seite.ids.add(element.getAttribute("name") ?? "");
      },
    })
    .on("head title", {
      element: () => {
        seite.titel.push("");
      },
      text: (text) => {
        seite.titel[seite.titel.length - 1] += text.text;
      },
    })
    .on("meta", {
      element: (element) => {
        const name = element.getAttribute("name")?.toLowerCase();
        const property = element.getAttribute("property")?.toLowerCase();
        const inhalt = element.getAttribute("content") ?? "";
        if (name === "description") seite.beschreibungen.push(inhalt);
        if (name === "viewport") seite.viewport.push(inhalt);
        if (name === "robots") seite.robots.push(inhalt);
        if ((name === "robots" || name === "googlebot") && /\bnoindex\b/i.test(inhalt))
          seite.noindex = true;
        if (property === "og:url") seite.ogUrl.push(inhalt);
        if (property === "og:image") seite.ogBild.push(inhalt);
      },
    })
    .on("link", {
      element: (element) => {
        const rel = (element.getAttribute("rel") ?? "").toLowerCase().split(/\s+/);
        const url = element.getAttribute("href") ?? "";
        if (rel.includes("canonical")) seite.kanonisch.push(url);
        if (rel.includes("alternate") && element.hasAttribute("hreflang"))
          seite.sprachverweise.push({ sprache: element.getAttribute("hreflang") ?? "", url });
        if (rel.includes("preload") && element.getAttribute("as") === "font")
          seite.fontPreloads.push({ href: url, crossorigin: element.hasAttribute("crossorigin") });
        const art: Verweis["art"] =
          rel.includes("icon") || rel.includes("apple-touch-icon")
            ? "icon"
            : rel.includes("manifest")
              ? "manifest"
              : rel.includes("preload") && element.getAttribute("as") === "font"
                ? "font-preload"
                : "href";
        if (url) seite.verweise.push({ url, art });
      },
    })
    .on("a[href], area[href]", {
      element: (element) => {
        seite.verweise.push({ url: element.getAttribute("href") ?? "", art: "href" });
      },
    })
    .on("img", {
      element: (element) => {
        const bild: Bild = {
          src: element.getAttribute("src"),
          alt: element.getAttribute("alt"),
          breite: element.getAttribute("width"),
          hoehe: element.getAttribute("height"),
          fetchpriority: element.getAttribute("fetchpriority"),
          loading: element.getAttribute("loading"),
        };
        seite.bilder.push(bild);
        if (bild.src) seite.verweise.push({ url: bild.src, art: "img src" });
      },
    })
    .on("img[srcset], source[srcset]", {
      element: (element) => {
        for (const url of srcsetAdressen(element.getAttribute("srcset") ?? ""))
          seite.verweise.push({ url, art: "srcset" });
      },
    })
    .on('script[type="application/ld+json"]', {
      element: () => {
        seite.jsonLd.push("");
      },
      text: (text) => {
        seite.jsonLd[seite.jsonLd.length - 1] += text.text;
      },
    })
    .transform(html);
  seite.titel = seite.titel.map((wert) => bereinigt(entitaeten(wert)));
  seite.beschreibungen = seite.beschreibungen.map((wert) => bereinigt(entitaeten(wert)));
  return seite;
}

function hatInStock(wert: unknown): boolean {
  if (typeof wert === "string") return /^(https?:\/\/schema\.org\/)?InStock$/.test(wert);
  if (Array.isArray(wert)) return wert.some((eintrag: unknown) => hatInStock(eintrag));
  if (wert && typeof wert === "object") return Object.values(wert).some(hatInStock);
  return false;
}

function istObjekt(wert: unknown): wert is Record<string, unknown> {
  return typeof wert === "object" && wert !== null && !Array.isArray(wert);
}

interface SitemapEintrag {
  loc: string;
  links: Sprachverweis[];
}

/** Sitemaps sind maschinell erzeugtes XML; ein Regex-Leser reicht und braucht keinen HTML-Parser. */
function parseSitemap(xml: string): { index: boolean; eintraege: SitemapEintrag[] } {
  const index = /<sitemapindex[\s>]/.test(xml);
  const blockRegex = index ? /<sitemap>([\s\S]*?)<\/sitemap>/g : /<url>([\s\S]*?)<\/url>/g;
  const eintraege: SitemapEintrag[] = [];
  for (const [, block = ""] of xml.matchAll(blockRegex)) {
    const loc = /<loc>([\s\S]*?)<\/loc>/.exec(block)?.[1] ?? "";
    const links = [...block.matchAll(/<xhtml:link\b([^>]*?)\/?>/g)].map(([, attribute = ""]) => ({
      sprache: /\bhreflang="([^"]*)"/.exec(attribute)?.[1] ?? "",
      url: entitaeten(/\bhref="([^"]*)"/.exec(attribute)?.[1] ?? ""),
    }));
    eintraege.push({ loc: bereinigt(entitaeten(loc)), links });
  }
  return { index, eintraege };
}

export async function pruefeBuild(optionen: Optionen): Promise<Ergebnis> {
  const buildVerzeichnis = fileURLToPath(optionen.dist);
  const befunde: Befund[] = [];
  const melde = (seite: string, pruefung: string, meldung: string): void => {
    befunde.push({ seite, pruefung, meldung });
  };
  const lies = (datei: string): Promise<string> => Bun.file(join(buildVerzeichnis, datei)).text();

  const dateien = new Set<string>();
  for await (const datei of new Bun.Glob("**/*").scan({ cwd: buildVerzeichnis, onlyFiles: true }))
    dateien.add(datei.replaceAll("\\", "/"));
  const htmlDateien = [...dateien].filter((pfad) => pfad.endsWith(".html")).sort();
  const seiten = await Promise.all(
    htmlDateien.map(async (pfad) => parseSeite(pfad, await lies(pfad))),
  );
  const nachDatei = new Map(seiten.map((seite) => [seite.datei, seite]));
  const nachPfad = new Map(seiten.map((seite) => [seite.pfad, seite]));

  if (!seiten.length) melde("dist", "build", "Keine HTML-Seiten im Build gefunden.");
  for (const sprache of SPRACHEN) {
    const start = pfadFuerSprache(sprache, "/");
    if (!nachPfad.has(start)) melde(start, "sprache", "Die Sprachstartseite fehlt im Build.");
  }

  // Die Origin kommt aus dem Canonical der Startseite (= PUBLIC_SITE_URL beim Build).
  const startseite = nachPfad.get("/");
  const startKanonisch = parseUrl(startseite?.kanonisch[0] ?? "");
  const origin = startKanonisch?.origin;
  if (!origin) {
    melde("/", "origin", "Kein absoluter Canonical auf der Startseite; Origin nicht bestimmbar.");
  } else {
    if (startKanonisch.protocol !== "https:" && !LOKALE_HOSTS.has(startKanonisch.hostname))
      melde("/", "origin-https", `Produktions-Origin muss https sein, gefunden: ${origin}.`);
    const erwartet = optionen.erwarteteOrigin?.trim().replace(/\/$/, "");
    if (erwartet && erwartet !== origin)
      melde(
        "/",
        "origin-umgebung",
        `Build-Origin ${origin} weicht von PUBLIC_SITE_URL ${erwartet} ab (Build mit alter Umgebung?).`,
      );
  }

  /** Löst URL-Pfade ausschließlich im inventarisierten Build auf. */
  function zielDatei(url: URL): string | undefined {
    let pfad: string;
    try {
      pfad = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    } catch {
      return undefined;
    }
    return [pfad, `${pfad.replace(/\/$/, "")}/index.html`.replace(/^\//, ""), `${pfad}.html`].find(
      (kandidat) => dateien.has(kandidat),
    );
  }

  const titelFundstellen = new Map<string, string>();
  const beschreibungFundstellen = new Map<string, string>();
  for (const seite of seiten) {
    if (seite.datei !== "404.html" && !seite.datei.endsWith("index.html"))
      melde(
        seite.pfad,
        "seitenpfad",
        `HTML-Datei außerhalb der Verzeichnisform (trailingSlash "always"): ${seite.datei}.`,
      );
    const locale = spracheAusPfad(seite.pfad);
    if (seite.sprache !== locale)
      melde(
        seite.pfad,
        "html-lang",
        `Erwartet ${locale}, gefunden ${seite.sprache ?? "kein lang"}.`,
      );
    if (seite.h1 !== 1) melde(seite.pfad, "h1", `Genau eine H1 erwartet, gefunden: ${seite.h1}.`);
    for (const [name, werte, gesehen] of [
      ["title", seite.titel, titelFundstellen],
      ["description", seite.beschreibungen, beschreibungFundstellen],
    ] as const) {
      if (werte.length !== 1 || !werte[0])
        melde(seite.pfad, name, `Genau ein nichtleerer Wert erwartet, gefunden: ${werte.length}.`);
      for (const wert of werte) {
        const schluessel = wert.toLocaleLowerCase();
        const vorher = gesehen.get(schluessel);
        if (wert && vorher) melde(seite.pfad, name, `Identisch mit ${vorher}: ${wert}`);
        if (wert) gesehen.set(schluessel, seite.pfad);
      }
    }
    if (seite.viewport.length !== 1)
      melde(
        seite.pfad,
        "viewport",
        `Genau ein Viewport-Meta erwartet, gefunden: ${seite.viewport.length}.`,
      );
    else if (
      !/\bwidth\s*=\s*device-width\b/.test(seite.viewport[0] ?? "") ||
      !/\binitial-scale\s*=\s*1(\.0)?\b/.test(seite.viewport[0] ?? "")
    )
      melde(
        seite.pfad,
        "viewport",
        `width=device-width und initial-scale=1 erwartet: ${seite.viewport[0]}`,
      );
    if (seite.robots.length !== 1)
      melde(
        seite.pfad,
        "robots-meta",
        `Genau ein robots-Meta erwartet, gefunden: ${seite.robots.length}.`,
      );

    if (seite.noindex) {
      if (seite.kanonisch.length)
        melde(seite.pfad, "canonical-noindex", "noindex-Seiten tragen keinen Canonical.");
      if (seite.sprachverweise.length)
        melde(seite.pfad, "hreflang-noindex", "noindex-Seiten tragen keine hreflang-Alternativen.");
    } else if (origin) {
      const canonical = parseUrl(seite.kanonisch[0] ?? "");
      if (seite.kanonisch.length !== 1 || !canonical || canonical.href !== `${origin}${seite.pfad}`)
        melde(
          seite.pfad,
          "canonical",
          `Absoluter, selbstreferenzierender Canonical ${origin}${seite.pfad} erwartet; gefunden: ${seite.kanonisch.join(", ") || "keiner"}.`,
        );
      if (seite.ogUrl.length !== 1 || seite.ogUrl[0] !== `${origin}${seite.pfad}`)
        melde(
          seite.pfad,
          "og-url",
          `og:url muss dem Canonical entsprechen; gefunden: ${seite.ogUrl.join(", ") || "keiner"}.`,
        );
    }
    for (const [index, wert] of seite.ogBild.entries()) {
      const url = parseUrl(wert);
      if (!url || url.origin !== origin)
        melde(
          seite.pfad,
          "og-image",
          `og:image ${index + 1} muss absolut auf der eigenen Origin liegen: ${wert}`,
        );
      else if (!zielDatei(url))
        melde(seite.pfad, "og-image", `og:image ${index + 1} fehlt im Build: ${url.pathname}`);
    }
    if (!seite.ogBild.length) melde(seite.pfad, "og-image", "og:image fehlt.");

    for (const [index, bild] of seite.bilder.entries()) {
      const kontext = `Bild ${index + 1} (${bild.src ?? "ohne src"})`;
      if (bild.alt === null)
        melde(
          seite.pfad,
          "bild-alt",
          `${kontext}: alt fehlt (leeres alt ist für dekorative Bilder erlaubt).`,
        );
      if (!bild.src) melde(seite.pfad, "bild-src", `${kontext}: src fehlt oder ist leer.`);
      if (!/^[1-9]\d*$/.test(bild.breite ?? "") || !/^[1-9]\d*$/.test(bild.hoehe ?? ""))
        melde(seite.pfad, "bild-masse", `${kontext}: positive width/height fehlen.`);
      if (bild.fetchpriority === "high" && bild.loading !== "eager")
        melde(
          seite.pfad,
          "bild-prioritaet",
          `${kontext}: fetchpriority=high verlangt loading=eager.`,
        );
    }
    const eilig = seite.bilder.filter((bild) => bild.fetchpriority === "high").length;
    if (eilig > 1)
      melde(
        seite.pfad,
        "bild-prioritaet",
        `Höchstens ein Bild mit fetchpriority=high (LCP), gefunden: ${eilig}.`,
      );

    if (seite.fontPreloads.length > 1)
      melde(
        seite.pfad,
        "font-preload",
        `Höchstens ein Font-Preload, gefunden: ${seite.fontPreloads.length}.`,
      );
    for (const preload of seite.fontPreloads)
      if (!preload.crossorigin)
        melde(seite.pfad, "font-preload", `Font-Preload ${preload.href} braucht crossorigin.`);

    if (origin) {
      const doppelte = new Set<string>();
      for (const verweis of seite.verweise) {
        const url = parseUrl(verweis.url, `${origin}${seite.pfad}`);
        if (!url) {
          melde(seite.pfad, "link-url", `Ungültige URL: ${verweis.url}`);
          continue;
        }
        if (!["https:", "http:"].includes(url.protocol) || url.origin !== origin) continue;
        const schluessel = `${verweis.art} ${url.href}`;
        if (doppelte.has(schluessel)) continue;
        doppelte.add(schluessel);
        const ziel = zielDatei(url);
        const code =
          verweis.art === "icon" || verweis.art === "manifest" || verweis.art === "font-preload"
            ? verweis.art
            : "link-ziel";
        if (!ziel) {
          melde(seite.pfad, code, `${verweis.art}: ${url.pathname} fehlt im Build.`);
          continue;
        }
        if (ziel.endsWith("index.html") && !url.pathname.endsWith("/"))
          melde(
            seite.pfad,
            "link-slash",
            `${verweis.art}: ${url.pathname} ohne Endslash (Nginx antwortet mit 301).`,
          );
        if (!url.hash || url.hash === "#" || url.hash.startsWith("#:~:text=")) continue;
        const zielSeite = nachDatei.get(ziel);
        if (!zielSeite) continue;
        let anker: string;
        try {
          anker = decodeURIComponent(url.hash.slice(1).split(":~:text=")[0] ?? "");
        } catch {
          melde(seite.pfad, "link-anker", `Ungültig kodierter Anker: ${url.href}`);
          continue;
        }
        if (anker && !zielSeite.ids.has(anker))
          melde(seite.pfad, "link-anker", `${url.pathname} besitzt keinen Anker #${anker}.`);
      }
    }

    for (const [index, block] of seite.jsonLd.entries()) {
      let wert: unknown;
      try {
        wert = JSON.parse(block);
      } catch {
        melde(seite.pfad, "json-ld", `Block ${index + 1} enthält ungültiges JSON.`);
        continue;
      }
      const objekte = Array.isArray(wert) ? wert : [wert];
      for (const objekt of objekte) {
        if (!istObjekt(objekt)) {
          melde(seite.pfad, "json-ld", `Block ${index + 1} ist kein Objekt.`);
          continue;
        }
        if (typeof objekt["@context"] !== "string" || !objekt["@type"])
          melde(seite.pfad, "json-ld-typ", `Block ${index + 1} ohne @context/@type.`);
        if (objekt["@type"] === "BreadcrumbList" && origin) {
          const elemente = Array.isArray(objekt.itemListElement) ? objekt.itemListElement : [];
          for (const element of elemente) {
            const item: unknown = istObjekt(element) ? element.item : undefined;
            const adresse =
              typeof item === "string" ? item : istObjekt(item) ? item["@id"] : undefined;
            const url = typeof adresse === "string" ? parseUrl(adresse) : undefined;
            if (!url || url.origin !== origin || !zielDatei(url))
              melde(
                seite.pfad,
                "json-ld-breadcrumb",
                `Brotkrümel-URL fehlt im Build oder ist fremd: ${String(adresse)}`,
              );
          }
        }
      }
      if (hatInStock(wert))
        melde(
          seite.pfad,
          "json-ld-verfuegbarkeit",
          `Block ${index + 1} enthält statisches InStock.`,
        );
    }

    if (!seite.noindex && origin) {
      const locale = spracheAusPfad(seite.pfad);
      const kennung = seitenKennung(seite.pfad);
      const erwartet = [...SPRACHEN, "x-default"].sort().join(",");
      const gefunden = seite.sprachverweise
        .map((verweis) => verweis.sprache)
        .sort()
        .join(",");
      if (gefunden !== erwartet)
        melde(
          seite.pfad,
          "hreflang",
          `Alle Sprachen und x-default erwartet; gefunden: ${gefunden || "keine"}.`,
        );
      for (const sprache of [...SPRACHEN, "x-default"]) {
        const zielSprache = sprache === "x-default" ? defaultLang : (sprache as Lang);
        const zielPfad = pfadFuerSprache(zielSprache, kennung);
        const zielUrl = `${origin}${zielPfad}`;
        const verweis = seite.sprachverweise.find((eintrag) => eintrag.sprache === sprache);
        if (!verweis || verweis.url !== zielUrl)
          melde(seite.pfad, "hreflang-ziel", `${sprache} muss auf ${zielUrl} zeigen.`);
        const ziel = nachPfad.get(zielPfad);
        if (!ziel || ziel.noindex)
          melde(seite.pfad, "hreflang-indexierbar", `${zielPfad} fehlt oder ist noindex.`);
        else if (
          !ziel.sprachverweise.some(
            (eintrag) => eintrag.sprache === locale && eintrag.url === `${origin}${seite.pfad}`,
          )
        )
          melde(
            seite.pfad,
            "hreflang-reziprok",
            `${zielPfad} verlinkt nicht mit ${locale} zurück.`,
          );
      }
    }
  }

  const fehlerseite = nachDatei.get("404.html");
  if (!fehlerseite) melde("/404.html", "404", "404.html fehlt (src/pages/404.astro).");
  else if (!fehlerseite.noindex) melde("/404.html", "404", "404.html muss noindex tragen.");

  // Manifest: gültiges JSON mit Symbolen, die im Build liegen.
  const manifestPfade = new Set(
    seiten.flatMap((seite) =>
      seite.verweise
        .filter((verweis) => verweis.art === "manifest")
        .map(
          (verweis) =>
            parseUrl(verweis.url, `${origin ?? "http://localhost"}${seite.pfad}`)?.pathname ?? "",
        ),
    ),
  );
  for (const pfad of manifestPfade) {
    const datei = pfad.replace(/^\/+/, "");
    if (!dateien.has(datei)) continue; // bereits als "manifest" gemeldet
    let manifest: unknown;
    try {
      manifest = JSON.parse(await lies(datei));
    } catch {
      melde(pfad, "manifest", "Manifest ist kein gültiges JSON.");
      continue;
    }
    const icons = istObjekt(manifest) && Array.isArray(manifest.icons) ? manifest.icons : [];
    if (!icons.length) melde(pfad, "manifest", "Manifest ohne icons.");
    for (const icon of icons) {
      const src = istObjekt(icon) && typeof icon.src === "string" ? icon.src : "";
      const url = parseUrl(src, `${origin ?? "http://localhost"}/`);
      if (!url || !zielDatei(url))
        melde(pfad, "manifest", `Icon fehlt im Build: ${src || "ohne src"}`);
    }
  }

  // Sitemap: Index vorhanden, jede URL lokal, eigene Origin, Endslash, vollständige Sprachgruppe.
  const sitemapDateien = [...dateien].filter((pfad) => /^sitemap[^/]*\.xml$/.test(pfad));
  const sitemapUrls = new Set<string>();
  if (!sitemapDateien.includes("sitemap-index.xml"))
    melde("sitemap", "sitemap", "sitemap-index.xml fehlt.");
  for (const pfad of sitemapDateien) {
    const { index, eintraege } = parseSitemap(await lies(pfad));
    if (!eintraege.length) melde(pfad, "sitemap", "Keine loc-Einträge vorhanden.");
    for (const { loc, links } of eintraege) {
      const url = parseUrl(loc);
      if (!url || !origin || url.origin !== origin) {
        melde(pfad, "sitemap-url", `Ungültige oder fremde Sitemap-URL: ${loc}`);
        continue;
      }
      const ziel = zielDatei(url);
      if (!ziel) {
        melde(pfad, "sitemap-ziel", `${url.href} fehlt im Build.`);
        continue;
      }
      if (index) {
        if (!sitemapDateien.includes(ziel))
          melde(pfad, "sitemap-index", `${url.href} ist keine lokale Sitemap.`);
        continue;
      }
      sitemapUrls.add(url.href);
      if (!url.pathname.endsWith("/")) melde(pfad, "sitemap-slash", `${url.href} ohne Endslash.`);
      const kennung = seitenKennung(url.pathname);
      const erwartet = [
        ...SPRACHEN.map((sprache) => ({
          sprache,
          url: `${origin}${pfadFuerSprache(sprache, kennung)}`,
        })),
        { sprache: "x-default", url: `${origin}${pfadFuerSprache(defaultLang, kennung)}` },
      ];
      if (
        links.length !== erwartet.length ||
        erwartet.some(
          (link) =>
            !links.some((eintrag) => eintrag.sprache === link.sprache && eintrag.url === link.url),
        )
      )
        melde(
          pfad,
          "sitemap-hreflang",
          `Unvollständige oder falsche Sprachgruppe für ${url.href}.`,
        );
      const seite = nachDatei.get(ziel);
      if (!seite) melde(pfad, "sitemap-inhalt", `${url.href} ist keine HTML-Seite.`);
      else if (seite.noindex)
        melde(
          pfad,
          "sitemap-noindex",
          `${url.href} darf als noindex-Seite nicht in der Sitemap stehen.`,
        );
    }
  }
  for (const seite of seiten.filter((eintrag) => !eintrag.noindex))
    if (!sitemapUrls.has(`${origin}${seite.pfad}`))
      melde(seite.pfad, "sitemap-vollstaendigkeit", "Indexierbare Seite fehlt in der Sitemap.");

  // robots.txt: Sitemap-Zeile mit eigener Origin, kein globales Disallow.
  if (!dateien.has("robots.txt")) melde("/robots.txt", "robots-txt", "robots.txt fehlt.");
  else {
    const zeilen = (await lies("robots.txt"))
      .split(/\r?\n/)
      .map((zeile) => zeile.replace(/#.*$/, "").trim());
    const sitemapZeile = `sitemap: ${origin}/sitemap-index.xml`;
    if (!zeilen.some((zeile) => zeile.toLowerCase() === sitemapZeile))
      melde("/robots.txt", "robots-txt", `Zeile "Sitemap: ${origin}/sitemap-index.xml" fehlt.`);
    let agenten: string[] = [];
    let neueGruppe = true;
    for (const zeile of zeilen) {
      const agent = /^user-agent:\s*(.+)$/i.exec(zeile)?.[1];
      if (agent) {
        if (neueGruppe) agenten = [];
        agenten.push(agent.trim());
        neueGruppe = false;
        continue;
      }
      if (!zeile) continue;
      neueGruppe = true;
      if (agenten.includes("*") && /^disallow:\s*\/\s*$/i.test(zeile))
        melde(
          "/robots.txt",
          "robots-txt",
          "Globales Disallow: / unter User-agent: * sperrt die ganze Site.",
        );
    }
  }

  // llms.txt: H1 in der ersten Zeile, nur eigene, existierende, indexierbare Links.
  if (!dateien.has("llms.txt")) melde("/llms.txt", "llms", "llms.txt fehlt.");
  else {
    const inhalt = await lies("llms.txt");
    if (!/^# \S/.test(inhalt.split(/\r?\n/)[0] ?? ""))
      melde("/llms.txt", "llms", "Erste Zeile muss eine Markdown-H1 sein.");
    for (const [, adresse = ""] of inhalt.matchAll(/\]\(([^)\s]+)\)/g)) {
      const url = parseUrl(adresse);
      if (!url || url.origin !== origin) {
        melde("/llms.txt", "llms", `Link muss absolut auf die eigene Origin zeigen: ${adresse}`);
        continue;
      }
      const ziel = zielDatei(url);
      if (!ziel) melde("/llms.txt", "llms", `Link fehlt im Build: ${adresse}`);
      else if (nachDatei.get(ziel)?.noindex)
        melde("/llms.txt", "llms", `Link auf noindex-Seite: ${adresse}`);
    }
  }

  const ergebnis: Ergebnis = {
    zeitpunkt: new Date().toISOString(),
    buildVerzeichnis,
    origin,
    erfolgreich: befunde.length === 0,
    statistik: {
      seiten: seiten.length,
      indexierbar: seiten.filter((seite) => !seite.noindex).length,
      bilder: seiten.reduce((summe, seite) => summe + seite.bilder.length, 0),
      sitemapUrls: sitemapUrls.size,
      befunde: befunde.length,
    },
    seiten: seiten.map((seite) => ({
      pfad: seite.pfad,
      titel: seite.titel[0],
      noindex: seite.noindex,
      h1: seite.h1,
      bilder: seite.bilder.length,
      jsonLd: seite.jsonLd.length,
    })),
    befunde,
  };
  await mkdir(dirname(optionen.bericht), { recursive: true });
  await Bun.write(optionen.bericht, `${JSON.stringify(ergebnis, null, 2)}\n`);
  return ergebnis;
}

if (import.meta.main) {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: { dist: { type: "string" }, bericht: { type: "string" } },
    strict: false,
    allowPositionals: true,
  });
  const optionen: Optionen = {
    dist: buildVerzeichnisAusArgumenten(new URL("../dist/", import.meta.url)),
    bericht:
      typeof values.bericht === "string" && values.bericht.trim()
        ? values.bericht
        : fileURLToPath(new URL("../../../.deploy/seo-audit.json", import.meta.url)),
    erwarteteOrigin: process.env.PUBLIC_SITE_URL,
  };
  try {
    const ergebnis = await pruefeBuild(optionen);
    const { statistik } = ergebnis;
    process.stdout.write(
      `SEO-Audit: ${statistik.seiten} Seiten (${statistik.indexierbar} indexierbar), ${statistik.bilder} Bilder, ${statistik.sitemapUrls} Sitemap-URLs, ${statistik.befunde} Befunde.\n${ergebnis.befunde
        .map((befund) => `- ${befund.seite} [${befund.pruefung}] ${befund.meldung}\n`)
        .join("")}Bericht: ${optionen.bericht}\n`,
    );
    if (!ergebnis.erfolgreich) process.exitCode = 1;
  } catch (fehler) {
    const meldung =
      fehler instanceof Error ? fehler.message : "Unbekannter Fehler beim Lesen des Builds.";
    process.stdout.write(`SEO-Audit konnte nicht abgeschlossen werden: ${meldung}\n`);
    process.exitCode = 1;
  }
}
