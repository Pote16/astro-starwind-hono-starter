import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, test } from "bun:test";

/**
 * Wie BUN_INSTALL im Deploy ankommt.
 *
 * Auf dem gemeinsamen Ploi-Server entscheidet allein diese Variable, welche
 * Bun-Version ein Deploy benutzt; das Daemon-Kommando liest dieses Skript nie.
 * Am 8.9.2026 stand sie bei cleanlist.app nicht in der Ploi-Environment, und die
 * Meldung nannte den falschen nächsten Schritt. Die Fälle hier halten fest, dass
 * jeder unbrauchbare Zustand eine eigene, wahre Meldung bekommt und nicht still
 * auf die alte gemeinsame Installation zurückfällt.
 */
const skriptOrdner = dirname(fileURLToPath(import.meta.url));
const linux = process.platform === "linux";
const aufraeumen: string[] = [];

afterAll(async () => {
  for (const pfad of aufraeumen) await rm(pfad, { recursive: true, force: true });
});

async function bunAttrappe(pfad: string, version: string): Promise<void> {
  await mkdir(dirname(pfad), { recursive: true });
  await writeFile(pfad, `#!/bin/sh\necho ${version}\n`);
  await chmod(pfad, 0o755);
}

/** Führt starter_umgebung und starter_runtime gegen eine gebaute .env aus. */
async function lauf(
  zeilen: string[],
  optionen: { streng?: boolean } = {},
): Promise<{ code: number; ausgabe: string }> {
  const wurzel = await mkdtemp(join(tmpdir(), "starter-buninstall-"));
  aufraeumen.push(wurzel);
  const pin = (await readFile(join(skriptOrdner, "..", ".bun-version"), "utf8")).trim();

  const heim = join(wurzel, "heim");
  await bunAttrappe(join(heim, ".bun", "bin", "bun"), "1.3.14");
  await bunAttrappe(join(wurzel, "runtime", "bin", "bun"), pin);
  await mkdir(join(wurzel, "ohne-bin"), { recursive: true });

  const site = join(wurzel, "site");
  await mkdir(site, { recursive: true });
  await writeFile(join(site, ".bun-version"), `${pin}\n`);
  await writeFile(
    join(site, ".env"),
    zeilen
      .map((z) =>
        z
          .replaceAll("<runtime>", join(wurzel, "runtime"))
          .replaceAll("<ohnebin>", join(wurzel, "ohne-bin")),
      )
      .join("\n") + "\n",
  );

  const proc = Bun.spawnSync({
    cmd: [
      "bash",
      "-c",
      `set -uo pipefail; . "${join(skriptOrdner, "deploy-common.sh")}"; starter_umgebung && starter_runtime && echo "FERTIG quelle=$STARTER_BUN_QUELLE bun=$(bun --version)"`,
    ],
    env: {
      PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
      HOME: heim,
      ROOT_DIR: site,
      ...(optionen.streng === false ? {} : { STARTER_STRENG: "1" }),
    },
  });
  return {
    code: proc.exitCode ?? -1,
    ausgabe: `${proc.stdout.toString()}${proc.stderr.toString()}`,
  };
}

