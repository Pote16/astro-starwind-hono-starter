# Backend

Hono läuft auf Bun und bindet standardmäßig an `127.0.0.1:3005`. Das Backend startet
aus den TypeScript-Quellen; `bun run build` prüft nur Typen mit `tsc --noEmit`.
Einrichtung und Qualitätsgate: [Root-README](../../README.md).
Verbindliche Projektregeln: [AGENTS.md](../../AGENTS.md).

- `GET /health`: Liveness ohne Datenbankzugriff.
- `GET /api`: API-Demoantwort.
- `POST /api/users`: validierte Demo mit Formularlimit, Honeypot und optionalem
  Turnstile. Keine Speicherung, Anmeldung, E-Mail oder Tracking-Conversion.
- `src/schemas/` validiert Eingaben und Produktionskonfiguration. Origins werden
  exakt geprüft; Client-IPs stammen aus der konfigurierten vertrauenswürdigen Proxy-Kette.
- `src/lib/mail.ts` und die Tracking-Helfer sind serverinterne Bausteine. Ihre
  Konfiguration allein löst keinen Versand aus; kein öffentlicher Mailrelay-Endpunkt.
- `src/validate-env.ts` prüft die Umgebung ohne App-/DB-Start. In Produktion müssen
  beide Turnstile-Schlüssel gemeinsam gesetzt sein oder gemeinsam fehlen.

Vom Projektroot: `bun run dev:backend`. Aus diesem Verzeichnis: `bun run start`,
`bun run lint` und `bun run typecheck`. Dev/Start laden Root-`.env` ausdrücklich.
Ohne DB und Redis funktionieren Import, Start, Health und die Demo; erst eigene
persistente Routen benötigen PostgreSQL. `AppType` ist für späteres RPC exportiert.
