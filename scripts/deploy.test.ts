import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "bun:test";

/**
 * Deploy-Fixtures: Kopien der Skripte laufen mit simuliertem bun, git, sudo,
 * supervisorctl, curl und /proc. Niemals echte Installationen, Migrationen,
 * Neustarts oder HTTP-Aufrufe. Bash, flock und /proc setzen Linux voraus;
 * unter Windows wird die Suite übersprungen (CI führt sie auf Ubuntu aus).
 */
const linux = process.platform !== "win32" && Bun.which("bash") !== null;
const sha = "1234567890abcdef1234567890abcdef12345678";
const flockProgramm = Bun.which("flock");
const pythonProgramm = Bun.which("python3");
const aktiveFixtures = new Set<() => Promise<void>>();

afterEach(async () => {
  await Promise.all([...aktiveFixtures].map((dispose) => dispose()));
}, 10_000);

async function text(datei: string): Promise<string> {
  return readFile(datei, "utf8").catch(() => "");
}

const produktionsEnv =
  "NODE_ENV=production\nDATABASE_URL=postgres://fixture.invalid/test\nPORT=3005\nPLOI_WORKER_ID=123\n";

async function fixture(variablen: Record<string, string> = {}) {
  const root = await realpath(await mkdtemp(join(tmpdir(), "starter-deploy-test-")));
  const prozesse = new Set<ReturnType<typeof Bun.spawn>>();
  const ausfuehrungen = new Set<Promise<unknown>>();
  let geschlossen = false;
  let aufraeumen: Promise<void> | undefined;

  function beenden(prozess: ReturnType<typeof Bun.spawn>) {
    try {
      process.kill(-prozess.pid, "SIGKILL");
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ESRCH")) throw error;
    }
  }

  function dispose(): Promise<void> {
    if (aufraeumen) return aufraeumen;
    geschlossen = true;
    aufraeumen = (async () => {
      for (const prozess of prozesse) beenden(prozess);
      await Promise.allSettled([...ausfuehrungen]);
      await rm(root, { recursive: true, force: true });
      aktiveFixtures.delete(dispose);
    })();
    return aufraeumen;
  }

  for (const ordner of [
    "scripts/cronjobs",
    "bin",
    ".deploy",
    "apps/frontend/dist",
    "apps/frontend/dist.old",
    "apps/backend/src/jobs",
  ])
    await mkdir(join(root, ordner), { recursive: true });
  for (const name of [
    "deploy.sh",
    "deploy-common.sh",
    "deploy-audits.sh",
    "start-backend.sh",
    "ploi-autodeploy.sh",
  ])
    await copyFile(new URL(name, import.meta.url), join(root, "scripts", name));
  await copyFile(
    new URL("cronjobs/run.sh", import.meta.url),
    join(root, "scripts/cronjobs/run.sh"),
  );
  await writeFile(join(root, ".bun-version"), "1.4.2\n");
  await writeFile(join(root, ".env"), produktionsEnv);
  await writeFile(join(root, "apps/frontend/dist/index.html"), "bisherig");
  await writeFile(join(root, "apps/frontend/dist.old/index.html"), "aelter");
  await writeFile(join(root, ".deploy/last-built-sha"), "vorheriger-erfolg\n");
  await writeFile(join(root, "apps/backend/src/jobs/demo.ts"), "");
  await writeFile(
    join(root, "bin/bun"),
    `#!/bin/bash
set -eu
printf 'bun %s\\n' "$*" >> "$FIXTURE_ROOT/aufrufe"
if [ "$*" = "--version" ]; then printf '%s\\n' "\${FIXTURE_VERSION:-1.4.2}"; exit 0; fi
if [ -n "\${FIXTURE_FAIL:-}" ] && [[ "$*" == *"$FIXTURE_FAIL"* ]]; then exit 23; fi
if [ "$*" = "install --frozen-lockfile" ]; then
  touch "$FIXTURE_ROOT/installiert"
  if [ "\${FIXTURE_HOLD:-0}" = 1 ]; then
    touch "$FIXTURE_ROOT/bereit"
    for _ in $(seq 1 500); do
      [ ! -f "$FIXTURE_ROOT/freigabe" ] || break
      /bin/sleep 0.01
    done
  fi
fi
if [ "$*" = "run build --outDir dist.new" ]; then
  mkdir -p dist.new/en; printf neu > dist.new/index.html; printf en > dist.new/en/index.html
  printf 'robots' > dist.new/robots.txt
  [ "\${FIXTURE_NO_404:-0}" = 1 ] || printf '404' > dist.new/404.html
fi
if [[ "$*" == apps/frontend/tools/pruefe-seo.ts* ]]; then
  # Das SEO-Gate liest nur den neuen Build; ohne dist.new/index.html schlägt es fehl.
  [ -s "\${@: -1}/index.html" ] || exit 25
  printf '{"erfolgreich":true}\\n' > "$FIXTURE_ROOT/.deploy/seo-audit.json"
fi
if [ "$*" = "run apps/backend/src/index.ts" ]; then
  printf 'daemon %s %s %s\\n' "$PWD" "$NODE_ENV" "$CI" >> "$FIXTURE_ROOT/aufrufe"
fi
`,
  );
  await chmod(join(root, "bin/bun"), 0o755);
  await writeFile(
    join(root, "sicherheit.sh"),
    `# Wird von jeder Test-Bash geladen; nichts erreicht das Betriebssystem.
git() {
  printf 'git %s\\n' "$*" >> "$FIXTURE_ROOT/aufrufe"
  case "$*" in
    'status --porcelain --untracked-files=no')
      if [ "\${FIXTURE_MODIFIED:-0}" = 1 ]; then printf ' M scripts/deploy.sh\\n'; fi
      return 0 ;;
    'ls-files --others --exclude-standard -- apps packages scripts')
      if [ "\${FIXTURE_UNTRACKED_SRC:-0}" = 1 ]; then printf 'apps/frontend/src/pages/unreviewed.astro\\n'; fi
      return 0 ;;
    'ls-files --others --exclude-standard')
      if [ "\${FIXTURE_UNTRACKED:-0}" = 1 ]; then printf 'ploi-1a2b3c.sh\\n'; fi
      return 0 ;;
    'rev-parse HEAD^{commit}')
      if [ "\${FIXTURE_HEAD_DRIFT:-0}" = 1 ] && [ -f "$FIXTURE_ROOT/installiert" ]; then printf 'ffffffffffffffffffffffffffffffffffffffff\\n'; else printf '${sha}\\n'; fi ;;
    'fetch origin'|'reset --hard origin/main') return 0 ;;
    *) return 97 ;;
  esac
}
supervisor_status_zeile() {
  # Zustand des simulierten Supervisor-Programms worker-123. Die Exitcodes sind
  # die von supervisorctl: 0 nur, solange alle Prozesse laufen, 3 (LSB "not
  # running") bei STOPPED/EXITED/FATAL und 4 bei unbekanntem Programm.
  local modus="\${FIXTURE_WORKER:-ok}" gestartet=0 zaehler
  [ -f "$FIXTURE_ROOT/worker-start" ] && gestartet=1
  case "$modus" in
    missing) printf 'worker-123:*: ERROR (no such process)\\n'; return 4 ;;
    stopped) if [ "$gestartet" = 1 ]; then printf 'worker-123:worker-123_00   RUNNING   pid 4712, uptime 0:00:01\\n'; return 0; else printf 'worker-123:worker-123_00   STOPPED   Sep 07 10:00 AM\\n'; return 3; fi ;;
    foreign) printf 'worker-123:worker-123_00   RUNNING   pid 9999, uptime 0:10:00\\n'; return 0 ;;
    unchanged) printf 'worker-123:worker-123_00   RUNNING   pid 4711, uptime 0:10:00\\n'; return 0 ;;
    new-foreign) if [ "$gestartet" = 1 ]; then printf 'worker-123:worker-123_00   RUNNING   pid 9999, uptime 0:00:01\\n'; else printf 'worker-123:worker-123_00   RUNNING   pid 4711, uptime 0:10:00\\n'; fi; return 0 ;;
    unstable)
      if [ "$gestartet" = 1 ]; then
        zaehler=$(( $(cat "$FIXTURE_ROOT/status-zaehler" 2>/dev/null || echo 0) + 1 )); printf '%s' "$zaehler" > "$FIXTURE_ROOT/status-zaehler"
        printf 'worker-123:worker-123_00   RUNNING   pid %s, uptime 0:00:01\\n' "$((4712 + zaehler))"
      else printf 'worker-123:worker-123_00   RUNNING   pid 4711, uptime 0:10:00\\n'; fi; return 0 ;;
    start-fail) printf 'worker-123:worker-123_00   FATAL   Exited too quickly\\n'; return 3 ;;
    *) if [ "$gestartet" = 1 ]; then printf 'worker-123:worker-123_00   RUNNING   pid 4712, uptime 0:00:01\\n'; else printf 'worker-123:worker-123_00   RUNNING   pid 4711, uptime 0:10:00\\n'; fi; return 0 ;;
  esac
}
sudo() {
  printf 'sudo %s\\n' "$*" >> "$FIXTURE_ROOT/aufrufe"
  [ "$1" = -n ] && [ "$2" = /usr/bin/supervisorctl ] || return 98
  [ "\${FIXTURE_WORKER:-ok}" != denied ] || { printf 'sudo: a password is required\\n' >&2; return 1; }
  [ "$4" = 'worker-123:*' ] || { printf '%s: ERROR (no such process)\\n' "$4"; return 1; }
  case "$3" in
    status) supervisor_status_zeile ;;
    stop) printf 'worker-123:worker-123_00: stopped\\n'; touch "$FIXTURE_ROOT/worker-stop" ;;
    start)
      if [ "\${FIXTURE_WORKER:-ok}" = start-fail ]; then printf 'worker-123:worker-123_00: ERROR (spawn error)\\n'; return 1; fi
      printf 'worker-123:worker-123_00: started\\n'; touch "$FIXTURE_ROOT/worker-start" ;;
    *) return 99 ;;
  esac
}
readlink() {
  case "$*" in
    '-f /proc/4711/cwd'|'-f /proc/4712/cwd'|'-f /proc/4713/cwd'|'-f /proc/4714/cwd') printf '%s\\n' "$FIXTURE_ROOT" ;;
    '-f /proc/9999/cwd') printf '/fremdes-projekt\\n' ;;
    -f\\ /proc/*/exe) printf '%s/bin/bun\\n' "$FIXTURE_ROOT" ;;
    *) command readlink "$@" ;;
  esac
}
curl() {
  printf 'curl %s\\n' "$*" >> "$FIXTURE_ROOT/aufrufe"
  [ "\${FIXTURE_HEALTH:-ok}" = ok ]
}
pgrep() { printf 'pgrep %s\\n' "$*" >> "$FIXTURE_ROOT/aufrufe"; return 1; }
pkill() { printf 'pkill %s\\n' "$*" >> "$FIXTURE_ROOT/aufrufe"; return 1; }
kill() { printf 'kill %s\\n' "$*" >> "$FIXTURE_ROOT/aufrufe"; return 1; }
sleep() { :; }
mv() {
  if [ "\${FIXTURE_PUBLISH_FAIL:-0}" = 1 ] && [ "$1" = "$FIXTURE_ROOT/apps/frontend/dist.new" ]; then return 24; fi
  /bin/mv "$@"
}
flock() {
  if [ -n "$FIXTURE_FLOCK_BIN" ]; then "$FIXTURE_FLOCK_BIN" "$@"; return; fi
  if [ -z "$FIXTURE_PYTHON_BIN" ]; then return 0; fi
  # Python schließt nur seine Kopie; die aufrufende Bash hält den Lock weiter.
  local fd="\${*: -1}" art="EX"
  case "$*" in *-s*) art="SH" ;; esac
  "$FIXTURE_PYTHON_BIN" -c 'import fcntl,sys
fd=int(sys.argv[1]); art=getattr(fcntl, "LOCK_"+sys.argv[2])
try: fcntl.flock(fd, art | fcntl.LOCK_NB)
except (BlockingIOError, OSError): sys.exit(1)' "$fd" "$art"
}
`,
  );
  const env = {
    PATH: `${join(root, "bin")}:/usr/bin:/bin`,
    HOME: root,
    BUN_INSTALL: root,
    BASH_ENV: join(root, "sicherheit.sh"),
    FIXTURE_ROOT: root,
    FIXTURE_FLOCK_BIN: flockProgramm ?? "",
    FIXTURE_PYTHON_BIN: pythonProgramm ?? "",
    STARTER_LOCK_WAIT: "1",
    ...variablen,
  };
  aktiveFixtures.add(dispose);
  return {
    root,
    async env(inhalt: string) {
      await writeFile(join(root, ".env"), inhalt);
    },
    run(skript = "deploy.sh", argumente: string[] = [], zeitlimit = 20_000) {
      if (geschlossen) throw new Error("Die Deploy-Fixture ist bereits geschlossen.");
      let abgelaufen = false;
      const prozess = Bun.spawn(["/bin/bash", join(root, "scripts", skript), ...argumente], {
        cwd: tmpdir(),
        env,
        stdout: "pipe",
        stderr: "pipe",
        detached: true,
        timeout: zeitlimit + 1_000,
        killSignal: "SIGKILL",
      });
      prozesse.add(prozess);
      const timer = setTimeout(() => {
        abgelaufen = true;
        beenden(prozess);
      }, zeitlimit);
      const ergebnis = (async () => {
        try {
          const [stdout, stderr, code] = await Promise.all([
            new Response(prozess.stdout).text(),
            new Response(prozess.stderr).text(),
            prozess.exited,
          ]);
          if (abgelaufen) throw new Error(`Deploy-Fixture ${skript}: Zeitlimit überschritten.`);
          if (geschlossen) throw new Error("Die Deploy-Fixture wurde abgebrochen.");
          return { code, ausgabe: stdout + stderr, aufrufe: await text(join(root, "aufrufe")) };
        } finally {
          clearTimeout(timer);
          prozesse.delete(prozess);
        }
      })();
      ausfuehrungen.add(ergebnis);
      void ergebnis.finally(() => ausfuehrungen.delete(ergebnis)).catch(() => {});
      return ergebnis;
    },
    dispose,
  };
}

