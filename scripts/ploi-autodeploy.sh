#!/bin/bash
# ----------------------------------------------------------------------------
# REFERENZ-SPIEGEL des Ploi-Deploy-Scripts (Ploi -> Site -> Deployment).
# Diese Datei wird NICHT aus dem Repository ausgeführt; die ausführende Quelle
# ist das Ploi-Panel. Panel und Datei von Hand synchron halten.
#
# Kette bei jedem Push auf main:
#   Push -> Ploi-Webhook -> DIESES Script (Panel) -> scripts/deploy.sh (Repo)
#
# {SITE_DIRECTORY}, {BRANCH}, {COMMIT_HASH} ersetzt Ploi vor der Ausführung.
# Folgen von `git reset --hard origin/main`:
#   - Jeder Push auf main deployt sofort; es gibt keine manuelle Freigabe.
#     CI (.github/workflows/quality.yml) und die Gates in scripts/deploy.sh sind
#     die einzigen automatischen Barrieren.
#   - Versionierte lokale Änderungen auf dem Server werden verworfen.
#   - Unversionierte und ignorierte Dateien überleben, insbesondere .env,
#     .deploy/, dist.old/ und Plois eigenes Hook-Skript ploi-<hash>.sh.
#   - Fetch und Reset laufen außerhalb des Deploy-Locks; deploy.sh prüft den
#     Zielcommit deshalb vor Migration und Veröffentlichung erneut.
# ----------------------------------------------------------------------------
# shellcheck disable=SC1083  # Ploi-Platzhalter, absichtlich literal
set -e
cd {SITE_DIRECTORY}

git fetch origin
git reset --hard origin/main

echo "__DOMAIN__ - Deploy"
echo "Branch: {BRANCH} | Commit: {COMMIT_HASH}"

bash scripts/deploy.sh
