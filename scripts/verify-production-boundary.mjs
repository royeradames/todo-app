import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { mkdir, open, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { createServer } from "node:net";
const origin = "http://localhost:4326";
await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once("error", reject);
  probe.listen(4326, "127.0.0.1", () =>
    probe.close((error) => (error ? reject(error) : resolve())),
  );
});
await mkdir(".test-state", { recursive: true });
const log = await open(".test-state/production-server.log", "w");
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "4326",
  ],
  {
    env: {
      ...process.env,
      NODE_ENV: "production",
      NEXT_TELEMETRY_DISABLED: "1",
      AUTH_BASE_URL: origin,
      AUTH_SECRET: randomBytes(32).toString("hex"),
      TODO_LOCAL_TEST_MAIL: "1",
      DATABASE_URL: "",
      DATABASE_URL_UNPOOLED: "",
      RESEND_API_KEY: "",
      AUTH_EMAIL_FROM: "",
    },
    stdio: ["ignore", log.fd, log.fd],
    detached: true,
  },
);
let started = false;
try {
  for (let index = 0; index < 120; index++) {
    if (server.exitCode !== null)
      throw new Error("Production server did not start");
    try {
      if ((await fetch(origin, { signal: AbortSignal.timeout(1000) })).ok) {
        started = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.equal(started, true);
  const result = [];
  for (const [path, expected] of [
    ["/", 200],
    ["/api/test-mail", 404],
    ["/api/auth/get-session", 503],
    ["/api/todos", 503],
  ]) {
    const response = await fetch(origin + path, { redirect: "manual" });
    assert.equal(response.status, expected, `Expected status for ${path}`);
    assert.equal(
      response.headers.has("set-cookie"),
      false,
      "No unconfigured auth cookie",
    );
    if (path === "/") assert.ok((await response.text()).includes("Todo demo"));
    result.push({ path, status: response.status, sessionCookie: false });
  }
  await writeFile(
    ".test-state/production-boundary.json",
    JSON.stringify(
      {
        passed: true,
        packageReleaseHold: true,
        databaseConfigured: false,
        mailConfigured: false,
        localMailFlagStillSet: true,
        checks: result,
        time: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(
    "Production boundary passed: public demo, hidden test mail, unconfigured auth/data fail closed.",
  );
} finally {
  if (server.exitCode === null && server.pid) {
    const ended = once(server, "exit");
    process.kill(-server.pid, "SIGTERM");
    const timeout = setTimeout(() => {
      try {
        process.kill(-server.pid, "SIGKILL");
      } catch {}
    }, 5000);
    await ended;
    clearTimeout(timeout);
  }
  await log.close();
}
