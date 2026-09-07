#!/usr/bin/env bash
# Build-Audits gegen das noch nicht veröffentlichte Verzeichnis dist.new.
# Wird von deploy.sh gesourct (dort sind run und starter_fehler definiert);
# starter_build_audits "<dist>" muss bei jedem Befund mit starter_fehler
# abbrechen. Projektspezifische Prüfungen (Migrationsregeln, weitere
# Sprachindizes) gehören hierhin, nicht in deploy.sh. Läuft ohne Netzwerk und
# ohne Datenbank; Nginx liefert währenddessen weiter den bisherigen Build aus.

# Sprachen mit eigenem Präfix; die Standardsprache liegt unter /.
STARTER_SPRACHPRAEFIXE="en"

starter_build_audits() {
  local dist="$1" sprache
  [ -d "$dist" ] || starter_fehler "Build-Verzeichnis $dist fehlt."
  [ -s "$dist/index.html" ] || starter_fehler "Frontend-Build unvollständig: index.html fehlt."
  for sprache in $STARTER_SPRACHPRAEFIXE; do
    [ -s "$dist/$sprache/index.html" ] || starter_fehler "Frontend-Build unvollständig: $sprache/index.html fehlt."
  done
  # Nginx liefert error_page 404 aus dieser Datei; ohne sie kommt die nackte Nginx-Seite.
  [ -s "$dist/404.html" ] || starter_fehler "Frontend-Build unvollständig: 404.html fehlt (src/pages/404.astro)."
  [ -s "$dist/robots.txt" ] || starter_fehler "Frontend-Build unvollständig: robots.txt fehlt."
  # SEO-Gate (apps/frontend/tools/pruefe-seo.ts): Canonical, hreflang, Sitemap,
  # robots.txt, 404, Bilder, interne Links, JSON-LD, Manifest, llms.txt.
  # Liest nur dist.new; PUBLIC_SITE_URL aus der .env muss zur Build-Origin passen.
  # Bericht: .deploy/seo-audit.json. Regeln: docs/seo.md.
  run bun apps/frontend/tools/pruefe-seo.ts --dist "$dist" \
    || starter_fehler "SEO-Audit meldet Befunde (Bericht: .deploy/seo-audit.json)."
}
