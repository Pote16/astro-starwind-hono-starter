import { spawn } from "node:child_process";

import { browserTestIds, testUrls } from "./environment";

const profile = process.argv[2];
if (profile !== "backend" && profile !== "blank" && profile !== "configured") {
  throw new Error("Unbekanntes lokales E2E-Profil.");
}
const root = process.cwd();
// Keine geerbten API-Schlüssel. Bun lädt keine .env; Vite erhält envDir:false.
const env: Record<string, string> = {
  PATH: process.env.PATH ?? "",
  ...(process.env.HOME ? { HOME: process.env.HOME } : {}),
  ...(process.env.TMPDIR ? { TMPDIR: process.env.TMPDIR } : {}),
  NODE_ENV: "development",
  ASTRO_TELEMETRY_DISABLED: "1",
  LOG_LEVEL: "error",
  PORT: new URL(testUrls.backend).port,
  FRONTEND_ORIGINS: `${testUrls.blank},${testUrls.configured}`,
  PUBLIC_API_URL: "",
  E2E_PROFILE: profile,
  ...(profile === "configured" ? browserTestIds : {}),
};
const args =
  profile === "backend"
    ? ["--no-env-file", "apps/backend/src/index.ts"]
    : [
        "--no-env-file",
        "apps/frontend/node_modules/astro/bin/astro.mjs",
        "dev",
        // Astros Testinstanzen dürfen den offenen Dev-Server weder sperren noch dessen Lock verändern.
        "--ignore-lock",
        "--root",
        "apps/frontend",
        "--config",
        "../../e2e/astro.config.mjs",
        "--host",
        "127.0.0.1",
        "--port",
        new URL(testUrls[profile]).port,
      ];
const child = spawn(process.execPath, args, { cwd: root, env, stdio: "inherit" });
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => child.kill(signal));
}
child.on("error", () => process.exit(1));
child.on("exit", (code) => process.exit(code ?? 1));
