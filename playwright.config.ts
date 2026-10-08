import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 180000,
  expect: { timeout: 20000 },
  reporter: "line",
  use: {
    baseURL: "http://localhost:4325",
    channel: "chrome",
    headless: true,
    screenshot: "off",
    trace: "off",
    video: "off",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:4325",
    timeout: 120000,
    reuseExistingServer: false,
    env: { TODO_LOCAL_TEST_MAIL: "1", NEXT_TELEMETRY_DISABLED: "1" },
    stdout: "ignore",
    stderr: "pipe",
  },
});
