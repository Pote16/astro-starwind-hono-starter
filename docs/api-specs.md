# API-Spezifikation (Hono RPC)

## Übersicht

Das Backend (`apps/backend`) exponiert eine Hono-App mit RPC-fähigen Routen. Der Typ `AppType` wird am Entrypoint exportiert, damit das Astro-Frontend typisiert auf die API zugreifen kann.

## Konventionen

- Jede Route mit Eingabedaten: Validierung via Zod (oder vergleichbar).
- Stripe-Webhooks: Body als Roh-Text mit `context.req.text()` lesen und mit `stripe.webhooks.constructEventAsync()` verarbeiten (Signaturprüfung nicht brechen).
- Kein `console.log`; Logging ausschließlich über `@ho-setup/logger`.

## RPC-Export

```ts
// apps/backend/src/index.ts
export type AppType = typeof app;
```

Frontend-Client nutzt diesen Typ für vollständige Typisierung aller Endpunkte.
