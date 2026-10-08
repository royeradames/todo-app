import { defineConfig } from "@playwright/test";
// The public demo needs no account or database. Override the port when 4325 is taken.
const port = process.env.TODO_TEST_PORT ?? "4325";
const origin = `http://localhost:${port}`;
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 180000,
  expect: { timeout: 20000 },
  reporter: "line",
  use: {
    baseURL: origin,
    channel: "chrome",
    headless: true,
    screenshot: "off",
    trace: "off",
    video: "off",
  },
  webServer: {
    command: `next dev --hostname 127.0.0.1 --port ${port}`,
    url: origin,
    timeout: 120000,
    reuseExistingServer: false,
    // Synthetic account settings pointing at closed local ports, so the
    // browser checks see an unreachable issuer and store, never a real one.
    env: {
      NEXT_TELEMETRY_DISABLED: "1",
      AUTH_BASE_URL: origin,
      AUTH_SECRET: "synthetic-browser-check-secret-with-32-characters",
      AUTH_ISSUER_URL: "http://127.0.0.1:9/api/auth",
      AUTH_CLIENT_ID: "synthetic-browser-check",
      AUTH_CLIENT_SECRET: "synthetic-browser-check",
      DATABASE_URL: "postgresql://synthetic@127.0.0.1:9/unavailable",
      DATABASE_URL_UNPOOLED: "postgresql://synthetic@127.0.0.1:9/unavailable",
    },
    stdout: "ignore",
    stderr: "pipe",
  },
});
