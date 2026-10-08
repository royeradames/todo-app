import { defineConfig } from "@playwright/test";
// Runs against the deployed protected previews. No local server or database.
export default defineConfig({
  testDir: "./tests/hosted",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 240_000,
  expect: { timeout: 20_000 },
  reporter: [["line"]],
  outputDir: "test-results-hosted",
  use: {
    channel: process.env.PLAYWRIGHT_CHANNEL === "chromium" ? undefined : "chrome",
    headless: true,
    screenshot: "only-on-failure",
    trace: "off",
    video: "off",
  },
});
