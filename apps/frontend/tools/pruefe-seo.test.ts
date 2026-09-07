import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { afterAll, describe, expect, test } from "bun:test";

import { type Befund, pruefeBuild } from "./pruefe-seo";

/**
 * Das Gate wird selbst geprüft: ein vollständiger Fixture-Build muss ohne
 * Befund durchgehen, gezielt kaputte Seiten müssen ihre Befundkennungen
 * auslösen, und ein frischer Astro-Build des Starters muss das Gate bestehen.
 */
const ORIGIN = "https://example.test";
const verzeichnisse: string[] = [];

afterAll(async () => {
  await Promise.all(verzeichnisse.map((pfad) => rm(pfad, { recursive: true, force: true })));
});

async function fixtureVerzeichnis(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "starter-seo-"));
  verzeichnisse.push(root);
  return root;
}

async function schreibe(root: string, dateien: Record<string, string>): Promise<void> {
  for (const [pfad, inhalt] of Object.entries(dateien)) {
    await mkdir(dirname(join(root, pfad)), { recursive: true });
    await writeFile(join(root, pfad), inhalt);
  }
}

interface SeiteOptionen {
  sprache: "de" | "en";
  pfad: string;
  titel: string;
  beschreibung?: string;
  noindex?: boolean;
  canonical?: string | null;
  hreflang?: Record<string, string> | null;
  kopf?: string;
  rumpf?: string;
}

function sprachlinks(kennung: string): Record<string, string> {
  const de = `${ORIGIN}${kennung}`;
  return { de, en: `${ORIGIN}/en${kennung}`, "x-default": de };
}

/** Eine regelkonforme Seite; Optionen schalten einzelne Teile gezielt kaputt. */
function seite(o: SeiteOptionen): string {
  const kennung = o.pfad.startsWith("/en/") ? o.pfad.slice(3) : o.pfad;
  const canonical = o.canonical === undefined ? `${ORIGIN}${o.pfad}` : o.canonical;
  const alternates = o.noindex
    ? null
    : o.hreflang === undefined
      ? sprachlinks(kennung)
      : o.hreflang;
  return `<!doctype html><html lang="${o.sprache}"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${o.titel}</title>
${o.beschreibung === undefined ? `<meta name="description" content="Beschreibung ${o.pfad}">` : o.beschreibung}
<meta name="robots" content="${o.noindex ? "noindex, follow" : "index, follow, max-image-preview:large"}">
${!o.noindex && canonical ? `<link rel="canonical" href="${canonical}">` : ""}
${
  alternates
    ? Object.entries(alternates)
        .map(([sprache, url]) => `<link rel="alternate" hreflang="${sprache}" href="${url}">`)
        .join("\n")
    : ""
}
<link rel="sitemap" type="application/xml" href="/sitemap-index.xml">
${!o.noindex && canonical ? `<meta property="og:url" content="${canonical}">` : ""}
<meta property="og:image" content="${ORIGIN}/_astro/og.png">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preload" href="/_astro/fonts/a.woff2" as="font" type="font/woff2" crossorigin>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Test","url":"${ORIGIN}/"}</script>
${o.kopf ?? ""}
</head><body>
<a href="#inhalt">Skip</a>
<main id="inhalt"><h1>${o.titel}</h1>
<img src="/bild.webp" alt="" width="10" height="10" loading="lazy">
<a href="/">de</a> <a href="/en/">en</a>
${o.rumpf ?? ""}
</main></body></html>`;
}

