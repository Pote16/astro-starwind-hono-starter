# Migrations Folder

Dieser Ordner enthält alle Datenbank-Migrationen für Prisma.

## Was passiert hier?

Jedes Mal, wenn du Änderungen an der `schema.prisma` Datei vornimmst, solltest du eine neue Migration erstellen. Dies stellt sicher, dass das Schema deiner Datenbank immer synchron mit dem Prisma-Modell ist.

## Wichtige Befehle

- **Migration erstellen:** `pnpm dlx prisma migrate dev --name <mein-migrations-name>` - Dies erstellt eine neue Migration und wendet sie auf deine Entwicklungsdatenbank an.
- **Migrationen anwenden (Produktion):** `pnpm dlx prisma migrate deploy` - Wendet ausstehende Migrationen an, ohne die Entwicklerumgebung neu zu initialisieren (wichtig für CI/CD).
- **Prisma Client generieren:** `pnpm dlx prisma generate` - Aktualisiert den TypeScript-Client basierend auf dem aktuellen Schema.

**Achtung:** Bearbeite die generierten `.sql` Dateien in den Unterordnern normalerweise nicht manuell, es sei denn, du weißt genau, was du tust (z.B. für komplexere Datenmigrationen, die Prisma nicht automatisch durchführt).
