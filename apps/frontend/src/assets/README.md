# Assets (`src/assets`)

Dieser Ordner enthält statische Assets, die von Astro importiert, verarbeitet oder gebündelt werden sollen.

## Was gehört hier rein?

- **Bilder:** Lokale Bilder (`.jpg`, `.png`, `.webp`, `.svg`), die auf deinen Seiten via `import` verwendet werden und von Astros Image-Optimization profitieren sollen (`<Image src={importImage} />`).
- **Icons:** Spezifische statische Icons (als raw SVG oder verarbeitbare Files), die in Komponenten referenziert werden.
- **Fonts:** Eigene Schriftarten (falls sie nicht über `@fontsource` geladen werden) und gebündelt werden sollen.

## Best Practices

- Nutze `src/assets` für Dateien, auf die du im Code verweist und die "optimiert" werden dürfen/sollen.
- Nutze den Ordner `public/` (im Root) NUR für Dateien, die unverändert (1:1 mit gleicher URL) im Browser aufrufbar sein müssen (z.B. `favicon.ico`, `robots.txt`, `sitemap.xml` oder PWA-Manifests).
- Gliedere Assets ggf. in Unterordner: `src/assets/images`, `src/assets/icons`.
