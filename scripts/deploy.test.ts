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

import { afterEach, expect, test } from "bun:test";

const sha = "1234567890abcdef1234567890abcdef12345678";
const flockProgramm = Bun.which("flock");
const pythonProgramm = Bun.which("python3");
const aktiveFixtures = new Set<() => Promise<void>>();

// Bun bricht einen Test ab, ohne dessen asynchrone Arbeit automatisch zu stoppen.
afterEach(async () => {
  await Promise.all([...aktiveFixtures].map((dispose) => dispose()));
}, 10_000);

async function text(datei: string): Promise<string> {
  return readFile(datei, "utf8").catch(() => "");
}

/** Nur Skriptkopien und simulierte Prozesse: niemals echte Bun-/Git-/HTTP-Aufrufe. */
async function fixture(variablen: Record<string, string> = {}) {
  const root = await realpath(await mkdtemp(join(tmpdir(), "starter-deploy-test-")));
  const prozesse = new Set<ReturnType<typeof Bun.spawn>>();
  const ausfuehrungen = new Set<Promise<unknown>>();
  let geschlossen = false;
  let aufraeumen: Promise<void> | undefined;

  function beenden(prozess: ReturnType<typeof Bun.spawn>) {
    // detached erzeugt eine eigene POSIX-Prozessgruppe. Nur diese Testgruppe
    // darf beendet werden, einschließlich Kindern, die stdout/Locks offen halten.
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
    "scripts",
    "bin",
    ".deploy",
    "apps/frontend/dist",
    "apps/frontend/dist.old",
  ])
    await mkdir(join(root, ordner), { recursive: true });
  for (const name of ["deploy.sh", "deploy-common.sh", "start-backend.sh", "ploi-autodeploy.sh"])
    await copyFile(new URL(name, import.meta.url), join(root, "scripts", name));
  await writeFile(join(root, ".bun-version"), "1.4.2\n");
  await writeFile(
    join(root, ".env"),
    "DATABASE_URL=postgres://fixture.invalid/test\nPORT=3005\nDEPLOY_REPOSITORY=https://github.com/Pote16/astro-starwind-hono-starter.git\n",
  );
  await writeFile(join(root, "apps/frontend/dist/index.html"), "bisherig");
  await writeFile(join(root, "apps/frontend/dist.old/index.html"), "aelter");
  await writeFile(join(root, ".deploy/last-built-sha"), "vorheriger-erfolg\n");
  await writeFile(
    join(root, "bin/bun"),
    `#!/bin/bash
set -eu
printf 'bun %s\\n' "$*" >> "$FIXTURE_ROOT/aufrufe"
if [ "$*" = "--version" ]; then printf '%s\\n' "\${FIXTURE_VERSION:-1.4.2}"; exit 0; fi
if [ -n "\${FIXTURE_FAIL:-}" ] && [[ "$*" == *"$FIXTURE_FAIL"* ]]; then exit 23; fi
if [ "$*" = "install --frozen-lockfile" ] && [ "\${FIXTURE_HOLD:-0}" = 1 ]; then
  touch "$FIXTURE_ROOT/bereit"
  for _ in $(seq 1 500); do
    [ ! -f "$FIXTURE_ROOT/freigabe" ] || break
    /bin/sleep 0.01
  done
fi
if [ "$*" = "run build --outDir dist.new" ]; then
  mkdir -p dist.new; printf neu > dist.new/index.html
fi
if [ "$*" = "run apps/backend/src/index.ts" ]; then
  printf 'daemon %s %s %s\\n' "$PWD" "$NODE_ENV" "$CI" >> "$FIXTURE_ROOT/aufrufe"
fi
`,
  );
  await chmod(join(root, "bin/bun"), 0o755);
  await writeFile(
    join(root, "sicherheit.sh"),
    `# Wird von jeder Test-Bash geladen; kill erreicht niemals das Betriebssystem.
git() {
  printf 'git %s\\n' "$*" >> "$FIXTURE_ROOT/aufrufe"
  case "$*" in
    'diff --quiet'|'diff --cached --quiet') return 0 ;;
    'ls-files --others --exclude-standard')
      [ "\${FIXTURE_UNTRACKED_FAIL:-0}" != 1 ] || return 1
      if [ "\${FIXTURE_UNTRACKED:-0}" = 1 ]; then printf 'apps/frontend/src/pages/unreviewed.astro\\n'; fi
      return 0 ;;
    'rev-parse HEAD^{commit}') printf '%s\\n' "\${FIXTURE_HEAD:-${sha}}" ;;
    'rev-parse FETCH_HEAD^{commit}') printf '${sha}\\n' ;;
    'symbolic-ref --short HEAD') printf 'main\\n' ;;
    'remote get-url origin') printf '%s\\n' "\${FIXTURE_ORIGIN:-https://github.com/Pote16/astro-starwind-hono-starter.git}" ;;
    'fetch --no-tags origin main'|'merge --ff-only ${sha}') return 0 ;;
    *) return 97 ;;
  esac
}
pgrep() {
  printf 'pgrep %s\\n' "$*" >> "$FIXTURE_ROOT/aufrufe"
  if [ -f "$FIXTURE_ROOT/terminiert" ] && [ "\${FIXTURE_NO_NEW:-0}" != 1 ]; then printf '410003\\n410002\\n'; else printf '410001\\n410002\\n'; fi
}
sudo() {
  # Auch bei fehlerhaften Argumenten niemals an echtes sudo weiterreichen.
  printf 'sudo %s\\n' "$*" >> "$FIXTURE_ROOT/aufrufe"
  if [ "$#" = 5 ]; then
    [ "$1" = -n ] && [ "$2" = -l ] && [ "$3" = /usr/bin/supervisorctl ] && [ "$4" = restart ] && [ "$5" = worker-123:worker-123_00 ] || return 98
    [ "\${FIXTURE_WORKER:-ok}" != restart-denied ]; return
  fi
  [ "$#" = 4 ] && [ "$1" = -n ] && [ "$2" = /usr/bin/supervisorctl ] && [ "$4" = worker-123:worker-123_00 ] || return 98
  case "\${FIXTURE_WORKER:-ok}" in
    denied|missing) return 1 ;;
  esac
  case "$3" in
    pid)
      case "\${FIXTURE_WORKER:-ok}" in
        foreign) printf '410002\\n'; return ;;
        drift) if [ "$(cat "$FIXTURE_ROOT/apps/frontend/dist/index.html")" = neu ]; then printf '410002\\n'; return; fi ;;
        zero) printf '0\\n'; return ;;
        multiple) printf '410001\\n410003\\n'; return ;;
      esac
      if [ -f "$FIXTURE_ROOT/worker-restart" ]; then
        case "\${FIXTURE_WORKER:-ok}" in
          unchanged) printf '410001\\n' ;;
          new-foreign) printf '410002\\n' ;;
          unstable) if [ -f "$FIXTURE_ROOT/http-geprueft" ]; then printf '410004\\n'; else printf '410003\\n'; fi ;;
          *) printf '410003\\n' ;;
        esac
      else printf '410001\\n'; fi ;;
    restart)
      [ "\${FIXTURE_WORKER:-ok}" != restart-fail ] || return 1
      touch "$FIXTURE_ROOT/worker-restart" ;;
    *) return 99 ;;
  esac
}
readlink() {
  case "$*" in
    '-f /proc/410001/cwd'|'-f /proc/410003/cwd'|'-f /proc/410004/cwd') printf '%s\\n' "$FIXTURE_ROOT" ;;
    '-f /proc/410002/cwd') printf '/fremdes-projekt\\n' ;;
    *) case "$*" in
      *'/fd/9') printf '%s/.deploy/deploy.lock\\n' "$FIXTURE_ROOT" ;;
      *) return 98 ;;
    esac ;;
  esac
}
kill() {
  printf 'kill %s\\n' "$*" >> "$FIXTURE_ROOT/aufrufe"
  case "$*" in
    '-0 410001') [ ! -f "$FIXTURE_ROOT/beendet" ] ;;
    '410001') touch "$FIXTURE_ROOT/terminiert" ;;
    '-9 410001') touch "$FIXTURE_ROOT/beendet" ;;
    *) return 99 ;;
  esac
}
curl() {
  printf 'curl %s\\n' "$*" >> "$FIXTURE_ROOT/aufrufe"
  touch "$FIXTURE_ROOT/http-geprueft"
  [ "\${FIXTURE_HEALTH:-ok}" = ok ]
}
sleep() { :; }
mv() {
  if [ "\${FIXTURE_PUBLISH_FAIL:-0}" = 1 ] && [ "$1" = "$FIXTURE_ROOT/apps/frontend/dist.new" ]; then return 24; fi
  /bin/mv "$@"
}
flock() {
  if [ -n "$FIXTURE_FLOCK_BIN" ]; then "$FIXTURE_FLOCK_BIN" "$@"; return; fi
  if [ -z "$FIXTURE_PYTHON_BIN" ]; then
    # Ohne Lock-Werkzeug bleiben die Kontrollflusstests lauffähig. Ausschließlich
    # der echte Konkurrenztest wird dann ausdrücklich übersprungen.
    [ -e /dev/fd/9 ]; return
  fi
  # Python schließt nur seine Kopie; die aufrufende Bash hält den Lock weiter.
  "$FIXTURE_PYTHON_BIN" -c 'import fcntl,sys
try: fcntl.flock(9, fcntl.LOCK_EX | fcntl.LOCK_NB)
except (BlockingIOError, OSError): sys.exit(1)'
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
    ...variablen,
  };
  aktiveFixtures.add(dispose);
  return {
    root,
    async env(inhalt: string) {
      await writeFile(join(root, ".env"), inhalt);
    },
    run(skript = "deploy.sh", zeitlimit = 20_000) {
      if (geschlossen) throw new Error("Die Deploy-Fixture ist bereits geschlossen.");
      let abgelaufen = false;
      const prozess = Bun.spawn(["/bin/bash", join(root, "scripts", skript)], {
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
      // Der Konkurrenztest wartet erst später auf seinen ersten Prozess.
      // Auch bei vorherigem Testabbruch muss dessen Ablehnung behandelt sein.
      void ergebnis.finally(() => ausfuehrungen.delete(ergebnis)).catch(() => {});
      return ergebnis;
    },
    dispose,
  };
}

test("fehlerhafte Umgebung bleibt geheim und bricht vor jeder Runtime-/Deployaktion ab", async () => {
  for (const inhalt of [
    null,
    "STARTER_TEST_SECRET=fixture-secret-value\n$NICHT_GESETZT\n",
    "SECRET='fixture-secret-value\n",
  ]) {
    const f = await fixture();
    try {
      if (inhalt === null) await rm(join(f.root, ".env"));
      else await f.env(inhalt);
      const r = await f.run();
      expect(r.code, `${String(inhalt)}: ${r.ausgabe}`).not.toBe(0);
      expect(r.ausgabe).toContain("Abbruch:");
      expect(r.ausgabe).not.toContain("fixture-secret-value");
      expect(r.aufrufe).toBe("");
    } finally {
      await f.dispose();
    }
  }
}, 60_000);

test("Bun-Pin und Produktionsschutz blockieren Installation und Datenbankänderungen", async () => {
  for (const vars of [
    { FIXTURE_VERSION: "1.4.1" },
    { RESET_DB: "true" },
    { PORT: "65536" },
    { DATABASE_URL: "" },
  ]) {
    const f = await fixture(vars);
    try {
      // Die .env hat Vorrang vor Supervisor-Werten und wird hier gezielt gesetzt.
      if ("PORT" in vars) await f.env("DATABASE_URL=postgres://fixture.invalid/test\nPORT=65536\n");
      if ("DATABASE_URL" in vars) await f.env("PORT=3005\n");
      const r = await f.run();
      expect(r.code).not.toBe(0);
      expect(r.aufrufe).not.toContain("bun install");
      expect(r.aufrufe).not.toContain("db:migrate");
      expect(await text(join(f.root, "apps/frontend/dist/index.html"))).toBe("bisherig");
    } finally {
      await f.dispose();
    }
  }
}, 60_000);

test("fehlgeschlagene Gates und Umgebung lassen bisherigen Build und Datenbank unangetastet", async () => {
  for (const fehler of [
    "run lint",
    "run typecheck",
    "test",
    "run format:check",
    "run build",
    "validate-env.ts",
  ]) {
    const f = await fixture({ FIXTURE_FAIL: fehler });
    try {
      const r = await f.run();
      expect(r.code).not.toBe(0);
      expect(r.aufrufe).not.toContain("db:migrate");
      expect(r.aufrufe).not.toContain("kill ");
      expect(await text(join(f.root, "apps/frontend/dist/index.html"))).toBe("bisherig");
      expect(await text(join(f.root, "apps/frontend/dist.old/index.html"))).toBe("aelter");
      expect(await text(join(f.root, ".deploy/last-built-sha"))).toBe("vorheriger-erfolg\n");
    } finally {
      await f.dispose();
    }
  }
}, 60_000);

test("Publikationsfehler stellt dist wieder her; späterer Healthfehler meldet keinen Erfolg", async () => {
  for (const vars of [
    { FIXTURE_PUBLISH_FAIL: "1" },
    { FIXTURE_HEALTH: "fehler" },
    { FIXTURE_NO_NEW: "1" },
  ]) {
    const f = await fixture(vars);
    try {
      const r = await f.run();
      expect(r.code).not.toBe(0);
      expect(r.aufrufe).toContain("db:migrate");
      expect(await text(join(f.root, ".deploy/last-built-sha"))).toBe("vorheriger-erfolg\n");
      if ("FIXTURE_PUBLISH_FAIL" in vars) {
        expect(await text(join(f.root, "apps/frontend/dist/index.html"))).toBe("bisherig");
        expect(r.aufrufe).not.toContain("kill ");
        expect(r.ausgabe).toContain("wiederhergestellt");
      } else {
        expect(await text(join(f.root, "apps/frontend/dist/index.html"))).toBe("neu");
        expect(await text(join(f.root, "apps/frontend/dist.old/index.html"))).toBe("bisherig");
        expect(r.ausgabe).toContain("kein vollständiger Release-Rollback");
        if ("FIXTURE_NO_NEW" in vars) expect(r.aufrufe).not.toContain("curl ");
      }
    } finally {
      await f.dispose();
    }
  }
}, 60_000);

test("Ploi-Hook schützt Origin/Zielcommit und übergibt seinen Lock an den Deploy", async () => {
  for (const vars of [
    {},
    { FIXTURE_ORIGIN: "https://example.invalid/anderes-projekt.git" },
    { FIXTURE_HEAD: "lokaler-ahead-commit" },
  ]) {
    const f = await fixture(vars);
    try {
      const datei = join(f.root, "scripts/ploi-autodeploy.sh");
      await writeFile(
        datei,
        (await text(datei)).replace("{SITE_DIRECTORY}", f.root).replace("{BRANCH}", "main"),
      );
      const r = await f.run("ploi-autodeploy.sh");
      if ("FIXTURE_ORIGIN" in vars || "FIXTURE_HEAD" in vars) {
        expect(r.code).not.toBe(0);
        expect(r.aufrufe).not.toContain("bun install");
        if ("FIXTURE_ORIGIN" in vars) expect(r.aufrufe).not.toContain("git fetch");
      } else {
        expect(r.code, r.ausgabe).toBe(0);
        expect(r.aufrufe.indexOf("git merge --ff-only")).toBeLessThan(
          r.aufrufe.indexOf("bun --version"),
        );
        expect(await text(join(f.root, ".deploy/last-built-sha"))).toBe(`${sha}\n`);
      }
    } finally {
      await f.dispose();
    }
  }
  const f = await fixture({ STARTER_DEPLOY_LOCK: "1" });
  try {
    const r = await f.run();
    expect(r.code).not.toBe(0);
    expect(r.aufrufe).not.toContain("bun install");
  } finally {
    await f.dispose();
  }
}, 60_000);

test("Erfolg prüft Staging vor Migration, beendet nur alte eigene PIDs und schreibt Commitmarker", async () => {
  const f = await fixture();
  try {
    const r = await f.run();
    expect(r.code, r.ausgabe).toBe(0);
    expect(r.aufrufe.indexOf("run build --outDir dist.new")).toBeLessThan(
      r.aufrufe.indexOf("db:migrate"),
    );
    expect(r.aufrufe).toContain("bun apps/backend/src/validate-env.ts");
    expect(r.aufrufe).toContain("kill 410001");
    expect(r.aufrufe).toContain("kill -9 410001");
    expect(r.aufrufe).not.toMatch(/kill[^\n]*41000[23]/);
    expect(r.aufrufe).toContain("http://127.0.0.1:3005/health");
    expect(await text(join(f.root, "apps/frontend/dist.old/index.html"))).toBe("bisherig");
    expect(await text(join(f.root, ".deploy/last-built-sha"))).toBe(`${sha}\n`);
    const daemon = await f.run("start-backend.sh");
    expect(daemon.code, daemon.ausgabe).toBe(0);
    expect(daemon.aufrufe).toContain(`daemon ${f.root} production true`);
  } finally {
    await f.dispose();
  }
}, 60_000);

test("konfigurierter Worker blockiert unsichere Namen, fremde PIDs und fehlenden Zugriff vor Installation", async () => {
  for (const fall of [
    { name: "all" },
    { name: "worker-123:all" },
    { name: "worker-123:*" },
    { name: "worker-123 worker-456" },
    { name: "worker-123,worker-456" },
    { name: "--help" },
    { fehler: "denied" },
    { fehler: "restart-denied" },
    { fehler: "missing" },
    { fehler: "foreign" },
    { fehler: "zero" },
    { fehler: "multiple" },
  ]) {
    const f = await fixture({ FIXTURE_WORKER: fall.fehler ?? "ok" });
    try {
      await f.env(
        `DATABASE_URL=postgres://fixture.invalid/test\nPLOI_DAEMON_NAME='${fall.name ?? "worker-123:worker-123_00"}'\n`,
      );
      const r = await f.run();
      expect(r.code, JSON.stringify(fall)).not.toBe(0);
      expect(r.aufrufe).not.toContain("bun install");
      expect(r.aufrufe).not.toContain("db:migrate");
      expect(r.aufrufe).not.toContain("pgrep ");
      expect(r.aufrufe).not.toContain("kill ");
      if (fall.name) expect(r.aufrufe).not.toContain("sudo ");
      expect(await text(join(f.root, "apps/frontend/dist/index.html"))).toBe("bisherig");
    } finally {
      await f.dispose();
    }
  }
}, 60_000);

