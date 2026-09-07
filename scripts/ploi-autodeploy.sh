#!/usr/bin/env bash
# VORBEREITETE VORLAGE, noch nicht als Ploi-Hook eingerichtet.
# In Ploi als Deploy Script hinterlegen; Ploi ersetzt seine Platzhalter.
# Eine Änderung dieser Repo-Datei allein ändert die Ploi-Einstellung nicht.
# Auslöser bei späterer Aktivierung: Push-Webhook für main.
set -euo pipefail

cd "{SITE_DIRECTORY}"
ROOT_DIR="$(pwd -P)"
readonly ROOT_DIR
PLOI_BRANCH="{BRANCH}"
[ "$PLOI_BRANCH" = "main" ] || { printf 'Abbruch: Autodeploy ist ausschließlich für main vorbereitet.\n' >&2; exit 1; }
# shellcheck source=scripts/deploy-common.sh
source "$ROOT_DIR/scripts/deploy-common.sh"
starter_umgebung
starter_lock

# Auch der Checkout-Wechsel steht unter dem Deploy-Lock. Fremde lokale
# Änderungen werden nicht durch einen Hard-Reset still verworfen.
[ "$(git symbolic-ref --short HEAD)" = "main" ] || starter_fehler "Server-Checkout steht nicht auf main."
[ -n "${DEPLOY_REPOSITORY:-}" ] || starter_fehler "DEPLOY_REPOSITORY muss die erwartete Origin-URL festlegen."
[ "$(git remote get-url origin)" = "$DEPLOY_REPOSITORY" ] \
  || starter_fehler "Origin entspricht nicht DEPLOY_REPOSITORY. Tatsächlichen Git-Remote des Projekts eintragen."
NICHT_VERSIONIERTE_DATEIEN="$(git ls-files --others --exclude-standard)" \
  || starter_fehler "Unversionierte Checkout-Dateien konnten nicht geprüft werden."
if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$NICHT_VERSIONIERTE_DATEIEN" ]; then
  starter_fehler "Server-Checkout hat lokale Änderungen. Vor dem Deploy prüfen."
fi

git fetch --no-tags origin main
ZIEL_SHA="$(git rev-parse 'FETCH_HEAD^{commit}')"
git merge --ff-only "$ZIEL_SHA"
[ "$(git rev-parse 'HEAD^{commit}')" = "$ZIEL_SHA" ] \
  || starter_fehler "Server-main enthält einen lokalen Commit außerhalb des abgerufenen Zielstands."
printf 'Astro-Hono-Starter: main, Zielcommit %s\n' "$ZIEL_SHA"

# exec erhält den Lock ohne Lücke bis zum Ende von deploy.sh.
# deploy.sh prüft den Deskriptor erneut und den Pin des Zielcommits. Der Hook
# braucht vor Fetch kein Bun: ein Runtime-Upgrade darf nicht am alten Pin hängen.
exec bash "$ROOT_DIR/scripts/deploy.sh" 9>&9
