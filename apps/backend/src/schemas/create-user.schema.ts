import { z } from "zod";

import { formProtectionSchema } from "./turnstile.schema.js";

export const createUserSchema = formProtectionSchema.extend({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().max(255).email(),
  age: z.number().int().positive().max(150).optional(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;
