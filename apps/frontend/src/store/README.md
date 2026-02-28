# Store (`src/store`)

Dieser Ordner enthält das globale Store-Management für den Client-State.
In unserer Architektur verwenden wir in der Regel **Nanostores** (`nanostores` und `@nanostores/react` o.ä.), um State zwischen (insellasierten) Framework-Komponenten (React, Solid) und Astro-Komponenten zu teilen.

## Was gehört hier rein?

- **Store Definitionen:** Dateien wie `ui-store.ts`, `cart-store.ts`, `user-session.ts`, die Atome (Atoms) oder Maps von Nanostores exportieren.
- **Client-State Logik:** Funktionen, die den Store updaten und an mehreren Stellen der App wiederverwendet werden.

## Best Practices

- Erstelle **kleine, fokussierte Stores** anstatt eines gigantischen Global-Stores.
- Nutze Framework-spezifische Hooks (z.B. `useStore` von `@nanostores/react`) nur in `.tsx`-Dateien, wenn die Komponente reaktiv auf Store-Änderungen reagieren soll.
- Lass den Server State (wie z.B. Daten-Fetching von der API) primär in TanStack Query (React Query) oder direkt in Astro Server Components – der `store` ist hauptsächlich für **UI-State** gedacht (Modal offen/zu, lokaler Warenkorb-Status etc.).
