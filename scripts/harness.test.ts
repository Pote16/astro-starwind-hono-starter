import { readdir, readFile } from "node:fs/promises";

import { describe, expect, test } from "bun:test";

/**
 * Vertrag des Deploy-Harness. Diese Prüfungen laufen überall (auch unter
 * Windows) und verhindern, dass die Lehren aus dem Ploi-Betrieb beim Ableiten
 * neuer Sites oder beim Aufräumen wieder verloren gehen.
 */
async function datei(pfad: string): Promise<string> {
  return (await readFile(new URL(pfad, import.meta.url), "utf8")).replaceAll("\r\n", "\n");
}

describe("Deploy-Harness-Vertrag", () => {
  test(".gitignore kennt Plois Hook-Datei, Build-Zwischenstände und den Deploy-Zustand", async () => {
    const gitignore = await datei("../.gitignore");
    for (const eintrag of ["/ploi-*.sh", "dist.new/", "dist.old/", ".deploy/", ".env", "storage/"])
      expect(gitignore.split("\n")).toContain(eintrag);
  });

  test(".gitattributes erzwingt LF für Shellskripte und den Bun-Pin", async () => {
    const attribute = await datei("../.gitattributes");
    expect(attribute).toContain("*.sh text eol=lf");
    expect(attribute).toContain(".bun-version text eol=lf");
    expect(attribute).toContain("* text=auto eol=lf");
  });

  test("Deploy-Skripte adressieren den Daemon nur über Supervisor, nie über Prozessmuster", async () => {
    for (const name of ["deploy.sh", "deploy-common.sh", "start-backend.sh", "cronjobs/run.sh"]) {
      const inhalt = await datei(name);
      expect(inhalt, name).not.toMatch(/^[^#\n]*\b(pkill|pgrep|killall)\b/m);
      expect(inhalt, name).not.toMatch(/^[^#\n]*\bkill -/m);
    }
    const common = await datei("deploy-common.sh");
    expect(common).toContain('PLOI_WORKER_PROGRAM="worker-${PLOI_WORKER_ID}"');
    expect(common).toContain('[ "${NODE_ENV:-}" = "production" ]');
    expect(common).not.toContain("export NODE_ENV=");
    const deploy = await datei("deploy.sh");
    // stop + start statt restart: ein gestoppter oder FATAL-Daemon wird so ebenfalls gestartet.
    expect(deploy).toContain('starter_supervisorctl stop "$PLOI_WORKER_ZIEL"');
    expect(deploy).toContain('starter_supervisorctl start "$PLOI_WORKER_ZIEL"');
    // `supervisorctl status` endet nach LSB mit Exit 3, sobald ein Prozess des
    // Programms gestoppt, EXITED oder FATAL ist. Genau dann muss der Deploy
    // weiterlaufen, deshalb liest er den Status ausschließlich über
    // starter_worker_status (toleriert Exit 3) statt direkt.
    expect(deploy).not.toMatch(/starter_supervisorctl status/);
    expect(common).toContain("STARTER_SUPERVISORCTL_OK");
    expect(common).toContain("starter_worker_status() {");
  });

  test("Ploi-Hook-Spiegel entspricht dem realen Panel-Script", async () => {
    const hook = await datei("ploi-autodeploy.sh");
    expect(hook).toContain("git reset --hard origin/main");
    expect(hook).toContain("bash scripts/deploy.sh");
    expect(hook).not.toContain("--ff-only");
    expect(hook).not.toContain("DEPLOY_REPOSITORY");
  });

  test(".env.example dokumentiert die Deploy-Variablen und die einheitliche Struktur", async () => {
    const env = await datei("../.env.example");
    for (const zeile of [
      "NODE_ENV=development",
      "PORT=",
      "POSTGRES_HOST=",
      "POSTGRES_PORT=",
      "POSTGRES_USER=",
      "POSTGRES_PASSWORD=",
      "POSTGRES_DB=",
      "DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}",
      "# REDIS_URL=redis://:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}",
      "PLOI_WORKER_ID=",
      "RESET_DB=false",
    ])
      expect(env, zeile).toContain(zeile);
    expect(env).not.toContain("PLOI_DAEMON_NAME");
    expect(env).not.toContain("DEPLOY_REPOSITORY");
    expect(env).toMatch(/NODE_ENV=production/);
  });

  test("Nginx-Referenz: keine add_header in Locations, kein Legacy-Header, echte 404-Seite, eigener Map-Prefix", async () => {
    const nginx = await datei("nginx.conf");
    const server = nginx.slice(nginx.indexOf("server {"));
    let tiefe = 0;
    let inLocation = false;
    for (const [nr, zeile] of server.split("\n").entries()) {
      const code = zeile.replace(/#.*$/, "");
      if (/^\s*location\b/.test(code)) inLocation = true;
      if (inLocation && /\badd_header\b/.test(code))
        throw new Error(
          `add_header innerhalb einer location (server-Zeile ${nr + 1}): ${zeile.trim()}`,
        );
      tiefe += (code.match(/{/g) ?? []).length - (code.match(/}/g) ?? []).length;
      if (inLocation && tiefe <= 1) inLocation = false;
    }
    const code = nginx.replace(/^\s*#.*$/gm, "");
    expect(code).not.toContain("X-XSS-Protection");
    expect(code).not.toMatch(/Connection\s+'upgrade'/);
    expect(code).not.toMatch(/try_files[^\n]*\/404\.html/);
    expect(code).toContain("error_page 404 /404.html;");
    // Das Ploi-Feld enthält die ganze Datei. Bleibt beim Einsetzen der von Ploi
    // erzeugte Kopf stehen, steht root zweimal im selben Server-Block und nginx
    // lehnt ab. Die Referenz selbst muss deshalb genau eines von beidem führen.
    expect(code.match(/^\s*root\s/gm) ?? []).toHaveLength(1);
    expect(code.match(/^server \{/gm) ?? []).toHaveLength(1);
    expect(code.match(/^\s*index\s/gm) ?? []).toHaveLength(1);
    expect(code).toContain("location = /404.html { internal; }");
    expect(code).toContain("map $sent_http_content_type $__MAPPREFIX___html_cache");
    expect(code).toContain("proxy_set_header X-Forwarded-For $remote_addr;");
    expect(code).not.toContain("$proxy_add_x_forwarded_for");
    expect(nginx.indexOf("location ~ /\\.(?!well-known).*")).toBeLessThan(
      nginx.indexOf("location ~* \\.(?:js|mjs|css"),
    );
  });

  test("Bun-Runtime ist je Site gepinnt und im Daemon-Spiegel dokumentiert", async () => {
    const daemon = await datei("ploi-daemon.md");
    expect(daemon).toContain("/home/ploi/.bun-versions/");
    expect(daemon).toContain("bin/bun");
    expect(daemon).toContain("PLOI_WORKER_ID");
    expect(daemon).toMatch(/Processes\s*\*{0,2}\s*\|?\s*`?1`?/);
    // Ein globales Upgrade würde alle Sites des Servers gleichzeitig umstellen.
    for (const name of ["deploy.sh", "deploy-common.sh", "start-backend.sh", "cronjobs/run.sh"]) {
      expect(await datei(name), name).not.toMatch(/^[^#\n]*\bbun upgrade\b/m);
    }
    const common = await datei("deploy-common.sh");
    expect(common).toContain('export PATH="$BUN_INSTALL/bin:$PATH"');
    expect(await datei("../.env.example")).toContain("BUN_INSTALL=/home/ploi/.bun-versions/");
  });

  test("Frontend liefert eine 404-Seite, robots.txt und CI prüft alle Shellskripte", async () => {
    await expect(datei("../apps/frontend/src/pages/404.astro")).resolves.toContain("noindex");
    const workflow = await datei("../.github/workflows/quality.yml");
    expect(workflow).toContain("scripts/cronjobs/*.sh");
    expect(workflow).toContain("shellcheck");
  });

  test("Astro überschreibt die Bildklassen nicht mit eigenen Layoutstilen", async () => {
    const config = await datei("../apps/frontend/astro.config.mjs");
    // responsiveStyles: true bettet rund 30 Regeln auf [data-astro-image] in jede
    // Seite ein, darunter height: auto und aspect-ratio aus den Bildmaßen. Die
    // schlagen die Tailwind-Klassen am Bild: eines mit "size-full object-cover",
    // das seine Karte füllen soll, fällt auf seine natürliche Höhe zurück. Am
    // 8.9.2026 auf der Startseite von cleanlist.app aufgefallen. srcset und sizes
    // erzeugt layout: "constrained" unabhängig davon weiter.
    expect(config).not.toMatch(/responsiveStyles:\s*true/);
    // z aus astro:content ist seit Astro 6 abgekündigt; Ersatz ist astro/zod.
    for (const pfad of ["../apps/frontend/src/content.config.ts"]) {
      const inhalt = await datei(pfad).catch(() => "");
      if (inhalt) expect(inhalt).not.toMatch(/import \{[^}]*\bz\b[^}]*\} from "astro:content"/);
    }
  });
  test("Kein bunx: die versionierte Runtime hat den Symlink nicht zwangsläufig", async () => {
    // bunx ist keine eigene Binärdatei, sondern ein Symlink auf bun, den nur Buns
    // Installer anlegt. Entsteht eine Runtime unter
    // /home/ploi/.bun-versions/<version>/ durch Verschieben einer flachen
    // Binärdatei, liegt dort bun, aber kein bunx. Solange ein fehlendes
    // BUN_INSTALL still auf $HOME/.bun zurückfiel, kam der Symlink aus der alten
    // gemeinsamen Installation; seit dieser Rückfall weg ist, bricht der Deploy
    // mitten drin ab mit "bunx: command not found" (Exit 127) — der PATH stimmt
    // ja, nur der Symlink fehlt. `bun x` ist derselbe Befehl und braucht ihn nicht.
    const bunx = /(?<![\w./-])bunx\s/;
    const paketdateien = ["../package.json"];
    for (const ordner of ["../apps", "../packages"]) {
      let eintraege: string[];
      try {
        eintraege = await readdir(new URL(`${ordner}/`, import.meta.url));
      } catch {
        continue;
      }
      for (const eintrag of eintraege) paketdateien.push(`${ordner}/${eintrag}/package.json`);
    }
    let geprueft = 0;
    for (const pfad of paketdateien) {
      let inhalt: string;
      try {
        inhalt = await datei(pfad);
      } catch {
        continue;
      }
      geprueft += 1;
      const scripts = (JSON.parse(inhalt) as { scripts?: Record<string, string> }).scripts ?? {};
      for (const [name, befehl] of Object.entries(scripts))
        expect(befehl, `${pfad} -> ${name}`).not.toMatch(bunx);
    }
    expect(geprueft).toBeGreaterThan(1);
    for (const name of ["deploy.sh", "deploy-common.sh", "start-backend.sh", "cronjobs/run.sh"]) {
      let inhalt: string;
      try {
        inhalt = await datei(name);
      } catch {
        continue;
      }
      expect(inhalt, name).not.toMatch(/^[^#\n]*(?<![\w./-])bunx\s/m);
    }
  });
});