test("fester Worker startet ausschließlich sein exaktes Ziel und verlangt einen neuen eigenen Prozess", async () => {
  for (const fehler of ["ok", "restart-fail", "unchanged", "new-foreign", "drift", "unstable"]) {
    const f = await fixture({ FIXTURE_WORKER: fehler });
    try {
      await f.env(
        "DATABASE_URL=postgres://fixture.invalid/test\nPLOI_DAEMON_NAME=worker-123:worker-123_00\n",
      );
      const r = await f.run();
      const pidAufruf = "sudo -n /usr/bin/supervisorctl pid worker-123:worker-123_00";
      expect(r.aufrufe).toContain(pidAufruf);
      expect(r.aufrufe.indexOf(pidAufruf)).toBeLessThan(r.aufrufe.indexOf("bun install"));
      expect(
        r.aufrufe.match(/sudo -n \/usr\/bin\/supervisorctl restart worker-123:worker-123_00/g) ??
          [],
      ).toHaveLength(fehler === "drift" ? 0 : 1);
      expect(r.aufrufe).not.toContain("pgrep ");
      expect(r.aufrufe).not.toContain("kill ");
      expect(await text(join(f.root, "apps/frontend/dist.old/index.html"))).toBe("bisherig");
      const marker = await text(join(f.root, ".deploy/last-built-sha"));
      if (fehler === "ok") {
        expect(r.code, r.ausgabe).toBe(0);
        expect(marker).toBe(`${sha}\n`);
        expect(r.aufrufe).toContain("http://127.0.0.1:3005/health");
      } else {
        expect(r.code).not.toBe(0);
        expect(marker).toBe("vorheriger-erfolg\n");
        if (fehler === "unstable") expect(r.aufrufe.match(/curl /g)).toHaveLength(1);
        else expect(r.aufrufe).not.toContain("curl ");
      }
    } finally {
      await f.dispose();
    }
  }
}, 60_000);

