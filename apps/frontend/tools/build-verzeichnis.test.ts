import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "bun:test";

import { buildVerzeichnisAusArgumenten } from "./build-verzeichnis";

const standard = new URL("../dist/", import.meta.url);

test("prüft auf Wunsch einen separaten Release-Build, auch mit Leerzeichen im Pfad", () => {
  expect(buildVerzeichnisAusArgumenten(standard, [])).toBe(standard);
  expect(
    fileURLToPath(buildVerzeichnisAusArgumenten(standard, ["--dist", "apps/frontend/dist neu"])),
  ).toBe(`${resolve("apps/frontend/dist neu")}${sep}`);
});

test("ein fehlendes oder leeres Deploy-Buildziel fällt nicht auf den alten Build zurück", () => {
  expect(() => buildVerzeichnisAusArgumenten(standard, ["--dist"])).toThrow();
  expect(() => buildVerzeichnisAusArgumenten(standard, ["--dist", " "])).toThrow();
});
