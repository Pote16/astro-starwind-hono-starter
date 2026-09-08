import { fileURLToPath } from "node:url";

import { expect, test } from "bun:test";

async function validate(env: Record<string, string>) {
  const subprocess = Bun.spawn(
    [
      process.execPath,
      "--no-env-file",
      fileURLToPath(new URL("./validate-env.ts", import.meta.url)),
    ],
    { env, stdout: "pipe", stderr: "pipe" },
  );
  const [code, stdout, stderr] = await Promise.all([
    subprocess.exited,
    new Response(subprocess.stdout).text(),
    new Response(subprocess.stderr).text(),
  ]);
  return { code, stdout, stderr };
}

test("Deploy-Vorprüfung scheitert ohne Produktions-Origins und gibt keine Werte aus", async () => {
  const environments: Record<string, string>[] = [
    { NODE_ENV: "production" },
    { NODE_ENV: "production", FRONTEND_ORIGINS: "https://user:fixture-secret@example.com" },
    { NODE_ENV: "production", FRONTEND_ORIGINS: "https://example.com", PORT: "3005junk" },
  ];
  for (const env of environments) {
    const result = await validate(env);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Backend-Konfiguration ungültig");
    expect(result.stderr).not.toContain("fixture-secret");
    expect(result.stderr).not.toContain("3005junk");
  }
});

test("Deploy-Vorprüfung benötigt weder Datenbank- noch Redis-Konfiguration", async () => {
  const result = await validate({
    NODE_ENV: "production",
    FRONTEND_ORIGINS: "https://example.com",
  });
  expect(result.code).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("Backend-Konfiguration gültig");
});

test("Produktion verlangt beide Turnstile-Schlüssel gemeinsam und verrät keine Schlüssel", async () => {
  const base = { NODE_ENV: "production", FRONTEND_ORIGINS: "https://example.com" };
  for (const keys of [
    { PUBLIC_TURNSTILE_SITE_KEY: "public-fixture-key", TURNSTILE_SECRET_KEY: "" },
    { PUBLIC_TURNSTILE_SITE_KEY: "", TURNSTILE_SECRET_KEY: "private-fixture-key" },
  ]) {
    const result = await validate({ ...base, ...keys });
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("TURNSTILE_SECRET_KEY");
    expect(result.stderr).not.toContain("fixture-key");
    expect(result.stdout).toBe("");
  }
  for (const keys of [
    { PUBLIC_TURNSTILE_SITE_KEY: "", TURNSTILE_SECRET_KEY: "" },
    {
      PUBLIC_TURNSTILE_SITE_KEY: "public-fixture-key",
      TURNSTILE_SECRET_KEY: "private-fixture-key",
    },
  ]) {
    const result = await validate({ ...base, ...keys });
    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
  }
});