test.skipIf(!flockProgramm && !pythonProgramm)(
  "gemeinsamer Lock verhindert einen zweiten Deploy vor der Installation",
  async () => {
    const f = await fixture({ FIXTURE_HOLD: "1" });
    try {
      const erster = f.run();
      for (let i = 0; i < 200 && !(await Bun.file(join(f.root, "bereit")).exists()); i++)
        await Bun.sleep(10);
      expect(await Bun.file(join(f.root, "bereit")).exists()).toBe(true);
      const zweiter = await f.run();
      expect(zweiter.code).not.toBe(0);
      expect(zweiter.ausgabe).toContain("Ein anderer Deploy läuft bereits");
      expect(zweiter.aufrufe.match(/bun install/g)).toHaveLength(1);
      await writeFile(join(f.root, "freigabe"), "1");
      const fertig = await erster;
      expect(fertig.code, fertig.ausgabe).toBe(0);
    } finally {
      await f.dispose();
    }
  },
  60_000,
);

test("unversionierte Dateien und fehlgeschlagene Git-Prüfung stoppen vor Fetch oder Installation", async () => {
  for (const script of ["deploy.sh", "ploi-autodeploy.sh"]) {
    for (const vars of [{ FIXTURE_UNTRACKED: "1" }, { FIXTURE_UNTRACKED_FAIL: "1" }]) {
      const f = await fixture(vars);
      try {
        if (script === "ploi-autodeploy.sh") {
          const path = join(f.root, "scripts", script);
          await writeFile(
            path,
            (await text(path)).replace("{SITE_DIRECTORY}", f.root).replace("{BRANCH}", "main"),
          );
        }
        const result = await f.run(script);
        expect(result.code).not.toBe(0);
        expect(result.aufrufe).toContain("git ls-files --others --exclude-standard");
        expect(result.aufrufe).not.toContain("git fetch");
        expect(result.aufrufe).not.toContain("bun install");
        expect(result.aufrufe).not.toContain("db:migrate");
        expect(result.aufrufe).not.toContain("kill ");
        expect(await text(join(f.root, "apps/frontend/dist/index.html"))).toBe("bisherig");
      } finally {
        await f.dispose();
      }
    }
  }
}, 60_000);

test("Zeitlimit und expliziter Abbruch räumen laufende Fixture-Prozessgruppen auf", async () => {
  const f = await fixture();
  try {
    await writeFile(join(f.root, "scripts/haengt.sh"), "/bin/sleep 60 &\nwait\n");
    await expect(f.run("haengt.sh", 100)).rejects.toThrow("Zeitlimit überschritten");
    const laufend = f.run("haengt.sh");
    await f.dispose();
    await expect(laufend).rejects.toThrow("abgebrochen");
    expect(await Bun.file(join(f.root, ".env")).exists()).toBe(false);
    await f.dispose();
  } finally {
    await f.dispose();
  }
}, 30_000);
