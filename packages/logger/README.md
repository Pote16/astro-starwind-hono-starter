# Loggerpaket `@ho-setup/logger`

Exportiert `logger` aus `src/index.ts`. Pino schreibt in Produktion strukturierte
JSON-Logs; außerhalb von Produktion verwendet es `pino-pretty`. `LOG_LEVEL` steuert
die Mindeststufe, standardmäßig `info`.

Nur sichere strukturierte Metadaten protokollieren. Request-Logs verwenden den Pfad
statt der vollständigen URL. Keine Querys, Tokens, E-Mail-Adressen, Namen oder
Nachrichtentexte ausgeben. Anbieterfehler können Secrets und Nutzerdaten enthalten;
nur feste sichere Fehlercodes loggen, keine ungeprüften Fehlerobjekte.

Nicht in Browsercode importieren. Frontend-Interaktionen benötigen keinen Pino-
Client. Einrichtung und Prüfungen: [Root-README](../../README.md).
Verbindliche Loggingregeln: [AGENTS.md](../../AGENTS.md).
