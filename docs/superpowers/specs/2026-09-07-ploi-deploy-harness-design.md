# Ploi-Deploy-Harness für alle Astro+Hono-Sites (Design, 07.09.2026)

## Ausgangslage

Der Starter und fünf abgeleitete Sites (cleanlist.app, mediapool.digital,
kanzlei-import.at, schlosshotel-seewirt.com, hollyhub.at) laufen auf einem
gemeinsamen Ploi-Server. Ein Audit (28 Agenten, Befunde adversarial verifiziert)
ergab:

- Das Template war gegen einen Hook gebaut, der nirgends installiert ist
  (ff-only, `DEPLOY_REPOSITORY`, vererbter Lock). Mit dem realen Panel-Hook
  (`git reset --hard origin/main; bash scripts/deploy.sh`) wäre jeder Deploy an
  Plois unversionierter `ploi-<hash>.sh` gescheitert.
- `NODE_ENV=production` wurde nur im Deploy exportiert; der Daemon liest die
  Ploi-`.env` und lief ohne Wrapper im Dev-Modus.
- Drei Live-Sites starten fremde Backends per `pkill -f` neu (identische
  Kommandozeile auf dem Host); Live-Nginx-Confs verlieren durch `add_header` in
  Locations die Security-Header auf allen HTML-Seiten.

## Entscheidungen

1. **Realer Hook bleibt.** `ploi-autodeploy.sh` ist ein Spiegel des Panel-Scripts.
   `deploy.sh` nimmt den Lock selbst und prüft den Zielcommit vor Migration und
   Veröffentlichung erneut.
2. **Worker-ID statt Prozessname.** `PLOI_WORKER_ID=<Zahl>` in der Ploi-Environment;
   Programm `worker-<id>`, Ziel `worker-<id>:*`, `stop`+`start` über
   `sudo -n supervisorctl` (eine sudoers-Regel für alle Sites). Vor jeder Änderung:
   Supervisor kennt das Programm, laufende PIDs haben `cwd` = Site-Verzeichnis.
   Kein `pkill`/`pgrep`-Fallback; das ist durch `harness.test.ts` festgeschrieben.
3. **`NODE_ENV=production` in der `.env`**, nicht exportiert. Deploy, Cron und Daemon
   sehen dieselbe Umgebung; `validate-env.ts` prüft genau das, was der Daemon lädt.
4. **Git-Sauberkeit:** versionierte Abweichungen und unversionierte Quelldateien
   brechen ab; andere unversionierte Dateien sind ein Hinweis. `/ploi-*.sh` ignoriert.
5. **Gates auf dem Server:** Install (frozen), `validate-env`, Lint, Typecheck,
   `bun test apps packages`, Build-Audits. Formatprüfung und Deploy-Fixtures nur in CI.
6. **Nginx:** Cache-Control ausschließlich über Maps im `http`-Kontext mit
   Site-Prefix; `error_page 404` mit echter `404.astro`; `X-Forwarded-For` wird
   überschrieben (`TRUSTED_PROXY_HOPS=1`); HSTS mit `includeSubDomains`, `preload`
   nur bewusst.
7. **Cron:** `scripts/cronjobs/run.sh` mit Allowlist, Lock je Job und geteiltem
   Deploy-Lock; Deploy wartet auf laufende Jobs.
8. **Bun:** exakter Pin 1.4.2 überall; Server-Bun einmalig auf 1.4.2 heben und
   die Pins der übrigen Projekte auf dem Host (pichler-luft-app) mitziehen.
9. **`.env.example`** hat in allen Projekten dieselbe Abschnittsfolge; PostgreSQL und
   Redis als Einzelteile plus zusammengesetzte URL.
10. **Zeilenenden:** `.gitattributes` mit `eol=lf`, damit Windows-Checkouts keine
    CRLF-Shellskripte erzeugen.

## Nicht Teil dieses Harness

Kein automatischer Datenbank- oder Release-Rollback, kein Nginx-Reload aus dem
Deploy, kein Maintenance-Modus. hollyhub.at bleibt vorerst auf Node/PM2 und übernimmt
nur die runtime-neutralen Teile (Lock, `dist.new`-Wechsel, Health-Check, Struktur).
