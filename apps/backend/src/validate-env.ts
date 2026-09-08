import { loadBackendEnvironment } from "./schemas/backend-env.schema.js";

// Reine Deploy-Vorprüfung, ohne App, Logger, Redis oder Datenbank zu laden.
// Ausgegeben wird die geworfene Meldung selbst; eine zweite, von Hand gepflegte
// Liste lief hier auseinander und nannte das fehlende Feld nicht mehr.
if (import.meta.main) {
  try {
    loadBackendEnvironment();
    process.stdout.write("Backend-Konfiguration gültig.\n");
  } catch (fehler) {
    const meldung = fehler instanceof Error ? fehler.message : String(fehler);
    process.stderr.write(`${meldung}\n`);
    process.exitCode = 1;
  }
}
