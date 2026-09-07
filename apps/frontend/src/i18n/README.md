# Internationalisierung

Astro-i18n definiert Deutsch unter `/` und Englisch unter `/en/` mit
`prefixDefaultLocale: false`. `src/pages/[lang]/index.astro` erzeugt die zusätzliche
Sprache über `getStaticPaths()`; beide Routen verwenden gemeinsames Seiten-Markup.
Keine automatische Weiterleitung anhand der Browsersprache.

- `ui.ts`: Sprachen, Standardsprache und gemeinsame UI-Texte.
- `formular.ts`: DE-/EN-Texte für Demoformular und Turnstile-Zustände.
- `cookieConsent.ts`: Consent-Texte und sicher konfigurierte Datenschutzlinks.
- `utils.ts`: typisierte Sprach-/Texthelfer und Pfade über Astros
  `getRelativeLocaleUrl`. In Astro-Komponenten `Astro.currentLocale` verwenden.

Neue sichtbare Texte in beiden Sprachen pflegen. Lange Seiteninhalte bei Bedarf in
strukturierte Datenmodule auslagern; identisches Markup nicht pro Sprache kopieren.
Rechtstexte und Linkziele projektspezifisch klären, keine Platzhalter als Tatsachen ausgeben.

[Frontend-README](../../README.md) · [Projektregeln](../../../../AGENTS.md)
