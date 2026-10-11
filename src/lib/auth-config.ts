import { createFederatedAuth } from "@royer/auth/federation";
import { vercelSuiteSettings } from "@royer/auth/suite";
import { getVercelOidcToken } from "@vercel/functions/oidc";
import type { Pool } from "pg";

export class AccountUnavailable extends Error {}

const loopbackHosts = ["localhost", "127.0.0.1", "[::1]"];
const unavailable = "Account access is not configured yet.";

// An exact origin: HTTPS, or HTTP on loopback for local development.
function exactOrigin(value: string | undefined) {
  if (!value) throw new AccountUnavailable(unavailable);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AccountUnavailable(unavailable);
  }
  const loopback = loopbackHosts.includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" && !(url.protocol === "http:" && loopback))
  )
    throw new AccountUnavailable(
      "Account addresses must be exact HTTPS origins, or local development origins.",
    );
  return url;
}

type Environment = Readonly<Record<string, string | undefined>>;

/**
 * Todo signs in through the central Breakthrough account. Credentials,
 * verification mail, MFA and recovery live on the issuer; Todo keeps only
 * its own principal IDs, sessions and lists.
 */
export function authSettings(env: Environment = process.env) {
  const base = exactOrigin(env.AUTH_BASE_URL);
  if (base.pathname !== "/") throw new AccountUnavailable(unavailable);
  const secret = env.AUTH_SECRET;
  const clientId = env.AUTH_CLIENT_ID;
  const clientSecret = env.AUTH_CLIENT_SECRET;
  if (!secret || secret.length < 32 || !clientId || !clientSecret)
    throw new AccountUnavailable(unavailable);
  const issuer = exactOrigin(env.AUTH_ISSUER_URL);
  if (issuer.pathname !== "/api/auth" || issuer.href !== env.AUTH_ISSUER_URL)
    throw new AccountUnavailable(
      "The account issuer must be its exact origin plus /api/auth.",
    );
  return {
    baseURL: base.origin,
    secret,
    issuerURL: issuer.href,
    issuerOrigin: issuer.origin,
    clientId,
    clientSecret,
  };
}

/**
 * Whether this deployment offers accounts.
 * - "suite": on Vercel with a database and no operator registration. Todo is a suite app: its
 *   origin is its client ID and Vercel's OIDC token is its credential, so it needs no AUTH_*
 *   setting at all (royer-auth suite clients, October 2026).
 * - "on": an operator-registered client (AUTH_ISSUER_URL, AUTH_CLIENT_ID, AUTH_CLIENT_SECRET),
 *   kept as the fallback and for local development.
 * - "off": no database or not on Vercel, so the app runs browser-only and says accounts are coming soon.
 * - "invalid": some settings exist but cannot work; logged, and also browser-only.
 */
export type AccountMode = "suite" | "on" | "off" | "invalid";
const registration = [
  "AUTH_ISSUER_URL",
  "AUTH_CLIENT_ID",
  "AUTH_CLIENT_SECRET",
] as const;
export function accountMode(env: Environment = process.env): AccountMode {
  const registered = registration.some((name) => env[name]?.trim());
  if (!registered) {
    if (!env.DATABASE_URL?.trim()) return "off";
    return vercelSuiteSettings(env) ? "suite" : "off";
  }
  if (!env.DATABASE_URL?.trim()) return "invalid";
  try {
    authSettings(env);
    return "on";
  } catch {
    return "invalid";
  }
}

/**
 * The preview issuer sits behind Vercel Deployment Protection. Its Trusted
 * Sources rule admits this project's Preview deployments, which prove
 * themselves with a fresh Vercel OIDC token on every issuer request.
 */
export async function trustedSourceHeaders() {
  const token = await getVercelOidcToken();
  if (!token) throw new AccountUnavailable("Account access is unavailable.");
  return { "x-vercel-trusted-oidc-idp-token": token };
}

/**
 * Only Preview deployments talk to the protected preview issuer. Production
 * talks to the public production issuer, which needs no Vercel token, so
 * switching Production to it is only a settings change.
 */
export function needsTrustedSource(env: Environment = process.env) {
  return env.VERCEL === "1" && env.VERCEL_ENV === "preview";
}

/** Todo's own exact origin for this deployment. */
export function appOrigin(env: Environment = process.env) {
  if (accountMode(env) === "suite") {
    const suite = vercelSuiteSettings(env);
    if (suite) return suite.baseURL;
  }
  return authSettings(env).baseURL;
}

/** The Breakthrough account site this deployment signs in with. */
export function issuerOrigin(env: Environment = process.env) {
  if (accountMode(env) === "suite") {
    const suite = vercelSuiteSettings(env);
    if (suite) return new URL(suite.issuerURL).origin;
  }
  return authSettings(env).issuerOrigin;
}

export function configureAuth(database: Pool) {
  if (accountMode() === "suite") {
    const suite = vercelSuiteSettings();
    if (!suite) throw new AccountUnavailable(unavailable);
    // No client ID, client secret or AUTH_SECRET: the local key lives in Todo's own database.
    return createFederatedAuth({ appId: "todo", appName: "Todo", database, ...suite });
  }
  const settings = authSettings();
  const onVercel = process.env.VERCEL === "1";
  return createFederatedAuth({
    appId: "todo",
    appName: "Todo",
    baseURL: settings.baseURL,
    secret: settings.secret,
    database,
    issuerURL: settings.issuerURL,
    clientId: settings.clientId,
    clientSecret: settings.clientSecret,
    ...(needsTrustedSource()
      ? { issuerRequestHeaders: trustedSourceHeaders }
      : {}),
    ...(onVercel ? { ipAddress: { headers: ["x-vercel-forwarded-for"] } } : {}),
  });
}
