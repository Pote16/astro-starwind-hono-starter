import { logger } from "@ho-setup/logger";
import { Resend } from "resend";

import {
  mailInputSchema,
  mailRecipientSchema,
  mailSuccessSchema,
  senderSchema,
} from "../schemas/mail.schema.js";

export interface MailPayload {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}
export type MailResult =
  | { status: "sent"; id: string }
  | { status: "skipped"; reason: "missing_api_key" | "missing_sender" | "missing_recipient" }
  | {
      status: "failed";
      reason: "invalid_input" | "invalid_configuration" | "provider_error" | "network_error";
    };
interface MailOptions {
  apiKey?: string;
  from?: string;
  recipient?: string;
  send?: (payload: MailPayload) => Promise<unknown>;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function sanitizeSubject(text: string): string {
  return text
    .replace(/[\p{Cc}\p{Cf}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

/** Serverinterner Helfer. Empfänger niemals ungeprüft aus einem öffentlichen Formular übernehmen. */
export function createMailSender(options: MailOptions = {}) {
  let client: Resend | undefined;
  return async (input: unknown): Promise<MailResult> => {
    const apiKey = (options.apiKey ?? process.env.RESEND_API_KEY)?.trim();
    const from = (options.from ?? process.env.RESEND_FROM_EMAIL)?.trim();
    if (!apiKey) return { status: "skipped", reason: "missing_api_key" };
    if (!from) return { status: "skipped", reason: "missing_sender" };
    const parsed = mailInputSchema.safeParse(input);
    if (!parsed.success) return { status: "failed", reason: "invalid_input" };
    const recipient = parsed.data.to ?? (options.recipient ?? process.env.MAIL_RECIPIENT)?.trim();
    if (!recipient) return { status: "skipped", reason: "missing_recipient" };
    const sender = senderSchema.safeParse(from);
    const receiver = mailRecipientSchema.safeParse(recipient);
    if (!sender.success || !receiver.success)
      return { status: "failed", reason: "invalid_configuration" };
    const data = parsed.data;
    const subject = sanitizeSubject(data.subject);
    if (!subject) return { status: "failed", reason: "invalid_input" };
    const fields = data.fields
      .map((field) => `<dt>${escapeHtml(field.label)}</dt><dd>${escapeHtml(field.value)}</dd>`)
      .join("");
    const payload: MailPayload = {
      from: sender.data,
      to: [receiver.data],
      subject,
      html: `<!doctype html><html><body><h1>${escapeHtml(subject)}</h1><p>${escapeHtml(data.text).replace(/\n/g, "<br>")}</p>${fields ? `<dl>${fields}</dl>` : ""}</body></html>`,
      text: [data.text, ...data.fields.map((field) => `${field.label}: ${field.value}`)].join(
        "\n\n",
      ),
      ...(data.replyTo ? { replyTo: data.replyTo } : {}),
    };
    try {
      const answer = options.send
        ? await options.send(payload)
        : await (client ??= new Resend(apiKey)).emails.send(payload);
      const result = mailSuccessSchema.safeParse(answer);
      if (!result.success) {
        // Anbieterfehler können Adressen oder den Request enthalten. Nur feste Codes loggen.
        logger.warn({ reason: "provider_error" }, "E-Mail-Versand fehlgeschlagen");
        return { status: "failed", reason: "provider_error" };
      }
      return { status: "sent", id: result.data.data.id };
    } catch {
      logger.warn({ reason: "network_error" }, "E-Mail-Versand fehlgeschlagen");
      return { status: "failed", reason: "network_error" };
    }
  };
}

/** Ohne Konfiguration entsteht weder ein SDK-Client noch ein Request. */
export const sendMail = createMailSender();
