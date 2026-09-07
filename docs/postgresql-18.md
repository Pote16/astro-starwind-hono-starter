# PostgreSQL 18 im lokalen Docker-Setup

Das offizielle Image verwendet ab PostgreSQL 18 `/var/lib/postgresql/18/docker` als Datenverzeichnis. Das persistente Volume wird deshalb an `/var/lib/postgresql` eingebunden. [Offizielle Image-Dokumentation](https://github.com/docker-library/docs/blob/master/postgres/README.md#pgdata).

Die Compose-Datei ist für neue lokale Instanzen vorbereitet. PostgreSQL ist ausschließlich auf `127.0.0.1:5435` erreichbar.

## Bereits vorhandene Daten

Die geänderte Compose-Datei führt keine Datenmigration aus. Vor dem nächsten Containerstart bestehende Daten sichern und die tatsächlichen Mounts, Volumes und die PostgreSQL-Hauptversion prüfen. Nach der vorherigen Mount-Konfiguration dürfen Daten nicht ungeprüft ausschließlich im benannten Volume vermutet werden.

Bei einer älteren Hauptversion ist ein geplanter Wechsel über `pg_upgrade` oder Dump und Restore erforderlich. Das Umhängen eines Volumes oder Ändern des Image-Tags allein aktualisiert kein Datenbankformat. Bei bereits vorhandenem PostgreSQL 18 muss auch die bisherige Verzeichnisstruktur zur neuen Einbindung passen.

Bestehende Volumes nicht als Fehlerbehebung löschen und insbesondere kein `docker compose down -v` ausführen. Erst nach geprüftem Backup und festgelegtem Migrationsweg mit den vorhandenen Daten weiterarbeiten.

Für Frontend, Build, Typprüfung, Lint und Tests muss Docker nicht gestartet werden.

## Zugangsdaten aus der Root-Umgebung

Compose liest `POSTGRES_USER`, `POSTGRES_PASSWORD` und `POSTGRES_DB` aus der Root-`.env`; ohne Werte gelten die lokalen Beispielwerte. `DATABASE_URL` muss dieselben Zugangsdaten und denselben Datenbanknamen verwenden. Der Healthcheck verwendet die Container-Variablen.

Diese Variablen initialisieren ausschließlich ein leeres Datenverzeichnis. Eine Änderung der `.env` setzt bei vorhandenen Volumes weder Passwörter noch Benutzer oder Datenbanknamen zurück. Bestehende Zugangsdaten müssen getrennt und geplant geändert werden.
