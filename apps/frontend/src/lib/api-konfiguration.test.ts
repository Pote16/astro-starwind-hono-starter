import { expect, test } from "bun:test";

import { leseApiOrigin } from "./api-konfiguration";

test("API-Konfiguration akzeptiert gleiche Origin und HTTP-Origins, aber keine Pfade oder Zugangsdaten", () => {
  for (const wert of ["", "http://localhost:3005", "https://api.example.test/"]) {
    expect(leseApiOrigin(wert).success).toBe(true);
  }
  for (const wert of [
    "kaputt",
    "javascript:alert(1)",
    "//example.test",
    "https://user:secret@example.test",
    "https://api.example.test/api",
    "https://api.example.test?key=secret",
  ]) {
    expect(() => leseApiOrigin(wert)).not.toThrow();
    expect(leseApiOrigin(wert).success).toBe(false);
  }
});
