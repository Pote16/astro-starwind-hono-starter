# Ploi-Daemon und Bun-Runtime — Referenz-Spiegel

Diese Datei spiegelt, was in der Ploi-Oberfläche eingetragen ist. Die Oberfläche
ist die ausführende Quelle; eine Änderung hier ändert nichts am Server und
umgekehrt. Beides von Hand synchron halten.

## Warum je Version eine eigene Runtime

Auf dem Server liegen mehrere Projekte mit unterschiedlichen Bun-Pins. Eine
einzige globale Installation unter `/home/ploi/.bun` zwingt dazu, bei jedem
Upgrade **alle** Projekte gleichzeitig nachzuziehen: `.bun-version` wird von
`starter_runtime` exakt verglichen, ein Projekt mit altem Pin bricht sofort ab.

Deshalb liegt je Version eine eigene Runtime, und jede Site zeigt auf die, die zu
ihrer `.bun-version` passt:

```text
/home/ploi/.bun-versions/1.3.14/bin/bun
/home/ploi/.bun-versions/1.4.2/bin/bun
/home/ploi/.bun/bin/bun            # alter gemeinsamer Stand, bleibt unverändert
```

Eine Site zu heben heißt dann: `.bun-version` im Repo ändern, `BUN_INSTALL` in
ihrer Ploi-Environment umstellen, Daemon-Kommando anpassen, deployen. Die
anderen Sites bleiben unberührt.

### Runtime einmalig anlegen (als `ploi`)

Das `bin/`-Unterverzeichnis ist Pflicht — Buns Installer legt es selbst an, und
`BUN_INSTALL` bezeichnet immer das Verzeichnis **über** `bin/`:

```bash
export BUN_INSTALL=/home/ploi/.bun-versions/1.4.2
curl -fsSL https://bun.sh/install | bash -s "bun-v1.4.2"
/home/ploi/.bun-versions/1.4.2/bin/bun --version   # muss 1.4.2 zeigen
```

**Der Installer ist der einzige empfohlene Weg.** Er legt neben `bin/bun` auch
`bin/bunx` an — einen Symlink auf dieselbe Binärdatei. Liegt eine Binärdatei
schon flach unter `/home/ploi/.bun-versions/<version>/bun`, entsteht durch
blosses Verschieben eine halbe Installation: `bun` ist da, `bunx` fehlt. Der
Deploy fällt seit der Härtung von `BUN_INSTALL` nicht mehr still auf
`$HOME/.bun` zurück, also bricht er dann mitten drin ab mit
`bunx: command not found` (Exit 127). Wer trotzdem verschiebt, muss den Symlink
nachziehen:

```bash
mkdir -p /home/ploi/.bun-versions/1.4.2/bin
mv /home/ploi/.bun-versions/1.4.2/bun /home/ploi/.bun-versions/1.4.2/bin/bun
/home/ploi/.bun-versions/1.4.2/bin/bun completions   # legt bin/bunx an
```

Prüfen, ob eine Runtime vollständig ist:

```bash
ls -l /home/ploi/.bun-versions/1.4.2/bin/   # nur "bun" ohne "bunx" = unvollständig
```

Die Scripts dieses Projekts rufen `bun x` statt `bunx` auf; das ist derselbe
Befehl und braucht den Symlink nicht. Für interaktives Arbeiten auf dem Server
ist er trotzdem angenehm.

### Der Fallstrick mit verschachtelten Aufrufen

Ein `package.json`-Script ruft `bun` ohne Pfad auf. Startet der Daemon mit einem
absoluten Pfad, entscheidet trotzdem der `PATH` des Kindprozesses, welche
Version dieser innere Aufruf bekommt. `deploy-common.sh` stellt deshalb
`$BUN_INSTALL/bin` dem `PATH` voran, bevor irgendein Werkzeug läuft. Prüfen:

```bash
/home/ploi/.bun-versions/1.4.2/bin/bun -e 'console.log(Bun.spawnSync(["bun","--version"]).stdout.toString().trim())'
```

Kommt dort die erwartete Version, erben verschachtelte Aufrufe korrekt. Kommt
eine andere, fehlt `BUN_INSTALL` in der Ploi-Environment dieser Site.

