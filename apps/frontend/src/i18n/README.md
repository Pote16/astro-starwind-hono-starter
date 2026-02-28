# Internationalisierung (`src/i18n`)

Dieser Ordner kapselt alle Texte, Übersetzungs-Wörterbücher und Hilfsfunktionen für die Mehrsprachigkeit (i18n) im Frontend.

## Was gehört hier rein?

- **`ui.ts`**: Enthält die definierten Sprachen (`defaultLang`, `languages`) und das zentrale Dictionary-Objekt `ui` mit Keys für UI-Texte.
- **`utils.ts`**: Hilfsfunktionen wie `getLangFromUrl()` (um die Sprache aus dem Pfad zu lesen) und `useTranslations()` (um typisiert auf die Keys zuzugreifen).
- **JSON-Dateien (Optional):** Bei sehr großen Projekten können Übersetzungen auch in JSON-Dateien (`de.json`, `en.json`) oder Content Collections liegen. Hier im Starter verwenden wir primär Code-basierte Dictionaries für maximale Typensicherheit.

## Best Practices

- Nutze das `t('key')` Pattern in deinen Astro- und React-Komponenten.
- Vermeide harte Fallbacks oder hartcodierte deutsche Texte in Komponenten (`<h1>Willkommen</h1>`). Alles sollte über die Language-Keys abrufbar sein (`<h1>{t('home.welcome')}</h1>`).
- Halte die Keys ordentlich gruppiert (z.B. `nav.home`, `auth.login`, `footer.imprint`).
