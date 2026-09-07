import { readFile } from "node:fs/promises";

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
});
