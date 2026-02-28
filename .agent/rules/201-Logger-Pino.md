---
trigger: glob
description: Globale Logging Regeln im Monorepo
globs: ["**/*.ts", "**/*.astro", "**/*.tsx"]
---

# Antigravity Logging Rules

Diese Regeln verbieten standardmäßige Console Logs.

## 1. Verbot von Console.log

- Nutze NIEMALS `console.log`, `console.error`, `console.warn` in deinem Code (weder Frontend noch Backend).

## 2. Pino Logger

- Jegliches Logging muss über das interne Package `@hollyhub/logger` (Pino) geschehen.
- Logge Fehler immer als vollständiges Objekt (`logger.error(error, "Custom message")`), um den Stack-Trace intakt zu lassen.
- Logge User-Aktionen als strukturiertes JSON (`logger.info({ userId, action }, "Aktion ausgeführt")`).
