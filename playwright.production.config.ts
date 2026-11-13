import { defineConfig } from "@playwright/test";
// Runs the production build exactly as Vercel Production does today: no
// account issuer, no client registration and no database. Build first with
// `npm run build`. Override the port when 4327 is taken.
const port = process.env.TODO_PRODUCTION_TEST_PORT ?? "4327";
const origin = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "./tests/production",
  fullyParallel: false,
  workers: 1,
  timeout: 120000,
  expect: { timeout: 15000 },
  reporter: "line",
  outputDir: "test-results-production",
  use: {
    baseURL: origin,
    channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
    headless: true,
    screenshot: "off",
    trace: "off",
    video: "off",
  },
  webServer: {
    command: `next start --hostname 127.0.0.1 --port ${port}`,
    url: origin,
    timeout: 60000,
    reuseExistingServer: false,
    env: {
      NODE_ENV: "production",
      NEXT_TELEMETRY_DISABLED: "1",
      AUTH_BASE_URL: "",
      AUTH_SECRET: "",
      AUTH_ISSUER_URL: "",
      AUTH_CLIENT_ID: "",
      AUTH_CLIENT_SECRET: "",
      DATABASE_URL: "",
      DATABASE_URL_UNPOOLED: "",
    },
    stdout: "ignore",
    stderr: "pipe",
  },
});
