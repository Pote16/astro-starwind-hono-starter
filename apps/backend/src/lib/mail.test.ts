import { logger } from "@ho-setup/logger";
import { expect, spyOn, test } from "bun:test";

import { createMailSender, escapeHtml, type MailPayload } from "./mail.js";

const configured = {
  apiKey: "test-key",
  from: "Starter <sender@example.org>",
  recipient: "inbox@example.org",
};
const input = {
  subject: "Neue Anfrage",
  text: "Nachricht",
  fields: [{ label: "Name", value: "Example" }],
};

test("fehlende Mail-Konfiguration überspringt ohne Provider-Aufruf", async () => {
  let calls = 0;
  for (const [config, reason] of [
    [{ ...configured, apiKey: "" }, "missing_api_key"],
    [{ ...configured, from: "" }, "missing_sender"],
    [{ ...configured, recipient: "" }, "missing_recipient"],
  ] as const) {
    const send = createMailSender({
      ...config,
      send: async () => {
        calls++;
        return {};
      },
    });
    expect(await send(input)).toEqual({ status: "skipped", reason });
  }
  expect(calls).toBe(0);
});

test("Mailtexte und Felder werden escaped, Betreff bereinigt und nur serverseitige Empfänger verwendet", async () => {
  const sent: MailPayload[] = [];
  const send = createMailSender({
    ...configured,
    send: async (payload) => {
      sent.push(payload);
      return { data: { id: "mail-id" }, error: null };
    },
  });
  expect(
    await send({
      subject: "Titel\r\nBcc: hidden@example.org",
      text: '<script>alert("test")</script>\nHallo',
      fields: [{ label: "<img src=x>", value: "\"&'<strong>Inhalt</strong>" }],
      replyTo: "reply@example.org",
    }),
  ).toEqual({ status: "sent", id: "mail-id" });
  expect(sent[0]?.to).toEqual(["inbox@example.org"]);
  expect(sent[0]?.replyTo).toBe("reply@example.org");
  expect(sent[0]?.subject).not.toMatch(/[\r\n]/);
  expect(sent[0]?.html).not.toContain("<script>");
  expect(sent[0]?.html).not.toContain("<img src=x>");
  expect(sent[0]?.html).toContain("&lt;script&gt;");
  expect(sent[0]?.html).toContain("&quot;&amp;&#39;&lt;strong&gt;");
  expect(sent[0]?.text).toContain('<script>alert("test")</script>');
  expect(escapeHtml("&<>\"'")).toBe("&amp;&lt;&gt;&quot;&#39;");
});

test("ungültige Maildaten erreichen keinen Provider", async () => {
  let calls = 0;
  const send = createMailSender({
    ...configured,
    send: async () => {
      calls++;
      return {};
    },
  });
  for (const data of [
    null,
    { ...input, to: "bad" },
    { ...input, replyTo: "x@example.org\r\nBcc: y@example.org" },
    { ...input, text: "x".repeat(20001) },
  ]) {
    expect(await send(data)).toEqual({ status: "failed", reason: "invalid_input" });
  }
  expect(calls).toBe(0);
});

test("Providerfehler und Exceptions verlassen den Helfer ohne PII, Secrets oder Stacktraces", async () => {
  const logs = spyOn(logger, "warn").mockImplementation(() => {});
  try {
    for (const transport of [
      async () => ({
        data: null,
        error: { name: "Bad request", message: "user@example.org test-key secret" },
      }),
      async () => {
        throw new Error("user@example.org test-key secret");
      },
      async () => ({ data: null, error: null }),
    ]) {
      const result = await createMailSender({ ...configured, send: transport })(input);
      expect(result.status).toBe("failed");
      expect(JSON.stringify(result)).not.toContain("user@example.org");
    }
    const logged = JSON.stringify(logs.mock.calls);
    expect(logged).not.toContain("user@example.org");
    expect(logged).not.toContain("test-key");
    expect(logged).not.toContain("secret");
  } finally {
    logs.mockRestore();
  }
});
