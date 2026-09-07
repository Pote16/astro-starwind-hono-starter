import { fileURLToPath } from "node:url";

import projectConfig from "../apps/frontend/astro.config.mjs";

const profile = process.env.E2E_PROFILE === "configured" ? "configured" : "blank";

// Die echte Astro-Konfiguration bleibt Grundlage. Nur Umgebung und Caches sind
// isoliert, damit offene Dev-Server und private Root-Env-Werte unberührt bleiben.
export default {
  ...projectConfig,
  root: fileURLToPath(new URL("../apps/frontend/", import.meta.url)),
  cacheDir: fileURLToPath(new URL(`../.cache/e2e/${profile}/astro/`, import.meta.url)),
  vite: {
    ...projectConfig.vite,
    envDir: false,
    cacheDir: fileURLToPath(new URL(`../.cache/e2e/${profile}/vite/`, import.meta.url)),
    server: { ...projectConfig.vite.server, strictPort: true },
  },
};
