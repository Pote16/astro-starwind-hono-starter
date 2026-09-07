import { loadBackendEnvironment } from "./schemas/backend-env.schema.js";

// Reine Deploy-Vorprüfung, ohne App, Logger, Redis oder Datenbank zu laden.
if (import.meta.main) {
  try {
    loadBackendEnvironment();
    process.stdout.write("Backend-Konfiguration gültig.\n");
  } catch {
    process.stderr.write(
      "Backend-Konfiguration ungültig: NODE_ENV, PORT, FRONTEND_ORIGINS, TRUSTED_PROXY_HOPS und das Turnstile-Schlüsselpaar prüfen.\n",
    );
    process.exitCode = 1;
  }
}
