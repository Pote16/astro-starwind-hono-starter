---
trigger: glob
description: Hono (RPC), Zod Validator und API Entwicklungsregeln für den Backend-Agenten
globs: "apps/backend/**/*.ts"
---

# Hono Backend Architektur

1. **Typisiertes RPC:**

- Das Backend nutzt Hono RPC. Exportiere immer den `AppType` am Ende des Entrypoints (`export type AppType = typeof app;`), damit das Astro-Frontend strikt typisiert auf die API zugreifen kann.
- Jede eingehende Route muss zwingend mit `zodValidator` (oder einer ähnlichen Schema-Validierung) abgesichert sein.

2. **Zod-Validierung in Hono-Routen:**

- Verwende `@hono/zod-validator` für die Validierung von Request Body, Query-Params und URL-Params.
- Definiere Schemas in separaten Dateien (`schemas/`) und importiere sie – keine Inline-Schemas in Route-Handlern.
- Validiere ALLE Eingabekanäle einer Route: `json`, `query`, `param`, `header` wo nötig.

```typescript
// ✅ Korrekt
import { zValidator } from "@hono/zod-validator";
import { createBookingSchema } from "../schemas/booking.schema";

app.post("/bookings", zValidator("json", createBookingSchema), async (c) => {
  const data = c.req.valid("json");
  // data ist jetzt typsicher validiert
});
```

3. **Error Handling:**

- Nutze Honos `HTTPException` für kontrollierte Fehler.
- Implementiere einen globalen `app.onError()` Handler, der Fehler mit Pino loggt und dem Client nur generische Fehlermeldungen zurückgibt.
- Gib bei Validierungsfehlern einen strukturierten Error-Response mit den Zod-Fehlermeldungen zurück (nur die Feldnamen und Fehlertexte, KEINE internen Details).

4. **Middleware-Reihenfolge:**

- Middleware-Reihenfolge: CORS → Rate Limiting → Auth → Validierung → Handler.
- Auth-Middleware MUSS vor den Route-Handlern stehen und den User-Context auf `c.set('user', ...)` setzen.

5. **Stripe Webhook Verarbeitung:**

- Verwende bei Stripe Webhooks NIEMALS `context.req.json()`.
- Um die Signaturprüfung nicht zu brechen, MUSS der Body als roher Text via `await context.req.text()` extrahiert und an die `stripe.webhooks.constructEventAsync()` Methode übergeben werden.

6. **Response-Format:**

- Nutze `c.json()` für JSON-Responses mit explizitem Statuscode: `c.json({ data }, 200)`.
- Verwende konsistente Response-Strukturen: `{ data: T }` für Erfolg, `{ error: { message: string, code: string } }` für Fehler.
