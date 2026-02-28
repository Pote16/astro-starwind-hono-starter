---
trigger: always_on
description: Sicherheitsvorgaben für den Antigravity Agent, inkl. Validierung und Secrets
globs: "*"
---

# Sicherheit

1. **Input-Validierung (Defense in Depth):**

- JEDER externe Input (Request Body, Query-Parameter, URL-Params, FormData, Headers, Cookies) MUSS serverseitig mit Zod validiert werden, bevor er verarbeitet wird.
- Vertraue NIEMALS Client-seitige Validierung als einzige Absicherung. Client-Validierung dient nur der UX – die echte Validierung passiert auf dem Server.
- Validiere Datentypen, Längen, Formate und erlaubte Wertebereiche explizit (z. B. `z.string().max(255).email()`, `z.number().int().positive()`).

2. **Authentifizierung & Autorisierung:**

- Prüfe in JEDER geschützten Route, ob ein gültiger Session-Token existiert, und ob der Benutzer die Berechtigung für die angeforderte Ressource hat.
- Implementiere NIEMALS eigene Krypto- oder Hashing-Logik. Nutze etablierte Bibliotheken (z. B. `better-auth`, `bcrypt`, `@node-rs/argon2`).
- Sensible Operationen (Löschen, Rollenänderung, Bezahlung) benötigen zusätzliche Autorisierungsprüfungen – nicht nur eine Session-Prüfung.

3. **Secrets & Umgebungsvariablen:**

- Secrets (API-Keys, DB-Credentials, Webhook-Secrets) gehören AUSSCHLIESSLICH in `.env`-Dateien und werden via `import.meta.env` / `process.env` geladen.
- `.env`-Dateien dürfen NIEMALS committed werden. Stelle sicher, dass sie in `.gitignore` stehen.
- Gib NIEMALS Secrets in Fehlermeldungen, Logs oder Client-Responses preis.

4. **SQL Injection & Datenbank-Sicherheit:**

- Nutze ausschließlich den Prisma ORM Client für Datenbankabfragen. Bei unvermeidbarem Raw-SQL MUSS `$queryRaw` mit Template-Literals (automatisches Escaping) verwendet werden – NIEMALS String-Konkatenation.
- Begrenze Abfrageergebnisse mit `take` / `LIMIT`, um DoS durch exzessive Datenmengen zu verhindern.

5. **XSS-Prävention:**

- Astro escaped HTML-Output standardmäßig. Verwende NIEMALS `set:html` mit User-Input.
- Wenn dynamischer HTML-Content unvermeidbar ist, sanitize ihn vorher mit einer Bibliothek wie `DOMPurify`.

6. **CSRF & Request-Integrität:**

- Für zustandsändernde Operationen (POST/PUT/DELETE) MUSS ein CSRF-Token oder Origin-Check implementiert sein.
- Nutze bei Astro Actions das integrierte CSRF-Schutz-System (`astro:actions`).

7. **Rate Limiting:**

- Öffentliche Endpoints (Login, Registrierung, Kontaktformulare) MÜSSEN Rate-Limiting haben, um Brute-Force und Spam zu verhindern.

8. **Error Handling:**

- Gib NIEMALS interne Fehlerdetails (Stack-Traces, DB-Fehlermeldungen, Dateipfade) an den Client zurück.
- Logge den vollständigen Fehler serverseitig mit Pino, sende dem Client nur eine generische Fehlermeldung mit einer Referenz-ID.