describe.skipIf(!linux)("BUN_INSTALL im Deploy", () => {
  test("der korrekte Wert läuft durch und nennt die .env als Quelle", async () => {
    const r = await lauf(["NODE_ENV=production", "BUN_INSTALL=<runtime>"]);
    expect(r.ausgabe).toContain("FERTIG");
    expect(r.ausgabe).toContain("quelle=.env");
    expect(r.code).toBe(0);
  });

  test("ein Endslash im Pfad stört nicht", async () => {
    const r = await lauf(["NODE_ENV=production", "BUN_INSTALL=<runtime>/"]);
    expect(r.ausgabe).toContain("FERTIG");
    expect(r.code).toBe(0);
  });

  test("fehlende und auskommentierte Zeile melden den Standard als Quelle", async () => {
    for (const zeilen of [
      ["NODE_ENV=production"],
      ["NODE_ENV=production", "# BUN_INSTALL=<runtime>"],
    ]) {
      const r = await lauf(zeilen);
      expect(r.code, zeilen.join(" | ")).not.toBe(0);
      // Die Meldung nennt die gemessene Binärdatei und die Herkunft, behauptet
      // aber keine der fünf möglichen Ursachen.
      expect(r.ausgabe).toContain("Quelle: Standard");
      expect(r.ausgabe).toContain("ohne führendes #");
    }
  });

  test("Leerzeichen um das Gleichheitszeichen werden gemeldet statt verschluckt", async () => {
    // `source` liefert den Status der letzten Zeile; diese Zeile stünde sonst
    // folgenlos in der Mitte und der Deploy meldete einen ganz anderen Grund.
    const r = await lauf(["NODE_ENV=production", "BUN_INSTALL = <runtime>", "LOG_LEVEL=info"]);
    expect(r.code).not.toBe(0);
    expect(r.ausgabe).toContain("Zeilen, die nichts setzen");
    expect(r.ausgabe).toContain("Zeile 2");
    // Werte gehören nicht ins Protokoll.
    expect(r.ausgabe).not.toContain("LOG_LEVEL");
  });

  test("ein leerer Wert zählt als in der .env gesetzt und bricht ab", async () => {
    const r = await lauf(["NODE_ENV=production", "BUN_INSTALL="]);
    expect(r.code).not.toBe(0);
    expect(r.ausgabe).toContain("ist leer");
    expect(r.ausgabe).toContain("Quelle: .env");
  });

  test("ein relativer Pfad bricht ab, statt in Unterverzeichnissen ins Leere zu zeigen", async () => {
    const r = await lauf(["NODE_ENV=production", "BUN_INSTALL=../runtime"]);
    expect(r.code).not.toBe(0);
    expect(r.ausgabe).toContain("kein absoluter Pfad");
  });

  test("ein Pfad ohne bin/bun fällt nicht still auf die alte Installation zurück", async () => {
    const r = await lauf(["NODE_ENV=production", "BUN_INSTALL=<ohnebin>"]);
    expect(r.code).not.toBe(0);
    expect(r.ausgabe).toContain("kein ausführbares bin/bun");
  });

  test("bei zwei Zeilen gewinnt die spätere und wird auch so benannt", async () => {
    const r = await lauf(["NODE_ENV=production", "BUN_INSTALL=<runtime>", "BUN_INSTALL=<ohnebin>"]);
    expect(r.code).not.toBe(0);
    expect(r.ausgabe).toContain("kein ausführbares bin/bun");
    expect(r.ausgabe).toContain("ohne-bin");
  });

  test("Wagenrückläufe werden benannt, nicht als falsches NODE_ENV gemeldet", async () => {
    const wurzel = await mkdtemp(join(tmpdir(), "starter-crlf-"));
    aufraeumen.push(wurzel);
    const pin = (await readFile(join(skriptOrdner, "..", ".bun-version"), "utf8")).trim();
    await bunAttrappe(join(wurzel, "heim", ".bun", "bin", "bun"), "1.3.14");
    const site = join(wurzel, "site");
    await mkdir(site, { recursive: true });
    await writeFile(join(site, ".bun-version"), `${pin}\n`);
    await writeFile(join(site, ".env"), "NODE_ENV=production\r\nLOG_LEVEL=info\r\n");
    const proc = Bun.spawnSync({
      cmd: [
        "bash",
        "-c",
        `set -uo pipefail; . "${join(skriptOrdner, "deploy-common.sh")}"; starter_umgebung`,
      ],
      env: {
        PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
        HOME: join(wurzel, "heim"),
        ROOT_DIR: site,
        STARTER_STRENG: "1",
      },
    });
    const ausgabe = `${proc.stdout.toString()}${proc.stderr.toString()}`;
    expect(proc.exitCode).not.toBe(0);
    expect(ausgabe).toContain("Wagenrückläufe");
    // Ohne diese Prüfung meldete das Skript "gefunden: 'production'" — eine
    // Meldung, die sich selbst widerspricht, weil das Zeichen unsichtbar ist.
    expect(ausgabe).not.toContain("gefunden: 'production'");
  });

  test("ausserhalb des Deploys bleibt es beim Hinweis und der Lauf geht weiter", async () => {
    // start-backend.sh und cronjobs/run.sh laden dieselbe Umgebung. Ein harter
    // Abbruch dort brächte Supervisor in FATAL und nähme das Backend vom Netz.
    const r = await lauf(["NODE_ENV=production", "BUN_INSTALL=<ohnebin>"], { streng: false });
    expect(r.ausgabe).toContain("Hinweis:");
    expect(r.ausgabe).toContain("Ersatzweise gilt für diesen Lauf");
  });
});