function sitemap(eintraege: { loc: string; links?: Record<string, string> }[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${eintraege
    .map(
      ({ loc, links = sprachlinks(loc.replace(ORIGIN, "").replace(/^\/en\//, "/")) }) =>
        `<url><loc>${loc}</loc>${Object.entries(links)
          .map(([lang, url]) => `<xhtml:link rel="alternate" hreflang="${lang}" href="${url}"/>`)
          .join("")}</url>`,
    )
    .join("")}</urlset>`;
}

const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${ORIGIN}/sitemap-0.xml</loc></sitemap></sitemapindex>`;

const statischeDateien = {
  "favicon.ico": "ico",
  "apple-touch-icon.png": "png",
  "icon-192.png": "png",
  "icon-512.png": "png",
  "bild.webp": "webp",
  "_astro/og.png": "png",
  "_astro/fonts/a.woff2": "woff2",
  "site.webmanifest": JSON.stringify({
    name: "Test",
    icons: [{ src: "/icon-192.png" }, { src: "/icon-512.png" }],
  }),
};

function vollstaendigerBuild(): Record<string, string> {
  return {
    ...statischeDateien,
    "index.html": seite({ sprache: "de", pfad: "/", titel: "Start" }),
    "en/index.html": seite({ sprache: "en", pfad: "/en/", titel: "Home" }),
    "404.html": seite({ sprache: "de", pfad: "/404.html", titel: "404", noindex: true }),
    "sitemap-index.xml": sitemapIndex,
    "sitemap-0.xml": sitemap([{ loc: `${ORIGIN}/` }, { loc: `${ORIGIN}/en/` }]),
    "robots.txt": `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap-index.xml\n`,
    "llms.txt": `# Test\n\n> Kurz\n\n## Deutsch\n- [Start](${ORIGIN}/)\n- [Home](${ORIGIN}/en/)\n`,
  };
}

async function pruefe(root: string, erwarteteOrigin?: string) {
  const bericht = join(root, "bericht", "seo-audit.json");
  const ergebnis = await pruefeBuild({
    dist: pathToFileURL(`${root}${sep}`),
    bericht,
    erwarteteOrigin,
  });
  return { ergebnis, bericht };
}

function kennungen(befunde: Befund[]): Set<string> {
  return new Set(befunde.map((befund) => befund.pruefung));
}

describe("pruefe-seo", () => {
  test("ein vollständiger Build besteht ohne Befund und schreibt den Bericht", async () => {
    const root = await fixtureVerzeichnis();
    await schreibe(root, vollstaendigerBuild());
    const { ergebnis, bericht } = await pruefe(root, ORIGIN);
    expect(ergebnis.befunde).toEqual([]);
    expect(ergebnis.erfolgreich).toBe(true);
    expect(ergebnis.origin).toBe(ORIGIN);
    expect(ergebnis.statistik).toMatchObject({ seiten: 3, indexierbar: 2, sitemapUrls: 2 });
    expect(JSON.parse(await Bun.file(bericht).text())).toMatchObject({ erfolgreich: true });
  });

  test("leerer Build und fehlender Startseiten-Canonical brechen nicht ab, sondern melden", async () => {
    const leer = await fixtureVerzeichnis();
    const ohne = await pruefe(leer);
    expect(kennungen(ohne.ergebnis.befunde)).toContain("build");
    expect(ohne.ergebnis.erfolgreich).toBe(false);

    const root = await fixtureVerzeichnis();
    await schreibe(root, {
      ...vollstaendigerBuild(),
      "index.html": seite({ sprache: "de", pfad: "/", titel: "Start", canonical: null }),
    });
    const { ergebnis } = await pruefe(root);
    expect(kennungen(ergebnis.befunde)).toContain("origin");
    expect(ergebnis.origin).toBeUndefined();
  });

  test("Produktions-Origin ohne https und abweichende PUBLIC_SITE_URL werden gemeldet", async () => {
    const root = await fixtureVerzeichnis();
    const http = vollstaendigerBuild();
    for (const datei of Object.keys(http))
      http[datei] = http[datei]!.replaceAll(ORIGIN, "http://example.test");
    await schreibe(root, http);
    const { ergebnis } = await pruefe(root, "https://andere.test");
    const gefunden = kennungen(ergebnis.befunde);
    expect(gefunden).toContain("origin-https");
    expect(gefunden).toContain("origin-umgebung");
    expect(gefunden).not.toContain("canonical");
  });

  test("gezielt kaputte Seiten lösen genau ihre Befundkennungen aus", async () => {
    const root = await fixtureVerzeichnis();
    await schreibe(root, {
      ...vollstaendigerBuild(),
      // Startseite: Sprachgruppe zeigt für en auf ein falsches Ziel.
      "index.html": seite({
        sprache: "de",
        pfad: "/",
        titel: "Start",
        hreflang: { ...sprachlinks("/"), en: `${ORIGIN}/en/falsch/` },
      }),
      // Englische Startseite verweist nicht auf die deutsche zurück.
      "en/index.html": seite({
        sprache: "en",
        pfad: "/en/",
        titel: "Home",
        hreflang: { en: `${ORIGIN}/en/`, "x-default": `${ORIGIN}/`, de: `${ORIGIN}/en/` },
      }),
      // Sammelbecken: fast jede Seitenregel verletzt.
      "kaputt/index.html": seite({
        sprache: "en",
        pfad: "/kaputt/",
        titel: "Start",
        beschreibung: "",
        canonical: `${ORIGIN}/kaputt`,
        hreflang: { de: `${ORIGIN}/kaputt/` },
        kopf: [
          '<meta name="viewport" content="width=device-width">',
          '<link rel="preload" href="/_astro/fonts/fehlt.woff2" as="font" type="font/woff2">',
          '<link rel="icon" href="/fehlt.ico">',
          '<script type="application/ld+json">{kaputt</script>',
          '<script type="application/ld+json">{"name":"ohne Typ"}</script>',
          `<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"item":"${ORIGIN}/nirgends/"}]}</script>`,
          '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Offer","availability":"https://schema.org/InStock"}</script>',
        ].join("\n"),
        rumpf: [
          "<h1>Zweite</h1>",
          '<img src="/fehlt.webp">',
          '<img src="/bild.webp" alt="" width="10" height="10" fetchpriority="high" loading="lazy">',
          '<img src="/bild.webp" alt="" width="10" height="10" fetchpriority="high" loading="eager">',
          '<a href="/fehlt/">weg</a> <a href="/en">ohne Slash</a> <a href="/#nix">Anker</a>',
        ].join("\n"),
      }),
      // noindex-Seite mit Canonical und hreflang, zusätzlich in Sitemap und llms.txt verlinkt.
      "danke/index.html": seite({
        sprache: "de",
        pfad: "/danke/",
        titel: "Danke",
        noindex: true,
        kopf: `<link rel="canonical" href="${ORIGIN}/danke/">\n<link rel="alternate" hreflang="de" href="${ORIGIN}/danke/">`,
      }),
      "alt.html": seite({ sprache: "de", pfad: "/alt.html", titel: "Alt", noindex: true }),
      "404.html": seite({ sprache: "de", pfad: "/404.html", titel: "404", canonical: null }),
      "sitemap-index.xml": sitemapIndex.replace("/sitemap-0.xml", "/index.html"),
      "sitemap-0.xml": sitemap([
        { loc: `${ORIGIN}/`, links: { de: `${ORIGIN}/` } },
        { loc: `${ORIGIN}/en` },
        { loc: `${ORIGIN}/danke/` },
        { loc: `${ORIGIN}/nix/` },
        { loc: "https://fremd.test/" },
      ]),
      "robots.txt": "User-agent: *\nDisallow: /\n",
      "llms.txt": `Kein Titel\n- [weg](${ORIGIN}/nix/)\n- [danke](${ORIGIN}/danke/)\n- [fremd](https://fremd.test/)\n`,
      "site.webmanifest": "{kaputt",
    });
    const { ergebnis } = await pruefe(root, ORIGIN);
    const gefunden = kennungen(ergebnis.befunde);
    for (const kennung of [
      "seitenpfad",
      "html-lang",
      "h1",
      "title",
      "description",
      "viewport",
      "canonical",
      "canonical-noindex",
      "og-url",
      "bild-alt",
      "bild-masse",
      "bild-prioritaet",
      "font-preload",
      "icon",
      "link-ziel",
      "link-slash",
      "link-anker",
      "json-ld",
      "json-ld-typ",
      "json-ld-breadcrumb",
      "json-ld-verfuegbarkeit",
      "hreflang",
      "hreflang-ziel",
      "hreflang-indexierbar",
      "hreflang-reziprok",
      "hreflang-noindex",
      "404",
      "manifest",
      "sitemap-index",
      "sitemap-url",
      "sitemap-ziel",
      "sitemap-slash",
      "sitemap-hreflang",
      "sitemap-noindex",
      "sitemap-vollstaendigkeit",
      "robots-txt",
      "llms",
    ])
      expect(gefunden, kennung).toContain(kennung);
    expect(ergebnis.erfolgreich).toBe(false);
    const meldung = (kennung: string) =>
      ergebnis.befunde.filter((befund) => befund.pruefung === kennung).map((b) => b.meldung);
    expect(meldung("bild-prioritaet")).toHaveLength(2);
    expect(meldung("robots-txt").join(" ")).toContain("Sitemap:");
    expect(meldung("robots-txt").join(" ")).toContain("Disallow");
    expect(meldung("llms")).toHaveLength(4);
    expect(meldung("hreflang-reziprok").join(" ")).toContain("/en/");
    // Die englische Startseite ist bis auf ihre Sprachgruppe und den fehlenden
    // Sitemap-Eintrag (dort steht nur /en ohne Endslash) regelkonform.
    const enBefunde = ergebnis.befunde.filter((befund) => befund.seite === "/en/");
    expect(kennungen(enBefunde)).toEqual(
      new Set(["hreflang-ziel", "hreflang-reziprok", "sitemap-vollstaendigkeit"]),
    );
  });

  test("ein frischer Astro-Build des Starters besteht das Gate", async () => {
    const frontend = fileURLToPath(new URL("../", import.meta.url));
    const dist = join(await fixtureVerzeichnis(), "dist");
    const build = Bun.spawn([process.execPath, "--bun", "astro", "build", "--outDir", dist], {
      cwd: frontend,
      env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1", NODE_ENV: "production" },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, code] = await Promise.all([
      new Response(build.stdout).text(),
      new Response(build.stderr).text(),
      build.exited,
    ]);
    expect(code, stdout + stderr).toBe(0);
    const { ergebnis } = await pruefe(dist, process.env.PUBLIC_SITE_URL);
    expect(ergebnis.befunde).toEqual([]);
    expect(ergebnis.statistik.seiten).toBeGreaterThanOrEqual(3);
    expect(ergebnis.statistik.sitemapUrls).toBeGreaterThanOrEqual(2);
    expect(ergebnis.seiten.find((seite) => seite.pfad === "/404.html")?.noindex).toBe(true);
  }, 240_000);
});
