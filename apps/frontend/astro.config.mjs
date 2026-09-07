import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { z } from "astro/zod";
import { loadEnv } from "vite";

import { defaultLang, languages } from "./src/i18n/ui";

const envDir = fileURLToPath(new URL("../../", import.meta.url));
const umgebung = loadEnv(
  process.env.NODE_ENV === "production" ? "production" : "development",
  envDir,
  "PORT",
);
const backendPort = z.coerce
  .number()
  .int()
  .min(1)
  .max(65535)
  .parse(umgebung.PORT ?? "3005");

export default defineConfig({
  output: "static",
  i18n: {
    defaultLocale: defaultLang,
    locales: Object.keys(languages),
    routing: { prefixDefaultLocale: false },
  },
  vite: {
    plugins: [tailwindcss()],
    // Alle Workspaces lesen denselben dokumentierten Vertrag im Projektroot.
    envDir,
    // Gleiche API-Pfade wie hinter Nginx; Origin bleibt für den CSRF-Check erhalten.
    server: {
      proxy: {
        "/api": { target: `http://127.0.0.1:${backendPort}`, changeOrigin: false, xfwd: true },
      },
    },
  },
});
