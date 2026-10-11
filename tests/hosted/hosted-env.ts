import type { BrowserContext } from "@playwright/test";

// Supplied by the runner's private environment. Values never reach test
// output: they are attached only through per-origin request routing and a
// fetch wrapper whose errors carry no headers.
function origin(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error("Set " + name + " for the hosted suite");
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error(name + " must be HTTPS");
  return url.origin;
}
export const todoOrigin = origin("TODO_PREVIEW_URL");
export const accountsOrigin = origin(
  "ACCOUNTS_PREVIEW_URL",
  "https://accounts-preview.royeradames.com",
);
const secrets = new Map([
  [todoOrigin, process.env.TODO_PREVIEW_BYPASS ?? ""],
  [accountsOrigin, process.env.ACCOUNTS_PREVIEW_BYPASS ?? ""],
]);
const sinkToken = process.env.AUTH_PREVIEW_SINK_TOKEN ?? "";
// Optional (royer-auth #41): the preview issuer gives a run that proves this
// token its own rate-limit budget, so runs on one Mac don't spend each
// other's. Sent only to the issuer, with a fresh run id per run.
const testToken = process.env.AUTH_PREVIEW_TEST_TOKEN ?? "";
const issuerTestHeaders: Record<string, string> = testToken
  ? {
      "x-preview-test-token": testToken,
      "x-preview-test-run": "run-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    }
  : {};
if (!sinkToken || [...secrets.values()].some((value) => !value))
  throw new Error(
    "Set TODO_PREVIEW_BYPASS, ACCOUNTS_PREVIEW_BYPASS and AUTH_PREVIEW_SINK_TOKEN for the hosted suite",
  );

/**
 * Adds each project's protection bypass only to requests for its own origin.
 * The bypass cookie it sets also covers page.request calls, which routes do
 * not intercept; cookies stay scoped to their host.
 */
export async function authorizePreviews(context: BrowserContext) {
  await context.route(
    (url) => secrets.has(url.origin),
    async (route) => {
      const bypass = secrets.get(new URL(route.request().url()).origin) ?? "";
      await route.continue({
        headers: {
          ...route.request().headers(),
          "x-vercel-protection-bypass": bypass,
          "x-vercel-set-bypass-cookie": "true",
          ...(new URL(route.request().url()).origin === accountsOrigin ? issuerTestHeaders : {}),
        },
      });
    },
  );
}

/** Reads the issuer's synthetic preview mailbox. Failures never echo secrets. */
export function readSink(address: string) {
  return sink(address, "GET");
}
/** Removes a synthetic .test account and its sink mail from the issuer. */
export function removeSyntheticAccount(address: string) {
  return sink(address, "DELETE");
}
async function sink(address: string, method: "GET" | "DELETE") {
  const url = new URL("/api/preview-mail?to=" + encodeURIComponent(address), accountsOrigin);
  try {
    return await fetch(url, {
      method,
      headers: {
        "x-vercel-protection-bypass": secrets.get(accountsOrigin) ?? "",
        authorization: "Bearer " + sinkToken,
        ...issuerTestHeaders,
      },
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error("Preview mailbox request failed");
  }
}