async function unveraendert(root: string) {
  expect(await text(join(root, "apps/frontend/dist/index.html"))).toBe("bisherig");
  expect(await text(join(root, "apps/frontend/dist.old/index.html"))).toBe("aelter");
  expect(await text(join(root, ".deploy/last-built-sha"))).toBe("vorheriger-erfolg\n");
}

describe.skipIf(!linux)("deploy.sh", () => {
  test("fehlerhafte .env bleibt geheim und bricht vor jeder Aktion ab; Zeilennummer wird genannt", async () => {
    for (const inhalt of [
      null,
      "STARTER_TEST_SECRET=fixture-secret-value\nSECRET='fixture-secret-value\n",
      "NODE_ENV=production\nGUT=1\nSCHLECHT=fixture-secret-value hat leerzeichen\n",
    ]) {
      const f = await fixture();
      try {
        if (inhalt === null) await rm(join(f.root, ".env"));
        else await f.env(inhalt);
        const r = await f.run();
        expect(r.code, `${String(inhalt)}: ${r.ausgabe}`).not.toBe(0);
        expect(r.ausgabe).toContain("Abbruch:");
        expect(r.ausgabe).not.toContain("fixture-secret-value");
        if (inhalt?.includes("SCHLECHT")) expect(r.ausgabe).toContain("Zeile 3");
        expect(r.aufrufe).toBe("");
      } finally {
        await f.dispose();
      }
    }
  }, 60_000);

  test("NODE_ENV muss in der .env auf production stehen", async () => {
    const f = await fixture();
    try {
      await f.env(produktionsEnv.replace("NODE_ENV=production", "NODE_ENV=development"));
      const r = await f.run();
      expect(r.code).not.toBe(0);
      expect(r.ausgabe).toContain("NODE_ENV=production");
      expect(r.aufrufe).toBe("");
    } finally {
      await f.dispose();
    }
  }, 30_000);

  test("Bun-Pin, RESET_DB, PORT, DATABASE_URL und PLOI_WORKER_ID werden vor der Installation geprüft", async () => {
    for (const fall of [
      { vars: { FIXTURE_VERSION: "1.4.1" }, meldung: "Bun 1.4.2 erforderlich" },
      { env: produktionsEnv + "RESET_DB=true\n", meldung: "RESET_DB" },
      { env: produktionsEnv.replace("PORT=3005", "PORT=65536"), meldung: "PORT" },
      { env: produktionsEnv.replace(/DATABASE_URL=.*\n/, ""), meldung: "DATABASE_URL" },
      { env: produktionsEnv.replace(/PLOI_WORKER_ID=.*\n/, ""), meldung: "PLOI_WORKER_ID" },
      {
        env: produktionsEnv.replace("PLOI_WORKER_ID=123", "PLOI_WORKER_ID=worker-123"),
        meldung: "Zahl",
      },
    ]) {
      const f = await fixture(fall.vars ?? {});
      try {
        if (fall.env) await f.env(fall.env);
        const r = await f.run();
        expect(r.code, JSON.stringify(fall)).not.toBe(0);
        expect(r.ausgabe).toContain(fall.meldung);
        expect(r.aufrufe).not.toContain("bun install");
        expect(r.aufrufe).not.toContain("supervisorctl stop");
        await unveraendert(f.root);
      } finally {
        await f.dispose();
      }
    }
  }, 60_000);

  test("Worker-Vorprüfung: unbekanntes Programm, fehlende sudo-Freigabe und fremdes Projekt stoppen vor der Installation", async () => {
    for (const fall of ["missing", "denied", "foreign"]) {
      const f = await fixture({ FIXTURE_WORKER: fall });
      try {
        const r = await f.run();
        expect(r.code, fall).not.toBe(0);
        expect(r.aufrufe).toContain("sudo -n /usr/bin/supervisorctl status worker-123:*");
        expect(r.aufrufe).not.toContain("bun install");
        expect(r.aufrufe).not.toContain("supervisorctl stop");
        expect(r.aufrufe).not.toContain("supervisorctl start");
        if (fall === "foreign") expect(r.ausgabe).toContain("anderen Projekt");
        await unveraendert(f.root);
      } finally {
        await f.dispose();
      }
    }
  }, 60_000);

  test("versionierte Abweichungen und unversionierte Quelldateien brechen ab; Plois Hook-Datei ist nur ein Hinweis", async () => {
    for (const vars of [{ FIXTURE_MODIFIED: "1" }, { FIXTURE_UNTRACKED_SRC: "1" }]) {
      const f = await fixture(vars);
      try {
        const r = await f.run();
        expect(r.code).not.toBe(0);
        expect(r.aufrufe).not.toContain("bun install");
        await unveraendert(f.root);
      } finally {
        await f.dispose();
      }
    }
    const f = await fixture({ FIXTURE_UNTRACKED: "1" });
    try {
      const r = await f.run();
      expect(r.code, r.ausgabe).toBe(0);
      expect(r.ausgabe).toContain("ploi-1a2b3c.sh");
      expect(r.ausgabe).toContain("Hinweis");
    } finally {
      await f.dispose();
    }
  }, 60_000);

  test("fehlgeschlagene Gates und Audits lassen Datenbank, Daemon und bisherigen Build unangetastet", async () => {
    for (const vars of [
      { FIXTURE_FAIL: "validate-env.ts" },
      { FIXTURE_FAIL: "run lint" },
      { FIXTURE_FAIL: "run typecheck" },
      { FIXTURE_FAIL: "test apps packages" },
      { FIXTURE_FAIL: "run build" },
      { FIXTURE_FAIL: "pruefe-seo" },
      { FIXTURE_NO_404: "1" },
      { FIXTURE_HEAD_DRIFT: "1" },
    ]) {
      const f = await fixture(vars);
      try {
        const r = await f.run();
        expect(r.code, JSON.stringify(vars)).not.toBe(0);
        expect(r.aufrufe).toContain("bun install --frozen-lockfile");
        expect(r.aufrufe).not.toContain("db:migrate");
        expect(r.aufrufe).not.toContain("supervisorctl stop");
        expect(r.aufrufe).not.toContain("supervisorctl start");
        if ("FIXTURE_NO_404" in vars) expect(r.ausgabe).toContain("404.html");
        if ("FIXTURE_HEAD_DRIFT" in vars) expect(r.ausgabe).toContain("verändert");
        await unveraendert(f.root);
      } finally {
        await f.dispose();
      }
    }
  }, 90_000);

  test("Publikationsfehler stellt dist wieder her, ohne den Daemon anzufassen", async () => {
    const f = await fixture({ FIXTURE_PUBLISH_FAIL: "1" });
    try {
      const r = await f.run();
      expect(r.code).not.toBe(0);
      expect(r.aufrufe).toContain("db:migrate");
      expect(r.aufrufe).not.toContain("supervisorctl stop");
      expect(await text(join(f.root, "apps/frontend/dist/index.html"))).toBe("bisherig");
      expect(await text(join(f.root, ".deploy/last-built-sha"))).toBe("vorheriger-erfolg\n");
      expect(r.ausgabe).toContain("wiederhergestellt");
    } finally {
      await f.dispose();
    }
  }, 30_000);

  test("Erfolg: Build vor Migration, Migration vor Veröffentlichung, stop+start nur des eigenen Programms, neue PID mit Health, Marker", async () => {
    const f = await fixture();
    try {
      const r = await f.run();
      expect(r.code, r.ausgabe).toBe(0);
      const reihenfolge = [
        "bun install --frozen-lockfile",
        "bun apps/backend/src/validate-env.ts",
        "bun run lint",
        "bun run typecheck",
        "bun test apps packages",
        "bun run build --outDir dist.new",
        "bun apps/frontend/tools/pruefe-seo.ts --dist",
        "bun run db:migrate",
        "sudo -n /usr/bin/supervisorctl stop worker-123:*",
        "sudo -n /usr/bin/supervisorctl start worker-123:*",
        "curl --fail --silent --max-time 3 --connect-timeout 1 http://127.0.0.1:3005/health",
      ].map((aufruf) => r.aufrufe.indexOf(aufruf));
      for (let i = 0; i < reihenfolge.length; i++) {
        expect(reihenfolge[i], `${i}`).toBeGreaterThanOrEqual(0);
        if (i > 0) expect(reihenfolge[i]).toBeGreaterThan(reihenfolge[i - 1]!);
      }
      expect(r.aufrufe).not.toMatch(/\b(pgrep|pkill|kill) /);
      expect(r.aufrufe).not.toContain("format:check");
      expect(r.aufrufe.match(/curl /g)?.length ?? 0).toBeGreaterThanOrEqual(2);
      expect(await text(join(f.root, "apps/frontend/dist/index.html"))).toBe("neu");
      expect(await text(join(f.root, "apps/frontend/dist.old/index.html"))).toBe("bisherig");
      expect(await text(join(f.root, ".deploy/last-built-sha"))).toBe(`${sha}\n`);
      expect(r.ausgabe).toContain("PID 4712");
      // Das SEO-Gate lief gegen dist.new und hinterließ seinen Bericht.
      expect(r.aufrufe).toContain(`pruefe-seo.ts --dist ${f.root}/apps/frontend/dist.new`);
      expect(await text(join(f.root, ".deploy/seo-audit.json"))).toContain('"erfolgreich":true');
      // Der optionale Daemon-Wrapper startet mit derselben geprüften Umgebung.
      const daemon = await f.run("start-backend.sh");
      expect(daemon.code, daemon.ausgabe).toBe(0);
      expect(daemon.aufrufe).toContain(`daemon ${f.root} production true`);
    } finally {
      await f.dispose();
    }
  }, 60_000);

  test("gestoppter Daemon (Erstdeploy) wird ohne stop gestartet", async () => {
    const f = await fixture({ FIXTURE_WORKER: "stopped" });
    try {
      const r = await f.run();
      expect(r.code, r.ausgabe).toBe(0);
      expect(r.ausgabe).toContain("läuft derzeit nicht");
      expect(r.aufrufe).not.toContain("supervisorctl stop");
      expect(r.aufrufe).toContain("supervisorctl start worker-123:*");
      expect(await text(join(f.root, ".deploy/last-built-sha"))).toBe(`${sha}\n`);
    } finally {
      await f.dispose();
    }
  }, 30_000);

  test("Backend-Abnahme scheitert bei gleicher PID, Startfehler, instabiler PID, fremder PID oder rotem Health-Check", async () => {
    for (const vars of [
      { FIXTURE_WORKER: "unchanged" },
      { FIXTURE_WORKER: "start-fail" },
      { FIXTURE_WORKER: "unstable" },
      { FIXTURE_WORKER: "new-foreign" },
      { FIXTURE_HEALTH: "fehler" },
    ]) {
      const f = await fixture(vars);
      try {
        const r = await f.run();
        expect(r.code, JSON.stringify(vars)).not.toBe(0);
        expect(r.aufrufe).toContain("db:migrate");
        expect(r.aufrufe).toContain("supervisorctl start worker-123:*");
        expect(await text(join(f.root, "apps/frontend/dist/index.html"))).toBe("neu");
        expect(await text(join(f.root, "apps/frontend/dist.old/index.html"))).toBe("bisherig");
        expect(await text(join(f.root, ".deploy/last-built-sha"))).toBe("vorheriger-erfolg\n");
        expect(r.ausgabe).toContain("Backend-Abnahme fehlgeschlagen");
        if ("FIXTURE_WORKER" in vars && vars.FIXTURE_WORKER === "new-foreign")
          expect(r.ausgabe).toContain("anderen Projekt");
      } finally {
        await f.dispose();
      }
    }
  }, 90_000);

  test.skipIf(!flockProgramm && !pythonProgramm)(
    "Deploy-Lock: zweiter Deploy wartet höchstens STARTER_LOCK_WAIT und bricht ab; Cronjob setzt währenddessen aus",
    async () => {
      const f = await fixture({ FIXTURE_HOLD: "1" });
      try {
        const runSh = join(f.root, "scripts/cronjobs/run.sh");
        await writeFile(runSh, (await text(runSh)).replace("  *)\n", "  demo) ;;\n  *)\n"));
        const erster = f.run();
        for (let i = 0; i < 200 && !(await Bun.file(join(f.root, "bereit")).exists()); i++)
          await Bun.sleep(10);
        expect(await Bun.file(join(f.root, "bereit")).exists()).toBe(true);
        const zweiter = await f.run();
        expect(zweiter.code).not.toBe(0);
        expect(zweiter.ausgabe).toContain("hält den Lock");
        const cron = await f.run("cronjobs/run.sh", ["demo"]);
        expect(cron.code, cron.ausgabe).toBe(0);
        expect(cron.ausgabe).toContain("setzt aus");
        expect(cron.aufrufe).not.toContain("jobs/demo.ts");
        await writeFile(join(f.root, "freigabe"), "1");
        const fertig = await erster;
        expect(fertig.code, fertig.ausgabe).toBe(0);
        expect(fertig.aufrufe.match(/bun install/g)).toHaveLength(1);
      } finally {
        await f.dispose();
      }
    },
    60_000,
  );

  test("Cron-Wrapper: unbekannter Job endet mit Exit 2 ohne Bun-Aufruf; freigeschalteter Job läuft mit Produktionsumgebung", async () => {
    const f = await fixture();
    try {
      const unbekannt = await f.run("cronjobs/run.sh", ["fremd"]);
      expect(unbekannt.code).toBe(2);
      expect(unbekannt.aufrufe).toBe("");
      const runSh = join(f.root, "scripts/cronjobs/run.sh");
      await writeFile(runSh, (await text(runSh)).replace("  *)\n", "  demo) ;;\n  *)\n"));
      const job = await f.run("cronjobs/run.sh", ["demo"]);
      expect(job.code, job.ausgabe).toBe(0);
      expect(job.aufrufe).toContain("bun run apps/backend/src/jobs/demo.ts");
      expect(job.ausgabe).toContain("demo beendet (Code 0)");
      await f.env(produktionsEnv.replace("NODE_ENV=production", "NODE_ENV=development"));
      await writeFile(join(f.root, "aufrufe"), "");
      const dev = await f.run("cronjobs/run.sh", ["demo"]);
      expect(dev.code).not.toBe(0);
      expect(dev.aufrufe).not.toContain("jobs/demo.ts");
    } finally {
      await f.dispose();
    }
  }, 60_000);

  test("Ploi-Hook-Spiegel: fetch, reset --hard und Übergabe an deploy.sh", async () => {
    const f = await fixture();
    try {
      const datei = join(f.root, "scripts/ploi-autodeploy.sh");
      await writeFile(
        datei,
        (await text(datei))
          .replaceAll("{SITE_DIRECTORY}", f.root)
          .replaceAll("{BRANCH}", "main")
          .replaceAll("{COMMIT_HASH}", sha),
      );
      const r = await f.run("ploi-autodeploy.sh");
      expect(r.code, r.ausgabe).toBe(0);
      expect(r.aufrufe.indexOf("git fetch origin")).toBeLessThan(
        r.aufrufe.indexOf("git reset --hard origin/main"),
      );
      expect(r.aufrufe.indexOf("git reset --hard origin/main")).toBeLessThan(
        r.aufrufe.indexOf("bun --version"),
      );
      expect(await text(join(f.root, ".deploy/last-built-sha"))).toBe(`${sha}\n`);
    } finally {
      await f.dispose();
    }
  }, 30_000);

  test("Zeitlimit und expliziter Abbruch räumen laufende Fixture-Prozessgruppen auf", async () => {
    const f = await fixture();
    try {
      await writeFile(join(f.root, "scripts/haengt.sh"), "/bin/sleep 60 &\nwait\n");
      await expect(f.run("haengt.sh", [], 100)).rejects.toThrow("Zeitlimit überschritten");
      const laufend = f.run("haengt.sh");
      await f.dispose();
      await expect(laufend).rejects.toThrow("abgebrochen");
      expect(await Bun.file(join(f.root, ".env")).exists()).toBe(false);
    } finally {
      await f.dispose();
    }
  }, 30_000);
});
