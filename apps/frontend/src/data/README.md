# Data (`src/data`)

Dieser Ordner enthält strukturierte Daten, die im Frontend konsumiert werden, aber nicht direkt UI-Textbausteine für i18n sind.

## Was gehört hier rein?

- **Statische Datensätze:** Arrays oder Objekte mit Konfigurationen (z.B. Navigation-Links, Preis-Tabellen, Konstanten, Dropdown-Optionen).
- **Mock-Daten:** Beispieldaten für Entwicklungszwecke oder zum Layouten von Komponenten (z.B. `sample-users.ts`, `dummy-posts.json`).
- **Content-Collections Schema (Optional):** Falls du `src/content/` nicht separat hast, könnten hier auch Type-Definitionen für CMS-artige Daten liegen.

## Best Practices

- Halte Daten getrennt von UI-Komponenten, um die Komponenten dümmer (präsentational) zu machen.
- Es ist völlig in Ordnung, diese Daten typisiert zu exportieren (z.B. Konstanten mit TypeScript `as const`).
- Lokalisierte und längere Textinhalte (wie z.B. Marketing-Texte für die Homepage) sollten jedoch eher in `src/i18n` oder als Astro Content Collections abgelegt werden.
