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
      fetch: (request) =>
        Response.json({
          pfad: new URL(request.url).pathname,
          proxyIp: request.headers.get("x-forwarded-for"),
          requestId: request.headers.get("x-request-id") !== null,
        }),
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
        "robots.txt": "User-agent: *\nAllow: /\n",
        "_astro/app.123.css": "body {}",
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
        .replace(/^\s*gzip[^\n]*;$/gm, "")
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
      const config = join(verzeichnis, "nginx.conf");
      await writeFile(
        config,
        `daemon off;\nmaster_process off;\nerror_log ${verzeichnis}/error.log error;\npid ${verzeichnis}/nginx.pid;\nevents {}\nhttp {\n${tempPfade}\ntypes { text/html html; text/css css; image/svg+xml svg; text/plain txt; application/xml xml; }\n${lokal}\n}`,
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
      expect((await fetch(ursprung + "/favicon.ico")).status).toBe(404);

      // Echte 404-Seite aus dem Build mit Status 404, Headern und no-store.
      const unbekannt = await fetch(ursprung + "/unbekannt");
      expect(unbekannt.status).toBe(404);
      expect(await unbekannt.text()).toContain("Seite nicht gefunden");
      expect(unbekannt.headers.get("cache-control")).toBe("no-store, no-cache, must-revalidate");
      erwarteSicherheitsHeader(unbekannt, "/unbekannt");
      expect((await fetch(ursprung + "/404.html")).status).toBe(404);

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
