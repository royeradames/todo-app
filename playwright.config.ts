import { defineConfig } from "@playwright/test";
// The list needs no account, database or settings. Override the port when 4325 is taken.
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
    env: { NEXT_TELEMETRY_DISABLED: "1" },
    stdout: "ignore",
    stderr: "pipe",
  },
});
