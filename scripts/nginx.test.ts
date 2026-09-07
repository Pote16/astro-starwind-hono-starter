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

test.skipIf(!nginx)(
  "Nginx liefert statische Seiten und proxyt /api ohne Redirect",
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
        }),
    });
    try {
      const port = await freierPort();
      for (const unterordner of ["logs", "dist/_astro", "dist/en"]) {
        await mkdir(join(verzeichnis, unterordner), { recursive: true });
      }
      for (const [pfad, text] of Object.entries({
        "index.html": "Deutsch",
        "en/index.html": "English",
        "_astro/app.123.css": "body {}",
        "logo.svg": "<svg></svg>",
        ".secret": "vertraulich",
      }))
        await writeFile(join(verzeichnis, "dist", pfad), text);
      const referenz = await readFile(new URL("./nginx.conf", import.meta.url), "utf8");
      // Ploi/TLS und reale Serverpfade werden ersetzt; Routing und Header bleiben original.
      const lokal = referenz
        .replace(/^\s*include \/etc\/nginx\/.*;$/gm, "")
        .replace(/^\s*gzip[^\n]*;$/gm, "")
        .replace("#listen 80;", `listen 127.0.0.1:${port};`)
        .replaceAll("__DOMAIN__", "localhost")
        .replace("root __SITE_DIRECTORY__/apps/frontend/dist;", `root ${verzeichnis}/dist;`)
        .replace(
          /error_log\s+\/var\/log\/nginx\/[^;]+;/,
          `error_log ${verzeichnis}/error.log error;`,
        )
        .replaceAll("127.0.0.1:3005", `127.0.0.1:${backend.port}`);
      // Distributionspakete verwenden absolute /var/log- und /var/lib-Pfade.
      // Auch ohne Rootrechte bleibt jeder vom Test erzeugte Pfad im Temp-Verzeichnis.
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
        `daemon off;\nmaster_process off;\nerror_log ${verzeichnis}/error.log error;\npid ${verzeichnis}/nginx.pid;\nevents {}\nhttp {\n${tempPfade}\ntypes { text/html html; text/css css; image/svg+xml svg; }\n${lokal}\n}`,
      );
      const syntax = Bun.spawn(
        [nginx, "-e", join(verzeichnis, "error.log"), "-t", "-p", `${verzeichnis}/`, "-c", config],
        {
          stdout: "pipe",
          stderr: "pipe",
        },
      );
      const fehler = await new Response(syntax.stderr).text();
      expect(await syntax.exited, fehler).toBe(0);
      prozess = Bun.spawn(
        [nginx, "-e", join(verzeichnis, "error.log"), "-p", `${verzeichnis}/`, "-c", config],
        {
          stdout: "ignore",
          stderr: "pipe",
        },
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
      for (const pfad of ["/", "/en/"]) {
        const antwort = await fetch(ursprung + pfad);
        expect(antwort.status).toBe(200);
        expect(antwort.headers.get("cache-control")).toBe("no-store, no-cache, must-revalidate");
      }
      for (const pfad of ["/api", "/api/example.json", "/api/events.js", "/health"]) {
        const antwort = await fetch(ursprung + pfad, { redirect: "manual" });
        expect(antwort.status).toBe(200);
        expect(antwort.headers.get("location")).toBeNull();
        expect(await antwort.json()).toEqual({ pfad, proxyIp: "127.0.0.1" });
      }
      for (const [pfad, dauer] of [
        ["/_astro/app.123.css", 31536000],
        ["/logo.svg", 3600],
      ] as const) {
        const antwort = await fetch(ursprung + pfad);
        expect(antwort.status).toBe(200);
        expect(antwort.headers.get("cache-control")).toBe(`max-age=${dauer}`);
        expect(antwort.headers.get("x-content-type-options")).toBe("nosniff");
        expect(antwort.headers.get("x-frame-options")).toBe("SAMEORIGIN");
      }
      expect((await fetch(ursprung + "/unbekannt")).status).toBe(404);
      expect((await fetch(ursprung + "/.secret")).status).toBe(403);
    } finally {
      prozess?.kill();
      if (prozess) await prozess.exited;
      await backend.stop(true);
      await rm(verzeichnis, { recursive: true, force: true });
    }
  },
  10000,
);
