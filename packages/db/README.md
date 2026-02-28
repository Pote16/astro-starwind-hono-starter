# Database Package (@ho-setup/db)

Dieser Ordner kapselt den Prisma ORM Client und das Datenbankschema.
Dadurch wird sichergestellt, dass Frontend und Backend auf dieselben generierten Typen und Datenbankverbindungen zugreifen können.

## Struktur

- `prisma/`: Enthält die `schema.prisma` und Migrationen.
- `src/`: Exportiert den konfigurierten Prisma-Client (`index.ts`).

## Befehle

- `pnpm db:generate`: Generiert den Prisma Client.
- `pnpm db:push`: Pusht Schema-Änderungen in die DB.
- `pnpm db:migrate`: Erstellt und wendet Migrationen an.
