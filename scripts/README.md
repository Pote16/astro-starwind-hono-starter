# Scripts (scripts)

Dieser Ordner enthält Utility- und Automatisierungsskripte für das Monorepo.

## Typischer Inhalt

- Deployment-Skripte (z.B. Bash-Skripte für PM2 oder Docker).
- CI/CD Hilfsskripte.
- Datenbank-Seed-Helfer oder Parsing-Utilities, die nicht direkt zur Laufzeit der Applikationen gehören.

_Hinweis:_ Skripte sollten im Idealfall über die `package.json` im regulären Workflow (z.B. `pnpm run script-name`) verknüpft sein.
