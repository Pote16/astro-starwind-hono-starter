import { fileURLToPath } from "node:url";

import { expect, test } from "bun:test";

// Ein fehlender optionaler Redis-Peer fiel erst beim Modulimport auf. Build und
// Typprüfung erkannten den Fehler nicht, obwohl auch der Memory-Modus blockierte.
test("Backend und DB-Modul laden ohne laufende Datenbank oder Redis", async () => {
  const subprocess = Bun.spawn(
    [
      process.execPath,
      "--no-env-file",
      "--eval",
      `import backend from "./src/index.ts";
       await import("@ho-setup/db");
       const response = await backend.fetch(new Request("http://localhost/health"));
       if (response.status !== 200) process.exit(1);
       process.stdout.write(await response.text());`,
    ],
    {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      env: {
        NODE_ENV: "production",
        LOG_LEVEL: "silent",
        FRONTEND_ORIGINS: "https://example.com",
        DATABASE_URL: "postgres://fixture:fixture@127.0.0.1:1/unused",
      },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  try {
    const [code, stdout, stderr] = await Promise.all([
      subprocess.exited,
      new Response(subprocess.stdout).text(),
      new Response(subprocess.stderr).text(),
    ]);
    expect(code, stderr).toBe(0);
    expect(stderr).toBe("");
    expect(JSON.parse(stdout)).toMatchObject({ status: "ok" });
  } finally {
    if (subprocess.exitCode === null) subprocess.kill();
  }
});