## Vier Stellen, an denen Bun angesprochen wird

| Ort      | Wo geändert                                                                     | Inhalt                                                                                 |
| -------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Daemon   | Ploi → Site → Daemons (schreibt `/etc/supervisor/conf.d/`, nie von Hand ändern) | absoluter Pfad im Command, siehe unten                                                 |
| Deploy   | Ploi → Site → Deployment → Deploy Script                                        | ruft nur `bash scripts/deploy.sh`; die Version kommt aus `BUN_INSTALL` der Environment |
| Projekt  | `.bun-version`, `packageManager`, `bun-types`                                   | der Pin, gegen den `starter_runtime` prüft                                             |
| Cronjobs | Ploi → Server → Cron Jobs                                                       | ruft nur `scripts/cronjobs/run.sh`, das dieselbe Umgebung lädt                         |

## Der Daemon-Eintrag

Ploi → Site → Daemons → Edit daemon:

| Feld                 | Wert                                                                       |
| -------------------- | -------------------------------------------------------------------------- |
| **Command**          | `/home/ploi/.bun-versions/<version>/bin/bun run apps/backend/src/index.ts` |
| **Processes**        | `1`                                                                        |
| **Directory**        | `/home/ploi/<domain>`                                                      |
| **Environment file** | _leer lassen_                                                              |
| **System user**      | `ploi (default)`                                                           |

`<version>` ist exakt der Inhalt von `.bun-version`.

**Processes muss 1 bleiben.** Bun bindet beim Start `PORT`; ein zweiter Prozess
fände den Port belegt und liefe in eine Neustartschleife.

**Environment file bleibt leer.** Bun lädt die `.env` selbst aus dem
Arbeitsverzeichnis, und das ist genau das Site-Verzeichnis, in das Ploi seine
Oberfläche schreibt. Ein zweiter Eintrag im Supervisor wäre eine konkurrierende
Quelle für dieselben Werte. Praktische Folge: **eine Änderung unter Site →
Environment wirkt erst nach einem Neustart des Daemons.**

Die von Ploi angezeigte Daemon-ID ergibt den Supervisor-Programmnamen
`worker-<id>`. Genau diese Zahl gehört als `PLOI_WORKER_ID` in die Environment;
`scripts/deploy.sh` startet ausschließlich dieses Programm neu. Wird der Daemon
gelöscht und neu angelegt, vergibt Ploi eine neue ID — dann `PLOI_WORKER_ID`
nachziehen.

## Environment-Werte für die Runtime

Ploi → Site → Environment (schreibt `<site>/.env`):

```dotenv
BUN_INSTALL=/home/ploi/.bun-versions/1.4.2
PLOI_WORKER_ID=<Zahl aus Ploi -> Daemons>
NODE_ENV=production
```

Ohne `BUN_INSTALL` gilt `$HOME/.bun`, also der alte gemeinsame Stand.

## Eine Site auf eine neue Bun-Version heben

1. Runtime auf dem Server anlegen, falls die Version noch fehlt (siehe oben).
2. Im Repo `.bun-version`, `packageManager` und `bun-types` auf die Version
   setzen, `bun install` mit genau dieser Binärdatei, Gates fahren, committen.
3. Ploi → Site → Environment: `BUN_INSTALL` auf das neue Verzeichnis.
4. Ploi → Site → Daemons: Command auf den neuen absoluten Pfad; **die Daemon-ID
   bleibt erhalten**, solange der Eintrag bearbeitet und nicht neu angelegt wird.
5. Deployen. `starter_runtime` bricht ab, wenn Pin und tatsächliche Version
   auseinanderlaufen, und nennt den Pfad der gefundenen Binärdatei.
6. Nach dem Deploy meldet `deploy.sh` einen Hinweis, wenn der laufende Daemon mit
   einer anderen Binärdatei läuft als der Deploy — dann wurde Schritt 4 vergessen.

Es gibt bewusst **kein** globales `bun upgrade` in den Skripten: es würde alle
Sites des Servers auf einmal umstellen.
