/** Optional: STARTER_NGINX_BIN zeigt auf eine lokal vorhandene Nginx-Binärdatei. */
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "bun:test";

const nginx = process.env.STARTER_NGINX_BIN;

async function freierPort(): Promise<number> {
  const server = createServer();
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const adresse = server.address();
      if (!adresse || typeof adresse === "string") return reject(new Error("Kein lokaler Port"));
      server.close((fehler) => (fehler ? reject(fehler) : resolve(adresse.port)));
    });
  });
}

const sicherheitsHeader = {
  "x-frame-options": "SAMEORIGIN",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
};

function erwarteSicherheitsHeader(antwort: Response, pfad: string) {
  for (const [name, wert] of Object.entries(sicherheitsHeader))
    expect(antwort.headers.get(name), `${pfad}: ${name}`).toBe(wert);
}

test.skipIf(!nginx)(
  "Nginx liefert statische Seiten mit Security-Headern, echte 404 und proxyt /api ohne Redirect",
  async () => {
    if (!nginx) return;
    const verzeichnis = await mkdtemp(join(tmpdir(), "starter-nginx-"));
    let prozess: ReturnType<typeof Bun.spawn> | undefined;
    const backend = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      // Das Backend schickt über hono/secure-headers eigene Kopien dieser Header.
      // Nginx hängt seine an, statt sie zu ersetzen; ohne proxy_hide_header stünden
      // sie doppelt in der Antwort, und Headers.get() verbindet Duplikate mit ", ".
      // Die Werte hier sind deshalb absichtlich andere als die des Vhosts.
      fetch: (request) =>
        Response.json(
          {
            pfad: new URL(request.url).pathname,
            proxyIp: request.headers.get("x-forwarded-for"),
            requestId: request.headers.get("x-request-id") !== null,
          },
          {
            headers: {
              "Referrer-Policy": "no-referrer",
              "Strict-Transport-Security": "max-age=15552000; includeSubDomains",
              "X-Content-Type-Options": "nosniff",
              "X-Frame-Options": "DENY",
            },
          },
        ),
    });
    try {
      const port = await freierPort();
      for (const unterordner of ["logs", "dist/_astro", "dist/en", "dist/.hidden"]) {
        await mkdir(join(verzeichnis, unterordner), { recursive: true });
      }
      for (const [pfad, inhalt] of Object.entries({
        "index.html": "Deutsch",
        "en/index.html": "English",
        "404.html": "Seite nicht gefunden",
        "gross.html": "<!doctype html><title>Gross</title>" + "<p>Inhalt</p>".repeat(60),
        "robots.txt": "User-agent: *\nAllow: /\n",
        "sitemap-index.xml": "<sitemapindex/>",
        "site.webmanifest": "{}",
        "llms.txt": "# Test",
        "_astro/app.123.css": "body { color: #000; }\n".repeat(40),
        "schrift.woff2": "wOF2".padEnd(600, "x"),
        "logo.svg": "<svg></svg>",
        ".secret": "vertraulich",
        ".hidden/x.css": "geheim",
        ".geheim.html": "geheim",
      }))
        await writeFile(join(verzeichnis, "dist", pfad), inhalt);
      const referenz = await readFile(new URL("./nginx.conf", import.meta.url), "utf8");
      // Ploi-Includes, TLS und reale Serverpfade werden ersetzt; Routing und Header bleiben original.
      const lokal = referenz
        .replace(/^\s*include \/etc\/nginx\/.*;$/gm, "")
        .replace(/^\s*ssl_[^\n]*;$/gm, "")
        .replace("#listen 80;", `listen 127.0.0.1:${port};`)
        .replaceAll("__DOMAIN__", "localhost")
        .replaceAll("__MAPPREFIX__", "starter")
        .replaceAll("__PORT__", String(backend.port))
        .replace("root __SITE_DIRECTORY__/apps/frontend/dist;", `root ${verzeichnis}/dist;`)
        .replace(
          /error_log\s+\/var\/log\/nginx\/[^;]+;/,
          `error_log ${verzeichnis}/error.log error;`,
        );
      // Alle Platzhalter außerhalb von Kommentaren müssen ersetzt sein.
      expect(lokal.replace(/^\s*#.*$/gm, "")).not.toMatch(/__[A-Z_]+__/);
      const version = Bun.spawn([nginx, "-V"], { stdout: "ignore", stderr: "pipe" });
      const bauoptionen = await new Response(version.stderr).text();
      expect(await version.exited, bauoptionen).toBe(0);
      const tempPfade = [
        `client_body_temp_path ${verzeichnis}/client_body;`,
        ...["proxy", "fastcgi", "uwsgi", "scgi"]
          .filter((modul) => !bauoptionen.includes(`--without-http_${modul}_module`))
          .map((modul) => `${modul}_temp_path ${verzeichnis}/${modul};`),
      ].join("\n");
      // Die Typkarte bildet /etc/nginx/mime.types nach, nicht mehr: font/woff2
      // steht dort wirklich drin, .webmanifest bis heute nicht. Deshalb fehlt
      // webmanifest hier bewusst — den Typ muss der Vhost selbst setzen,
      // sonst geht das Manifest als application/octet-stream raus.
      const config = join(verzeichnis, "nginx.conf");
      await writeFile(
        config,
        `daemon off;\nmaster_process off;\nerror_log ${verzeichnis}/error.log error;\npid ${verzeichnis}/nginx.pid;\nevents {}\nhttp {\n${tempPfade}\ntypes { text/html html; text/css css; image/svg+xml svg; text/plain txt; application/xml xml; font/woff2 woff2; }\n${lokal}\n}`,
      );
      const syntax = Bun.spawn(
        [nginx, "-e", join(verzeichnis, "error.log"), "-t", "-p", `${verzeichnis}/`, "-c", config],
        { stdout: "pipe", stderr: "pipe" },
      );
      const fehler = await new Response(syntax.stderr).text();
      expect(await syntax.exited, fehler).toBe(0);
      prozess = Bun.spawn(
        [nginx, "-e", join(verzeichnis, "error.log"), "-p", `${verzeichnis}/`, "-c", config],
        { stdout: "ignore", stderr: "pipe" },
      );
      const ursprung = `http://127.0.0.1:${port}`;
      let bereit = false;
      for (let versuch = 0; versuch < 100; versuch++) {
        try {
          if ((await fetch(ursprung)).status === 200) {
            bereit = true;
            break;
          }
        } catch {
          /* Der eigene Testserver startet gerade. */
        }
        await Bun.sleep(25);
      }
      expect(bereit).toBe(true);

      // HTML: nie cachen, Security-Header vorhanden (die Fehlerklasse der Live-Confs).
      for (const pfad of ["/", "/en/"]) {
        const antwort = await fetch(ursprung + pfad);
        expect(antwort.status).toBe(200);
        expect(antwort.headers.get("cache-control")).toBe("no-store, no-cache, must-revalidate");
        erwarteSicherheitsHeader(antwort, pfad);
      }
      // Verzeichnis ohne Slash: kanonischer Redirect auf die Slash-Form.
      const redirect = await fetch(ursprung + "/en", { redirect: "manual" });
      expect(redirect.status).toBe(301);
      expect(redirect.headers.get("location")).toMatch(/\/en\/$/);

      // Backend-Proxy: exakter /api, Unterpfade auch mit Dateiendung, kein Redirect,
      // X-Forwarded-For wird überschrieben, X-Request-Id gesetzt.
      for (const pfad of ["/api", "/api/example.json", "/api/events.js", "/api/x.js", "/health"]) {
        const antwort = await fetch(ursprung + pfad, {
          redirect: "manual",
          headers: { "x-forwarded-for": "1.2.3.4" },
        });
        expect(antwort.status, pfad).toBe(200);
        expect(antwort.headers.get("location")).toBeNull();
        erwarteSicherheitsHeader(antwort, pfad);
        expect(await antwort.json()).toEqual({
          pfad,
          proxyIp: "127.0.0.1",
          requestId: pfad !== "/health",
        });
      }

      // Content-gehashte Assets: ein Jahr immutable; public-Dateien kurz; Header überall.
      const asset = await fetch(ursprung + "/_astro/app.123.css");
      expect(asset.status).toBe(200);
      expect(asset.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
      erwarteSicherheitsHeader(asset, "/_astro/app.123.css");
      expect((await fetch(ursprung + "/_astro/fehlt.css")).status).toBe(404);
      const logo = await fetch(ursprung + "/logo.svg");
      expect(logo.status).toBe(200);
      expect(logo.headers.get("cache-control")).toBe("max-age=3600");
      erwarteSicherheitsHeader(logo, "/logo.svg");
      const robots = await fetch(ursprung + "/robots.txt");
      expect(robots.status).toBe(200);
      erwarteSicherheitsHeader(robots, "/robots.txt");
      // Generierte Textrouten (src/pages/*.ts): erreichbar, passender Content-Type, kurz gecacht.
      for (const [pfad, typ] of [
        ["/sitemap-index.xml", "application/xml"],
        ["/site.webmanifest", "application/manifest+json"],
        ["/llms.txt", "text/plain"],
      ] as const) {
        const antwort = await fetch(ursprung + pfad);
        expect(antwort.status, pfad).toBe(200);
        expect(antwort.headers.get("content-type"), pfad).toStartWith(typ);
        expect(antwort.headers.get("cache-control"), pfad).toBe("max-age=3600");
        erwarteSicherheitsHeader(antwort, pfad);
      }
      expect((await fetch(ursprung + "/favicon.ico")).status).toBe(404);

      // Echte 404-Seite aus dem Build mit Status 404, Headern und no-store.
      const unbekannt = await fetch(ursprung + "/unbekannt");
      expect(unbekannt.status).toBe(404);
      expect(await unbekannt.text()).toContain("Seite nicht gefunden");
      expect(unbekannt.headers.get("cache-control")).toBe("no-store, no-cache, must-revalidate");
      erwarteSicherheitsHeader(unbekannt, "/unbekannt");
      expect((await fetch(ursprung + "/404.html")).status).toBe(404);

      // gzip wird sonst nirgends gemessen. Der Vhost schaltet es selbst ein; die
      // Typliste steht dort und nicht in der http-Ebene dieser Testkonfiguration.
      const holeMitGzip = (pfad: string) =>
        fetch(ursprung + pfad, { headers: { "Accept-Encoding": "gzip" } });
      const htmlGzip = await holeMitGzip("/gross.html");
      expect(htmlGzip.headers.get("content-encoding")).toBe("gzip");
      const cssGzip = await holeMitGzip("/_astro/app.123.css");
      expect(cssGzip.headers.get("content-encoding")).toBe("gzip");
      // Bereits komprimierte Formate bleiben unangetastet: erneutes Packen kostet
      // nur Rechenzeit und macht die Datei eher groesser.
      expect((await holeMitGzip("/schrift.woff2")).headers.get("content-encoding")).toBeNull();

      // Versteckte Dateien bleiben gesperrt, auch mit Asset- oder HTML-Endung.
      for (const pfad of ["/.secret", "/.hidden/x.css", "/.geheim.html"])
        expect((await fetch(ursprung + pfad)).status, pfad).toBe(403);
    } finally {
      prozess?.kill();
      if (prozess) await prozess.exited;
      await backend.stop(true);
      await rm(verzeichnis, { recursive: true, force: true });
    }
  },
  10000,
);
