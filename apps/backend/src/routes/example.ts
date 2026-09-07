import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { FORM_TEXTS } from "../lib/form-texts.js";
import { createFormRateLimitMiddleware } from "../middleware/rate-limit.js";
import { createTurnstileMiddleware, type TurnstileOptions } from "../middleware/turnstile.js";
import type { BackendEnvironment } from "../schemas/backend-env.schema.js";
import { type CreateUserInput, createUserSchema } from "../schemas/create-user.schema.js";
import { formProtectionSchema } from "../schemas/turnstile.schema.js";

function demoResponse(data: CreateUserInput) {
  return {
    success: true,
    message: FORM_TEXTS[data.language].demo,
    data: {
      name: data.name,
      email: data.email,
      ...(data.age !== undefined ? { age: data.age } : {}),
    },
  };
}

export function createExampleRouter(
  environment: BackendEnvironment,
  options: Pick<TurnstileOptions, "secret" | "fetcher"> = {},
) {
  return new Hono()
    .get("/", (c) => c.json({ message: "Welcome to the Astro+Hono-Setup API", status: "healthy" }))
    .post(
      "/users",
      createFormRateLimitMiddleware(environment),
      zValidator("json", createUserSchema, (result, c) => {
        if (!result.success) {
          const protection = formProtectionSchema.safeParse(result.data);
          const language = protection.success ? protection.data.language : "de";
          return c.json(
            { error: { code: "VALIDATION_ERROR", message: FORM_TEXTS[language].validation } },
            400,
          );
        }
      }),
      createTurnstileMiddleware("create_user", {
        ...options,
        origins: environment.frontendOrigins,
        honeypotResponse: async (c) =>
          c.json(demoResponse(createUserSchema.parse(await c.req.json<unknown>())), 201),
      }),
      (c) => {
        // Bewusste Demo: weder Persistierung noch Mail- oder Trackingversand.
        return c.json(demoResponse(c.req.valid("json")), 201);
      },
    );
}
