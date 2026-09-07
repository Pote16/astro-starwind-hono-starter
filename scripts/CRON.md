# Spätere Cronjobs

Der Starter bringt keinen fachlichen Cronjob mit. Astro wird beim Deploy gebaut,
das Backend läuft als Ploi-Daemon. In Ploi und auf dem Server wurde kein Zeitplan eingerichtet.

## Wenn eine konkrete Aufgabe hinzukommt

1. Die Aufgabe als eigenen, endlichen Bun-Einstieg implementieren, beispielsweise
   für eine fachlich festgelegte Bereinigung. Fehler müssen mit Exitcode ungleich
   null enden. Wiederholte Ausführung darf keine doppelten Mails oder Datensätze
   erzeugen. Änderungen an gespeicherten Daten benötigen klar definierte Aufbewahrungsregeln.
2. Einen Wrapper unter `scripts/` anlegen. Er wechselt über seinen eigenen Dateipfad
   in den Projektroot und nutzt `deploy-common.sh` für Root-`.env`, Production-Env
   und den exakten Bun-Pin. Cron erbt weder den interaktiven Shell-PATH noch die
   Umgebung eines vorherigen Deploys.
3. Vor dem Laden des Aufgabencodes einen **gemeinsamen** Lock auf
   `.deploy/deploy.lock` halten (`flock -s`). Der Deploy verwendet denselben Lock
   exklusiv. Zusätzlich verhindert ein eigener exklusiver Lock pro Aufgabe, dass
   zwei Ausführungen derselben Aufgabe überlappen. Lock-Dateien nicht löschen.
4. Erst nach manueller Prüfung den Wrapper in Plois Cronjobs eintragen. Benutzer
   ist der Site-Benutzer, niemals pauschal `root`. Absolute Pfade verwenden;
   Zugangsdaten gehören in die `.env`, nicht in den Cron-Befehl.
5. Zeitzone des Servers prüfen und zusammen mit Intervall und maximaler Laufzeit
   dokumentieren. Für tägliche Uhrzeiten beachten, dass die Zeitumstellung in
   `Europe/Vienna` Termine überspringen oder doppelt auslösen kann.
6. Laufzeit begrenzen, Fehler überwachen und Logrotation einrichten. Logs enthalten
   Status, Dauer und interne IDs, keine E-Mail-Adressen, Nachrichtentexte oder Keys.

Die spätere Dokumentation pro Job nennt Zweck, Codepfad, Ploi-Eintrag, Zeitplan,
Zeitzone, Datenzugriffe, Lock, Wiederholungsverhalten, Logpfad und Abschaltung.
Ein Deploy darf Cronjobs weder still hinzufügen noch deren Zeitpläne verändern.

Vorhandene Skripte in diesem Ordner richten ausschließlich den Deploy-Ablauf vor.
Sie sind keine Cronjobs und dürfen nicht als regelmäßiger Ersatz für Plois
Push-Webhook oder Supervisor-Neustart eingetragen werden.
