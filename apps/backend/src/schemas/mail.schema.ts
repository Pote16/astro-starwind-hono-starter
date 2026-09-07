import { z } from "zod";

const emailSchema = z.string().trim().max(320).email();
export const senderSchema = z
  .string()
  .trim()
  .max(400)
  .refine((value) => {
    if (/[\p{Cc}\p{Cf}]/u.test(value)) return false;
    const address = value.match(/^[^<>]+<([^<>]+)>$/)?.[1] ?? value;
    return emailSchema.safeParse(address).success;
  });
export const mailInputSchema = z.object({
  to: emailSchema.optional(),
  replyTo: emailSchema.optional(),
  subject: z.string().trim().min(1).max(1000),
  text: z.string().min(1).max(20000),
  fields: z
    .array(z.object({ label: z.string().max(100), value: z.string().max(5000) }))
    .max(30)
    .default([]),
});
export const mailSuccessSchema = z.object({
  data: z.object({ id: z.string().min(1).max(200) }),
  error: z.null().optional(),
});
export const mailRecipientSchema = emailSchema;
